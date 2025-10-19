import { 
  Controller, 
  Get, 
  Post, 
  Patch, 
  Param, 
  Query, 
  Body, 
  UseGuards,
  ParseUUIDPipe,
  ParseEnumPipe,
  Logger
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { GapAnalysisService, CreateGapAnalysisDto } from '../services/gap-analysis.service';

@ApiTags('gap-analysis')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('gap-analysis')
export class GapAnalysisController {
  private readonly logger = new Logger(GapAnalysisController.name);

  constructor(private readonly gapAnalysisService: GapAnalysisService) {}

  @Post('organizations/:organizationId/analyze')
  @ApiOperation({ 
    summary: 'Perform gap analysis for organization',
    description: 'Analyzes organization emissions against UK benchmarks and compliance requirements'
  })
  @ApiResponse({ status: 201, description: 'Gap analysis completed successfully' })
  @Roles('ADMIN', 'ORGANIZATION_ADMIN')
  async performGapAnalysis(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() data?: Partial<CreateGapAnalysisDto>
  ) {
    try {
      this.logger.log(`Starting gap analysis for organization: ${organizationId}`);
      const result = await this.gapAnalysisService.performGapAnalysis(organizationId, data);
      
      return {
        success: true,
        message: 'Gap analysis completed successfully',
        data: result
      };
    } catch (error) {
      this.logger.error(`Gap analysis failed for organization ${organizationId}:`, error);
      throw error;
    }
  }

  @Get('organizations/:organizationId/latest')
  @ApiOperation({ 
    summary: 'Get latest gap analysis',
    description: 'Retrieves the most recent gap analysis for an organization'
  })
  @ApiResponse({ status: 200, description: 'Latest gap analysis retrieved' })
  @Roles('ADMIN', 'ORGANIZATION_ADMIN', 'USER')
  async getLatestGapAnalysis(@Param('organizationId', ParseUUIDPipe) organizationId: string) {
    const analysis = await this.gapAnalysisService.getLatestGapAnalysis(organizationId);
    
    return {
      success: true,
      data: analysis
    };
  }

  @Get('organizations/:organizationId/history')
  @ApiOperation({ 
    summary: 'Get gap analysis history',
    description: 'Retrieves historical gap analysis results for an organization'
  })
  @ApiResponse({ status: 200, description: 'Gap analysis history retrieved' })
  @Roles('ADMIN', 'ORGANIZATION_ADMIN', 'USER')
  async getGapAnalysisHistory(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Query('limit') limit?: string
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    const history = await this.gapAnalysisService.getGapAnalysisHistory(organizationId, limitNum);
    
    return {
      success: true,
      data: history
    };
  }

  @Get('organizations/:organizationId/recommendations')
  @ApiOperation({ 
    summary: 'Get recommendations',
    description: 'Retrieves recommendations from the latest gap analysis'
  })
  @ApiResponse({ status: 200, description: 'Recommendations retrieved' })
  @Roles('ADMIN', 'ORGANIZATION_ADMIN', 'USER')
  async getRecommendations(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Query('category') category?: string
  ) {
    const recommendations = await this.gapAnalysisService.getRecommendationsByCategory(organizationId, category);
    
    return {
      success: true,
      data: recommendations
    };
  }

  @Patch('recommendations/:recommendationId/implement')
  @ApiOperation({ 
    summary: 'Mark recommendation as implemented',
    description: 'Updates recommendation status to implemented with optional notes'
  })
  @ApiResponse({ status: 200, description: 'Recommendation marked as implemented' })
  @Roles('ADMIN', 'ORGANIZATION_ADMIN')
  async markRecommendationImplemented(
    @Param('recommendationId', ParseUUIDPipe) recommendationId: string,
    @Body('notes') notes?: string
  ) {
    const recommendation = await this.gapAnalysisService.markRecommendationImplemented(recommendationId, notes);
    
    return {
      success: true,
      message: 'Recommendation marked as implemented',
      data: recommendation
    };
  }

  @Get('organizations/:organizationId/compliance-gaps')
  @ApiOperation({ 
    summary: 'Get compliance gaps',
    description: 'Retrieves compliance gaps from the latest gap analysis'
  })
  @ApiResponse({ status: 200, description: 'Compliance gaps retrieved' })
  @Roles('ADMIN', 'ORGANIZATION_ADMIN', 'USER')
  async getComplianceGaps(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Query('priority', new ParseEnumPipe(['HIGH', 'MEDIUM', 'LOW'], { optional: true })) priority?: 'HIGH' | 'MEDIUM' | 'LOW'
  ) {
    const gaps = await this.gapAnalysisService.getComplianceGapsByPriority(organizationId, priority);
    
    return {
      success: true,
      data: gaps
    };
  }

  @Patch('compliance-gaps/:gapId/status')
  @ApiOperation({ 
    summary: 'Update compliance gap status',
    description: 'Updates the current status of a compliance gap'
  })
  @ApiResponse({ status: 200, description: 'Compliance gap status updated' })
  @Roles('ADMIN', 'ORGANIZATION_ADMIN')
  async updateComplianceGapStatus(
    @Param('gapId', ParseUUIDPipe) gapId: string,
    @Body('status', new ParseEnumPipe(['COMPLIANT', 'PARTIAL', 'NON_COMPLIANT'])) status: 'COMPLIANT' | 'PARTIAL' | 'NON_COMPLIANT'
  ) {
    const gap = await this.gapAnalysisService.updateComplianceGapStatus(gapId, status);
    
    return {
      success: true,
      message: 'Compliance gap status updated',
      data: gap
    };
  }

  @Post('organizations/:organizationId/schedule')
  @ApiOperation({ 
    summary: 'Schedule automatic gap analysis',
    description: 'Sets up automated gap analysis for an organization'
  })
  @ApiResponse({ status: 201, description: 'Automatic analysis scheduled' })
  @Roles('ADMIN', 'ORGANIZATION_ADMIN')
  async scheduleAutomaticAnalysis(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body('frequency', new ParseEnumPipe(['MONTHLY', 'QUARTERLY', 'ANNUALLY'])) frequency: 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY'
  ) {
    const schedule = await this.gapAnalysisService.scheduleAutomaticAnalysis(organizationId, frequency);
    
    return {
      success: true,
      message: 'Automatic gap analysis scheduled',
      data: schedule
    };
  }

  @Post('run-scheduled')
  @ApiOperation({ 
    summary: 'Run scheduled analyses',
    description: 'Manually triggers all due scheduled gap analyses - typically called by cron job'
  })
  @ApiResponse({ status: 200, description: 'Scheduled analyses executed' })
  @Roles('ADMIN')
  async runScheduledAnalyses() {
    try {
      await this.gapAnalysisService.runScheduledAnalyses();
      
      return {
        success: true,
        message: 'Scheduled gap analyses executed successfully'
      };
    } catch (error) {
      this.logger.error('Failed to run scheduled analyses:', error);
      throw error;
    }
  }

  @Get('organizations/:organizationId/dashboard')
  @ApiOperation({ 
    summary: 'Get gap analysis dashboard data',
    description: 'Retrieves comprehensive dashboard data including latest analysis, key metrics, and urgent actions'
  })
  @ApiResponse({ status: 200, description: 'Dashboard data retrieved' })
  @Roles('ADMIN', 'ORGANIZATION_ADMIN', 'USER')
  async getDashboardData(@Param('organizationId', ParseUUIDPipe) organizationId: string) {
    try {
      // Get latest analysis
      const latestAnalysis = await this.gapAnalysisService.getLatestGapAnalysis(organizationId);
      
      if (!latestAnalysis) {
        return {
          success: true,
          data: {
            hasAnalysis: false,
            message: 'No gap analysis found. Run your first analysis to see insights.'
          }
        };
      }

      // Get high priority items
      const highPriorityRecommendations = await this.gapAnalysisService.getRecommendationsByCategory(organizationId);
      const highPriorityGaps = await this.gapAnalysisService.getComplianceGapsByPriority(organizationId, 'HIGH');

      // Calculate summary metrics
      const totalRecommendations = latestAnalysis.recommendations?.length || 0;
      const implementedRecommendations = latestAnalysis.recommendations?.filter(r => r.status === 'IMPLEMENTED').length || 0;
      const pendingRecommendations = totalRecommendations - implementedRecommendations;
      
      const totalGaps = latestAnalysis.complianceGaps?.length || 0;
      const compliantGaps = latestAnalysis.complianceGaps?.filter(g => g.currentStatus === 'COMPLIANT').length || 0;
      const nonCompliantGaps = latestAnalysis.complianceGaps?.filter(g => g.currentStatus === 'NON_COMPLIANT').length || 0;

      const dashboardData = {
        hasAnalysis: true,
        analysisDate: latestAnalysis.analysisDate,
        overallScore: latestAnalysis.overallScore,
        nextAnalysisDate: latestAnalysis.nextAnalysisDate,
        
        // Key metrics
        metrics: {
          totalRecommendations,
          implementedRecommendations,
          pendingRecommendations,
          implementationRate: totalRecommendations > 0 ? Math.round((implementedRecommendations / totalRecommendations) * 100) : 0,
          
          totalComplianceGaps: totalGaps,
          compliantGaps,
          nonCompliantGaps,
          complianceRate: totalGaps > 0 ? Math.round((compliantGaps / totalGaps) * 100) : 0
        },

        // High priority items (limit to 5 each)
        urgentActions: {
          recommendations: highPriorityRecommendations
            .filter(r => r.priority === 'HIGH' && r.status === 'PENDING')
            .slice(0, 5),
          complianceGaps: highPriorityGaps.slice(0, 5)
        },

        // Benchmarking summary
        benchmarks: latestAnalysis.benchmarks?.map(b => ({
          type: b.benchmarkType,
          performance: b.performance,
          percentageDifference: b.percentageDifference,
          context: b.context
        })) || [],

        // Recent progress
        recentlyImplemented: latestAnalysis.recommendations
          ?.filter(r => r.status === 'IMPLEMENTED' && r.implementedAt)
          .sort((a, b) => new Date(b.implementedAt!).getTime() - new Date(a.implementedAt!).getTime())
          .slice(0, 3) || []
      };

      return {
        success: true,
        data: dashboardData
      };
      
    } catch (error) {
      this.logger.error(`Failed to get dashboard data for organization ${organizationId}:`, error);
      throw error;
    }
  }
}