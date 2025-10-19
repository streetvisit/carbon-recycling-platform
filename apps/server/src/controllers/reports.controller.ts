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
  HttpStatus,
  HttpCode,
  Logger,
  ParseUUIDPipe,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiProperty,
} from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsNumber, IsBoolean, IsDateString, Min, Max, IsArray } from 'class-validator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { GetUser } from '../decorators/get-user.decorator';
import { ReportsService } from '../services/reports.service';

// Enums
export enum ReportType {
  CARBON_FOOTPRINT = 'carbon_footprint',
  EMISSIONS_SUMMARY = 'emissions_summary',
  SCOPE_BREAKDOWN = 'scope_breakdown',
  SUPPLIER_ASSESSMENT = 'supplier_assessment',
  COMPLIANCE = 'compliance',
  PROGRESS_TRACKING = 'progress_tracking',
  BENCHMARK = 'benchmark',
  CUSTOM = 'custom',
}

export enum ReportStatus {
  DRAFT = 'draft',
  GENERATING = 'generating',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SCHEDULED = 'scheduled',
}

export enum ReportFormat {
  PDF = 'pdf',
  EXCEL = 'xlsx',
  CSV = 'csv',
  JSON = 'json',
}

export enum ReportFrequency {
  ONCE = 'once',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  ANNUALLY = 'annually',
}

// DTOs
class CreateReportDto {
  @ApiProperty({ example: 'Q3 2024 Carbon Footprint Report' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'Quarterly carbon footprint analysis including all scopes' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: ReportType, example: ReportType.CARBON_FOOTPRINT })
  @IsEnum(ReportType)
  type: ReportType;

  @ApiProperty({ example: '2024-07-01' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2024-09-30' })
  @IsDateString()
  endDate: string;

  @ApiProperty({ enum: ReportFormat, example: ReportFormat.PDF })
  @IsOptional()
  @IsEnum(ReportFormat)
  format?: ReportFormat = ReportFormat.PDF;

  @ApiProperty({ example: { includeScopes: ['scope1', 'scope2', 'scope3'], includeSuppliers: true } })
  @IsOptional()
  configuration?: any;

  @ApiProperty({ example: { templateId: 'standard', brandingEnabled: true } })
  @IsOptional()
  customization?: any;

  @ApiProperty({ example: true })
  @IsOptional()
  @IsBoolean()
  isScheduled?: boolean = false;

  @ApiProperty({ enum: ReportFrequency, example: ReportFrequency.QUARTERLY })
  @IsOptional()
  @IsEnum(ReportFrequency)
  frequency?: ReportFrequency;
}

class UpdateReportDto {
  @ApiProperty({ example: 'Updated Report Title', required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ example: 'Updated description', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: ReportType, required: false })
  @IsOptional()
  @IsEnum(ReportType)
  type?: ReportType;

  @ApiProperty({ example: '2024-07-01', required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ example: '2024-09-30', required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ enum: ReportFormat, required: false })
  @IsOptional()
  @IsEnum(ReportFormat)
  format?: ReportFormat;

  @ApiProperty({ required: false })
  @IsOptional()
  configuration?: any;

  @ApiProperty({ required: false })
  @IsOptional()
  customization?: any;

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  @IsBoolean()
  isScheduled?: boolean;

  @ApiProperty({ enum: ReportFrequency, required: false })
  @IsOptional()
  @IsEnum(ReportFrequency)
  frequency?: ReportFrequency;
}

class QueryReportsDto {
  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ example: 10, required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiProperty({ example: 'carbon footprint', required: false })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ enum: ReportType, required: false })
  @IsOptional()
  @IsEnum(ReportType)
  type?: ReportType;

  @ApiProperty({ enum: ReportStatus, required: false })
  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;

  @ApiProperty({ example: 'title', enum: ['title', 'type', 'status', 'createdAt'], required: false })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiProperty({ example: 'desc', enum: ['asc', 'desc'], required: false })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';

  @ApiProperty({ example: '2024-01-01', required: false })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiProperty({ example: '2024-12-31', required: false })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}

class ShareReportDto {
  @ApiProperty({ example: ['user1@example.com', 'user2@example.com'] })
  @IsArray()
  @IsString({ each: true })
  emails: string[];

  @ApiProperty({ example: 'Please review the attached Q3 carbon footprint report.' })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiProperty({ example: true })
  @IsOptional()
  @IsBoolean()
  allowDownload?: boolean = true;

