import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { LoggingInterceptor } from '../interceptors/logging.interceptor';
import { UKComplianceService } from '../services/uk-compliance.service';

// UK Government's 6 Integrity Principles
export interface IntegrityPrinciples {
  principle1: HighIntegrityValidation;
  principle2: MeasurementDisclosure;
  principle3: TransitionPlanAlignment;
  principle4: ClaimsAccuracy;
  principle5: MarketCooperation;
  principle6: AddionalityRequirement;
}

export interface HighIntegrityValidation {
  compliant: boolean;
  ccpLabelled: boolean;
  vcsStandard: boolean;
  goldStandard: boolean;
  icvcmApproved: boolean;
  issues: string[];
}

export interface MeasurementDisclosure {
  compliant: boolean;
  sustainabilityReporting: boolean;
  vcmiClaimsCode: boolean;
  disclosureComplete: boolean;
  plannedUse: string;
  issues: string[];
}

export interface TransitionPlanAlignment {
  compliant: boolean;
  parisAlignment: boolean;
  oneFiveDegreeTarget: boolean;
  scienceBasedTargets: boolean;
  netZeroPathway: boolean;
  issues: string[];
}

export interface ClaimsAccuracy {
  compliant: boolean;
  accurateTerminology: boolean;
  environmentalImpact: boolean;
  ukCompliantClaims: boolean;
  misleadingClaims: string[];
  issues: string[];
}

export interface MarketCooperation {
  compliant: boolean;
  marketParticipation: boolean;
  bestPracticeSharing: boolean;
  integritySupport: boolean;
  cooperationScore: number;
  issues: string[];
}

export interface AddionalityRequirement {
  compliant: boolean;
  additionalToDirectAction: boolean;
  valueChainAction: boolean;
  scope3Commitment: boolean;
  ambitionLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  issues: string[];
}

// VCMI Claims Code Types
export interface VCMIReport {
  claimsCode: string;
  complianceLevel: 'SILVER' | 'GOLD';
  scope3ActionPlan: boolean;
  beyondValueChainMitigation: boolean;
  creditsUsed: CarbonCreditUsage[];
  reportingPeriod: string;
  certificationDate: Date;
  validityPeriod: string;
}

export interface CarbonCreditUsage {
  creditType: string;
  quantity: number;
  vintage: string;
  methodology: string;
  registry: string;
  retirement: boolean;
  purposeOfUse: string;
  ccpLabelled: boolean;
}

// Nature Market Types
export interface NatureMarketOpportunity {
  id: string;
  type: 'PEATLAND_RESTORATION' | 'WOODLAND_CREATION' | 'BIODIVERSITY_NET_GAIN' | 'HABITAT_RESTORATION';
  location: UKLocation;
  area: number; // hectares
  potentialCredits: number;
  estimatedRevenue: number; // GBP
  timeline: string;
  requirements: string[];
  eligibilityCriteria: string[];
}

export interface UKLocation {
  country: 'ENGLAND' | 'SCOTLAND' | 'WALES' | 'NORTHERN_IRELAND';
  region: string;
  postcode: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
}

// UK Market Intelligence Types
export interface UKMarketData {
  carbonMarketSize: number; // £250B by 2050
  natureMarketSize: number; // £69B by 2050
  currentInvestment: number; // £43.7B since July 2024
  growthRate: number; // 3x economy average
  employmentGrowth: number; // 10%+ green jobs
  governmentSupport: boolean;
  regulatoryClarity: number; // 0-1 score
}

@Controller('uk-compliance')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(LoggingInterceptor)
export class UKComplianceController {
  constructor(private readonly ukComplianceService: UKComplianceService) {}

  // UK Government 6 Integrity Principles Validation
  @Post('validate-integrity-principles')
  @Roles('admin', 'compliance_officer', 'sustainability_manager')
  async validateIntegrityPrinciples(
    @Body() creditData: any,
    @CurrentUser() user: any,
  ): Promise<IntegrityPrinciples> {
    return await this.ukComplianceService.validateIntegrityPrinciples(creditData, user.id);
  }

