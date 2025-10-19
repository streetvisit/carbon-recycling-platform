import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { FileStorageService } from './file-storage.service';
import { Decimal } from '@prisma/client/runtime/library';
import * as PDFDocument from 'pdfkit';
import * as ExcelJS from 'exceljs';

export interface ReportTemplate {
  id: string;
  name: string;
  type: 'SUSTAINABILITY' | 'COMPLIANCE' | 'SUPPLY_CHAIN' | 'EXECUTIVE' | 'CUSTOM';
  framework: 'GRI' | 'SASB' | 'TCFD' | 'CDP' | 'SECR' | 'CSRD' | 'CUSTOM';
  sections: ReportSection[];
  settings: ReportSettings;
}

export interface ReportSection {
  id: string;
  title: string;
  type: 'OVERVIEW' | 'EMISSIONS' | 'SCOPE3' | 'INITIATIVES' | 'BENCHMARKING' | 'TARGETS' | 'RISKS' | 'CUSTOM';
  order: number;
  required: boolean;
  dataRequirements: string[];
  visualizations?: VisualizationConfig[];
}

export interface ReportSettings {
  includeSupplierData: boolean;
  includeInitiatives: boolean;
  includeBenchmarking: boolean;
  includeGapAnalysis: boolean;
  includeForwardLooking: boolean;
  format: 'PDF' | 'EXCEL' | 'HTML' | 'JSON';
  branding: BrandingConfig;
  confidentiality: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL';
}

export interface BrandingConfig {
  logo?: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  fonts: {
    heading: string;
    body: string;
  };
  customCSS?: string;
}

export interface VisualizationConfig {
  type: 'CHART' | 'TABLE' | 'MAP' | 'INFOGRAPHIC' | 'CUSTOM';
  chartType?: 'BAR' | 'LINE' | 'PIE' | 'SCATTER' | 'TREEMAP' | 'SANKEY';
  dataSource: string;
  title: string;
  description?: string;
  settings: any;
}

export interface ReportData {
  organizationInfo: any;
  reportingPeriod: {
    year: number;
    startDate: Date;
    endDate: Date;
  };
  executiveSummary: ExecutiveSummary;
  emissionsData: EmissionsAnalysis;
  scope3Analysis: Scope3Analysis;
  supplierAnalysis: SupplierAnalysis;
  initiativesProgress: InitiativesProgress;
  benchmarkingResults: BenchmarkingResults;
  forwardLooking: ForwardLooking;
  compliance: ComplianceStatus;
  appendices: any[];
}

export interface ExecutiveSummary {
  totalEmissions: number;
  emissionChange: number;
  scope3Percentage: number;
  supplierCount: number;
  initiativesCount: number;
  targetProgress: number;
  keyAchievements: string[];
  priorityActions: string[];
}

export interface EmissionsAnalysis {
  scope1: EmissionScope;
  scope2: EmissionScope;
  scope3: EmissionScope;
  total: EmissionScope;
  breakdown: EmissionBreakdown[];
  trends: EmissionTrend[];
  intensity: IntensityMetrics;
}

export interface EmissionScope {
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  breakdown?: Record<string, number>;
}

export interface EmissionBreakdown {
  category: string;
  value: number;
  percentage: number;
  trend: 'INCREASING' | 'DECREASING' | 'STABLE';
}

export interface EmissionTrend {
  year: number;
  scope1: number;
  scope2: number;
  scope3: number;
  total: number;
}

export interface IntensityMetrics {
  perEmployee: number;
  perRevenue: number;
  perSquareMeter?: number;
  perUnit?: number;
  customMetrics?: Record<string, number>;
}

export interface Scope3Analysis {
  totalEmissions: number;
  categoryBreakdown: Scope3Category[];
  supplierContributions: SupplierContribution[];
  dataQuality: DataQualityAssessment;
  improvementOpportunities: string[];
}

export interface Scope3Category {
  category: string;
  emissions: number;
  percentage: number;
  supplierCount: number;
  dataQuality: 'HIGH' | 'MEDIUM' | 'LOW';
  trend: 'IMPROVING' | 'STABLE' | 'WORSENING';
}

export interface SupplierContribution {
  supplierId: string;
  supplierName: string;
  emissions: number;
  percentage: number;
  categories: string[];
  engagement: 'HIGH' | 'MEDIUM' | 'LOW';
  improvements: number; // year-over-year
}

export interface SupplierAnalysis {
  overview: SupplierOverview;
  performance: SupplierPerformance[];
  engagement: SupplierEngagement;
  riskAssessment: SupplierRisk[];
  collaboration: CollaborationMetrics;
}

export interface SupplierOverview {
  totalSuppliers: number;
  respondingSuppliers: number;
  responseRate: number;
  dataQualityScore: number;
  averageEmissions: number;
  topEmitters: SupplierContribution[];
}

export interface SupplierPerformance {
  tier: 'TIER_1' | 'TIER_2' | 'TIER_3';
  supplierCount: number;
  averageEmissions: number;
  improvement: number;
  topPerformers: string[];
  underperformers: string[];
}

