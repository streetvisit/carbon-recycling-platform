import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { 
  gapAnalysisEngine, 
  type GapAnalysisInput, 
  type GapAnalysisResult 
} from '@carbon-recycling/uk-gov-data/gap-analysis-engine';

export interface CreateGapAnalysisDto {
  organizationId: string;
  sector: string;
  sicCode?: string;
  employeeCount?: number;
  revenue?: number;
  location?: string;
  reportingYear: number;
  businessActivities?: string[];
}

@Injectable()
export class GapAnalysisService {
  private readonly logger = new Logger(GapAnalysisService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Perform gap analysis for an organization
   */
  async performGapAnalysis(organizationId: string, data?: Partial<CreateGapAnalysisDto>): Promise<GapAnalysisResult> {
    this.logger.log(`Performing gap analysis for organization: ${organizationId}`);

    try {
      // Get organization details
      const organization = await this.prisma.organization.findUnique({
        where: { id: organizationId },
        include: {
          emissions: {
            orderBy: { reportingYear: 'desc' },
            take: 1
          }
        }
      });

      if (!organization) {
        throw new Error(`Organization not found: ${organizationId}`);
      }

      // Get latest emissions data
      const latestEmissions = organization.emissions[0];
      if (!latestEmissions) {
        throw new Error(`No emissions data found for organization: ${organizationId}`);
      }

      // Prepare analysis input
      const input: GapAnalysisInput = {
        organizationId,
        sector: data?.sector || organization.sector || 'unknown',
        sicCode: data?.sicCode || organization.sicCode,
        employeeCount: data?.employeeCount || organization.employeeCount,
        revenue: data?.revenue || organization.annualRevenue,
        location: data?.location || organization.location,
        reportingYear: data?.reportingYear || latestEmissions.reportingYear,
        currentEmissions: {
          scope1: latestEmissions.scope1Emissions.toNumber(),
          scope2: latestEmissions.scope2Emissions.toNumber(),
          scope3: latestEmissions.scope3Emissions?.toNumber() || 0,
          total: latestEmissions.totalEmissions.toNumber()
        },
        businessActivities: data?.businessActivities || []
      };

      // Perform analysis
      const result = await gapAnalysisEngine.analyzeGaps(input);

      // Save results to database
      await this.saveGapAnalysisResults(result);

      this.logger.log(`Gap analysis completed for organization: ${organizationId}`);
      return result;

    } catch (error) {
      this.logger.error(`Gap analysis failed for organization ${organizationId}:`, error);
      throw error;
    }
  }

  /**
   * Get latest gap analysis for an organization
   */
  async getLatestGapAnalysis(organizationId: string) {
    return this.prisma.gapAnalysis.findFirst({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      include: {
        benchmarks: true,
        complianceGaps: true,
        recommendations: true
      }
    });
  }

  /**
   * Get gap analysis history for an organization
   */
  async getGapAnalysisHistory(organizationId: string, limit: number = 10) {
    return this.prisma.gapAnalysis.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        benchmarks: true,
        complianceGaps: true,
        recommendations: true
      }
    });
  }

  /**
   * Get recommendations by category for an organization
   */
  async getRecommendationsByCategory(organizationId: string, category?: string) {
    const latestAnalysis = await this.getLatestGapAnalysis(organizationId);
    
    if (!latestAnalysis) {
      return [];
    }

    const whereClause = category 
      ? { gapAnalysisId: latestAnalysis.id, category }
      : { gapAnalysisId: latestAnalysis.id };

    return this.prisma.gapAnalysisRecommendation.findMany({
      where: whereClause,
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ]
    });
  }

  /**
   * Mark recommendation as implemented
   */
  async markRecommendationImplemented(recommendationId: string, notes?: string) {
    return this.prisma.gapAnalysisRecommendation.update({
      where: { id: recommendationId },
      data: {
        status: 'IMPLEMENTED',
        implementationNotes: notes,
        implementedAt: new Date()
      }
    });
  }

  /**
   * Get compliance gaps by priority
   */
  async getComplianceGapsByPriority(organizationId: string, priority?: 'HIGH' | 'MEDIUM' | 'LOW') {
    const latestAnalysis = await this.getLatestGapAnalysis(organizationId);
    
    if (!latestAnalysis) {
      return [];
    }

    const whereClause = priority 
      ? { gapAnalysisId: latestAnalysis.id, priority }
      : { gapAnalysisId: latestAnalysis.id };

    return this.prisma.complianceGap.findMany({
      where: whereClause,
      orderBy: [
        { priority: 'desc' },
        { deadline: 'asc' }
      ]
    });
  }

  /**
   * Update compliance gap status
   */
  async updateComplianceGapStatus(gapId: string, status: 'COMPLIANT' | 'PARTIAL' | 'NON_COMPLIANT') {
    return this.prisma.complianceGap.update({
      where: { id: gapId },
      data: {
        currentStatus: status,
        updatedAt: new Date()
      }
    });
  }

  /**
   * Schedule automatic gap analysis
   */
  async scheduleAutomaticAnalysis(organizationId: string, frequency: 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY') {
    return this.prisma.gapAnalysisSchedule.upsert({
      where: { organizationId },
      update: {
        frequency,
        isActive: true,
        updatedAt: new Date()
      },
      create: {
        organizationId,
        frequency,
        isActive: true,
        nextRunDate: this.calculateNextRunDate(frequency)
      }
    });
  }

  /**
   * Run scheduled gap analyses
   */
  async runScheduledAnalyses() {
    const scheduledAnalyses = await this.prisma.gapAnalysisSchedule.findMany({
      where: {
        isActive: true,
        nextRunDate: {
          lte: new Date()
        }
      },
      include: {
        organization: true
      }
    });

    for (const schedule of scheduledAnalyses) {
      try {
        await this.performGapAnalysis(schedule.organizationId);
        
        // Update next run date
        await this.prisma.gapAnalysisSchedule.update({
          where: { id: schedule.id },
          data: {
            nextRunDate: this.calculateNextRunDate(schedule.frequency),
            lastRunDate: new Date()
          }
        });

        this.logger.log(`Scheduled gap analysis completed for organization: ${schedule.organizationId}`);
      } catch (error) {
        this.logger.error(`Scheduled gap analysis failed for organization ${schedule.organizationId}:`, error);
      }
    }
  }

  /**
   * Save gap analysis results to database
   */
  private async saveGapAnalysisResults(result: GapAnalysisResult) {
    // Create the main gap analysis record
    const gapAnalysis = await this.prisma.gapAnalysis.create({
      data: {
        organizationId: result.organizationId,
        analysisDate: new Date(result.analysisDate),
        overallScore: result.overallScore.toUpperCase(),
        nextAnalysisDate: new Date(result.nextAnalysisDate),
        dataSources: result.dataSources
      }
    });

    // Save benchmarks
    const benchmarkPromises = Object.entries(result.benchmarks).map(([type, benchmark]) =>
      this.prisma.benchmarkComparison.create({
        data: {
          gapAnalysisId: gapAnalysis.id,
          benchmarkType: type.toUpperCase(),
          metric: benchmark.metric.toUpperCase(),
          yourValue: benchmark.yourValue,
          benchmarkValue: benchmark.benchmarkValue,
          percentageDifference: benchmark.percentageDifference,
          performance: benchmark.performance.toUpperCase(),
          unit: benchmark.unit,
          context: benchmark.context
        }
      })
    );

    // Save compliance gaps
    const gapPromises = result.complianceGaps.map(gap =>
      this.prisma.complianceGap.create({
        data: {
          gapAnalysisId: gapAnalysis.id,
          regulation: gap.regulation,
          requirement: gap.requirement,
          currentStatus: gap.currentStatus.toUpperCase(),
          gapDescription: gap.gapDescription,
          priority: gap.priority.toUpperCase(),
          deadline: gap.deadline ? new Date(gap.deadline) : null,
          actionRequired: gap.actionRequired
        }
      })
    );

    // Save recommendations
    const recommendationPromises = result.recommendations.map(rec =>
      this.prisma.gapAnalysisRecommendation.create({
        data: {
          gapAnalysisId: gapAnalysis.id,
          externalId: rec.id,
          category: rec.category.toUpperCase(),
          priority: rec.priority.toUpperCase(),
          title: rec.title,
          description: rec.description,
          estimatedEmissionReduction: rec.estimatedImpact.emissionReduction || null,
          estimatedCostSaving: rec.estimatedImpact.costSaving || null,
          complianceImprovement: rec.estimatedImpact.complianceImprovement || null,
          implementationTime: rec.implementationTime,
          difficulty: rec.difficulty.toUpperCase(),
          dataSource: rec.dataSource,
          status: 'PENDING'
        }
      })
    );

    // Execute all promises
    await Promise.all([
      ...benchmarkPromises,
      ...gapPromises,
      ...recommendationPromises
    ]);

    return gapAnalysis;
  }

  /**
   * Calculate next run date based on frequency
   */
  private calculateNextRunDate(frequency: 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY'): Date {
    const nextDate = new Date();
    
    switch (frequency) {
      case 'MONTHLY':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case 'QUARTERLY':
        nextDate.setMonth(nextDate.getMonth() + 3);
        break;
      case 'ANNUALLY':
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        break;
    }
    
    return nextDate;
  }
}