  // VCMI Claims Code Compliance
  @Get('vcmi-compliance/:companyId')
  @Roles('admin', 'compliance_officer', 'sustainability_manager')
  async getVCMICompliance(
    @Param('companyId') companyId: string,
    @Query('reportingPeriod') reportingPeriod?: string,
  ): Promise<VCMIReport> {
    return await this.ukComplianceService.generateVCMIReport(companyId, reportingPeriod);
  }

  @Post('vcmi-claims-code')
  @Roles('admin', 'compliance_officer')
  async generateVCMIClaimsCode(
    @Body() claimsData: any,
    @CurrentUser() user: any,
  ): Promise<{ claimsCode: string; validityPeriod: string }> {
    return await this.ukComplianceService.generateVCMIClaimsCode(claimsData, user.id);
  }

  // Core Carbon Principles (CCP) Verification
  @Post('verify-ccp-credits')
  @Roles('admin', 'compliance_officer', 'trader')
  async verifyCCPCredits(
    @Body() credits: any[],
    @CurrentUser() user: any,
  ): Promise<any> {
    return await this.ukComplianceService.verifyCCPCredits(credits, user.id);
  }

  @Get('ccp-eligible-credits')
  async getCCPEligibleCredits(
    @Query('creditType') creditType?: string,
    @Query('vintage') vintage?: string,
    @Query('methodology') methodology?: string,
  ): Promise<any> {
    return await this.ukComplianceService.getCCPEligibleCredits({
      creditType,
      vintage,
      methodology,
    });
  }

  // UK Sustainability Reporting
  @Post('generate-uk-sustainability-report')
  @Roles('admin', 'compliance_officer', 'sustainability_manager')
  async generateUKSustainabilityReport(
    @Body() reportData: any,
    @CurrentUser() user: any,
  ): Promise<any> {
    return await this.ukComplianceService.generateUKSustainabilityReport(reportData, user.id);
  }

  @Get('uk-reporting-templates')
  async getUKReportingTemplates(
    @Query('reportType') reportType?: string,
  ): Promise<any> {
    return await this.ukComplianceService.getUKReportingTemplates(reportType);
  }

  // Nature Market Opportunities
  @Get('nature-market-opportunities')
  @Roles('admin', 'landowner', 'farmer', 'nature_project_developer')
  async getNatureMarketOpportunities(
    @Query('location') location?: string,
    @Query('type') type?: string,
    @Query('minArea') minArea?: number,
    @Query('maxArea') maxArea?: number,
  ): Promise<NatureMarketOpportunity[]> {
    return await this.ukComplianceService.getNatureMarketOpportunities({
      location,
      type,
      minArea,
      maxArea,
    });
  }

  @Post('calculate-farmer-revenue')
  @Roles('admin', 'farmer', 'landowner', 'land_manager')
  async calculateFarmerRevenue(
    @Body() landData: any,
    @CurrentUser() user: any,
  ): Promise<any> {
    return await this.ukComplianceService.calculateFarmerRevenue(landData, user.id);
  }

  @Post('register-nature-project')
  @Roles('admin', 'nature_project_developer', 'landowner')
  async registerNatureProject(
    @Body() projectData: any,
    @CurrentUser() user: any,
  ): Promise<any> {
    return await this.ukComplianceService.registerNatureProject(projectData, user.id);
  }

  // UK Market Intelligence & Analytics
  @Get('market-intelligence')
  async getUKMarketIntelligence(): Promise<UKMarketData> {
    return await this.ukComplianceService.getUKMarketIntelligence();
  }

  @Get('investment-tracking')
  @Roles('admin', 'investor', 'executive')
  async getInvestmentTracking(
    @Query('sector') sector?: string,
    @Query('region') region?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ): Promise<any> {
    return await this.ukComplianceService.getInvestmentTracking({
      sector,
      region,
      fromDate,
      toDate,
    });
  }

  @Get('green-finance-metrics')
  async getGreenFinanceMetrics(): Promise<any> {
    return await this.ukComplianceService.getGreenFinanceMetrics();
  }

  // Government Consultation & Engagement
  @Post('consultation-response')
  @Roles('admin', 'compliance_officer', 'policy_officer')
  async submitConsultationResponse(
    @Body() responseData: any,
    @CurrentUser() user: any,
  ): Promise<any> {
    return await this.ukComplianceService.submitConsultationResponse(responseData, user.id);
  }