  @ApiProperty({ example: '2024-12-31' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

class ScheduleReportDto {
  @ApiProperty({ enum: ReportFrequency, example: ReportFrequency.MONTHLY })
  @IsEnum(ReportFrequency)
  frequency: ReportFrequency;

  @ApiProperty({ example: '2024-12-01T09:00:00Z' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '0 9 1 * *' })
  @IsOptional()
  @IsString()
  cronExpression?: string;

  @ApiProperty({ example: { emailNotification: true, recipients: ['admin@example.com'] } })
  @IsOptional()
  schedulingOptions?: any;
}

@ApiTags('Reports')
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ReportsController {
  private readonly logger = new Logger(ReportsController.name);

  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  @Roles('admin', 'manager', 'user')
  @ApiOperation({
    summary: 'Get all reports',
    description: 'Retrieve a paginated list of reports with optional filtering',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiQuery({ name: 'search', required: false, example: 'carbon footprint' })
  @ApiQuery({ name: 'type', required: false, enum: ReportType })
  @ApiQuery({ name: 'status', required: false, enum: ReportStatus })
  @ApiQuery({ name: 'sortBy', required: false, example: 'createdAt' })
  @ApiQuery({ name: 'sortOrder', required: false, example: 'desc' })
  @ApiQuery({ name: 'dateFrom', required: false, example: '2024-01-01' })
  @ApiQuery({ name: 'dateTo', required: false, example: '2024-12-31' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Reports retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              title: { type: 'string' },
              description: { type: 'string' },
              type: { type: 'string', enum: Object.values(ReportType) },
              status: { type: 'string', enum: Object.values(ReportStatus) },
              format: { type: 'string', enum: Object.values(ReportFormat) },
              startDate: { type: 'string', format: 'date' },
              endDate: { type: 'string', format: 'date' },
              isScheduled: { type: 'boolean' },
              frequency: { type: 'string', enum: Object.values(ReportFrequency) },
              configuration: { type: 'object' },
              customization: { type: 'object' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
        },
        pagination: {
          type: 'object',
          properties: {
            page: { type: 'number' },
            limit: { type: 'number' },
            total: { type: 'number' },
            totalPages: { type: 'number' },
          },
        },
      },
    },
  })
  async findAll(
    @Query(ValidationPipe) query: QueryReportsDto,
    @GetUser('organizationId') organizationId: string,
  ) {
    this.logger.log(`Getting reports for organization: ${organizationId}`);
    return await this.reportsService.findAll(organizationId, query);
  }

  @Get(':id')
  @Roles('admin', 'manager', 'user')
  @ApiOperation({
    summary: 'Get report by ID',
    description: 'Retrieve a specific report by its ID',
  })
  @ApiParam({ name: 'id', description: 'Report UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Report retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Report not found',
  })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    this.logger.log(`Getting report: ${id} for organization: ${organizationId}`);
    return await this.reportsService.findOne(id, organizationId);
  }

  @Post()
  @Roles('admin', 'manager')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create new report',
    description: 'Create a new report configuration',
  })
  @ApiBody({ type: CreateReportDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Report created successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid report configuration',
  })
  async create(
    @Body(ValidationPipe) createReportDto: CreateReportDto,
    @GetUser('organizationId') organizationId: string,
    @GetUser('id') userId: string,
  ) {
    this.logger.log(`Creating report: ${createReportDto.title} for organization: ${organizationId}`);
    return await this.reportsService.create(createReportDto, organizationId, userId);
  }