export interface SupplierEngagement {
  programParticipation: number;
  trainingCompleted: number;
  initiativesJoined: number;
  dataSubmissionRate: number;
  improvementPlans: number;
}

export interface SupplierRisk {
  category: 'EMISSIONS' | 'COMPLIANCE' | 'OPERATIONAL' | 'REPUTATIONAL';
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  affectedSuppliers: number;
  description: string;
  mitigation: string;
}

export interface CollaborationMetrics {
  activeInitiatives: number;
  sharedReductions: number;
  investmentLeverage: number;
  partnershipValue: number;
}

export interface InitiativesProgress {
  activeInitiatives: number;
  completedInitiatives: number;
  totalReductions: number;
  investment: number;
  roi: number;
  keyInitiatives: KeyInitiative[];
}

export interface KeyInitiative {
  name: string;
  status: string;
  progress: number;
  emissions: number;
  investment: number;
  timeline: string;
}

export interface BenchmarkingResults {
  sectorComparison: BenchmarkComparison;
  peerComparison: BenchmarkComparison;
  bestPractices: string[];
  improvementOpportunities: string[];
}

export interface BenchmarkComparison {
  metric: string;
  yourValue: number;
  benchmark: number;
  percentile: number;
  performance: 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'NEEDS_IMPROVEMENT';
}

export interface ForwardLooking {
  targets: Target[];
  projections: Projection[];
  scenarios: Scenario[];
  roadmap: RoadmapMilestone[];
}

export interface Target {
  type: 'ABSOLUTE' | 'INTENSITY' | 'RENEWABLE';
  baseline: number;
  target: number;
  deadline: Date;
  progress: number;
  onTrack: boolean;
}

export interface Projection {
  year: number;
  business_as_usual: number;
  with_initiatives: number;
  target_trajectory: number;
}

export interface Scenario {
  name: string;
  description: string;
  emissions: number;
  probability: number;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface RoadmapMilestone {
  year: number;
  milestone: string;
  targetReduction: number;
  initiatives: string[];
  investment: number;
}

export interface ComplianceStatus {
  frameworks: ComplianceFramework[];
  overallScore: number;
  gaps: ComplianceGap[];
  recommendations: string[];
}

export interface ComplianceFramework {
  name: string;
  status: 'COMPLIANT' | 'PARTIAL' | 'NON_COMPLIANT';
  score: number;
  requirements: ComplianceRequirement[];
}

export interface ComplianceRequirement {
  requirement: string;
  status: 'MET' | 'PARTIAL' | 'NOT_MET';
  evidence: string[];
  gap?: string;
}

export interface ComplianceGap {
  framework: string;
  requirement: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  recommendation: string;
  deadline?: Date;
}

export interface DataQualityAssessment {
  overallScore: number;
  completeness: number;
  accuracy: number;
  timeliness: number;
  issues: DataQualityIssue[];
}

export interface DataQualityIssue {
  type: 'MISSING' | 'INCONSISTENT' | 'OUTDATED' | 'ESTIMATED';
  field: string;
  description: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  recommendation: string;
}

@Injectable()
export class AdvancedReportingService {
  private readonly logger = new Logger(AdvancedReportingService.name);
  private reportTemplates: Map<string, ReportTemplate> = new Map();

  constructor(
    private prisma: PrismaService,
    private fileStorage: FileStorageService
  ) {
    this.initializeReportTemplates();
  }

