import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { DataSource } from '../entities/data-source.entity';
import { Organization } from '../entities/organization.entity';
import { DataSourceType, DataSourceStatus } from '../controllers/data-sources.controller';

// Interfaces
interface CreateDataSourceDto {
  name: string;
  description?: string;
  type: DataSourceType;
  configuration?: any;
  metadata?: any;
  isActive?: boolean;
}

interface UpdateDataSourceDto {
  name?: string;
  description?: string;
  type?: DataSourceType;
  configuration?: any;
  metadata?: any;
  isActive?: boolean;
  status?: DataSourceStatus;
}

interface QueryDataSourcesDto {
  page?: number;
  limit?: number;
  search?: string;
  type?: DataSourceType;
  status?: DataSourceStatus;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface TestConnectionOptions {
  timeout?: number;
  validateSchema?: boolean;
  sampleSize?: number;
}

@Injectable()
export class DataSourcesService {
  private readonly logger = new Logger(DataSourcesService.name);

  constructor(
    @InjectRepository(DataSource)
    private readonly dataSourceRepository: Repository<DataSource>,
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    @InjectQueue('data-sync')
    private readonly dataSyncQueue: Queue,
  ) {}

  async findAll(organizationId: string, query: QueryDataSourcesDto) {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        type,
        status,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = query;

      const queryBuilder = this.dataSourceRepository
        .createQueryBuilder('dataSource')
        .where('dataSource.organizationId = :organizationId', { organizationId })
        .andWhere('dataSource.deletedAt IS NULL');

      // Apply search filter
      if (search) {
        queryBuilder.andWhere(
          '(dataSource.name ILIKE :search OR dataSource.description ILIKE :search)',
          { search: `%${search}%` }
        );
      }

      // Apply type filter
      if (type) {
        queryBuilder.andWhere('dataSource.type = :type', { type });
      }

      // Apply status filter
      if (status) {
        queryBuilder.andWhere('dataSource.status = :status', { status });
      }

      // Apply sorting
      const validSortFields = ['name', 'type', 'status', 'createdAt', 'updatedAt'];
      const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
      queryBuilder.orderBy(`dataSource.${sortField}`, sortOrder.toUpperCase() as 'ASC' | 'DESC');

      // Apply pagination
      const skip = (page - 1) * limit;
      queryBuilder.skip(skip).take(limit);

      const [dataSources, total] = await queryBuilder.getManyAndCount();

      return {
        data: dataSources,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error(`Failed to retrieve data sources for organization ${organizationId}:`, error);
      throw new BadRequestException('Failed to retrieve data sources');
    }
  }

  async findOne(id: string, organizationId: string): Promise<DataSource> {
    const dataSource = await this.dataSourceRepository.findOne({
      where: {
        id,
        organizationId,
        deletedAt: null,
      },
      relations: ['organization'],
    });

    if (!dataSource) {
      throw new NotFoundException(`Data source with ID ${id} not found`);
    }

    return dataSource;
  }

  async create(
    createDataSourceDto: CreateDataSourceDto,
    organizationId: string,
    userId: string,
  ): Promise<DataSource> {
    try {
      // Verify organization exists
      const organization = await this.organizationRepository.findOne({
        where: { id: organizationId },
      });

      if (!organization) {
        throw new NotFoundException(`Organization with ID ${organizationId} not found`);
      }

      // Validate configuration based on type
      this.validateConfiguration(createDataSourceDto.type, createDataSourceDto.configuration);

      // Create data source
      const dataSource = this.dataSourceRepository.create({
        ...createDataSourceDto,
        organizationId,
        status: DataSourceStatus.CONFIGURED,
        createdBy: userId,
        configuration: this.sanitizeConfiguration(createDataSourceDto.configuration),
      });

      const savedDataSource = await this.dataSourceRepository.save(dataSource);

      this.logger.log(`Data source created: ${savedDataSource.id} by user: ${userId}`);

      return savedDataSource;
    } catch (error) {
      this.logger.error(`Failed to create data source:`, error);
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to create data source');
    }
  }

