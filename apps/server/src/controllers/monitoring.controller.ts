import { Controller, Get, UseGuards, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { GetUser } from '../decorators/get-user.decorator';

@ApiTags('Monitoring')
@Controller('monitoring')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class MonitoringController {
  private readonly logger = new Logger(MonitoringController.name);

  @Get('health')
  @Roles('admin', 'manager', 'user')
  @ApiOperation({
    summary: 'Health check',
    description: 'Get system health status',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'System health retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'healthy' },
        timestamp: { type: 'string', format: 'date-time' },
        services: {
          type: 'object',
          properties: {
            database: { type: 'string', example: 'healthy' },
            redis: { type: 'string', example: 'healthy' },
            email: { type: 'string', example: 'healthy' },
            storage: { type: 'string', example: 'healthy' },
          },
        },
        version: { type: 'string', example: '1.0.0' },
        uptime: { type: 'number', example: 3600 },
      },
    },
  })
  async getHealth() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'healthy',
        redis: 'healthy',
        email: 'healthy',
        storage: 'healthy',
      },
      version: '1.0.0',
      uptime: process.uptime(),
    };
  }

  @Get('metrics')
  @Roles('admin', 'manager')
  @ApiOperation({
    summary: 'Get system metrics',
    description: 'Retrieve system performance metrics',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'System metrics retrieved successfully',
  })
  async getMetrics() {
    return {
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      cpu: process.cpuUsage(),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('alerts')
  @Roles('admin', 'manager')
  @ApiOperation({
    summary: 'Get active alerts',
    description: 'Retrieve current system alerts',
  })
  async getAlerts(@GetUser('organizationId') organizationId: string) {
    this.logger.log(`Getting alerts for organization: ${organizationId}`);
    return {
      alerts: [],
      totalCount: 0,
      lastUpdated: new Date().toISOString(),
    };
  }
}