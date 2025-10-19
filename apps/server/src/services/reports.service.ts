import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Report } from '../entities/report.entity';
import { Organization } from '../entities/organization.entity';
import { EmailService } from './email.service';
import { FileStorageService } from './file-storage.service';
import { ReportType, ReportStatus, ReportFormat, ReportFrequency } from '../controllers/reports.controller';

// Interfaces
interface CreateReportDto {
  title: string;
  description?: string;
  type: ReportType;
  startDate: string;
  endDate: string;
  format?: ReportFormat;
  configuration?: any;
  customization?: any;
  isScheduled?: boolean;
  frequency?: ReportFrequency;
}

interface UpdateReportDto {
  title?: string;
  description?: string;
  type?: ReportType;
  startDate?: string;
  endDate?: string;
  format?: ReportFormat;
  configuration?: any;
  customization?: any;
  isScheduled?: boolean;
  frequency?: ReportFrequency;
}

interface QueryReportsDto {
  page?: number;
  limit?: number;
  search?: string;
  type?: ReportType;
  status?: ReportStatus;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  dateFrom?: string;
  dateTo?: string;
}

interface ShareReportDto {
  emails: string[];
  message?: string;
  allowDownload?: boolean;
  expiresAt?: string;
}

interface ScheduleReportDto {
  frequency: ReportFrequency;
  startDate: string;
  cronExpression?: string;
  schedulingOptions?: any;
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    @InjectQueue('report-generation')
    private readonly reportQueue: Queue,
    private readonly emailService: EmailService,
    private readonly fileStorageService: FileStorageService,
  ) {}

  async findAll(organizationId: string, query: QueryReportsDto) {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        type,
        status,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        dateFrom,
        dateTo
      } = query;

      const queryBuilder = this.reportRepository
        .createQueryBuilder('report')
        .where('report.organizationId = :organizationId', { organizationId })
        .andWhere('report.deletedAt IS NULL');

      // Apply search filter
      if (search) {
        queryBuilder.andWhere(
          '(report.title ILIKE :search OR report.description ILIKE :search)',
          { search: `%${search}%` }
        );
      }

      // Apply type filter
      if (type) {
        queryBuilder.andWhere('report.type = :type', { type });
      }

      // Apply status filter
      if (status) {
        queryBuilder.andWhere('report.status = :status', { status });
      }

      // Apply date filters
      if (dateFrom) {
        queryBuilder.andWhere('report.startDate >= :dateFrom', { dateFrom });
      }
      if (dateTo) {
        queryBuilder.andWhere('report.endDate <= :dateTo', { dateTo });
      }

      // Apply sorting
      const validSortFields = ['title', 'type', 'status', 'createdAt', 'updatedAt'];
      const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
      queryBuilder.orderBy(`report.${sortField}`, sortOrder.toUpperCase() as 'ASC' | 'DESC');

      // Apply pagination
      const skip = (page - 1) * limit;
      queryBuilder.skip(skip).take(limit);

      const [reports, total] = await queryBuilder.getManyAndCount();

      return {
        data: reports,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error(`Failed to retrieve reports for organization ${organizationId}:`, error);
      throw new BadRequestException('Failed to retrieve reports');
    }
  }

  async findOne(id: string, organizationId: string): Promise<Report> {
    const report = await this.reportRepository.findOne({
      where: {
        id,
        organizationId,
        deletedAt: null,
      },
      relations: ['organization'],
    });

    if (!report) {
      throw new NotFoundException(`Report with ID ${id} not found`);
    }

    return report;
  }

  async create(
    createReportDto: CreateReportDto,
    organizationId: string,
    userId: string,
  ): Promise<Report> {
    try {
      // Verify organization exists
      const organization = await this.organizationRepository.findOne({
        where: { id: organizationId },
      });

      if (!organization) {
        throw new NotFoundException(`Organization with ID ${organizationId} not found`);
      }

      // Validate date range
      const startDate = new Date(createReportDto.startDate);
      const endDate = new Date(createReportDto.endDate);
      
      if (startDate >= endDate) {
        throw new BadRequestException('Start date must be before end date');
      }

      // Create report
      const report = this.reportRepository.create({
        ...createReportDto,
        organizationId,
        status: ReportStatus.DRAFT,
        createdBy: userId,
        format: createReportDto.format || ReportFormat.PDF,
        isScheduled: createReportDto.isScheduled || false,
        configuration: createReportDto.configuration || this.getDefaultConfiguration(createReportDto.type),
        customization: createReportDto.customization || {},
      });

      const savedReport = await this.reportRepository.save(report);

      this.logger.log(`Report created: ${savedReport.id} by user: ${userId}`);

      return savedReport;
    } catch (error) {
      this.logger.error(`Failed to create report:`, error);
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to create report');
    }
  }

  async update(
    id: string,
    updateReportDto: UpdateReportDto,
    organizationId: string,
    userId: string,
  ): Promise<Report> {
    const report = await this.findOne(id, organizationId);

    if (report.status === ReportStatus.GENERATING) {
      throw new BadRequestException('Cannot update report while it is being generated');
    }

    try {
      // Validate date range if both dates are provided
      if (updateReportDto.startDate && updateReportDto.endDate) {
        const startDate = new Date(updateReportDto.startDate);
        const endDate = new Date(updateReportDto.endDate);
        
        if (startDate >= endDate) {
          throw new BadRequestException('Start date must be before end date');
        }
      }

      // Update fields
      Object.assign(report, {
        ...updateReportDto,
        updatedBy: userId,
        status: ReportStatus.DRAFT, // Reset to draft when updated
      });

      const savedReport = await this.reportRepository.save(report);

      this.logger.log(`Report updated: ${id} by user: ${userId}`);

      return savedReport;
    } catch (error) {
      this.logger.error(`Failed to update report ${id}:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to update report');
    }
  }

  async remove(id: string, organizationId: string, userId: string): Promise<void> {
    const report = await this.findOne(id, organizationId);

    if (report.status === ReportStatus.GENERATING) {
      throw new BadRequestException('Cannot delete report while it is being generated');
    }

    try {
      // Soft delete
      report.deletedAt = new Date();
      report.deletedBy = userId;

      await this.reportRepository.save(report);

      this.logger.log(`Report soft deleted: ${id} by user: ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to delete report ${id}:`, error);
      throw new BadRequestException('Failed to delete report');
    }
  }

  async generateReport(id: string, organizationId: string, userId: string) {
    const report = await this.findOne(id, organizationId);

    if (report.status === ReportStatus.GENERATING) {
      throw new BadRequestException('Report is already being generated');
    }

    try {
      // Update status to generating
      report.status = ReportStatus.GENERATING;
      report.generationStartedAt = new Date();
      await this.reportRepository.save(report);

      // Add generation job to queue
      const job = await this.reportQueue.add('generate-report', {
        reportId: id,
        organizationId,
        userId,
        configuration: report.configuration,
        customization: report.customization,
      }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10000 },
      });

      this.logger.log(`Report generation job queued: ${job.id} for report: ${id}`);

      return {
        message: 'Report generation initiated successfully',
        jobId: job.id.toString(),
        estimatedDuration: this.estimateGenerationTime(report.type as ReportType),
      };
    } catch (error) {
      // Reset status on error
      report.status = ReportStatus.FAILED;
      await this.reportRepository.save(report);
      
      this.logger.error(`Failed to generate report ${id}:`, error);
      throw new BadRequestException('Failed to initiate report generation');
    }
  }

  async downloadReport(id: string, organizationId: string) {
    const report = await this.findOne(id, organizationId);

    if (report.status !== ReportStatus.COMPLETED) {
      throw new BadRequestException('Report is not available for download');
    }

    if (!report.filePath) {
      throw new BadRequestException('Report file not found');
    }

    try {
      const downloadUrl = await this.fileStorageService.generatePresignedUrl(report.filePath);
      const filename = `${report.title.replace(/[^a-zA-Z0-9]/g, '_')}.${report.format}`;

      // Update download count
      report.downloadCount = (report.downloadCount || 0) + 1;
      report.lastDownloadedAt = new Date();
      await this.reportRepository.save(report);

      this.logger.log(`Report downloaded: ${id} for organization: ${organizationId}`);

      return {
        downloadUrl,
        filename,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      };
    } catch (error) {
      this.logger.error(`Failed to generate download URL for report ${id}:`, error);
      throw new BadRequestException('Failed to generate download URL');
    }
  }

  async shareReport(
    id: string,
    shareReportDto: ShareReportDto,
    organizationId: string,
    userId: string,
  ) {
    const report = await this.findOne(id, organizationId);

    if (report.status !== ReportStatus.COMPLETED) {
      throw new BadRequestException('Report is not available for sharing');
    }

    try {
      const shareId = `share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const expiresAt = shareReportDto.expiresAt 
        ? new Date(shareReportDto.expiresAt) 
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      // Generate secure sharing URL (mock implementation)
      const shareUrl = `${process.env.FRONTEND_URL || 'https://platform.example.com'}/shared-reports/${shareId}`;

      // Send sharing emails
      for (const email of shareReportDto.emails) {
        await this.emailService.sendEmail({
          to: email,
          subject: `Shared Report: ${report.title}`,
          template: 'report-sharing',
          context: {
            reportTitle: report.title,
            shareUrl,
            message: shareReportDto.message,
            allowDownload: shareReportDto.allowDownload,
            expiresAt: expiresAt.toISOString(),
            senderName: 'Carbon Platform User', // You might want to get actual user name
          },
        });
      }

      this.logger.log(`Report shared: ${id} with ${shareReportDto.emails.length} recipients`);

      return {
        message: 'Report shared successfully',
        sharedWith: shareReportDto.emails,
        shareId,
      };
    } catch (error) {
      this.logger.error(`Failed to share report ${id}:`, error);
      throw new BadRequestException('Failed to share report');
    }
  }

  async scheduleReport(
    id: string,
    scheduleReportDto: ScheduleReportDto,
    organizationId: string,
    userId: string,
  ) {
    const report = await this.findOne(id, organizationId);

    try {
      const scheduleId = `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const nextRunAt = this.calculateNextRunTime(scheduleReportDto.frequency, new Date(scheduleReportDto.startDate));

      // Update report with scheduling information
      report.isScheduled = true;
      report.frequency = scheduleReportDto.frequency;
      report.scheduledAt = new Date(scheduleReportDto.startDate);
      report.nextRunAt = nextRunAt;
      report.schedulingOptions = scheduleReportDto.schedulingOptions;
      
      await this.reportRepository.save(report);

      // Add recurring job to queue (mock implementation)
      // In real implementation, you'd use a proper job scheduler like Bull with repeat options
      
      this.logger.log(`Report scheduled: ${id} with frequency: ${scheduleReportDto.frequency}`);

      return {
        message: 'Report scheduled successfully',
        scheduleId,
        nextRunAt,
      };
    } catch (error) {
      this.logger.error(`Failed to schedule report ${id}:`, error);
      throw new BadRequestException('Failed to schedule report');
    }
  }

  async cancelSchedule(id: string, organizationId: string, userId: string) {
    const report = await this.findOne(id, organizationId);

    if (!report.isScheduled) {
      throw new BadRequestException('Report is not scheduled');
    }

    try {
      // Cancel scheduling
      report.isScheduled = false;
      report.frequency = null;
      report.scheduledAt = null;
      report.nextRunAt = null;
      report.schedulingOptions = null;
      
      await this.reportRepository.save(report);

      this.logger.log(`Report schedule cancelled: ${id} by user: ${userId}`);

      return {
        message: 'Report schedule cancelled successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to cancel report schedule ${id}:`, error);
      throw new BadRequestException('Failed to cancel report schedule');
    }
  }

  async getStatus(id: string, organizationId: string) {
    const report = await this.findOne(id, organizationId);

    try {
      return {
        id: report.id,
        status: report.status,
        progress: this.calculateProgress(report),
        message: this.getStatusMessage(report.status as ReportStatus),
        startedAt: report.generationStartedAt,
        completedAt: report.generationCompletedAt,
        error: report.errorMessage,
        fileSize: report.fileSize,
        downloadCount: report.downloadCount || 0,
      };
    } catch (error) {
      this.logger.error(`Failed to get status for report ${id}:`, error);
      throw new BadRequestException('Failed to retrieve report status');
    }
  }

  async getAvailableTemplates() {
    // Mock implementation - replace with actual template data
    return [
      {
        id: 'carbon-footprint-standard',
        name: 'Standard Carbon Footprint Report',
        description: 'Comprehensive carbon footprint analysis with all scopes',
        type: ReportType.CARBON_FOOTPRINT,
        preview: '/templates/previews/carbon-footprint-standard.png',
        customizable: true,
        configuration: {
          includeScopes: ['scope1', 'scope2', 'scope3'],
          includeCharts: true,
          includeTrends: true,
          includeComparisons: true,
        },
      },
      {
        id: 'emissions-summary',
        name: 'Emissions Summary Report',
        description: 'High-level overview of emissions data',
        type: ReportType.EMISSIONS_SUMMARY,
        preview: '/templates/previews/emissions-summary.png',
        customizable: true,
        configuration: {
          summaryLevel: 'high',
          includeGraphs: true,
          timeframe: 'quarterly',
        },
      },
      {
        id: 'supplier-assessment',
        name: 'Supplier Assessment Report',
        description: 'Comprehensive supplier carbon assessment',
        type: ReportType.SUPPLIER_ASSESSMENT,
        preview: '/templates/previews/supplier-assessment.png',
        customizable: true,
        configuration: {
          includeRiskAnalysis: true,
          includeScorecard: true,
          includeRecommendations: true,
        },
      },
      {
        id: 'compliance-report',
        name: 'Compliance Report',
        description: 'Regulatory compliance and standards reporting',
        type: ReportType.COMPLIANCE,
        preview: '/templates/previews/compliance.png',
        customizable: false,
        configuration: {
          standards: ['GHG Protocol', 'ISO 14064', 'CDP'],
          includeEvidence: true,
        },
      },
      {
        id: 'progress-tracking',
        name: 'Progress Tracking Report',
        description: 'Track progress against carbon reduction goals',
        type: ReportType.PROGRESS_TRACKING,
        preview: '/templates/previews/progress-tracking.png',
        customizable: true,
        configuration: {
          includeGoals: true,
          includeActuals: true,
          includeProjections: true,
          timeframe: 'annual',
        },
      },
    ];
  }

  async getAnalyticsSummary(organizationId: string) {
    try {
      const totalReports = await this.reportRepository.count({
        where: { organizationId, deletedAt: null },
      });

      const reportsByType = await this.reportRepository
        .createQueryBuilder('report')
        .select('report.type', 'type')
        .addSelect('COUNT(*)', 'count')
        .where('report.organizationId = :organizationId', { organizationId })
        .andWhere('report.deletedAt IS NULL')
        .groupBy('report.type')
        .getRawMany();

      const reportsByStatus = await this.reportRepository
        .createQueryBuilder('report')
        .select('report.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .where('report.organizationId = :organizationId', { organizationId })
        .andWhere('report.deletedAt IS NULL')
        .groupBy('report.status')
        .getRawMany();

      const scheduledReports = await this.reportRepository.count({
        where: { organizationId, deletedAt: null, isScheduled: true },
      });

      const completedReports = await this.reportRepository.count({
        where: { organizationId, deletedAt: null, status: ReportStatus.COMPLETED },
      });

      // Convert arrays to objects
      const typeStats = reportsByType.reduce((acc, item) => {
        acc[item.type] = parseInt(item.count);
        return acc;
      }, {});

      const statusStats = reportsByStatus.reduce((acc, item) => {
        acc[item.status] = parseInt(item.count);
        return acc;
      }, {});

      // Calculate metrics
      const completionRate = totalReports > 0 ? (completedReports / totalReports) * 100 : 0;
      const averageGenerationTime = 45; // Mock value in minutes

      // Most popular types
      const mostPopularTypes = Object.entries(typeStats)
        .sort(([,a], [,b]) => (b as number) - (a as number))
        .slice(0, 3)
        .map(([type, count]) => ({ type, count }));

      // Mock trends data
      const trends = [
        { month: 'Jan', reports: Math.floor(totalReports * 0.1) },
        { month: 'Feb', reports: Math.floor(totalReports * 0.15) },
        { month: 'Mar', reports: Math.floor(totalReports * 0.2) },
        { month: 'Apr', reports: Math.floor(totalReports * 0.25) },
        { month: 'May', reports: Math.floor(totalReports * 0.2) },
        { month: 'Jun', reports: Math.floor(totalReports * 0.1) },
      ];

      return {
        totalReports,
        reportsByType: typeStats,
        reportsByStatus: statusStats,
        scheduledReports,
        completionRate,
        averageGenerationTime,
        mostPopularTypes,
        trends,
      };
    } catch (error) {
      this.logger.error(`Failed to get analytics summary for organization ${organizationId}:`, error);
      throw new BadRequestException('Failed to retrieve analytics summary');
    }
  }

  // Private helper methods
  private getDefaultConfiguration(type: ReportType): any {
    const configurations = {
      [ReportType.CARBON_FOOTPRINT]: {
        includeScopes: ['scope1', 'scope2', 'scope3'],
        includeCharts: true,
        includeTrends: true,
        includeComparisons: true,
      },
      [ReportType.EMISSIONS_SUMMARY]: {
        summaryLevel: 'medium',
        includeGraphs: true,
        timeframe: 'quarterly',
      },
      [ReportType.SCOPE_BREAKDOWN]: {
        detailLevel: 'detailed',
        includeEmissionFactors: true,
        includeCalculationMethods: true,
      },
      [ReportType.SUPPLIER_ASSESSMENT]: {
        includeRiskAnalysis: true,
        includeScorecard: true,
        includeRecommendations: true,
      },
      [ReportType.COMPLIANCE]: {
        standards: ['GHG Protocol'],
        includeEvidence: false,
      },
      [ReportType.PROGRESS_TRACKING]: {
        includeGoals: true,
        includeActuals: true,
        includeProjections: false,
      },
      [ReportType.BENCHMARK]: {
        includeIndustryBenchmarks: true,
        includePeerComparison: false,
      },
      [ReportType.CUSTOM]: {
        customizable: true,
      },
    };

    return configurations[type] || {};
  }

  private estimateGenerationTime(type: ReportType): number {
    // Return estimated generation time in seconds
    const times = {
      [ReportType.CARBON_FOOTPRINT]: 120,
      [ReportType.EMISSIONS_SUMMARY]: 60,
      [ReportType.SCOPE_BREAKDOWN]: 90,
      [ReportType.SUPPLIER_ASSESSMENT]: 180,
      [ReportType.COMPLIANCE]: 150,
      [ReportType.PROGRESS_TRACKING]: 100,
      [ReportType.BENCHMARK]: 200,
      [ReportType.CUSTOM]: 120,
    };

    return times[type] || 120;
  }

  private calculateProgress(report: Report): number {
    if (report.status === ReportStatus.COMPLETED) return 100;
    if (report.status === ReportStatus.FAILED) return 0;
    if (report.status === ReportStatus.DRAFT) return 0;
    if (report.status === ReportStatus.GENERATING) {
      // Mock progress calculation based on time elapsed
      const startTime = report.generationStartedAt?.getTime() || Date.now();
      const elapsed = Date.now() - startTime;
      const estimated = this.estimateGenerationTime(report.type as ReportType) * 1000;
      return Math.min(95, Math.floor((elapsed / estimated) * 100));
    }
    return 0;
  }

  private getStatusMessage(status: ReportStatus): string {
    const messages = {
      [ReportStatus.DRAFT]: 'Report is in draft state',
      [ReportStatus.GENERATING]: 'Report generation in progress',
      [ReportStatus.COMPLETED]: 'Report generated successfully',
      [ReportStatus.FAILED]: 'Report generation failed',
      [ReportStatus.SCHEDULED]: 'Report is scheduled for generation',
    };

    return messages[status] || 'Unknown status';
  }

  private calculateNextRunTime(frequency: ReportFrequency, startDate: Date): Date {
    const nextRun = new Date(startDate);

    switch (frequency) {
      case ReportFrequency.DAILY:
        nextRun.setDate(nextRun.getDate() + 1);
        break;
      case ReportFrequency.WEEKLY:
        nextRun.setDate(nextRun.getDate() + 7);
        break;
      case ReportFrequency.MONTHLY:
        nextRun.setMonth(nextRun.getMonth() + 1);
        break;
      case ReportFrequency.QUARTERLY:
        nextRun.setMonth(nextRun.getMonth() + 3);
        break;
      case ReportFrequency.ANNUALLY:
        nextRun.setFullYear(nextRun.getFullYear() + 1);
        break;
      default:
        return startDate;
    }

    return nextRun;
  }
}