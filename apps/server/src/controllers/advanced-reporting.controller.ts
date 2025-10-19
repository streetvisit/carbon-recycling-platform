import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  Body,
  UseGuards,
  Res,
  Logger,
  HttpException,
  HttpStatus,
  StreamableFile
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiBody
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { GetUser } from '../decorators/get-user.decorator';
import { AdvancedReportingService, ReportTemplate, ReportSettings } from '../services/advanced-reporting.service';
import { User } from '@prisma/client';
import { Response } from 'express';
import { createReadStream } from 'fs';

class GenerateReportDto {
  templateId: string;
  reportingYear: number;
  customSettings?: Partial<ReportSettings>;
}

@ApiTags('Advanced Reporting')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/advanced-reporting')
export class AdvancedReportingController {
  private readonly logger = new Logger(AdvancedReportingController.name);

  constructor(private advancedReportingService: AdvancedReportingService) {}

  /**
   * Get available report templates
   */
  @Get('templates')
  @ApiOperation({ 
    summary: 'Get available report templates',
    description: 'Retrieve all available report templates with their configurations'
  })
  @ApiResponse({
    status: 200,
    description: 'List of available report templates',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'gri-sustainability' },
          name: { type: 'string', example: 'GRI Sustainability Report' },
          type: { 
            type: 'string', 
            enum: ['SUSTAINABILITY', 'COMPLIANCE', 'SUPPLY_CHAIN', 'EXECUTIVE', 'CUSTOM'],
            example: 'SUSTAINABILITY'
          },
          framework: { 
            type: 'string', 
            enum: ['GRI', 'SASB', 'TCFD', 'CDP', 'SECR', 'CSRD', 'CUSTOM'],
            example: 'GRI'
          },
          sections: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', example: 'executive-summary' },
                title: { type: 'string', example: 'Executive Summary' },
                type: { 
                  type: 'string',
                  enum: ['OVERVIEW', 'EMISSIONS', 'SCOPE3', 'INITIATIVES', 'BENCHMARKING', 'TARGETS', 'RISKS', 'CUSTOM']
                },
                order: { type: 'number', example: 1 },
                required: { type: 'boolean', example: true }
              }
            }
          },
          settings: {
            type: 'object',
            properties: {
              includeSupplierData: { type: 'boolean', example: true },
              includeInitiatives: { type: 'boolean', example: true },
              includeBenchmarking: { type: 'boolean', example: true },
              format: { 
                type: 'string',
                enum: ['PDF', 'EXCEL', 'HTML', 'JSON'],
                example: 'PDF'
              },
              confidentiality: {
                type: 'string',
                enum: ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL'],
                example: 'PUBLIC'
              }
            }
          }
        }
      }
    }
  })
  @Roles('admin', 'manager', 'user')
  getReportTemplates(): ReportTemplate[] {
    this.logger.log('Fetching available report templates');
    return this.advancedReportingService.getReportTemplates();
  }

  /**
   * Get specific report template
   */
  @Get('templates/:templateId')
  @ApiOperation({ 
    summary: 'Get specific report template',
    description: 'Retrieve details of a specific report template by ID'
  })
  @ApiParam({ 
    name: 'templateId', 
    description: 'Report template ID',
    example: 'gri-sustainability'
  })
  @ApiResponse({
    status: 200,
    description: 'Report template details',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'gri-sustainability' },
        name: { type: 'string', example: 'GRI Sustainability Report' },
        type: { type: 'string', example: 'SUSTAINABILITY' },
        framework: { type: 'string', example: 'GRI' },
        sections: { type: 'array' },
        settings: { type: 'object' }
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: 'Template not found'
  })
  @Roles('admin', 'manager', 'user')
  getReportTemplate(@Param('templateId') templateId: string): ReportTemplate {
    this.logger.log(`Fetching report template: ${templateId}`);
    
    const template = this.advancedReportingService.getReportTemplate(templateId);
    if (!template) {
      throw new HttpException(`Template not found: ${templateId}`, HttpStatus.NOT_FOUND);
    }

    return template;
  }

  /**
   * Generate comprehensive sustainability report
   */
  @Post('generate')
  @ApiOperation({
    summary: 'Generate comprehensive sustainability report',
    description: 'Generate a detailed sustainability report with supplier data integration, benchmarking, and compliance analysis'
  })
  @ApiBody({
    description: 'Report generation configuration',
    schema: {
      type: 'object',
      properties: {
        templateId: { 
          type: 'string', 
          example: 'gri-sustainability',
          description: 'ID of the report template to use'
        },
        reportingYear: { 
          type: 'number', 
          example: 2024,
          description: 'Year for which to generate the report'
        },
        customSettings: {
          type: 'object',
          description: 'Optional custom settings to override template defaults',
          properties: {
            includeSupplierData: { type: 'boolean', example: true },
            includeInitiatives: { type: 'boolean', example: true },
            includeBenchmarking: { type: 'boolean', example: true },
            includeGapAnalysis: { type: 'boolean', example: false },
            includeForwardLooking: { type: 'boolean', example: true },
            format: { 
              type: 'string',
              enum: ['PDF', 'EXCEL', 'HTML', 'JSON'],
              example: 'PDF'
            },
            confidentiality: {
              type: 'string',
              enum: ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL'],
              example: 'PUBLIC'
            },
            branding: {
              type: 'object',
              properties: {
                colors: {
                  type: 'object',
                  properties: {
                    primary: { type: 'string', example: '#1f2937' },
                    secondary: { type: 'string', example: '#10b981' },
                    accent: { type: 'string', example: '#3b82f6' }
                  }
                },
                fonts: {
                  type: 'object',
                  properties: {
                    heading: { type: 'string', example: 'Arial' },
                    body: { type: 'string', example: 'Arial' }
                  }
                }
              }
            }
          }
        }
      },
      required: ['templateId', 'reportingYear']
    }
  })
  @ApiResponse({
    status: 201,
    description: 'Report generated successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Report generated successfully' },
        data: {
          type: 'object',
          properties: {
            reportId: { type: 'string', example: 'clp1234567890abcdef' },
            downloadUrl: { type: 'string', example: 'https://storage.example.com/reports/sustainability_2024.pdf' },
            metadata: {
              type: 'object',
              properties: {
                template: { type: 'string', example: 'GRI Sustainability Report' },
                year: { type: 'number', example: 2024 },
                format: { type: 'string', example: 'PDF' },
                size: { type: 'number', example: 1024567 },
                sections: { type: 'number', example: 5 }
              }
            }
          }
        }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request parameters'
  })
  @ApiResponse({
    status: 404,
    description: 'Template or organization not found'
  })
  @ApiResponse({
    status: 500,
    description: 'Report generation failed'
  })
  @Roles('admin', 'manager', 'user')
  async generateReport(
    @Body() generateReportDto: GenerateReportDto,
    @GetUser() user: User
  ) {
    this.logger.log(`Generating report for organization ${user.organizationId} with template ${generateReportDto.templateId}`);

    try {
      const { templateId, reportingYear, customSettings } = generateReportDto;

      if (!templateId || !reportingYear) {
        throw new HttpException(
          'templateId and reportingYear are required',
          HttpStatus.BAD_REQUEST
        );
      }

      if (reportingYear < 2020 || reportingYear > new Date().getFullYear()) {
        throw new HttpException(
          'Reporting year must be between 2020 and current year',
          HttpStatus.BAD_REQUEST
        );
      }

      const result = await this.advancedReportingService.generateReport(
        user.organizationId,
        templateId,
        reportingYear,
        customSettings
      );

      return {
        success: true,
        message: 'Report generated successfully',
        data: result
      };
    } catch (error) {
      this.logger.error(`Report generation failed: ${error.message}`, error.stack);
      
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Report generation failed',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get generated reports for organization
   */
  @Get('reports')
  @ApiOperation({
    summary: 'Get generated reports',
    description: 'Retrieve list of previously generated reports for the organization'
  })
  @ApiQuery({
    name: 'year',
    required: false,
    type: Number,
    description: 'Filter by reporting year',
    example: 2024
  })
  @ApiQuery({
    name: 'template',
    required: false,
    type: String,
    description: 'Filter by template ID',
    example: 'gri-sustainability'
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Limit number of results',
    example: 10
  })
  @ApiResponse({
    status: 200,
    description: 'List of generated reports',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'clp1234567890abcdef' },
              templateId: { type: 'string', example: 'gri-sustainability' },
              name: { type: 'string', example: 'GRI Sustainability Report' },
              reportingYear: { type: 'number', example: 2024 },
              createdAt: { type: 'string', format: 'date-time' },
              file: {
                type: 'object',
                properties: {
                  originalName: { type: 'string', example: 'GRI_Sustainability_Report_2024.pdf' },
                  size: { type: 'number', example: 1024567 },
                  url: { type: 'string', example: 'https://storage.example.com/reports/report.pdf' }
                }
              },
              metadata: {
                type: 'object',
                properties: {
                  sections: { type: 'number', example: 5 },
                  dataPoints: { type: 'number', example: 8 },
                  generatedAt: { type: 'string', format: 'date-time' },
                  version: { type: 'string', example: '1.0' }
                }
              }
            }
          }
        },
        pagination: {
          type: 'object',
          properties: {
            total: { type: 'number', example: 25 },
            page: { type: 'number', example: 1 },
            limit: { type: 'number', example: 10 }
          }
        }
      }
    }
  })
  @Roles('admin', 'manager', 'user')
  async getGeneratedReports(
    @GetUser() user: User,
    @Query('year') year?: number,
    @Query('template') template?: string,
    @Query('limit') limit?: number
  ) {
    this.logger.log(`Fetching generated reports for organization ${user.organizationId}`);

    try {
      let reports = await this.advancedReportingService.getGeneratedReports(user.organizationId);

      // Apply filters
      if (year) {
        reports = reports.filter(report => report.reportingYear === year);
      }

      if (template) {
        reports = reports.filter(report => report.templateId === template);
      }

      // Apply limit
      const total = reports.length;
      if (limit && limit > 0) {
        reports = reports.slice(0, limit);
      }

      return {
        success: true,
        data: reports,
        pagination: {
          total,
          page: 1,
          limit: limit || total
        }
      };
    } catch (error) {
      this.logger.error(`Failed to fetch generated reports: ${error.message}`, error.stack);
      throw new HttpException(
        'Failed to fetch reports',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Download generated report
   */
  @Get('reports/:reportId/download')
  @ApiOperation({
    summary: 'Download generated report',
    description: 'Download a previously generated report file'
  })
  @ApiParam({
    name: 'reportId',
    description: 'ID of the generated report',
    example: 'clp1234567890abcdef'
  })
  @ApiResponse({
    status: 200,
    description: 'Report file download',
    headers: {
      'Content-Type': {
        description: 'MIME type of the file',
        schema: { type: 'string', example: 'application/pdf' }
      },
      'Content-Disposition': {
        description: 'File attachment header',
        schema: { type: 'string', example: 'attachment; filename="report.pdf"' }
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: 'Report not found'
  })
  @Roles('admin', 'manager', 'user')
  async downloadReport(
    @Param('reportId') reportId: string,
    @GetUser() user: User,
    @Res({ passthrough: true }) res: Response
  ): Promise<StreamableFile> {
    this.logger.log(`Downloading report ${reportId} for user ${user.id}`);

    try {
      const reports = await this.advancedReportingService.getGeneratedReports(user.organizationId);
      const report = reports.find(r => r.id === reportId);

      if (!report) {
        throw new HttpException('Report not found', HttpStatus.NOT_FOUND);
      }

      // Set response headers
      res.set({
        'Content-Type': report.file?.originalName?.endsWith('.pdf') ? 'application/pdf' : 
                       report.file?.originalName?.endsWith('.xlsx') ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' :
                       report.file?.originalName?.endsWith('.html') ? 'text/html' : 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${report.file?.originalName || 'report.pdf'}"`
      });

      // Return file stream (in real implementation, this would stream from the file storage service)
      // For now, return a placeholder response
      const buffer = Buffer.from(`Report ${reportId} content would be streamed here`);
      return new StreamableFile(buffer);

    } catch (error) {
      this.logger.error(`Failed to download report ${reportId}: ${error.message}`, error.stack);
      
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Failed to download report',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Preview report data (without generating full report)
   */
  @Get('preview/:templateId')
  @ApiOperation({
    summary: 'Preview report data',
    description: 'Get a preview of what data would be included in a report without generating the full document'
  })
  @ApiParam({
    name: 'templateId',
    description: 'Report template ID',
    example: 'gri-sustainability'
  })
  @ApiQuery({
    name: 'year',
    required: true,
    type: Number,
    description: 'Reporting year',
    example: 2024
  })
  @ApiResponse({
    status: 200,
    description: 'Report data preview',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            template: {
              type: 'object',
              properties: {
                name: { type: 'string', example: 'GRI Sustainability Report' },
                sections: { type: 'number', example: 5 }
              }
            },
            dataAvailability: {
              type: 'object',
              properties: {
                emissionsData: { type: 'boolean', example: true },
                supplierData: { type: 'boolean', example: false },
                initiativesData: { type: 'boolean', example: true },
                benchmarkingData: { type: 'boolean', example: true }
              }
            },
            estimatedSize: { type: 'string', example: '~2.5 MB' },
            generationTime: { type: 'string', example: '~30 seconds' }
          }
        }
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: 'Template not found'
  })
  @Roles('admin', 'manager', 'user')
  async previewReport(
    @Param('templateId') templateId: string,
    @Query('year') year: number,
    @GetUser() user: User
  ) {
    this.logger.log(`Previewing report ${templateId} for organization ${user.organizationId}, year ${year}`);

    try {
      const template = this.advancedReportingService.getReportTemplate(templateId);
      if (!template) {
        throw new HttpException('Template not found', HttpStatus.NOT_FOUND);
      }

      // Mock data availability check (in real implementation, would check actual data)
      const dataAvailability = {
        emissionsData: true, // Always available from basic emissions data
        supplierData: template.settings.includeSupplierData ? Math.random() > 0.5 : false,
        initiativesData: template.settings.includeInitiatives ? Math.random() > 0.3 : false,
        benchmarkingData: template.settings.includeBenchmarking ? true : false
      };

      const estimatedSections = template.sections.filter(section => 
        section.required || 
        (section.type === 'SCOPE3' && dataAvailability.supplierData) ||
        (section.type === 'INITIATIVES' && dataAvailability.initiativesData)
      ).length;

      return {
        success: true,
        data: {
          template: {
            name: template.name,
            sections: estimatedSections,
            framework: template.framework
          },
          dataAvailability,
          estimatedSize: `~${Math.round(estimatedSections * 0.5 * 10) / 10} MB`,
          generationTime: `~${Math.max(15, estimatedSections * 5)} seconds`,
          missingDataWarnings: [
            ...(!dataAvailability.supplierData && template.settings.includeSupplierData ? ['Supplier data not available'] : []),
            ...(!dataAvailability.initiativesData && template.settings.includeInitiatives ? ['Initiatives data incomplete'] : [])
          ]
        }
      };
    } catch (error) {
      this.logger.error(`Failed to preview report: ${error.message}`, error.stack);
      
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Failed to preview report',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get supported compliance frameworks
   */
  @Get('frameworks')
  @ApiOperation({
    summary: 'Get supported compliance frameworks',
    description: 'Retrieve list of supported sustainability reporting frameworks'
  })
  @ApiResponse({
    status: 200,
    description: 'List of supported frameworks',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'GRI' },
              name: { type: 'string', example: 'Global Reporting Initiative' },
              description: { type: 'string', example: 'The most widely used sustainability reporting standard' },
              region: { type: 'string', example: 'Global' },
              mandatory: { type: 'boolean', example: false },
              categories: {
                type: 'array',
                items: { type: 'string' },
                example: ['Environmental', 'Social', 'Governance']
              }
            }
          }
        }
      }
    }
  })
  @Roles('admin', 'manager', 'user')
  getSupportedFrameworks() {
    this.logger.log('Fetching supported compliance frameworks');

    const frameworks = [
      {
        id: 'GRI',
        name: 'Global Reporting Initiative',
        description: 'The most widely used sustainability reporting standard worldwide',
        region: 'Global',
        mandatory: false,
        categories: ['Environmental', 'Social', 'Governance']
      },
      {
        id: 'TCFD',
        name: 'Task Force on Climate-related Financial Disclosures',
        description: 'Framework for climate-related financial risk disclosure',
        region: 'Global',
        mandatory: false,
        categories: ['Climate Risk', 'Financial']
      },
      {
        id: 'SASB',
        name: 'Sustainability Accounting Standards Board',
        description: 'Industry-specific sustainability accounting standards',
        region: 'Global',
        mandatory: false,
        categories: ['Financial', 'Industry-Specific']
      },
      {
        id: 'CDP',
        name: 'Carbon Disclosure Project',
        description: 'Global environmental disclosure system',
        region: 'Global',
        mandatory: false,
        categories: ['Environmental', 'Climate']
      },
      {
        id: 'SECR',
        name: 'Streamlined Energy & Carbon Reporting',
        description: 'UK mandatory energy and carbon reporting requirements',
        region: 'UK',
        mandatory: true,
        categories: ['Environmental', 'Energy']
      },
      {
        id: 'CSRD',
        name: 'Corporate Sustainability Reporting Directive',
        description: 'EU mandatory sustainability reporting directive',
        region: 'EU',
        mandatory: true,
        categories: ['Environmental', 'Social', 'Governance']
      }
    ];

    return {
      success: true,
      data: frameworks
    };
  }
}