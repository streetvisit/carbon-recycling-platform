import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, FindManyOptions } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { EmissionCalculation } from '../entities/emission-calculation.entity';
import { ActivityData } from '../entities/activity-data.entity';
import { EmissionFactor } from '../entities/emission-factor.entity';

interface EmissionsSummaryParams {
  organizationId: string;
  period: 'month' | 'quarter' | 'year';
  year: number;
  userId: string;
}

interface EmissionCalculationsParams {
  organizationId: string;
  scope?: 1 | 2 | 3;
  category?: string;
  period?: string;
  startDate?: string;
  endDate?: string;
  limit: number;
  offset: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  userId: string;
}

interface CreateEmissionCalculationParams {
  organizationId: string;
  activityDataId: string;
  emissionFactorId: string;
  scope: 1 | 2 | 3;
  category: string;
  activityAmount: number;
  unit: string;
  calculationMethod: 'standard' | 'custom' | 'hybrid';
  customFactor?: number;
  metadata?: Record<string, any>;
  userId: string;
}

interface EmissionsTrendsParams {
  organizationId: string;
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  scope?: 1 | 2 | 3;
  months: number;
  userId: string;
}

interface RecalculateEmissionsParams {
  organizationId: string;
  scope?: 1 | 2 | 3;
  category?: string;
  userId: string;
}

@Injectable()
export class EmissionsService {
  private readonly logger = new Logger(EmissionsService.name);

  constructor(
    @InjectRepository(EmissionCalculation)
    private readonly emissionCalculationRepository: Repository<EmissionCalculation>,
    @InjectRepository(ActivityData)
    private readonly activityDataRepository: Repository<ActivityData>,
    @InjectRepository(EmissionFactor)
    private readonly emissionFactorRepository: Repository<EmissionFactor>,
    @InjectQueue('emissions-calculation')
    private readonly calculationQueue: Queue,
  ) {}