  @Get('government-updates')
  async getGovernmentUpdates(
    @Query('category') category?: string,
    @Query('fromDate') fromDate?: string,
  ): Promise<any> {
    return await this.ukComplianceService.getGovernmentUpdates(category, fromDate);
  }

  // UK Registry Integration
  @Post('uk-registry-integration')
  @Roles('admin', 'compliance_officer')
  async initiateUKRegistryIntegration(
    @Body() registryData: any,
    @CurrentUser() user: any,
  ): Promise<any> {
    return await this.ukComplianceService.initiateUKRegistryIntegration(registryData, user.id);
  }

  @Get('registry-status')
  async getRegistryStatus(
    @Query('registryType') registryType?: string,
  ): Promise<any> {
    return await this.ukComplianceService.getRegistryStatus(registryType);
  }

  // Indigenous Peoples & Local Communities (IPLC) Safeguards
  @Post('iplc-safeguards-assessment')
  @Roles('admin', 'compliance_officer', 'nature_project_developer')
  async assessIPLCSafeguards(
    @Body() projectData: any,
    @CurrentUser() user: any,
  ): Promise<any> {
    return await this.ukComplianceService.assessIPLCSafeguards(projectData, user.id);
  }

  @Post('fpic-tracking')
  @Roles('admin', 'compliance_officer', 'community_liaison')
  async trackFPIC(
    @Body() fpicData: any,
    @CurrentUser() user: any,
  ): Promise<any> {
    return await this.ukComplianceService.trackFPIC(fpicData, user.id);
  }

  // UK Market Participant Directory
  @Get('market-participants')
  async getMarketParticipants(
    @Query('type') type?: 'BUYER' | 'SELLER' | 'DEVELOPER' | 'VERIFIER' | 'REGISTRY',
    @Query('sector') sector?: string,
    @Query('location') location?: string,
  ): Promise<any> {
    return await this.ukComplianceService.getMarketParticipants({ type, sector, location });
  }

  @Post('register-market-participant')
  @Roles('admin', 'compliance_officer')
  async registerMarketParticipant(
    @Body() participantData: any,
    @CurrentUser() user: any,
  ): Promise<any> {
    return await this.ukComplianceService.registerMarketParticipant(participantData, user.id);
  }

  // Best Practices & Knowledge Sharing
  @Get('best-practices')
  async getBestPractices(
    @Query('category') category?: string,
    @Query('sector') sector?: string,
  ): Promise<any> {
    return await this.ukComplianceService.getBestPractices(category, sector);
  }

  @Post('share-best-practice')
  @Roles('admin', 'compliance_officer', 'sustainability_manager')
  async shareBestPractice(
    @Body() practiceData: any,
    @CurrentUser() user: any,
  ): Promise<any> {
    return await this.ukComplianceService.shareBestPractice(practiceData, user.id);
  }

  // UK Government Reporting Automation
  @Post('automated-government-report')
  @Roles('admin', 'compliance_officer')
  async generateAutomatedGovernmentReport(
    @Body() reportConfig: any,
    @CurrentUser() user: any,
  ): Promise<any> {
    return await this.ukComplianceService.generateAutomatedGovernmentReport(reportConfig, user.id);
  }

  @Get('compliance-dashboard')
  @Roles('admin', 'compliance_officer', 'executive')
  async getComplianceDashboard(
    @Query('period') period?: string,
  ): Promise<any> {
    return await this.ukComplianceService.getComplianceDashboard(period);
  }

  // Development Environment Controls
  @Get('development-status')
  async getDevelopmentStatus(): Promise<any> {
    return {
      environment: process.env.NODE_ENV,
      ukComplianceMode: process.env.UK_COMPLIANCE_MODE === 'true',
      ringFenced: process.env.RING_FENCED === 'true',
      realTradingDisabled: process.env.REAL_TRADING_DISABLED === 'true',
      simulationOnly: process.env.SIMULATION_ONLY === 'true',
      lastUpdated: new Date(),
    };
  }

  @Post('validate-development-compliance')
  @Roles('admin', 'developer')
  async validateDevelopmentCompliance(
    @Body() validationData: any,
    @CurrentUser() user: any,
  ): Promise<any> {
    return await this.ukComplianceService.validateDevelopmentCompliance(validationData, user.id);
  }
}