  async update(
    id: string,
    updateDataSourceDto: UpdateDataSourceDto,
    organizationId: string,
    userId: string,
  ): Promise<DataSource> {
    const dataSource = await this.findOne(id, organizationId);

    try {
      // Validate configuration if provided
      if (updateDataSourceDto.configuration && updateDataSourceDto.type) {
        this.validateConfiguration(updateDataSourceDto.type, updateDataSourceDto.configuration);
      } else if (updateDataSourceDto.configuration) {
        this.validateConfiguration(dataSource.type as DataSourceType, updateDataSourceDto.configuration);
      }

      // Update fields
      Object.assign(dataSource, {
        ...updateDataSourceDto,
        updatedBy: userId,
        configuration: updateDataSourceDto.configuration
          ? this.sanitizeConfiguration(updateDataSourceDto.configuration)
          : dataSource.configuration,
      });

      const savedDataSource = await this.dataSourceRepository.save(dataSource);

      this.logger.log(`Data source updated: ${id} by user: ${userId}`);

      return savedDataSource;
    } catch (error) {
      this.logger.error(`Failed to update data source ${id}:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to update data source');
    }
  }

  async remove(id: string, organizationId: string, userId: string): Promise<void> {
    const dataSource = await this.findOne(id, organizationId);

    try {
      // Soft delete
      dataSource.deletedAt = new Date();
      dataSource.deletedBy = userId;
      dataSource.isActive = false;

      await this.dataSourceRepository.save(dataSource);

      this.logger.log(`Data source soft deleted: ${id} by user: ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to delete data source ${id}:`, error);
      throw new BadRequestException('Failed to delete data source');
    }
  }

  async testConnection(
    id: string,
    organizationId: string,
    options?: TestConnectionOptions,
  ) {
    const dataSource = await this.findOne(id, organizationId);

    try {
      const testOptions = {
        timeout: options?.timeout || 30000,
        validateSchema: options?.validateSchema || true,
        sampleSize: options?.sampleSize || 5,
      };

      const testResults = await this.performConnectionTest(dataSource, testOptions);

      // Update data source status based on test results
      if (testResults.success) {
        dataSource.status = DataSourceStatus.ACTIVE;
        dataSource.lastTestedAt = new Date();
      } else {
        dataSource.status = DataSourceStatus.ERROR;
      }

      await this.dataSourceRepository.save(dataSource);

      this.logger.log(`Data source test completed: ${id}, success: ${testResults.success}`);

      return testResults;
    } catch (error) {
      this.logger.error(`Failed to test data source ${id}:`, error);
      
      // Update status to error
      dataSource.status = DataSourceStatus.ERROR;
      await this.dataSourceRepository.save(dataSource);

      return {
        success: false,
        message: 'Connection test failed',
        details: { error: error.message },
        testResults: {
          connectionTest: false,
          authenticationTest: false,
          dataValidationTest: false,
          sampleData: [],
        },
      };
    }
  }

  async triggerSync(id: string, organizationId: string, userId: string) {
    const dataSource = await this.findOne(id, organizationId);

    if (!dataSource.isActive || dataSource.status !== DataSourceStatus.ACTIVE) {
      throw new BadRequestException('Data source must be active and properly configured for sync');
    }

    try {
      // Add sync job to queue
      const job = await this.dataSyncQueue.add('sync-data-source', {
        dataSourceId: id,
        organizationId,
        userId,
        triggeredAt: new Date(),
      }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      });

      this.logger.log(`Data sync job queued: ${job.id} for data source: ${id}`);

      return {
        message: 'Data sync initiated successfully',
        syncJobId: job.id.toString(),
        estimatedDuration: this.estimateSyncDuration(dataSource.type as DataSourceType),
      };
    } catch (error) {
      this.logger.error(`Failed to trigger sync for data source ${id}:`, error);
      throw new BadRequestException('Failed to initiate data sync');
    }
  }

  async getStatus(id: string, organizationId: string) {
    const dataSource = await this.findOne(id, organizationId);

    try {
      // Get additional status information
      const stats = await this.getDataSourceStats(id);
      const qualityMetrics = await this.getDataQualityMetrics(id);

      return {
        id: dataSource.id,
        status: dataSource.status,
        isActive: dataSource.isActive,
        lastSyncAt: dataSource.lastSyncAt,
        lastSyncStatus: dataSource.lastSyncStatus,
        nextSyncAt: this.calculateNextSyncTime(dataSource),
        errorCount: stats.errorCount,
        successCount: stats.successCount,
        dataQuality: qualityMetrics,
      };
    } catch (error) {
      this.logger.error(`Failed to get status for data source ${id}:`, error);
      throw new BadRequestException('Failed to retrieve data source status');
    }
  }

  async getMetrics(id: string, organizationId: string, period: string) {
    const dataSource = await this.findOne(id, organizationId);

    try {
      const metrics = await this.calculateMetrics(id, period);
      
      return {
        dataSource: {
          id: dataSource.id,
          name: dataSource.name,
          type: dataSource.type,
        },
        period,
        metrics,
        generatedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to get metrics for data source ${id}:`, error);
      throw new BadRequestException('Failed to retrieve data source metrics');
    }
  }

