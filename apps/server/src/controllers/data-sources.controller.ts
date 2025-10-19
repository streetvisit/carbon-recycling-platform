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
import { IsString, IsOptional, IsEnum, IsNumber, IsBoolean, Min, Max } from 'class-validator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { GetUser } from '../decorators/get-user.decorator';
import { DataSourcesService } from '../services/data-sources.service';

// Enums
export enum DataSourceType {
  CSV_UPLOAD = 'csv_upload',
  API_INTEGRATION = 'api_integration',
  DATABASE_CONNECTION = 'database_connection',
  IOT_SENSOR = 'iot_sensor',
  MANUAL_ENTRY = 'manual_entry',
  THIRD_PARTY_PROVIDER = 'third_party_provider',
}

export enum DataSourceStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  CONFIGURED = 'configured',
  ERROR = 'error',
  TESTING = 'testing',
}

// DTOs
class CreateDataSourceDto {
  @ApiProperty({ example: 'Energy Consumption API' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Energy consumption data from building management system' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: DataSourceType, example: DataSourceType.API_INTEGRATION })
  @IsEnum(DataSourceType)
  type: DataSourceType;

  @ApiProperty({ example: { endpoint: 'https://api.building.com/energy', apiKey: 'key123' } })
  @IsOptional()
  configuration?: any;

  @ApiProperty({ example: { frequency: 'hourly', format: 'json' } })
  @IsOptional()
  metadata?: any;

  @ApiProperty({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}

class UpdateDataSourceDto {
  @ApiProperty({ example: 'Updated Energy API', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: 'Updated description', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: DataSourceType, required: false })
  @IsOptional()
  @IsEnum(DataSourceType)
  type?: DataSourceType;

  @ApiProperty({ example: { endpoint: 'https://api.building.com/energy/v2' }, required: false })
  @IsOptional()
  configuration?: any;

  @ApiProperty({ example: { frequency: 'daily', format: 'json' }, required: false })
  @IsOptional()
  metadata?: any;

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ enum: DataSourceStatus, required: false })
  @IsOptional()
  @IsEnum(DataSourceStatus)
  status?: DataSourceStatus;
}

class QueryDataSourcesDto {
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

  @ApiProperty({ example: 'energy', required: false })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ enum: DataSourceType, required: false })
  @IsOptional()
  @IsEnum(DataSourceType)
  type?: DataSourceType;

  @ApiProperty({ enum: DataSourceStatus, required: false })
  @IsOptional()
  @IsEnum(DataSourceStatus)
  status?: DataSourceStatus;

  @ApiProperty({ example: 'name', enum: ['name', 'type', 'status', 'createdAt'], required: false })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiProperty({ example: 'desc', enum: ['asc', 'desc'], required: false })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';
}

class TestDataSourceDto {
  @ApiProperty({ example: { timeout: 30000, validateSchema: true } })
  @IsOptional()
  testOptions?: {
    timeout?: number;
    validateSchema?: boolean;
    sampleSize?: number;
  };
}