  /**
   * Initialize standard report templates
   */
  private initializeReportTemplates() {
    // GRI Sustainability Report Template
    const griTemplate: ReportTemplate = {
      id: 'gri-sustainability',
      name: 'GRI Sustainability Report',
      type: 'SUSTAINABILITY',
      framework: 'GRI',
      sections: [
        {
          id: 'executive-summary',
          title: 'Executive Summary',
          type: 'OVERVIEW',
          order: 1,
          required: true,
          dataRequirements: ['organizationInfo', 'executiveSummary']
        },
        {
          id: 'emissions-overview',
          title: 'Emissions Overview',
          type: 'EMISSIONS',
          order: 2,
          required: true,
          dataRequirements: ['emissionsData'],
          visualizations: [
            {
              type: 'CHART',
              chartType: 'BAR',
              dataSource: 'emissionsData.breakdown',
              title: 'Emissions by Scope',
              description: 'Breakdown of emissions by scope 1, 2, and 3'
            }
          ]
        },
        {
          id: 'supply-chain',
          title: 'Supply Chain Emissions',
          type: 'SCOPE3',
          order: 3,
          required: true,
          dataRequirements: ['scope3Analysis', 'supplierAnalysis']
        },
        {
          id: 'initiatives',
          title: 'Climate Initiatives',
          type: 'INITIATIVES',
          order: 4,
          required: false,
          dataRequirements: ['initiativesProgress']
        },
        {
          id: 'targets-progress',
          title: 'Targets & Progress',
          type: 'TARGETS',
          order: 5,
          required: true,
          dataRequirements: ['forwardLooking']
        }
      ],
      settings: {
        includeSupplierData: true,
        includeInitiatives: true,
        includeBenchmarking: true,
        includeGapAnalysis: false,
        includeForwardLooking: true,
        format: 'PDF',
        branding: {
          colors: {
            primary: '#1f2937',
            secondary: '#10b981',
            accent: '#3b82f6'
          },
          fonts: {
            heading: 'Arial',
            body: 'Arial'
          }
        },
        confidentiality: 'PUBLIC'
      }
    };

    // TCFD Climate Report Template
    const tcfdTemplate: ReportTemplate = {
      id: 'tcfd-climate',
      name: 'TCFD Climate Report',
      type: 'COMPLIANCE',
      framework: 'TCFD',
      sections: [
        {
          id: 'governance',
          title: 'Governance',
          type: 'OVERVIEW',
          order: 1,
          required: true,
          dataRequirements: ['organizationInfo']
        },
        {
          id: 'strategy',
          title: 'Strategy',
          type: 'RISKS',
          order: 2,
          required: true,
          dataRequirements: ['forwardLooking', 'benchmarkingResults']
        },
        {
          id: 'risk-management',
          title: 'Risk Management',
          type: 'RISKS',
          order: 3,
          required: true,
          dataRequirements: ['supplierAnalysis']
        },
        {
          id: 'metrics-targets',
          title: 'Metrics and Targets',
          type: 'EMISSIONS',
          order: 4,
          required: true,
          dataRequirements: ['emissionsData', 'forwardLooking']
        }
      ],
      settings: {
        includeSupplierData: true,
        includeInitiatives: false,
        includeBenchmarking: true,
        includeGapAnalysis: true,
        includeForwardLooking: true,
        format: 'PDF',
        branding: {
          colors: {
            primary: '#1e293b',
            secondary: '#059669',
            accent: '#2563eb'
          },
          fonts: {
            heading: 'Arial',
            body: 'Arial'
          }
        },
        confidentiality: 'PUBLIC'
      }
    };

    // Executive Dashboard Template
    const executiveTemplate: ReportTemplate = {
      id: 'executive-dashboard',
      name: 'Executive Dashboard',
      type: 'EXECUTIVE',
      framework: 'CUSTOM',
      sections: [
        {
          id: 'key-metrics',
          title: 'Key Performance Metrics',
          type: 'OVERVIEW',
          order: 1,
          required: true,
          dataRequirements: ['executiveSummary']
        },
        {
          id: 'supplier-performance',
          title: 'Supplier Performance',
          type: 'SCOPE3',
          order: 2,
          required: true,
          dataRequirements: ['supplierAnalysis']
        },
        {
          id: 'initiatives-roi',
          title: 'Initiatives ROI',
          type: 'INITIATIVES',
          order: 3,
          required: true,
          dataRequirements: ['initiativesProgress']
        }
      ],
      settings: {
        includeSupplierData: true,
        includeInitiatives: true,
        includeBenchmarking: true,
        includeGapAnalysis: false,
        includeForwardLooking: true,
        format: 'PDF',
        branding: {
          colors: {
            primary: '#111827',
            secondary: '#16a34a',
            accent: '#dc2626'
          },
          fonts: {
            heading: 'Arial',
            body: 'Arial'
          }
        },
        confidentiality: 'INTERNAL'
      }
    };

    this.reportTemplates.set('gri-sustainability', griTemplate);
    this.reportTemplates.set('tcfd-climate', tcfdTemplate);
    this.reportTemplates.set('executive-dashboard', executiveTemplate);

    this.logger.log(`Initialized ${this.reportTemplates.size} report templates`);
  }

  /**
   * Generate comprehensive sustainability report
   */
  async generateReport(
    organizationId: string,
    templateId: string,
    reportingYear: number,
    customSettings?: Partial<ReportSettings>
  ): Promise<{ reportId: string; downloadUrl: string; metadata: any }> {
    this.logger.log(`Generating report ${templateId} for organization ${organizationId}, year ${reportingYear}`);

    const template = this.reportTemplates.get(templateId);
    if (!template) {
      throw new Error(`Report template not found: ${templateId}`);
    }

    // Apply custom settings
    const settings = { ...template.settings, ...customSettings };

    // Gather comprehensive data
    const reportData = await this.gatherReportData(organizationId, reportingYear, settings);

    // Generate report based on format
    let reportBuffer: Buffer;
    let filename: string;
    let mimeType: string;

    switch (settings.format) {
      case 'PDF':
        reportBuffer = await this.generatePDFReport(template, reportData, settings);
        filename = `${template.name}_${reportingYear}.pdf`;
        mimeType = 'application/pdf';
        break;
      case 'EXCEL':
        reportBuffer = await this.generateExcelReport(template, reportData, settings);
        filename = `${template.name}_${reportingYear}.xlsx`;
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        break;
      case 'HTML':
        reportBuffer = Buffer.from(await this.generateHTMLReport(template, reportData, settings));
        filename = `${template.name}_${reportingYear}.html`;
        mimeType = 'text/html';
        break;
      default:
        throw new Error(`Unsupported report format: ${settings.format}`);
    }

    // Save report file
    const storedFile = await this.fileStorage.uploadFile(
      {
        originalname: filename,
        buffer: reportBuffer,
        mimetype: mimeType,
        size: reportBuffer.length
      } as any,
      {
        organizationId,
        uploadedBy: 'system',
        category: 'REPORT',
        description: `${template.name} for ${reportingYear}`,
        tags: ['sustainability', 'report', templateId, reportingYear.toString()],
        isPublic: settings.confidentiality === 'PUBLIC'
      }
    );

    // Store report metadata in database
    const reportRecord = await this.prisma.generatedReport.create({
      data: {
        organizationId,
        templateId,
        name: template.name,
        reportingYear,
        fileId: storedFile.id,
        settings: settings as any,
        metadata: {
          sections: template.sections.length,
          dataPoints: Object.keys(reportData).length,
          generatedAt: new Date(),
          version: '1.0'
        }
      }
    });

    this.logger.log(`Report generated successfully: ${reportRecord.id}`);

    return {
      reportId: reportRecord.id,
      downloadUrl: storedFile.url,
      metadata: {
        template: template.name,
        year: reportingYear,
        format: settings.format,
        size: reportBuffer.length,
        sections: template.sections.length
      }
    };
  }

