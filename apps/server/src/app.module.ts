import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { CacheModule } from '@nestjs/cache-manager';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';

// Guards
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

// Interceptors
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { TransformInterceptor } from './interceptors/transform.interceptor';

// Filters
import { GlobalExceptionFilter } from './filters/global-exception.filter';

// Controllers
import { AnalyticsMlController } from './controllers/analytics-ml.controller';
import { AdvancedReportingController } from './controllers/advanced-reporting.controller';
import { GapAnalysisController } from './controllers/gap-analysis.controller';
import { EmissionsController } from './controllers/emissions.controller';
import { DataSourcesController } from './controllers/data-sources.controller';
import { SuppliersController } from './controllers/suppliers.controller';
import { ReportsController } from './controllers/reports.controller';
import { UsersController } from './controllers/users.controller';
import { AuthController } from './controllers/auth.controller';
import { MonitoringController } from './controllers/monitoring.controller';

// Services
import { AnalyticsMlService } from './services/analytics-ml.service';
import { AdvancedReportingService } from './services/advanced-reporting.service';
import { GapAnalysisService } from './services/gap-analysis.service';
import { CollaborativeInitiativesService } from './services/collaborative-initiatives.service';
import { DataValidationService } from './services/data-validation.service';
import { EmailService } from './services/email.service';
import { FileStorageService } from './services/file-storage.service';
import { MonitoringAlertsService } from './services/monitoring-alerts.service';
import { Scope3CollectionService } from './services/scope3-collection.service';
import { EmissionsService } from './services/emissions.service';
import { DataSourcesService } from './services/data-sources.service';
import { SuppliersService } from './services/suppliers.service';
import { ReportsService } from './services/reports.service';
import { UsersService } from './services/users.service';
import { AuthService } from './services/auth.service';

// Entities
import { User } from './entities/user.entity';
import { Organization } from './entities/organization.entity';
import { DataSource } from './entities/data-source.entity';
import { EmissionFactor } from './entities/emission-factor.entity';
import { ActivityData } from './entities/activity-data.entity';
import { EmissionCalculation } from './entities/emission-calculation.entity';
import { Supplier } from './entities/supplier.entity';
import { Report } from './entities/report.entity';
import { MLModel } from './entities/ml-model.entity';
import { AnalyticsInsight } from './entities/analytics-insight.entity';
import { Alert } from './entities/alert.entity';
import { Notification } from './entities/notification.entity';
import { AuditLog } from './entities/audit-log.entity';
import { Collaboration } from './entities/collaboration.entity';
import { DataRequest } from './entities/data-request.entity';
import { Document } from './entities/document.entity';

// Middleware
import { RequestIdMiddleware } from './middleware/request-id.middleware';
import { LoggerMiddleware } from './middleware/logger.middleware';
import { RateLimitMiddleware } from './middleware/rate-limit.middleware';

// Jobs/Tasks
import { DataSyncTask } from './tasks/data-sync.task';
import { ReportGenerationTask } from './tasks/report-generation.task';
import { AlertProcessor } from './tasks/alert-processor.task';
import { CleanupTask } from './tasks/cleanup.task';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      validationOptions: {
        allowUnknown: false,
        abortEarly: true,
      },
    }),

    // Database
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'sqlite',
        database: process.env.DATABASE_URL || 'data/carbon-platform.db',
        entities: [
          User,
          Organization,
          DataSource,
          EmissionFactor,
          ActivityData,
          EmissionCalculation,
          Supplier,
          Report,
          MLModel,
          AnalyticsInsight,
          Alert,
          Notification,
          AuditLog,
          Collaboration,
          DataRequest,
          Document,
        ],
        synchronize: process.env.NODE_ENV === 'development',
        logging: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
        migrations: ['dist/migrations/*.js'],
        migrationsRun: true,
      }),
    }),

    // Feature repositories
    TypeOrmModule.forFeature([
      User,
      Organization,
      DataSource,
      EmissionFactor,
      ActivityData,
      EmissionCalculation,
      Supplier,
      Report,
      MLModel,
      AnalyticsInsight,
      Alert,
      Notification,
      AuditLog,
      Collaboration,
      DataRequest,
      Document,
    ]),

    // Task scheduling
    ScheduleModule.forRoot(),

    // Queue management
    BullModule.forRootAsync({
      useFactory: () => ({
        redis: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT) || 6379,
          password: process.env.REDIS_PASSWORD,
          db: parseInt(process.env.REDIS_DB) || 0,
        },
        defaultJobOptions: {
          removeOnComplete: 10,
          removeOnFail: 5,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      }),
    }),

    // Queue definitions
    BullModule.registerQueue(
      { name: 'data-sync' },
      { name: 'report-generation' },
      { name: 'alerts' },
      { name: 'cleanup' }
    ),

    // Caching
    CacheModule.register({
      isGlobal: true,
      ttl: parseInt(process.env.CACHE_TTL) || 300, // 5 minutes
      max: parseInt(process.env.CACHE_MAX_ITEMS) || 1000,
    }),
  ],

  controllers: [
    AnalyticsMlController,
    AdvancedReportingController,
    GapAnalysisController,
    EmissionsController,
    DataSourcesController,
    SuppliersController,
    ReportsController,
    UsersController,
    AuthController,
    MonitoringController,
  ],

  providers: [
    // Core Services
    AnalyticsMlService,
    AdvancedReportingService,
    GapAnalysisService,
    CollaborativeInitiativesService,
    DataValidationService,
    EmailService,
    FileStorageService,
    MonitoringAlertsService,
    Scope3CollectionService,
    EmissionsService,
    DataSourcesService,
    SuppliersService,
    ReportsService,
    UsersService,
    AuthService,

    // Background Tasks
    DataSyncTask,
    ReportGenerationTask,
    AlertProcessor,
    CleanupTask,

    // Global Guards
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },

    // Global Interceptors
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },

    // Global Filters
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],

  exports: [
    // Export services for potential use in other modules
    AnalyticsMlService,
    AdvancedReportingService,
    GapAnalysisService,
    EmissionsService,
    DataSourcesService,
    SuppliersService,
    ReportsService,
    UsersService,
    AuthService,
    EmailService,
    FileStorageService,
    DataValidationService,
    MonitoringAlertsService,
  ],
})
export class AppModule {
  constructor() {
    console.log('🚀 Carbon Recycling Platform AppModule initialized');
    console.log('📊 Database entities loaded:', [
      'User', 'Organization', 'DataSource', 'EmissionFactor', 'ActivityData',
      'EmissionCalculation', 'Supplier', 'Report', 'MLModel', 'AnalyticsInsight',
      'Alert', 'Notification', 'AuditLog', 'Collaboration', 'DataRequest', 'Document'
    ].length);
    console.log('🔧 Services loaded:', [
      'Analytics & ML', 'Advanced Reporting', 'Gap Analysis', 'Emissions',
      'Data Sources', 'Suppliers', 'Reports', 'Users', 'Auth', 'Email',
      'File Storage', 'Monitoring', 'Validation', 'Collaboration'
    ].length);
    console.log('🎯 Controllers loaded:', [
      'Analytics & ML', 'Advanced Reporting', 'Gap Analysis', 'Emissions',
      'Data Sources', 'Suppliers', 'Reports', 'Users', 'Auth', 'Monitoring'
    ].length);
  }
}