@ApiTags('Data Sources')
@Controller('data-sources')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DataSourcesController {
  private readonly logger = new Logger(DataSourcesController.name);

  constructor(private readonly dataSourcesService: DataSourcesService) {}

  @Get()
  @Roles('admin', 'manager', 'user')
  @ApiOperation({
    summary: 'Get all data sources',
    description: 'Retrieve a paginated list of data sources with optional filtering',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiQuery({ name: 'search', required: false, example: 'energy' })
  @ApiQuery({ name: 'type', required: false, enum: DataSourceType })
  @ApiQuery({ name: 'status', required: false, enum: DataSourceStatus })
  @ApiQuery({ name: 'sortBy', required: false, example: 'createdAt' })
  @ApiQuery({ name: 'sortOrder', required: false, example: 'desc' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Data sources retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
              description: { type: 'string' },
              type: { type: 'string', enum: Object.values(DataSourceType) },
              status: { type: 'string', enum: Object.values(DataSourceStatus) },
              isActive: { type: 'boolean' },
              configuration: { type: 'object' },
              metadata: { type: 'object' },
              organizationId: { type: 'string', format: 'uuid' },
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
    @Query(ValidationPipe) query: QueryDataSourcesDto,
    @GetUser('organizationId') organizationId: string,
  ) {
    this.logger.log(`Getting data sources for organization: ${organizationId}`);
    return await this.dataSourcesService.findAll(organizationId, query);
  }

  @Get(':id')
  @Roles('admin', 'manager', 'user')
  @ApiOperation({
    summary: 'Get data source by ID',
    description: 'Retrieve a specific data source by its ID',
  })
  @ApiParam({ name: 'id', description: 'Data source UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Data source retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Data source not found',
  })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    this.logger.log(`Getting data source: ${id} for organization: ${organizationId}`);
    return await this.dataSourcesService.findOne(id, organizationId);
  }

  @Post()
  @Roles('admin', 'manager')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create new data source',
    description: 'Create a new data source configuration',
  })
  @ApiBody({ type: CreateDataSourceDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Data source created successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid data source configuration',
  })
  async create(
    @Body(ValidationPipe) createDataSourceDto: CreateDataSourceDto,
    @GetUser('organizationId') organizationId: string,
    @GetUser('id') userId: string,
  ) {
    this.logger.log(`Creating data source: ${createDataSourceDto.name} for organization: ${organizationId}`);
    return await this.dataSourcesService.create(createDataSourceDto, organizationId, userId);
  }

  @Put(':id')
  @Roles('admin', 'manager')
  @ApiOperation({
    summary: 'Update data source',
    description: 'Update an existing data source configuration',
  })
  @ApiParam({ name: 'id', description: 'Data source UUID' })
  @ApiBody({ type: UpdateDataSourceDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Data source updated successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Data source not found',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) updateDataSourceDto: UpdateDataSourceDto,
    @GetUser('organizationId') organizationId: string,
    @GetUser('id') userId: string,
  ) {
    this.logger.log(`Updating data source: ${id} for organization: ${organizationId}`);
    return await this.dataSourcesService.update(id, updateDataSourceDto, organizationId, userId);
  }

  @Delete(':id')
  @Roles('admin', 'manager')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete data source',
    description: 'Delete a data source (soft delete)',
  })
  @ApiParam({ name: 'id', description: 'Data source UUID' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Data source deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Data source not found',
  })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser('organizationId') organizationId: string,
    @GetUser('id') userId: string,
  ) {
    this.logger.log(`Deleting data source: ${id} for organization: ${organizationId}`);
    return await this.dataSourcesService.remove(id, organizationId, userId);
  }

  @Post(':id/test')
  @Roles('admin', 'manager')
  @ApiOperation({
    summary: 'Test data source connection',
    description: 'Test the connection and configuration of a data source',
  })
  @ApiParam({ name: 'id', description: 'Data source UUID' })
  @ApiBody({ type: TestDataSourceDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Data source test completed',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        details: { type: 'object' },
        testResults: {
          type: 'object',
          properties: {
            connectionTest: { type: 'boolean' },
            authenticationTest: { type: 'boolean' },
            dataValidationTest: { type: 'boolean' },
            sampleData: { type: 'array' },
          },
        },
      },
    },
  })
  async testConnection(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) testOptions: TestDataSourceDto,
    @GetUser('organizationId') organizationId: string,
  ) {
    this.logger.log(`Testing data source: ${id} for organization: ${organizationId}`);
    return await this.dataSourcesService.testConnection(id, organizationId, testOptions.testOptions);
  }

  @Post(':id/sync')
  @Roles('admin', 'manager')
  @ApiOperation({
    summary: 'Trigger data sync',
    description: 'Manually trigger data synchronization for a data source',
  })
  @ApiParam({ name: 'id', description: 'Data source UUID' })
  @ApiResponse({
    status: HttpStatus.ACCEPTED,
    description: 'Data sync initiated successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        syncJobId: { type: 'string' },
        estimatedDuration: { type: 'number' },
      },
    },
  })
  async triggerSync(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser('organizationId') organizationId: string,
    @GetUser('id') userId: string,
  ) {
    this.logger.log(`Triggering sync for data source: ${id} for organization: ${organizationId}`);
    return await this.dataSourcesService.triggerSync(id, organizationId, userId);
  }

  @Get(':id/status')
  @Roles('admin', 'manager', 'user')
  @ApiOperation({
    summary: 'Get data source status',
    description: 'Get detailed status information for a data source',
  })
  @ApiParam({ name: 'id', description: 'Data source UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Data source status retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        status: { type: 'string', enum: Object.values(DataSourceStatus) },
        isActive: { type: 'boolean' },
        lastSyncAt: { type: 'string', format: 'date-time' },
        lastSyncStatus: { type: 'string' },
        nextSyncAt: { type: 'string', format: 'date-time' },
        errorCount: { type: 'number' },
        successCount: { type: 'number' },
        dataQuality: {
          type: 'object',
          properties: {
            score: { type: 'number' },
            completeness: { type: 'number' },
            accuracy: { type: 'number' },
            consistency: { type: 'number' },
          },
        },
      },
    },
  })
  async getStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    this.logger.log(`Getting status for data source: ${id} for organization: ${organizationId}`);
    return await this.dataSourcesService.getStatus(id, organizationId);
  }

  @Get(':id/metrics')
  @Roles('admin', 'manager', 'user')
  @ApiOperation({
    summary: 'Get data source metrics',
    description: 'Get performance and usage metrics for a data source',
  })
  @ApiParam({ name: 'id', description: 'Data source UUID' })
  @ApiQuery({ name: 'period', required: false, example: '30d' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Data source metrics retrieved successfully',
  })
  async getMetrics(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('period') period: string = '30d',
    @GetUser('organizationId') organizationId: string,
  ) {
    this.logger.log(`Getting metrics for data source: ${id} for organization: ${organizationId}`);
    return await this.dataSourcesService.getMetrics(id, organizationId, period);
  }

  @Get('types/supported')
  @Roles('admin', 'manager', 'user')
  @ApiOperation({
    summary: 'Get supported data source types',
    description: 'Retrieve list of supported data source types and their configurations',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Supported data source types retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: Object.values(DataSourceType) },
          name: { type: 'string' },
          description: { type: 'string' },
          configurationSchema: { type: 'object' },
          features: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  })
  async getSupportedTypes() {
    this.logger.log('Getting supported data source types');
    return await this.dataSourcesService.getSupportedTypes();
  }
}