  /**
   * Gather comprehensive data for report
   */
  private async gatherReportData(
    organizationId: string,
    reportingYear: number,
    settings: ReportSettings
  ): Promise<ReportData> {
    // Gather base organization and emissions data
    const [organization, currentEmissions, previousEmissions] = await Promise.all([
      this.getOrganizationInfo(organizationId),
      this.getEmissionsData(organizationId, reportingYear),
      this.getEmissionsData(organizationId, reportingYear - 1)
    ]);

    // Calculate emissions analysis
    const emissionsAnalysis = this.calculateEmissionsAnalysis(currentEmissions, previousEmissions);

    // Gather supplier data if enabled
    let supplierAnalysis: SupplierAnalysis | null = null;
    let scope3Analysis: Scope3Analysis | null = null;

    if (settings.includeSupplierData) {
      [supplierAnalysis, scope3Analysis] = await Promise.all([
        this.generateSupplierAnalysis(organizationId, reportingYear),
        this.generateScope3Analysis(organizationId, reportingYear)
      ]);
    }

    // Gather initiatives data if enabled
    let initiativesProgress: InitiativesProgress | null = null;
    if (settings.includeInitiatives) {
      initiativesProgress = await this.generateInitiativesProgress(organizationId, reportingYear);
    }

    // Generate benchmarking results if enabled
    let benchmarkingResults: BenchmarkingResults | null = null;
    if (settings.includeBenchmarking) {
      benchmarkingResults = await this.generateBenchmarkingResults(organizationId, reportingYear);
    }

    // Generate forward-looking analysis if enabled
    let forwardLooking: ForwardLooking | null = null;
    if (settings.includeForwardLooking) {
      forwardLooking = await this.generateForwardLooking(organizationId, reportingYear);
    }

    // Generate compliance status
    const compliance = await this.generateComplianceStatus(organizationId, reportingYear);

    // Calculate executive summary
    const executiveSummary = this.calculateExecutiveSummary(
      emissionsAnalysis,
      supplierAnalysis,
      initiativesProgress,
      benchmarkingResults
    );

    return {
      organizationInfo: organization,
      reportingPeriod: {
        year: reportingYear,
        startDate: new Date(reportingYear, 0, 1),
        endDate: new Date(reportingYear, 11, 31)
      },
      executiveSummary,
      emissionsData: emissionsAnalysis,
      scope3Analysis: scope3Analysis || this.getEmptyScope3Analysis(),
      supplierAnalysis: supplierAnalysis || this.getEmptySupplierAnalysis(),
      initiativesProgress: initiativesProgress || this.getEmptyInitiativesProgress(),
      benchmarkingResults: benchmarkingResults || this.getEmptyBenchmarkingResults(),
      forwardLooking: forwardLooking || this.getEmptyForwardLooking(),
      compliance,
      appendices: []
    };
  }

  /**
   * Generate PDF report
   */
  private async generatePDFReport(
    template: ReportTemplate,
    data: ReportData,
    settings: ReportSettings
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const chunks: Buffer[] = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));

        // Add cover page
        this.addCoverPage(doc, template, data, settings);

        // Add sections based on template
        for (const section of template.sections) {
          this.addReportSection(doc, section, data, settings);
        }

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate Excel report
   */
  private async generateExcelReport(
    template: ReportTemplate,
    data: ReportData,
    settings: ReportSettings
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();

    // Add summary sheet
    const summarySheet = workbook.addWorksheet('Executive Summary');
    this.addExcelSummary(summarySheet, data, settings);

    // Add emissions data sheet
    const emissionsSheet = workbook.addWorksheet('Emissions Data');
    this.addEmissionsDataSheet(emissionsSheet, data.emissionsData);

    // Add supplier analysis sheet if enabled
    if (settings.includeSupplierData && data.supplierAnalysis) {
      const supplierSheet = workbook.addWorksheet('Supplier Analysis');
      this.addSupplierDataSheet(supplierSheet, data.supplierAnalysis);
    }

    // Add initiatives sheet if enabled
    if (settings.includeInitiatives && data.initiativesProgress) {
      const initiativesSheet = workbook.addWorksheet('Initiatives');
      this.addInitiativesDataSheet(initiativesSheet, data.initiativesProgress);
    }

    return await workbook.xlsx.writeBuffer() as Buffer;
  }

