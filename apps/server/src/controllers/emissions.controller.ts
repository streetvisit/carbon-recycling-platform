import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
  ParseUUIDPipe,
  HttpStatus,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { EmissionsService } from '../services/emissions.service';

// DTOs
class CreateEmissionCalculationDto {
  activityDataId: string;
  emissionFactorId: string;
  scope: 1 | 2 | 3;
  category: string;
  activityAmount: number;
  unit: string;
  calculationMethod: 'standard' | 'custom' | 'hybrid';
  customFactor?: number;
  metadata?: Record<string, any>;
}

class UpdateEmissionCalculationDto {
  activityAmount?: number;
  emissionFactorId?: string;
  calculationMethod?: 'standard' | 'custom' | 'hybrid';
  customFactor?: number;
  metadata?: Record<string, any>;
}

class EmissionCalculationQueryDto {
  organizationId?: string;
  scope?: 1 | 2 | 3;
  category?: string;
  period?: string;
  startDate?: string;
  endDate?: string;
  limit?: number = 50;
  offset?: number = 0;
  sortBy?: string = 'createdAt';
  sortOrder?: 'asc' | 'desc' = 'desc';
}

class EmissionsSummaryResponseDto {
  totalEmissions: number;
  scope1: number;
  scope2: number;
  scope3: number;
  byCategory: Record<string, number>;
  byPeriod: Record<string, number>;
  trend: {
    direction: 'increasing' | 'decreasing' | 'stable';
    percentage: number;
  };
  lastUpdated: string;
}

class EmissionCalculationResponseDto {
  id: string;
  organizationId: string;
  activityDataId: string;
  emissionFactorId: string;
  scope: number;
  category: string;
  activityAmount: number;
  unit: string;
  emissionFactor: number;
  totalEmissions: number;
  co2Equivalent: number;
  calculationMethod: string;
  uncertainty: number;
  qualityScore: number;
  calculatedAt: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

@ApiTags('Emissions')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('emissions')
export class EmissionsController {
  private readonly logger = new Logger(EmissionsController.name);

  constructor(private readonly emissionsService: EmissionsService) {}

  @Get('summary')
  @ApiOperation({ 
    summary: 'Get emissions summary',
    description: 'Get comprehensive emissions summary with trends and breakdowns' 
  })
  @ApiQuery({ 
    name: 'organizationId', 
    required: false, 
    description: 'Filter by organization ID' 
  })
  @ApiQuery({ 
    name: 'period', 
    required: false, 
    description: 'Time period (month, quarter, year)',
    enum: ['month', 'quarter', 'year']
  })
  @ApiQuery({ 
    name: 'year', 
    required: false, 
    description: 'Specific year to analyze' 
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Emissions summary retrieved successfully',
    type: EmissionsSummaryResponseDto,
  })
  @Roles('admin', 'manager', 'analyst', 'viewer')
  async getEmissionsSummary(
    @CurrentUser() user: any,
    @Query('organizationId') organizationId?: string,
    @Query('period') period: 'month' | 'quarter' | 'year' = 'year',
    @Query('year') year?: number,
  ): Promise<EmissionsSummaryResponseDto> {
    this.logger.log(`Getting emissions summary for user ${user.id}, org: ${organizationId}`);

    try {
      const summary = await this.emissionsService.getEmissionsSummary({
        organizationId: organizationId || user.organizationId,
        period,
        year: year || new Date().getFullYear(),
        userId: user.id,
      });

      return {
        totalEmissions: summary.totalEmissions,
        scope1: summary.scope1,
        scope2: summary.scope2,
        scope3: summary.scope3,
        byCategory: summary.byCategory,
        byPeriod: summary.byPeriod,
        trend: summary.trend,
        lastUpdated: summary.lastUpdated,
      };
    } catch (error) {
      this.logger.error(`Failed to get emissions summary: ${error.message}`);
      throw new BadRequestException('Failed to retrieve emissions summary');
    }
  }