  async getSupportedTypes() {
    return [
      {
        type: DataSourceType.CSV_UPLOAD,
        name: 'CSV File Upload',
        description: 'Upload CSV files containing emission data',
        configurationSchema: {
          required: ['columnMapping'],
          properties: {
            columnMapping: { type: 'object' },
            delimiter: { type: 'string', default: ',' },
            hasHeader: { type: 'boolean', default: true },
          },
        },
        features: ['batch_processing', 'data_validation', 'column_mapping'],
      },
      {
        type: DataSourceType.API_INTEGRATION,
        name: 'API Integration',
        description: 'Connect to external APIs for real-time data',
        configurationSchema: {
          required: ['endpoint'],
          properties: {
            endpoint: { type: 'string', format: 'uri' },
            authentication: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['none', 'api_key', 'bearer', 'oauth'] },
                credentials: { type: 'object' },
              },
            },
            polling: {
              type: 'object',
              properties: {
                interval: { type: 'number', minimum: 300 }, // 5 minutes minimum
                enabled: { type: 'boolean', default: true },
              },
            },
          },
        },
        features: ['real_time', 'polling', 'authentication', 'rate_limiting'],
      },
      {
        type: DataSourceType.DATABASE_CONNECTION,
        name: 'Database Connection',
        description: 'Connect to external databases',
        configurationSchema: {
          required: ['connectionString', 'query'],
          properties: {
            connectionString: { type: 'string' },
            query: { type: 'string' },
            schedule: { type: 'string' }, // cron expression
          },
        },
        features: ['scheduled_sync', 'custom_queries', 'connection_pooling'],
      },
      {
        type: DataSourceType.IOT_SENSOR,
        name: 'IoT Sensor',
        description: 'Collect data from IoT sensors',
        configurationSchema: {
          required: ['protocol', 'deviceId'],
          properties: {
            protocol: { type: 'string', enum: ['mqtt', 'http', 'coap'] },
            deviceId: { type: 'string' },
            endpoint: { type: 'string' },
            credentials: { type: 'object' },
          },
        },
        features: ['real_time', 'device_management', 'protocol_support'],
      },
      {
        type: DataSourceType.MANUAL_ENTRY,
        name: 'Manual Entry',
        description: 'Manually enter data through forms',
        configurationSchema: {
          required: ['formSchema'],
          properties: {
            formSchema: { type: 'object' },
            validation: { type: 'object' },
          },
        },
        features: ['form_builder', 'validation', 'approval_workflow'],
      },
      {
        type: DataSourceType.THIRD_PARTY_PROVIDER,
        name: 'Third-Party Provider',
        description: 'Connect to third-party data providers',
        configurationSchema: {
          required: ['provider', 'credentials'],
          properties: {
            provider: { type: 'string' },
            credentials: { type: 'object' },
            mapping: { type: 'object' },
          },
        },
        features: ['provider_integration', 'data_mapping', 'automatic_updates'],
      },
    ];
  }

  // Private helper methods
  private validateConfiguration(type: DataSourceType, configuration: any): void {
    if (!configuration) return;

    const supportedTypes = this.getSupportedTypes();
    const typeConfig = supportedTypes.find(t => t.type === type);
    
    if (!typeConfig) {
      throw new BadRequestException(`Unsupported data source type: ${type}`);
    }

    // Basic validation - you can extend this with proper JSON schema validation
    const required = typeConfig.configurationSchema.required || [];
    for (const field of required) {
      if (!configuration[field]) {
        throw new BadRequestException(`Required configuration field missing: ${field}`);
      }
    }
  }

  private sanitizeConfiguration(configuration: any): any {
    if (!configuration) return configuration;

    // Remove sensitive fields from logs and sanitize
    const sanitized = { ...configuration };
    
    // Remove passwords, API keys, etc.
    if (sanitized.credentials) {
      Object.keys(sanitized.credentials).forEach(key => {
        if (key.toLowerCase().includes('password') || 
            key.toLowerCase().includes('secret') ||
            key.toLowerCase().includes('key')) {
          sanitized.credentials[key] = '[REDACTED]';
        }
      });
    }

    return sanitized;
  }

  private async performConnectionTest(dataSource: DataSource, options: TestConnectionOptions) {
    // Mock implementation - replace with actual testing logic
    const type = dataSource.type as DataSourceType;
    
    switch (type) {
      case DataSourceType.API_INTEGRATION:
        return await this.testApiConnection(dataSource, options);
      case DataSourceType.DATABASE_CONNECTION:
        return await this.testDatabaseConnection(dataSource, options);
      case DataSourceType.IOT_SENSOR:
        return await this.testIoTConnection(dataSource, options);
      default:
        return {
          success: true,
          message: 'Connection test completed successfully',
          details: { type: 'mock_test' },
          testResults: {
            connectionTest: true,
            authenticationTest: true,
            dataValidationTest: true,
            sampleData: [],
          },
        };
    }
  }

  private async testApiConnection(dataSource: DataSource, options: TestConnectionOptions) {
    // Mock API test implementation
    return {
      success: true,
      message: 'API connection test successful',
      details: { endpoint: dataSource.configuration?.endpoint },
      testResults: {
        connectionTest: true,
        authenticationTest: true,
        dataValidationTest: true,
        sampleData: [{ timestamp: new Date(), value: 100 }],
      },
    };
  }

  private async testDatabaseConnection(dataSource: DataSource, options: TestConnectionOptions) {
    // Mock database test implementation
    return {
      success: true,
      message: 'Database connection test successful',
      details: { query: dataSource.configuration?.query },
      testResults: {
        connectionTest: true,
        authenticationTest: true,
        dataValidationTest: true,
        sampleData: [{ id: 1, data: 'sample' }],
      },
    };
  }

  private async testIoTConnection(dataSource: DataSource, options: TestConnectionOptions) {
    // Mock IoT test implementation
    return {
      success: true,
      message: 'IoT connection test successful',
      details: { deviceId: dataSource.configuration?.deviceId },
      testResults: {
        connectionTest: true,
        authenticationTest: true,
        dataValidationTest: true,
        sampleData: [{ sensor: 'temp', value: 25.5 }],
      },
    };
  }

  private async getDataSourceStats(id: string) {
    // Mock implementation - replace with actual stats queries
    return {
      errorCount: 0,
      successCount: 100,
      totalSyncs: 100,
      averageResponseTime: 150,
    };
  }

  private async getDataQualityMetrics(id: string) {
    // Mock implementation - replace with actual quality calculations
    return {
      score: 0.95,
      completeness: 0.98,
      accuracy: 0.92,
      consistency: 0.96,
    };
  }

  private calculateNextSyncTime(dataSource: DataSource): Date | null {
    if (!dataSource.isActive || !dataSource.metadata?.polling?.interval) {
      return null;
    }

    const interval = dataSource.metadata.polling.interval * 1000; // Convert to milliseconds
    const lastSync = dataSource.lastSyncAt || new Date();
    return new Date(lastSync.getTime() + interval);
  }

  private estimateSyncDuration(type: DataSourceType): number {
    // Return estimated duration in seconds
    const durations = {
      [DataSourceType.CSV_UPLOAD]: 30,
      [DataSourceType.API_INTEGRATION]: 60,
      [DataSourceType.DATABASE_CONNECTION]: 120,
      [DataSourceType.IOT_SENSOR]: 15,
      [DataSourceType.MANUAL_ENTRY]: 5,
      [DataSourceType.THIRD_PARTY_PROVIDER]: 90,
    };

    return durations[type] || 60;
  }

  private async calculateMetrics(id: string, period: string) {
    // Mock implementation - replace with actual metrics calculations
    return {
      totalRecords: 1000,
      recordsPerDay: 33.3,
      errorRate: 0.02,
      averageLatency: 120,
      dataVolume: '2.5MB',
      syncFrequency: '1 hour',
      uptime: 0.999,
    };
  }
}