  /**
   * Generate HTML report
   */
  private async generateHTMLReport(
    template: ReportTemplate,
    data: ReportData,
    settings: ReportSettings
  ): Promise<string> {
    let html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${template.name} - ${data.reportingPeriod.year}</title>
        <style>
            body { 
                font-family: ${settings.branding.fonts.body}; 
                line-height: 1.6; 
                color: #333; 
                max-width: 1200px; 
                margin: 0 auto; 
                padding: 20px; 
            }
            h1, h2, h3 { 
                color: ${settings.branding.colors.primary}; 
                font-family: ${settings.branding.fonts.heading}; 
            }
            .metric { 
                background: #f8f9fa; 
                padding: 15px; 
                margin: 10px 0; 
                border-radius: 5px; 
                border-left: 4px solid ${settings.branding.colors.secondary}; 
            }
            .chart-placeholder { 
                background: #e9ecef; 
                height: 300px; 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                margin: 20px 0; 
                border-radius: 5px; 
            }
            ${settings.branding.customCSS || ''}
        </style>
    </head>
    <body>
    `;

    // Add header
    html += `
        <header>
            <h1>${template.name}</h1>
            <h2>${data.organizationInfo.name}</h2>
            <p>Reporting Period: ${data.reportingPeriod.year}</p>
        </header>
    `;

    // Add sections
    for (const section of template.sections) {
      html += this.generateHTMLSection(section, data, settings);
    }

    html += `
        <footer>
            <p>Generated on ${new Date().toLocaleDateString()} by Carbon Recycling Platform</p>
        </footer>
    </body>
    </html>
    `;

    return html;
  }

  /**
   * Helper methods for data generation and formatting
   */
  private async getOrganizationInfo(organizationId: string) {
    return this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        users: {
          select: { name: true, role: true }
        }
      }
    });
  }

  private async getEmissionsData(organizationId: string, year: number) {
    return this.prisma.emissions.findFirst({
      where: {
        organizationId,
        reportingYear: year
      }
    });
  }

  private calculateEmissionsAnalysis(current: any, previous: any): EmissionsAnalysis {
    const currentScope1 = current?.scope1Emissions?.toNumber() || 0;
    const currentScope2 = current?.scope2Emissions?.toNumber() || 0;
    const currentScope3 = current?.scope3Emissions?.toNumber() || 0;
    const currentTotal = current?.totalEmissions?.toNumber() || 0;

    const previousScope1 = previous?.scope1Emissions?.toNumber() || 0;
    const previousScope2 = previous?.scope2Emissions?.toNumber() || 0;
    const previousScope3 = previous?.scope3Emissions?.toNumber() || 0;
    const previousTotal = previous?.totalEmissions?.toNumber() || 0;

    return {
      scope1: {
        current: currentScope1,
        previous: previousScope1,
        change: currentScope1 - previousScope1,
        changePercent: previousScope1 > 0 ? ((currentScope1 - previousScope1) / previousScope1) * 100 : 0
      },
      scope2: {
        current: currentScope2,
        previous: previousScope2,
        change: currentScope2 - previousScope2,
        changePercent: previousScope2 > 0 ? ((currentScope2 - previousScope2) / previousScope2) * 100 : 0
      },
      scope3: {
        current: currentScope3,
        previous: previousScope3,
        change: currentScope3 - previousScope3,
        changePercent: previousScope3 > 0 ? ((currentScope3 - previousScope3) / previousScope3) * 100 : 0
      },
      total: {
        current: currentTotal,
        previous: previousTotal,
        change: currentTotal - previousTotal,
        changePercent: previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0
      },
      breakdown: [
        { category: 'Scope 1', value: currentScope1, percentage: currentTotal > 0 ? (currentScope1 / currentTotal) * 100 : 0, trend: 'STABLE' },
        { category: 'Scope 2', value: currentScope2, percentage: currentTotal > 0 ? (currentScope2 / currentTotal) * 100 : 0, trend: 'STABLE' },
        { category: 'Scope 3', value: currentScope3, percentage: currentTotal > 0 ? (currentScope3 / currentTotal) * 100 : 0, trend: 'STABLE' }
      ],
      trends: [
        {
          year: current?.reportingYear || new Date().getFullYear(),
          scope1: currentScope1,
          scope2: currentScope2,
          scope3: currentScope3,
          total: currentTotal
        }
      ],
      intensity: {
        perEmployee: current?.organization?.employeeCount ? currentTotal / current.organization.employeeCount : 0,
        perRevenue: current?.organization?.annualRevenue ? (currentTotal / current.organization.annualRevenue) * 1000000 : 0
      }
    };
  }

  private async generateSupplierAnalysis(organizationId: string, reportingYear: number): Promise<SupplierAnalysis> {
    // Mock implementation - would integrate with actual supplier data
    return {
      overview: {
        totalSuppliers: 150,
        respondingSuppliers: 120,
        responseRate: 80,
        dataQualityScore: 75,
        averageEmissions: 45.2,
        topEmitters: []
      },
      performance: [],
      engagement: {
        programParticipation: 65,
        trainingCompleted: 45,
        initiativesJoined: 12,
        dataSubmissionRate: 80,
        improvementPlans: 35
      },
      riskAssessment: [],
      collaboration: {
        activeInitiatives: 8,
        sharedReductions: 1250,
        investmentLeverage: 2.5,
        partnershipValue: 850000
      }
    };
  }

  private async generateScope3Analysis(organizationId: string, reportingYear: number): Promise<Scope3Analysis> {
    // Mock implementation
    return {
      totalEmissions: 2450.5,
      categoryBreakdown: [
        { category: 'Purchased Goods', emissions: 1200, percentage: 49, supplierCount: 45, dataQuality: 'HIGH', trend: 'STABLE' },
        { category: 'Business Travel', emissions: 350, percentage: 14, supplierCount: 1, dataQuality: 'HIGH', trend: 'DECREASING' }
      ],
      supplierContributions: [],
      dataQuality: {
        overallScore: 78,
        completeness: 82,
        accuracy: 75,
        timeliness: 88,
        issues: []
      },
      improvementOpportunities: [
        'Engage top 10 suppliers for emission reduction initiatives',
        'Implement supplier training program',
        'Develop supplier scorecards'
      ]
    };
  }

  private async generateInitiativesProgress(organizationId: string, reportingYear: number): Promise<InitiativesProgress> {
    // Mock implementation
    return {
      activeInitiatives: 12,
      completedInitiatives: 8,
      totalReductions: 850,
      investment: 450000,
      roi: 2.1,
      keyInitiatives: [
        {
          name: 'Renewable Energy Transition',
          status: 'In Progress',
          progress: 75,
          emissions: 350,
          investment: 200000,
          timeline: '12 months'
        }
      ]
    };
  }

  private async generateBenchmarkingResults(organizationId: string, reportingYear: number): Promise<BenchmarkingResults> {
    return {
      sectorComparison: {
        metric: 'Emissions Intensity',
        yourValue: 125.5,
        benchmark: 145.2,
        percentile: 65,
        performance: 'GOOD'
      },
      peerComparison: {
        metric: 'Total Emissions',
        yourValue: 2450,
        benchmark: 2890,
        percentile: 60,
        performance: 'GOOD'
      },
      bestPractices: [
        'Implement science-based targets',
        'Develop comprehensive Scope 3 strategy',
        'Engage suppliers in emissions reduction'
      ],
      improvementOpportunities: [
        'Increase renewable energy procurement',
        'Optimize supply chain efficiency',
        'Implement circular economy principles'
      ]
    };
  }

  private async generateForwardLooking(organizationId: string, reportingYear: number): Promise<ForwardLooking> {
    return {
      targets: [
        {
          type: 'ABSOLUTE',
          baseline: 2500,
          target: 1250,
          deadline: new Date(2030, 11, 31),
          progress: 35,
          onTrack: true
        }
      ],
      projections: [
        { year: 2024, business_as_usual: 2600, with_initiatives: 2350, target_trajectory: 2250 },
        { year: 2025, business_as_usual: 2650, with_initiatives: 2200, target_trajectory: 2000 }
      ],
      scenarios: [
        {
          name: 'Best Case',
          description: 'All initiatives succeed',
          emissions: 1800,
          probability: 0.3,
          impact: 'HIGH'
        }
      ],
      roadmap: [
        {
          year: 2024,
          milestone: 'Complete renewable energy transition',
          targetReduction: 300,
          initiatives: ['Solar installation', 'Wind power agreement'],
          investment: 500000
        }
      ]
    };
  }

  private async generateComplianceStatus(organizationId: string, reportingYear: number): Promise<ComplianceStatus> {
    return {
      frameworks: [
        {
          name: 'GRI Standards',
          status: 'COMPLIANT',
          score: 85,
          requirements: [
            { requirement: 'GHG Emissions', status: 'MET', evidence: ['Emissions calculation report'] }
          ]
        }
      ],
      overallScore: 82,
      gaps: [],
      recommendations: [
        'Implement additional data verification procedures',
        'Enhance third-party assurance coverage'
      ]
    };
  }

  private calculateExecutiveSummary(
    emissions: EmissionsAnalysis,
    supplier: SupplierAnalysis | null,
    initiatives: InitiativesProgress | null,
    benchmarking: BenchmarkingResults | null
  ): ExecutiveSummary {
    return {
      totalEmissions: emissions.total.current,
      emissionChange: emissions.total.changePercent,
      scope3Percentage: emissions.total.current > 0 ? (emissions.scope3.current / emissions.total.current) * 100 : 0,
      supplierCount: supplier?.overview.totalSuppliers || 0,
      initiativesCount: initiatives?.activeInitiatives || 0,
      targetProgress: 65, // Mock
      keyAchievements: [
        '15% reduction in Scope 1 emissions',
        '85% supplier engagement rate',
        'Science-based targets approved'
      ],
      priorityActions: [
        'Expand Scope 3 measurement',
        'Increase renewable energy',
        'Engage top suppliers'
      ]
    };
  }

  // Empty data generators for optional sections
  private getEmptyScope3Analysis(): Scope3Analysis {
    return {
      totalEmissions: 0,
      categoryBreakdown: [],
      supplierContributions: [],
      dataQuality: { overallScore: 0, completeness: 0, accuracy: 0, timeliness: 0, issues: [] },
      improvementOpportunities: []
    };
  }

  private getEmptySupplierAnalysis(): SupplierAnalysis {
    return {
      overview: {
        totalSuppliers: 0,
        respondingSuppliers: 0,
        responseRate: 0,
        dataQualityScore: 0,
        averageEmissions: 0,
        topEmitters: []
      },
      performance: [],
      engagement: {
        programParticipation: 0,
        trainingCompleted: 0,
        initiativesJoined: 0,
        dataSubmissionRate: 0,
        improvementPlans: 0
      },
      riskAssessment: [],
      collaboration: {
        activeInitiatives: 0,
        sharedReductions: 0,
        investmentLeverage: 0,
        partnershipValue: 0
      }
    };
  }

  private getEmptyInitiativesProgress(): InitiativesProgress {
    return {
      activeInitiatives: 0,
      completedInitiatives: 0,
      totalReductions: 0,
      investment: 0,
      roi: 0,
      keyInitiatives: []
    };
  }

  private getEmptyBenchmarkingResults(): BenchmarkingResults {
    return {
      sectorComparison: {
        metric: '',
        yourValue: 0,
        benchmark: 0,
        percentile: 0,
        performance: 'AVERAGE'
      },
      peerComparison: {
        metric: '',
        yourValue: 0,
        benchmark: 0,
        percentile: 0,
        performance: 'AVERAGE'
      },
      bestPractices: [],
      improvementOpportunities: []
    };
  }

  private getEmptyForwardLooking(): ForwardLooking {
    return {
      targets: [],
      projections: [],
      scenarios: [],
      roadmap: []
    };
  }

  // PDF generation helper methods
  private addCoverPage(doc: any, template: ReportTemplate, data: ReportData, settings: ReportSettings) {
    doc.fontSize(24).fillColor(settings.branding.colors.primary)
       .text(template.name, 50, 100);
    
    doc.fontSize(18).fillColor('#666')
       .text(data.organizationInfo.name, 50, 150);
       
    doc.fontSize(14).fillColor('#333')
       .text(`Reporting Period: ${data.reportingPeriod.year}`, 50, 200)
       .text(`Generated: ${new Date().toLocaleDateString()}`, 50, 220);

    doc.addPage();
  }

  private addReportSection(doc: any, section: ReportSection, data: ReportData, settings: ReportSettings) {
    doc.fontSize(18).fillColor(settings.branding.colors.primary)
       .text(section.title, 50, doc.y + 20);
    
    // Add section content based on type
    switch (section.type) {
      case 'OVERVIEW':
        this.addOverviewContent(doc, data, settings);
        break;
      case 'EMISSIONS':
        this.addEmissionsContent(doc, data, settings);
        break;
      case 'SCOPE3':
        this.addScope3Content(doc, data, settings);
        break;
      // Add more section types as needed
    }

    doc.addPage();
  }

  private addOverviewContent(doc: any, data: ReportData, settings: ReportSettings) {
    const summary = data.executiveSummary;
    doc.fontSize(12).fillColor('#333')
       .text(`Total Emissions: ${summary.totalEmissions.toLocaleString()} tCO2e`, 50, doc.y + 10)
       .text(`Change from Previous Year: ${summary.emissionChange.toFixed(1)}%`, 50, doc.y + 5)
       .text(`Scope 3 Percentage: ${summary.scope3Percentage.toFixed(1)}%`, 50, doc.y + 5);
  }

  private addEmissionsContent(doc: any, data: ReportData, settings: ReportSettings) {
    const emissions = data.emissionsData;
    doc.fontSize(12).fillColor('#333')
       .text(`Scope 1: ${emissions.scope1.current.toLocaleString()} tCO2e`, 50, doc.y + 10)
       .text(`Scope 2: ${emissions.scope2.current.toLocaleString()} tCO2e`, 50, doc.y + 5)
       .text(`Scope 3: ${emissions.scope3.current.toLocaleString()} tCO2e`, 50, doc.y + 5);
  }

  private addScope3Content(doc: any, data: ReportData, settings: ReportSettings) {
    if (data.scope3Analysis.totalEmissions > 0) {
      doc.fontSize(12).fillColor('#333')
         .text(`Total Scope 3: ${data.scope3Analysis.totalEmissions.toLocaleString()} tCO2e`, 50, doc.y + 10)
         .text(`Data Quality Score: ${data.scope3Analysis.dataQuality.overallScore}%`, 50, doc.y + 5);
    }
  }

  // Excel generation helper methods
  private addExcelSummary(worksheet: any, data: ReportData, settings: ReportSettings) {
    worksheet.addRow(['Executive Summary']);
    worksheet.addRow(['Total Emissions (tCO2e)', data.executiveSummary.totalEmissions]);
    worksheet.addRow(['Emission Change (%)', data.executiveSummary.emissionChange]);
    worksheet.addRow(['Scope 3 Percentage (%)', data.executiveSummary.scope3Percentage]);
  }

  private addEmissionsDataSheet(worksheet: any, emissions: EmissionsAnalysis) {
    worksheet.addRow(['Scope', 'Current (tCO2e)', 'Previous (tCO2e)', 'Change (tCO2e)', 'Change (%)']);
    worksheet.addRow(['Scope 1', emissions.scope1.current, emissions.scope1.previous, emissions.scope1.change, emissions.scope1.changePercent]);
    worksheet.addRow(['Scope 2', emissions.scope2.current, emissions.scope2.previous, emissions.scope2.change, emissions.scope2.changePercent]);
    worksheet.addRow(['Scope 3', emissions.scope3.current, emissions.scope3.previous, emissions.scope3.change, emissions.scope3.changePercent]);
    worksheet.addRow(['Total', emissions.total.current, emissions.total.previous, emissions.total.change, emissions.total.changePercent]);
  }

  private addSupplierDataSheet(worksheet: any, supplier: SupplierAnalysis) {
    worksheet.addRow(['Supplier Overview']);
    worksheet.addRow(['Total Suppliers', supplier.overview.totalSuppliers]);
    worksheet.addRow(['Responding Suppliers', supplier.overview.respondingSuppliers]);
    worksheet.addRow(['Response Rate (%)', supplier.overview.responseRate]);
    worksheet.addRow(['Data Quality Score', supplier.overview.dataQualityScore]);
  }

  private addInitiativesDataSheet(worksheet: any, initiatives: InitiativesProgress) {
    worksheet.addRow(['Initiatives Overview']);
    worksheet.addRow(['Active Initiatives', initiatives.activeInitiatives]);
    worksheet.addRow(['Completed Initiatives', initiatives.completedInitiatives]);
    worksheet.addRow(['Total Reductions (tCO2e)', initiatives.totalReductions]);
    worksheet.addRow(['Investment (£)', initiatives.investment]);
    worksheet.addRow(['ROI', initiatives.roi]);
  }

  // HTML generation helper methods
  private generateHTMLSection(section: ReportSection, data: ReportData, settings: ReportSettings): string {
    let html = `<section><h2>${section.title}</h2>`;

    switch (section.type) {
      case 'OVERVIEW':
        html += this.generateHTMLOverview(data);
        break;
      case 'EMISSIONS':
        html += this.generateHTMLEmissions(data);
        break;
      case 'SCOPE3':
        html += this.generateHTMLScope3(data);
        break;
    }

    html += '</section>';
    return html;
  }

  private generateHTMLOverview(data: ReportData): string {
    const summary = data.executiveSummary;
    return `
      <div class="metric">
        <h3>Total Emissions</h3>
        <p>${summary.totalEmissions.toLocaleString()} tCO2e</p>
      </div>
      <div class="metric">
        <h3>Year-over-Year Change</h3>
        <p>${summary.emissionChange.toFixed(1)}%</p>
      </div>
      <div class="metric">
        <h3>Scope 3 Contribution</h3>
        <p>${summary.scope3Percentage.toFixed(1)}%</p>
      </div>
    `;
  }

  private generateHTMLEmissions(data: ReportData): string {
    const emissions = data.emissionsData;
    return `
      <div class="chart-placeholder">Emissions Breakdown Chart</div>
      <div class="metric">
        <h3>Scope 1</h3>
        <p>${emissions.scope1.current.toLocaleString()} tCO2e</p>
      </div>
      <div class="metric">
        <h3>Scope 2</h3>
        <p>${emissions.scope2.current.toLocaleString()} tCO2e</p>
      </div>
      <div class="metric">
        <h3>Scope 3</h3>
        <p>${emissions.scope3.current.toLocaleString()} tCO2e</p>
      </div>
    `;
  }

  private generateHTMLScope3(data: ReportData): string {
    if (data.scope3Analysis.totalEmissions === 0) {
      return '<p>Scope 3 data not available for this reporting period.</p>';
    }

    return `
      <div class="metric">
        <h3>Total Scope 3 Emissions</h3>
        <p>${data.scope3Analysis.totalEmissions.toLocaleString()} tCO2e</p>
      </div>
      <div class="metric">
        <h3>Data Quality Score</h3>
        <p>${data.scope3Analysis.dataQuality.overallScore}%</p>
      </div>
      <div class="chart-placeholder">Scope 3 Category Breakdown</div>
    `;
  }

  /**
   * Get available report templates
   */
  getReportTemplates(): ReportTemplate[] {
    return Array.from(this.reportTemplates.values());
  }

  /**
   * Get report template by ID
   */
  getReportTemplate(templateId: string): ReportTemplate | null {
    return this.reportTemplates.get(templateId) || null;
  }

  /**
   * Get generated reports for organization
   */
  async getGeneratedReports(organizationId: string) {
    return this.prisma.generatedReport.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      include: {
        file: {
          select: {
            originalName: true,
            size: true,
            url: true
          }
        }
      }
    });
  }
}