  /**
   * Get comprehensive emissions summary with trends and breakdowns
   */
  async getEmissionsSummary(params: EmissionsSummaryParams) {
    this.logger.log(`Getting emissions summary for organization ${params.organizationId}`);

    try {
      // Calculate date ranges based on period
      const currentYear = params.year;
      const previousYear = currentYear - 1;

      // Current period emissions
      const currentEmissions = await this.emissionCalculationRepository
        .createQueryBuilder('calc')
        .select('SUM(calc.totalEmissions)', 'total')
        .addSelect('calc.scope', 'scope')
        .addSelect('calc.category', 'category')
        .where('calc.organizationId = :orgId', { orgId: params.organizationId })
        .andWhere('YEAR(calc.calculatedAt) = :year', { year: currentYear })
        .groupBy('calc.scope, calc.category')
        .getRawMany();

      // Previous period emissions for trend calculation
      const previousEmissions = await this.emissionCalculationRepository
        .createQueryBuilder('calc')
        .select('SUM(calc.totalEmissions)', 'total')
        .where('calc.organizationId = :orgId', { orgId: params.organizationId })
        .andWhere('YEAR(calc.calculatedAt) = :year', { year: previousYear })
        .getRawOne();

      // Calculate totals by scope
      const scope1 = currentEmissions
        .filter(e => e.scope === 1)
        .reduce((sum, e) => sum + parseFloat(e.total || 0), 0);
      const scope2 = currentEmissions
        .filter(e => e.scope === 2)
        .reduce((sum, e) => sum + parseFloat(e.total || 0), 0);
      const scope3 = currentEmissions
        .filter(e => e.scope === 3)
        .reduce((sum, e) => sum + parseFloat(e.total || 0), 0);

      const totalEmissions = scope1 + scope2 + scope3;

      // Calculate by category
      const byCategory = currentEmissions.reduce((acc, e) => {
        if (!acc[e.category]) acc[e.category] = 0;
        acc[e.category] += parseFloat(e.total || 0);
        return acc;
      }, {} as Record<string, number>);

      // Calculate monthly breakdown for the year
      const monthlyData = await this.emissionCalculationRepository
        .createQueryBuilder('calc')
        .select('MONTH(calc.calculatedAt)', 'month')
        .addSelect('SUM(calc.totalEmissions)', 'total')
        .where('calc.organizationId = :orgId', { orgId: params.organizationId })
        .andWhere('YEAR(calc.calculatedAt) = :year', { year: currentYear })
        .groupBy('MONTH(calc.calculatedAt)')
        .orderBy('month')
        .getRawMany();

      const byPeriod = monthlyData.reduce((acc, item) => {
        const monthName = new Date(2024, item.month - 1, 1).toLocaleString('en-US', { month: 'long' });
        acc[monthName] = parseFloat(item.total || 0);
        return acc;
      }, {} as Record<string, number>);

      // Calculate trend
      const previousTotal = parseFloat(previousEmissions?.total || 0);
      let trend = {
        direction: 'stable' as 'increasing' | 'decreasing' | 'stable',
        percentage: 0,
      };

      if (previousTotal > 0) {
        const change = ((totalEmissions - previousTotal) / previousTotal) * 100;
        trend.percentage = Math.abs(change);
        
        if (change > 5) trend.direction = 'increasing';
        else if (change < -5) trend.direction = 'decreasing';
        else trend.direction = 'stable';
      }

      return {
        totalEmissions,
        scope1,
        scope2,
        scope3,
        byCategory,
        byPeriod,
        trend,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Failed to get emissions summary: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get paginated list of emission calculations with filtering
   */
  async getEmissionCalculations(params: EmissionCalculationsParams) {
    this.logger.log(`Getting emission calculations for organization ${params.organizationId}`);

    try {
      const queryBuilder = this.emissionCalculationRepository
        .createQueryBuilder('calc')
        .leftJoinAndSelect('calc.activityData', 'activity')
        .leftJoinAndSelect('calc.emissionFactor', 'factor')
        .where('calc.organizationId = :orgId', { orgId: params.organizationId });

      // Apply filters
      if (params.scope) {
        queryBuilder.andWhere('calc.scope = :scope', { scope: params.scope });
      }

      if (params.category) {
        queryBuilder.andWhere('calc.category = :category', { category: params.category });
      }

      if (params.startDate && params.endDate) {
        queryBuilder.andWhere('calc.calculatedAt BETWEEN :start AND :end', {
          start: params.startDate,
          end: params.endDate,
        });
      }

      // Apply sorting
      const sortField = params.sortBy || 'calculatedAt';
      const sortOrder = params.sortOrder || 'DESC';
      queryBuilder.orderBy(`calc.${sortField}`, sortOrder.toUpperCase() as 'ASC' | 'DESC');

      // Apply pagination
      queryBuilder.skip(params.offset).take(params.limit);

      const [calculations, total] = await queryBuilder.getManyAndCount();

      return { calculations, total };
    } catch (error) {
      this.logger.error(`Failed to get emission calculations: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get emission calculation by ID
   */
  async getEmissionCalculationById(id: string, userId: string) {
    this.logger.log(`Getting emission calculation ${id}`);

    try {
      const calculation = await this.emissionCalculationRepository.findOne({
        where: { id },
        relations: ['activityData', 'emissionFactor'],
      });

      return calculation;
    } catch (error) {
      this.logger.error(`Failed to get emission calculation ${id}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create new emission calculation
   */
  async createEmissionCalculation(params: CreateEmissionCalculationParams) {
    this.logger.log(`Creating emission calculation for organization ${params.organizationId}`);

    try {
      // Get activity data and emission factor
      const activityData = await this.activityDataRepository.findOne({
        where: { id: params.activityDataId },
      });

      if (!activityData) {
        throw new NotFoundException('Activity data not found');
      }

      const emissionFactor = await this.emissionFactorRepository.findOne({
        where: { id: params.emissionFactorId },
      });

      if (!emissionFactor) {
        throw new NotFoundException('Emission factor not found');
      }

      // Calculate emissions
      const factor = params.customFactor || emissionFactor.factor;
      const totalEmissions = params.activityAmount * factor;
      const co2Equivalent = totalEmissions * (emissionFactor.gwpFactor || 1);

      // Calculate uncertainty and quality score
      const uncertainty = this.calculateUncertainty(params);
      const qualityScore = this.calculateQualityScore(params, activityData, emissionFactor);

      const calculation = this.emissionCalculationRepository.create({
        organizationId: params.organizationId,
        activityDataId: params.activityDataId,
        emissionFactorId: params.emissionFactorId,
        scope: params.scope,
        category: params.category,
        activityAmount: params.activityAmount,
        unit: params.unit,
        emissionFactor: factor,
        totalEmissions,
        co2Equivalent,
        calculationMethod: params.calculationMethod,
        uncertainty,
        qualityScore,
        calculatedAt: new Date(),
        metadata: params.metadata,
      });

      const savedCalculation = await this.emissionCalculationRepository.save(calculation);

      // Queue for additional processing
      await this.calculationQueue.add('process-calculation', {
        calculationId: savedCalculation.id,
        userId: params.userId,
      });

      return savedCalculation;
    } catch (error) {
      this.logger.error(`Failed to create emission calculation: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update emission calculation
   */
  async updateEmissionCalculation(
    id: string,
    updateData: Partial<CreateEmissionCalculationParams>,
    userId: string,
  ) {
    this.logger.log(`Updating emission calculation ${id}`);

    try {
      const calculation = await this.emissionCalculationRepository.findOne({
        where: { id },
      });

      if (!calculation) {
        return null;
      }

      // Recalculate if necessary
      if (updateData.activityAmount || updateData.emissionFactorId || updateData.customFactor) {
        let emissionFactor = calculation.emissionFactor;

        if (updateData.emissionFactorId) {
          const factor = await this.emissionFactorRepository.findOne({
            where: { id: updateData.emissionFactorId },
          });
          emissionFactor = factor?.factor || emissionFactor;
        }

        if (updateData.customFactor) {
          emissionFactor = updateData.customFactor;
        }

        const activityAmount = updateData.activityAmount || calculation.activityAmount;
        calculation.totalEmissions = activityAmount * emissionFactor;
        calculation.co2Equivalent = calculation.totalEmissions * 1; // Simplified
      }

      // Update fields
      Object.assign(calculation, updateData);
      calculation.updatedAt = new Date();

      const updatedCalculation = await this.emissionCalculationRepository.save(calculation);

      return updatedCalculation;
    } catch (error) {
      this.logger.error(`Failed to update emission calculation ${id}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete emission calculation
   */
  async deleteEmissionCalculation(id: string, userId: string): Promise<boolean> {
    this.logger.log(`Deleting emission calculation ${id}`);

    try {
      const result = await this.emissionCalculationRepository.delete({ id });
      return result.affected > 0;
    } catch (error) {
      this.logger.error(`Failed to delete emission calculation ${id}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Bulk create emission calculations
   */
  async bulkCreateEmissionCalculations(calculationsData: CreateEmissionCalculationParams[]) {
    this.logger.log(`Bulk creating ${calculationsData.length} emission calculations`);

    const calculations = [];
    const errors = [];
    let successCount = 0;
    let failureCount = 0;

    for (const data of calculationsData) {
      try {
        const calculation = await this.createEmissionCalculation(data);
        calculations.push(calculation);
        successCount++;
      } catch (error) {
        errors.push(`Failed to create calculation: ${error.message}`);
        failureCount++;
      }
    }

    return {
      calculations,
      successCount,
      failureCount,
      errors,
    };
  }

  /**
   * Get emissions trends over time
   */
  async getEmissionsTrends(params: EmissionsTrendsParams) {
    this.logger.log(`Getting emissions trends for organization ${params.organizationId}`);

    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(endDate.getMonth() - params.months);

      let dateFormat: string;
      let groupByFormat: string;

      switch (params.period) {
        case 'daily':
          dateFormat = '%Y-%m-%d';
          groupByFormat = 'DATE(calc.calculatedAt)';
          break;
        case 'weekly':
          dateFormat = '%Y-W%u';
          groupByFormat = 'YEARWEEK(calc.calculatedAt)';
          break;
        case 'monthly':
          dateFormat = '%Y-%m';
          groupByFormat = 'YEAR(calc.calculatedAt), MONTH(calc.calculatedAt)';
          break;
        case 'quarterly':
          dateFormat = '%Y-Q%q';
          groupByFormat = 'YEAR(calc.calculatedAt), QUARTER(calc.calculatedAt)';
          break;
        case 'yearly':
          dateFormat = '%Y';
          groupByFormat = 'YEAR(calc.calculatedAt)';
          break;
        default:
          dateFormat = '%Y-%m';
          groupByFormat = 'YEAR(calc.calculatedAt), MONTH(calc.calculatedAt)';
      }

      const queryBuilder = this.emissionCalculationRepository
        .createQueryBuilder('calc')
        .select(`DATE_FORMAT(calc.calculatedAt, '${dateFormat}')`, 'period')
        .addSelect('SUM(calc.totalEmissions)', 'totalEmissions')
        .addSelect('calc.scope', 'scope')
        .where('calc.organizationId = :orgId', { orgId: params.organizationId })
        .andWhere('calc.calculatedAt BETWEEN :start AND :end', {
          start: startDate,
          end: endDate,
        })
        .groupBy(groupByFormat)
        .addGroupBy('calc.scope')
        .orderBy('calc.calculatedAt');

      if (params.scope) {
        queryBuilder.andWhere('calc.scope = :scope', { scope: params.scope });
      }

      const trends = await queryBuilder.getRawMany();

      // Transform data for frontend consumption
      const transformedTrends = trends.reduce((acc, trend) => {
        const period = trend.period;
        if (!acc[period]) {
          acc[period] = { period, totalEmissions: 0, scope1: 0, scope2: 0, scope3: 0 };
        }
        
        acc[period].totalEmissions += parseFloat(trend.totalEmissions);
        acc[period][`scope${trend.scope}`] = parseFloat(trend.totalEmissions);
        
        return acc;
      }, {});

      return Object.values(transformedTrends);
    } catch (error) {
      this.logger.error(`Failed to get emissions trends: ${error.message}`);
      throw error;
    }
  }

  /**
   * Trigger recalculation of emissions
   */
  async recalculateEmissions(params: RecalculateEmissionsParams) {
    this.logger.log(`Triggering emissions recalculation for organization ${params.organizationId}`);

    try {
      const queryBuilder = this.emissionCalculationRepository
        .createQueryBuilder('calc')
        .where('calc.organizationId = :orgId', { orgId: params.organizationId });

      if (params.scope) {
        queryBuilder.andWhere('calc.scope = :scope', { scope: params.scope });
      }

      if (params.category) {
        queryBuilder.andWhere('calc.category = :category', { category: params.category });
      }

      const calculations = await queryBuilder.getMany();

      // Queue recalculation jobs
      const jobId = `recalc-${Date.now()}`;
      await this.calculationQueue.add('recalculate-emissions', {
        organizationId: params.organizationId,
        calculationIds: calculations.map(c => c.id),
        userId: params.userId,
        scope: params.scope,
        category: params.category,
      }, {
        jobId,
        delay: 0,
        attempts: 3,
      });

      return {
        jobId,
        estimatedDuration: calculations.length * 0.1, // seconds
        affectedCalculations: calculations.length,
      };
    } catch (error) {
      this.logger.error(`Failed to trigger emissions recalculation: ${error.message}`);
      throw error;
    }
  }

  /**
   * Calculate uncertainty for emission calculation
   */
  private calculateUncertainty(params: CreateEmissionCalculationParams): number {
    let uncertainty = 0;

    // Base uncertainty based on calculation method
    switch (params.calculationMethod) {
      case 'standard':
        uncertainty = 15; // 15% base uncertainty
        break;
      case 'custom':
        uncertainty = 25; // 25% for custom factors
        break;
      case 'hybrid':
        uncertainty = 20; // 20% for hybrid approach
        break;
    }

    // Adjust based on data quality indicators
    if (params.metadata?.dataQuality === 'high') {
      uncertainty *= 0.8;
    } else if (params.metadata?.dataQuality === 'low') {
      uncertainty *= 1.3;
    }

    return Math.round(uncertainty * 100) / 100;
  }

  /**
   * Calculate quality score for emission calculation
   */
  private calculateQualityScore(
    params: CreateEmissionCalculationParams,
    activityData: ActivityData,
    emissionFactor: EmissionFactor,
  ): number {
    let score = 100;

    // Deduct points based on various factors
    if (params.calculationMethod === 'custom') score -= 10;
    if (!params.metadata?.verified) score -= 15;
    if (params.metadata?.dataAge > 30) score -= 10; // Days
    if (!emissionFactor.verified) score -= 20;

    return Math.max(0, Math.min(100, score));
  }
}