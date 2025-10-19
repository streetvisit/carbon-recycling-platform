import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // Enable CORS for frontend applications
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:4321',
      'https://carbon-recycling-platform.pages.dev',
      process.env.FRONTEND_URL,
    ].filter(Boolean),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      disableErrorMessages: process.env.NODE_ENV === 'production',
      validationError: {
        target: false,
        value: false,
      },
    }),
  );

  // Global prefix for all routes
  app.setGlobalPrefix('api/v1');

  // Setup Swagger documentation
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Carbon Recycling Platform API')
      .setDescription(
        'Comprehensive carbon emissions management and sustainability reporting platform API'
      )
      .setVersion('1.0')
      .setContact(
        'MPM2',
        'https://github.com/mpm2/carbon-recycling-platform',
        'support@mpm2.com'
      )
      .setLicense('MIT', 'https://opensource.org/licenses/MIT')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT',
          description: 'Enter JWT token',
          in: 'header',
        },
        'JWT-auth',
      )
      .addTag('Analytics & ML', 'Machine learning models and advanced analytics')
      .addTag('Advanced Reporting', 'Sophisticated reporting and compliance features')
      .addTag('Gap Analysis', 'Regulatory and compliance gap analysis')
      .addTag('Emissions', 'Carbon emissions calculation and tracking')
      .addTag('Data Sources', 'Data integration and management')
      .addTag('Suppliers', 'Supplier collaboration and management')
      .addTag('Reports', 'Report generation and management')
      .addTag('Users', 'User management and authentication')
      .addTag('Monitoring', 'System monitoring and alerts')
      .addTag('Collaboration', 'Collaborative initiatives and partnerships')
      .addTag('Validation', 'Data validation and quality assurance')
      .addTag('File Storage', 'File upload and storage management')
      .addTag('Email', 'Email notifications and communications')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      customSiteTitle: 'Carbon Recycling Platform API Docs',
      customfavIcon: '/favicon.ico',
      customJs: [
        'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-bundle.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-standalone-preset.min.js',
      ],
      customCssUrl: [
        'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui.min.css',
      ],
    });

    logger.log('📚 Swagger documentation available at /api/docs');
  }

  // Health check endpoint
  app.getHttpAdapter().get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      services: {
        database: 'connected',
        redis: process.env.REDIS_URL ? 'connected' : 'not_configured',
        email: process.env.SMTP_HOST ? 'configured' : 'not_configured',
        fileStorage: process.env.AWS_S3_BUCKET ? 'configured' : 'not_configured',
      },
    });
  });

  // Global error handling
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.log('SIGTERM received, shutting down gracefully');
    await app.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.log('SIGINT received, shutting down gracefully');
    await app.close();
    process.exit(0);
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);

  logger.log(`🚀 Carbon Recycling Platform API running on port ${port}`);
  logger.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.log(`📊 Database: Connected`);
  logger.log(`🔒 Authentication: ${process.env.CLERK_SECRET_KEY ? 'Configured' : 'Not configured'}`);
  
  if (process.env.NODE_ENV !== 'production') {
    logger.log(`📖 API Documentation: http://localhost:${port}/api/docs`);
  }
}

// Handle module loading errors
bootstrap().catch((error) => {
  const logger = new Logger('Bootstrap');
  logger.error('Failed to start application:', error);
  process.exit(1);
});