  @Put(':id')
  @Roles('admin', 'manager')
  @ApiOperation({
    summary: 'Update report',
    description: 'Update an existing report configuration',
  })
  @ApiParam({ name: 'id', description: 'Report UUID' })
  @ApiBody({ type: UpdateReportDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Report updated successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Report not found',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) updateReportDto: UpdateReportDto,
    @GetUser('organizationId') organizationId: string,
    @GetUser('id') userId: string,
  ) {
    this.logger.log(`Updating report: ${id} for organization: ${organizationId}`);
    return await this.reportsService.update(id, updateReportDto, organizationId, userId);
  }

  @Delete(':id')
  @Roles('admin', 'manager')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete report',
    description: 'Delete a report (soft delete)',
  })
  @ApiParam({ name: 'id', description: 'Report UUID' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Report deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Report not found',
  })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser('organizationId') organizationId: string,
    @GetUser('id') userId: string,
  ) {
    this.logger.log(`Deleting report: ${id} for organization: ${organizationId}`);
    return await this.reportsService.remove(id, organizationId, userId);
  }

  @Post(':id/generate')
  @Roles('admin', 'manager')
  @ApiOperation({
    summary: 'Generate report',
    description: 'Generate the actual report file based on configuration',
  })
  @ApiParam({ name: 'id', description: 'Report UUID' })
  @ApiResponse({
    status: HttpStatus.ACCEPTED,
    description: 'Report generation initiated successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        jobId: { type: 'string' },
        estimatedDuration: { type: 'number' },
      },
    },
  })
  async generateReport(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser('organizationId') organizationId: string,
    @GetUser('id') userId: string,
  ) {
    this.logger.log(`Generating report: ${id} for organization: ${organizationId}`);
    return await this.reportsService.generateReport(id, organizationId, userId);
  }

  @Get(':id/download')
  @Roles('admin', 'manager', 'user')
  @ApiOperation({
    summary: 'Download report',
    description: 'Download the generated report file',
  })
  @ApiParam({ name: 'id', description: 'Report UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Report download URL generated successfully',
    schema: {
      type: 'object',
      properties: {
        downloadUrl: { type: 'string' },
        filename: { type: 'string' },
        expiresAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  async downloadReport(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    this.logger.log(`Downloading report: ${id} for organization: ${organizationId}`);
    return await this.reportsService.downloadReport(id, organizationId);
  }

  @Post(':id/share')
  @Roles('admin', 'manager')
  @ApiOperation({
    summary: 'Share report',
    description: 'Share report with specified users via email',
  })
  @ApiParam({ name: 'id', description: 'Report UUID' })
  @ApiBody({ type: ShareReportDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Report shared successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        sharedWith: { type: 'array', items: { type: 'string' } },
        shareId: { type: 'string' },
      },
    },
  })
  async shareReport(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) shareReportDto: ShareReportDto,
    @GetUser('organizationId') organizationId: string,
    @GetUser('id') userId: string,
  ) {
    this.logger.log(`Sharing report: ${id} for organization: ${organizationId}`);
    return await this.reportsService.shareReport(id, shareReportDto, organizationId, userId);
  }

  @Post(':id/schedule')
  @Roles('admin', 'manager')
  @ApiOperation({
    summary: 'Schedule report',
    description: 'Schedule automatic report generation',
  })
  @ApiParam({ name: 'id', description: 'Report UUID' })
  @ApiBody({ type: ScheduleReportDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Report scheduled successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        scheduleId: { type: 'string' },
        nextRunAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  async scheduleReport(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) scheduleReportDto: ScheduleReportDto,
    @GetUser('organizationId') organizationId: string,
    @GetUser('id') userId: string,
  ) {
    this.logger.log(`Scheduling report: ${id} for organization: ${organizationId}`);
    return await this.reportsService.scheduleReport(id, scheduleReportDto, organizationId, userId);
  }

  @Delete(':id/schedule')
  @Roles('admin', 'manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel scheduled report',
    description: 'Cancel automatic report generation schedule',
  })
  @ApiParam({ name: 'id', description: 'Report UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Report schedule cancelled successfully',
  })
  async cancelSchedule(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser('organizationId') organizationId: string,
    @GetUser('id') userId: string,
  ) {
    this.logger.log(`Cancelling report schedule: ${id} for organization: ${organizationId}`);
    return await this.reportsService.cancelSchedule(id, organizationId, userId);
  }

  @Get(':id/status')
  @Roles('admin', 'manager', 'user')
  @ApiOperation({
    summary: 'Get report status',
    description: 'Get detailed status information for a report',
  })
  @ApiParam({ name: 'id', description: 'Report UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Report status retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        status: { type: 'string', enum: Object.values(ReportStatus) },
        progress: { type: 'number' },
        message: { type: 'string' },
        startedAt: { type: 'string', format: 'date-time' },
        completedAt: { type: 'string', format: 'date-time' },
        error: { type: 'string' },
        fileSize: { type: 'number' },
        downloadCount: { type: 'number' },
      },
    },
  })
  async getStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    this.logger.log(`Getting status for report: ${id} for organization: ${organizationId}`);
    return await this.reportsService.getStatus(id, organizationId);
  }

  @Get('templates/available')
  @Roles('admin', 'manager', 'user')
  @ApiOperation({
    summary: 'Get available report templates',
    description: 'Retrieve list of available report templates',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Report templates retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          type: { type: 'string', enum: Object.values(ReportType) },
          preview: { type: 'string' },
          customizable: { type: 'boolean' },
          configuration: { type: 'object' },
        },
      },
    },
  })
  async getAvailableTemplates() {
    this.logger.log('Getting available report templates');
    return await this.reportsService.getAvailableTemplates();
  }

  @Get('analytics/summary')
  @Roles('admin', 'manager')
  @ApiOperation({
    summary: 'Get reports analytics summary',
    description: 'Retrieve analytics summary for all reports',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Reports analytics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        totalReports: { type: 'number' },
        reportsByType: { type: 'object' },
        reportsByStatus: { type: 'object' },
        scheduledReports: { type: 'number' },
        completionRate: { type: 'number' },
        averageGenerationTime: { type: 'number' },
        mostPopularTypes: { type: 'array' },
        trends: { type: 'array' },
      },
    },
  })
  async getAnalyticsSummary(
    @GetUser('organizationId') organizationId: string,
  ) {
    this.logger.log(`Getting reports analytics for organization: ${organizationId}`);
    return await this.reportsService.getAnalyticsSummary(organizationId);
  }
}