  @Get('calculations')
  @ApiOperation({ 
    summary: 'List emission calculations',
    description: 'Retrieve paginated list of emission calculations with filtering' 
  })
  @ApiQuery({ type: EmissionCalculationQueryDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Emission calculations retrieved successfully',
    type: [EmissionCalculationResponseDto],
  })
  @Roles('admin', 'manager', 'analyst', 'viewer')
  async getEmissionCalculations(
    @CurrentUser() user: any,
    @Query() query: EmissionCalculationQueryDto,
  ): Promise<{
    calculations: EmissionCalculationResponseDto[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    this.logger.log(`Getting emission calculations for user ${user.id}`);

    try {
      const result = await this.emissionsService.getEmissionCalculations({
        organizationId: query.organizationId || user.organizationId,
        scope: query.scope,
        category: query.category,
        period: query.period,
        startDate: query.startDate,
        endDate: query.endDate,
        limit: query.limit,
        offset: query.offset,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
        userId: user.id,
      });

      return {
        calculations: result.calculations.map(calc => ({
          id: calc.id,
          organizationId: calc.organizationId,
          activityDataId: calc.activityDataId,
          emissionFactorId: calc.emissionFactorId,
          scope: calc.scope,
          category: calc.category,
          activityAmount: calc.activityAmount,
          unit: calc.unit,
          emissionFactor: calc.emissionFactor,
          totalEmissions: calc.totalEmissions,
          co2Equivalent: calc.co2Equivalent,
          calculationMethod: calc.calculationMethod,
          uncertainty: calc.uncertainty,
          qualityScore: calc.qualityScore,
          calculatedAt: calc.calculatedAt,
          createdAt: calc.createdAt,
          updatedAt: calc.updatedAt,
          metadata: calc.metadata,
        })),
        total: result.total,
        page: Math.floor(query.offset / query.limit) + 1,
        totalPages: Math.ceil(result.total / query.limit),
      };
    } catch (error) {
      this.logger.error(`Failed to get emission calculations: ${error.message}`);
      throw new BadRequestException('Failed to retrieve emission calculations');
    }
  }

  @Get('calculations/:id')
  @ApiOperation({ 
    summary: 'Get emission calculation details',
    description: 'Retrieve detailed information about a specific emission calculation' 
  })
  @ApiParam({ name: 'id', description: 'Emission calculation ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Emission calculation retrieved successfully',
    type: EmissionCalculationResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Emission calculation not found',
  })
  @Roles('admin', 'manager', 'analyst', 'viewer')
  async getEmissionCalculation(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<EmissionCalculationResponseDto> {
    this.logger.log(`Getting emission calculation ${id} for user ${user.id}`);

    try {
      const calculation = await this.emissionsService.getEmissionCalculationById(id, user.id);

      if (!calculation) {
        throw new NotFoundException('Emission calculation not found');
      }

      return {
        id: calculation.id,
        organizationId: calculation.organizationId,
        activityDataId: calculation.activityDataId,
        emissionFactorId: calculation.emissionFactorId,
        scope: calculation.scope,
        category: calculation.category,
        activityAmount: calculation.activityAmount,
        unit: calculation.unit,
        emissionFactor: calculation.emissionFactor,
        totalEmissions: calculation.totalEmissions,
        co2Equivalent: calculation.co2Equivalent,
        calculationMethod: calculation.calculationMethod,
        uncertainty: calculation.uncertainty,
        qualityScore: calculation.qualityScore,
        calculatedAt: calculation.calculatedAt,
        createdAt: calculation.createdAt,
        updatedAt: calculation.updatedAt,
        metadata: calculation.metadata,
      };
    } catch (error) {
      this.logger.error(`Failed to get emission calculation ${id}: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to retrieve emission calculation');
    }
  }

  @Post('calculations')
  @ApiOperation({ 
    summary: 'Create emission calculation',
    description: 'Create a new emission calculation based on activity data and emission factors' 
  })
  @ApiBody({ type: CreateEmissionCalculationDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Emission calculation created successfully',
    type: EmissionCalculationResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid calculation data',
  })
  @Roles('admin', 'manager', 'analyst')
  async createEmissionCalculation(
    @CurrentUser() user: any,
    @Body() createDto: CreateEmissionCalculationDto,
  ): Promise<EmissionCalculationResponseDto> {
    this.logger.log(`Creating emission calculation for user ${user.id}`);

    try {
      const calculation = await this.emissionsService.createEmissionCalculation({
        ...createDto,
        organizationId: user.organizationId,
        userId: user.id,
      });

      return {
        id: calculation.id,
        organizationId: calculation.organizationId,
        activityDataId: calculation.activityDataId,
        emissionFactorId: calculation.emissionFactorId,
        scope: calculation.scope,
        category: calculation.category,
        activityAmount: calculation.activityAmount,
        unit: calculation.unit,
        emissionFactor: calculation.emissionFactor,
        totalEmissions: calculation.totalEmissions,
        co2Equivalent: calculation.co2Equivalent,
        calculationMethod: calculation.calculationMethod,
        uncertainty: calculation.uncertainty,
        qualityScore: calculation.qualityScore,
        calculatedAt: calculation.calculatedAt,
        createdAt: calculation.createdAt,
        updatedAt: calculation.updatedAt,
        metadata: calculation.metadata,
      };
    } catch (error) {
      this.logger.error(`Failed to create emission calculation: ${error.message}`);
      throw new BadRequestException('Failed to create emission calculation');
    }
  }

  @Put('calculations/:id')
  @ApiOperation({ 
    summary: 'Update emission calculation',
    description: 'Update an existing emission calculation' 
  })
  @ApiParam({ name: 'id', description: 'Emission calculation ID' })
  @ApiBody({ type: UpdateEmissionCalculationDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Emission calculation updated successfully',
    type: EmissionCalculationResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Emission calculation not found',
  })
  @Roles('admin', 'manager', 'analyst')
  async updateEmissionCalculation(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateEmissionCalculationDto,
  ): Promise<EmissionCalculationResponseDto> {
    this.logger.log(`Updating emission calculation ${id} for user ${user.id}`);

    try {
      const calculation = await this.emissionsService.updateEmissionCalculation(
        id,
        updateDto,
        user.id,
      );

      if (!calculation) {
        throw new NotFoundException('Emission calculation not found');
      }

      return {
        id: calculation.id,
        organizationId: calculation.organizationId,
        activityDataId: calculation.activityDataId,
        emissionFactorId: calculation.emissionFactorId,
        scope: calculation.scope,
        category: calculation.category,
        activityAmount: calculation.activityAmount,
        unit: calculation.unit,
        emissionFactor: calculation.emissionFactor,
        totalEmissions: calculation.totalEmissions,
        co2Equivalent: calculation.co2Equivalent,
        calculationMethod: calculation.calculationMethod,
        uncertainty: calculation.uncertainty,
        qualityScore: calculation.qualityScore,
        calculatedAt: calculation.calculatedAt,
        createdAt: calculation.createdAt,
        updatedAt: calculation.updatedAt,
        metadata: calculation.metadata,
      };
    } catch (error) {
      this.logger.error(`Failed to update emission calculation ${id}: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to update emission calculation');
    }
  }

  @Delete('calculations/:id')
  @ApiOperation({ 
    summary: 'Delete emission calculation',
    description: 'Delete a specific emission calculation' 
  })
  @ApiParam({ name: 'id', description: 'Emission calculation ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Emission calculation deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Emission calculation not found',
  })
  @Roles('admin', 'manager')
  async deleteEmissionCalculation(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    this.logger.log(`Deleting emission calculation ${id} for user ${user.id}`);

    try {
      const success = await this.emissionsService.deleteEmissionCalculation(id, user.id);

      if (!success) {
        throw new NotFoundException('Emission calculation not found');
      }

      return { message: 'Emission calculation deleted successfully' };
    } catch (error) {
      this.logger.error(`Failed to delete emission calculation ${id}: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to delete emission calculation');
    }
  }

  @Post('calculations/bulk')
  @ApiOperation({ 
    summary: 'Bulk create emission calculations',
    description: 'Create multiple emission calculations in a single request' 
  })
  @ApiBody({ type: [CreateEmissionCalculationDto] })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Bulk emission calculations created successfully',
    type: [EmissionCalculationResponseDto],
  })
  @Roles('admin', 'manager', 'analyst')
  async bulkCreateEmissionCalculations(
    @CurrentUser() user: any,
    @Body() createDtos: CreateEmissionCalculationDto[],
  ): Promise<{
    calculations: EmissionCalculationResponseDto[];
    successCount: number;
    failureCount: number;
    errors: string[];
  }> {
    this.logger.log(`Bulk creating ${createDtos.length} emission calculations for user ${user.id}`);

    try {
      const result = await this.emissionsService.bulkCreateEmissionCalculations(
        createDtos.map(dto => ({
          ...dto,
          organizationId: user.organizationId,
          userId: user.id,
        })),
      );

      return {
        calculations: result.calculations.map(calc => ({
          id: calc.id,
          organizationId: calc.organizationId,
          activityDataId: calc.activityDataId,
          emissionFactorId: calc.emissionFactorId,
          scope: calc.scope,
          category: calc.category,
          activityAmount: calc.activityAmount,
          unit: calc.unit,
          emissionFactor: calc.emissionFactor,
          totalEmissions: calc.totalEmissions,
          co2Equivalent: calc.co2Equivalent,
          calculationMethod: calc.calculationMethod,
          uncertainty: calc.uncertainty,
          qualityScore: calc.qualityScore,
          calculatedAt: calc.calculatedAt,
          createdAt: calc.createdAt,
          updatedAt: calc.updatedAt,
          metadata: calc.metadata,
        })),
        successCount: result.successCount,
        failureCount: result.failureCount,
        errors: result.errors,
      };
    } catch (error) {
      this.logger.error(`Failed to bulk create emission calculations: ${error.message}`);
      throw new BadRequestException('Failed to bulk create emission calculations');
    }
  }

  @Get('trends')
  @ApiOperation({ 
    summary: 'Get emissions trends',
    description: 'Retrieve emissions trends and patterns over time' 
  })
  @ApiQuery({ 
    name: 'period', 
    required: false, 
    description: 'Time period for trend analysis',
    enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly']
  })
  @ApiQuery({ 
    name: 'scope', 
    required: false, 
    description: 'Emission scope filter',
    enum: [1, 2, 3]
  })
  @ApiQuery({ name: 'months', required: false, description: 'Number of months to analyze' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Emissions trends retrieved successfully',
  })
  @Roles('admin', 'manager', 'analyst', 'viewer')
  async getEmissionsTrends(
    @CurrentUser() user: any,
    @Query('period') period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' = 'monthly',
    @Query('scope') scope?: 1 | 2 | 3,
    @Query('months') months: number = 12,
  ) {
    this.logger.log(`Getting emissions trends for user ${user.id}`);

    try {
      const trends = await this.emissionsService.getEmissionsTrends({
        organizationId: user.organizationId,
        period,
        scope,
        months,
        userId: user.id,
      });

      return trends;
    } catch (error) {
      this.logger.error(`Failed to get emissions trends: ${error.message}`);
      throw new BadRequestException('Failed to retrieve emissions trends');
    }
  }

  @Post('recalculate')
  @ApiOperation({ 
    summary: 'Recalculate emissions',
    description: 'Trigger recalculation of emissions for updated factors or data' 
  })
  @ApiQuery({ 
    name: 'scope', 
    required: false, 
    description: 'Specific scope to recalculate' 
  })
  @ApiQuery({ 
    name: 'category', 
    required: false, 
    description: 'Specific category to recalculate' 
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Emissions recalculation triggered successfully',
  })
  @Roles('admin', 'manager')
  async recalculateEmissions(
    @CurrentUser() user: any,
    @Query('scope') scope?: 1 | 2 | 3,
    @Query('category') category?: string,
  ) {
    this.logger.log(`Triggering emissions recalculation for user ${user.id}`);

    try {
      const result = await this.emissionsService.recalculateEmissions({
        organizationId: user.organizationId,
        scope,
        category,
        userId: user.id,
      });

      return {
        message: 'Emissions recalculation triggered successfully',
        jobId: result.jobId,
        estimatedDuration: result.estimatedDuration,
        affectedCalculations: result.affectedCalculations,
      };
    } catch (error) {
      this.logger.error(`Failed to trigger emissions recalculation: ${error.message}`);
      throw new BadRequestException('Failed to trigger emissions recalculation');
    }
  }
}