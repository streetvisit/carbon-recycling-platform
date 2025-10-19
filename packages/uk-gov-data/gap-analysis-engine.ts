/**
 * Gap Analysis Engine
 * 
 * Intelligent system that compares organization emissions against 
 * UK government benchmarks, sectoral averages, and compliance requirements
 */

import { UK_GOVERNMENT_DATA_SOURCES, UK_SECTOR_MAPPING, type UKDataSource } from './data-sources';

export interface GapAnalysisInput {
  organizationId: string;
  sector: string;
  sicCode?: string;
  employeeCount?: number;
  revenue?: number;
  location?: string; // UK postcode or local authority
  reportingYear: number;
  currentEmissions: {
    scope1: number;
    scope2: number;
    scope3: number;
    total: number;
  };
  businessActivities?: string[];
}

export interface GapAnalysisResult {
  organizationId: string;
  analysisDate: string;
  overallScore: 'excellent' | 'good' | 'average' | 'needs_improvement' | 'urgent_action';
  
  // Benchmarking results
  benchmarks: {
    sectorAverage: BenchmarkComparison;
    nationalAverage: BenchmarkComparison;
    netZeroPathway: BenchmarkComparison;
    peerComparison: BenchmarkComparison;
  };
  
  // Compliance gaps
  complianceGaps: ComplianceGap[];
  
  // Specific recommendations
  recommendations: Recommendation[];
  
  // Data sources used
  dataSources: string[];
  
  // Next analysis date
  nextAnalysisDate: string;
}

export interface BenchmarkComparison {
  metric: 'absolute_emissions' | 'emissions_intensity' | 'reduction_rate';
  yourValue: number;
  benchmarkValue: number;
  percentageDifference: number;
  performance: 'above_average' | 'average' | 'below_average';
  unit: string;
  context: string;
}

export interface ComplianceGap {
  regulation: 'SECR' | 'TCFD' | 'UK_Taxonomy' | 'UK_ETS' | 'Carbon_Budgets';
  requirement: string;
  currentStatus: 'compliant' | 'partial' | 'non_compliant' | 'unknown';
  gapDescription: string;
  priority: 'high' | 'medium' | 'low';
  deadline?: string;
  actionRequired: string;
}

export interface Recommendation {
  id: string;
  category: 'measurement' | 'reduction' | 'reporting' | 'compliance';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  estimatedImpact: {
    emissionReduction?: number; // tCO2e
    costSaving?: number; // £
    complianceImprovement?: string;
  };
  implementationTime: string;
  difficulty: 'easy' | 'medium' | 'hard';
  dataSource: string;
}

export class GapAnalysisEngine {
  private benchmarkData: Map<string, any> = new Map();
  private complianceRules: Map<string, any> = new Map();

  constructor() {
    this.loadBenchmarkData();
    this.loadComplianceRules();
  }

  /**
   * Perform comprehensive gap analysis
   */
  async analyzeGaps(input: GapAnalysisInput): Promise<GapAnalysisResult> {
    const analysisDate = new Date().toISOString();
    
    // Fetch relevant benchmark data
    const benchmarks = await this.performBenchmarkAnalysis(input);
    
    // Identify compliance gaps
    const complianceGaps = await this.identifyComplianceGaps(input);
    
    // Generate recommendations
    const recommendations = await this.generateRecommendations(input, benchmarks, complianceGaps);
    
    // Calculate overall score
    const overallScore = this.calculateOverallScore(benchmarks, complianceGaps);
    
    return {
      organizationId: input.organizationId,
      analysisDate,
      overallScore,
      benchmarks,
      complianceGaps,
      recommendations,
      dataSources: this.getUsedDataSources(input),
      nextAnalysisDate: this.calculateNextAnalysisDate(analysisDate)
    };
  }

  /**
   * Perform benchmark analysis against various standards
   */
  private async performBenchmarkAnalysis(input: GapAnalysisInput) {
    const emissionsIntensity = input.revenue ? 
      input.currentEmissions.total / (input.revenue / 1000000) : // tCO2e per £M revenue
      input.employeeCount ? input.currentEmissions.total / input.employeeCount : 0; // tCO2e per employee

    // Sector average comparison
    const sectorData = await this.getSectorBenchmarks(input.sector, input.reportingYear);
    const sectorAverage: BenchmarkComparison = {
      metric: 'emissions_intensity',
      yourValue: emissionsIntensity,
      benchmarkValue: sectorData.averageIntensity,
      percentageDifference: ((emissionsIntensity - sectorData.averageIntensity) / sectorData.averageIntensity) * 100,
      performance: this.categorizePerformance(emissionsIntensity, sectorData.averageIntensity),
      unit: input.revenue ? 'tCO2e/£M revenue' : 'tCO2e/employee',
      context: `Based on ${sectorData.dataPoints} UK ${input.sector} companies`
    };

    // National average comparison
    const nationalData = await this.getNationalBenchmarks(input.reportingYear);
    const nationalAverage: BenchmarkComparison = {
      metric: 'absolute_emissions',
      yourValue: input.currentEmissions.total,
      benchmarkValue: nationalData.averageCompanyEmissions,
      percentageDifference: ((input.currentEmissions.total - nationalData.averageCompanyEmissions) / nationalData.averageCompanyEmissions) * 100,
      performance: this.categorizePerformance(input.currentEmissions.total, nationalData.averageCompanyEmissions),
      unit: 'tCO2e',
      context: 'UK national average for similar-sized companies'
    };

    // Net zero pathway comparison
    const netZeroData = await this.getNetZeroPathway(input.sector, input.reportingYear);
    const netZeroPathway: BenchmarkComparison = {
      metric: 'reduction_rate',
      yourValue: 0, // Would need historical data to calculate
      benchmarkValue: netZeroData.requiredAnnualReduction,
      percentageDifference: -100, // Assume not meeting pathway without historical data
      performance: 'below_average',
      unit: '% per year',
      context: `UK ${input.sector} sector net zero pathway (CCC Sixth Carbon Budget)`
    };

    // Peer comparison (companies of similar size in same sector)
    const peerData = await this.getPeerBenchmarks(input);
    const peerComparison: BenchmarkComparison = {
      metric: 'emissions_intensity',
      yourValue: emissionsIntensity,
      benchmarkValue: peerData.medianIntensity,
      percentageDifference: ((emissionsIntensity - peerData.medianIntensity) / peerData.medianIntensity) * 100,
      performance: this.categorizePerformance(emissionsIntensity, peerData.medianIntensity),
      unit: input.revenue ? 'tCO2e/£M revenue' : 'tCO2e/employee',
      context: `Median of ${peerData.peerCount} similar companies in ${input.sector}`
    };

    return {
      sectorAverage,
      nationalAverage,
      netZeroPathway,
      peerComparison
    };
  }

  /**
   * Identify compliance gaps against UK regulations
   */
  private async identifyComplianceGaps(input: GapAnalysisInput): Promise<ComplianceGap[]> {
    const gaps: ComplianceGap[] = [];
    
    // SECR (Streamlined Energy and Carbon Reporting)
    if (this.isSubjectToSECR(input)) {
      gaps.push({
        regulation: 'SECR',
        requirement: 'Annual energy and carbon reporting',
        currentStatus: 'unknown', // Would need to check actual reporting
        gapDescription: 'Must report Scope 1, 2 and business travel emissions, plus energy consumption',
        priority: 'high',
        deadline: `${input.reportingYear + 1}-12-31`,
        actionRequired: 'Ensure comprehensive SECR reporting including Scope 3 business travel'
      });
    }

    // UK ETS compliance
    if (this.isSubjectToUKETS(input)) {
      gaps.push({
        regulation: 'UK_ETS',
        requirement: 'Verified emissions reporting and allowance surrender',
        currentStatus: input.currentEmissions.total > 25000 ? 'partial' : 'compliant',
        gapDescription: 'Large emitters must verify emissions and surrender allowances',
        priority: 'high',
        deadline: `${input.reportingYear + 1}-04-30`,
        actionRequired: 'Ensure verified emissions reporting and allowance management'
      });
    }

    // TCFD recommendations
    if (this.shouldFollowTCFD(input)) {
      gaps.push({
        regulation: 'TCFD',
        requirement: 'Climate-related financial disclosures',
        currentStatus: 'partial',
        gapDescription: 'Disclose governance, strategy, risk management, and metrics around climate risks',
        priority: 'medium',
        actionRequired: 'Implement TCFD framework including scenario analysis and risk assessment'
      });
    }

    // Carbon Budget alignment
    const carbonBudgetGap = await this.assessCarbonBudgetAlignment(input);
    if (carbonBudgetGap) {
      gaps.push(carbonBudgetGap);
    }

    return gaps;
  }

  /**
   * Generate actionable recommendations
   */
  private async generateRecommendations(
    input: GapAnalysisInput, 
    benchmarks: any, 
    gaps: ComplianceGap[]
  ): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    // Performance-based recommendations
    if (benchmarks.sectorAverage.performance === 'below_average') {
      recommendations.push({
        id: 'sector-performance-improvement',
        category: 'reduction',
        priority: 'high',
        title: 'Improve sector-relative performance',
        description: `Your emissions intensity is ${Math.abs(benchmarks.sectorAverage.percentageDifference).toFixed(1)}% above sector average`,
        estimatedImpact: {
          emissionReduction: input.currentEmissions.total * (Math.abs(benchmarks.sectorAverage.percentageDifference) / 100),
          complianceImprovement: 'Align with sector best practices'
        },
        implementationTime: '12-18 months',
        difficulty: 'medium',
        dataSource: 'ONS Atmospheric Emissions by Industry'
      });
    }

    // Data quality recommendations
    if (!input.scope3 || input.currentEmissions.scope3 === 0) {
      recommendations.push({
        id: 'scope3-measurement',
        category: 'measurement',
        priority: 'high',
        title: 'Implement Scope 3 emissions measurement',
        description: 'Scope 3 typically represents 70-90% of total emissions for most organizations',
        estimatedImpact: {
          complianceImprovement: 'Complete GHG Protocol coverage'
        },
        implementationTime: '3-6 months',
        difficulty: 'medium',
        dataSource: 'GHG Protocol Corporate Standard'
      });
    }

    // Compliance-driven recommendations
    gaps.forEach(gap => {
      if (gap.priority === 'high') {
        recommendations.push({
          id: `compliance-${gap.regulation.toLowerCase()}`,
          category: 'compliance',
          priority: 'high',
          title: `Address ${gap.regulation} compliance gap`,
          description: gap.actionRequired,
          estimatedImpact: {
            complianceImprovement: `Achieve ${gap.regulation} compliance`
          },
          implementationTime: '1-3 months',
          difficulty: 'easy',
          dataSource: 'UK Government Regulations'
        });
      }
    });

    // Net zero pathway recommendations
    if (benchmarks.netZeroPathway.performance === 'below_average') {
      const requiredReduction = input.currentEmissions.total * (benchmarks.netZeroPathway.benchmarkValue / 100);
      recommendations.push({
        id: 'net-zero-alignment',
        category: 'reduction',
        priority: 'medium',
        title: 'Align with UK net zero pathway',
        description: `Increase annual emission reductions to ${benchmarks.netZeroPathway.benchmarkValue}% per year`,
        estimatedImpact: {
          emissionReduction: requiredReduction,
          complianceImprovement: 'Align with UK Carbon Budget pathway'
        },
        implementationTime: '2-3 years',
        difficulty: 'hard',
        dataSource: 'CCC Sixth Carbon Budget'
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Calculate overall performance score
   */
  private calculateOverallScore(benchmarks: any, gaps: ComplianceGap[]): 'excellent' | 'good' | 'average' | 'needs_improvement' | 'urgent_action' {
    let score = 0;
    let maxScore = 0;

    // Benchmark performance scoring (40% weight)
    Object.values(benchmarks).forEach((benchmark: any) => {
      maxScore += 10;
      if (benchmark.performance === 'above_average') score += 10;
      else if (benchmark.performance === 'average') score += 6;
      else score += 2;
    });

    // Compliance scoring (60% weight)
    const highPriorityGaps = gaps.filter(g => g.priority === 'high').length;
    const totalGaps = gaps.length;
    
    maxScore += 15;
    if (highPriorityGaps === 0) score += 15;
    else if (highPriorityGaps <= 2) score += 10;
    else if (highPriorityGaps <= 4) score += 6;
    else score += 2;

    const percentage = (score / maxScore) * 100;

    if (percentage >= 85) return 'excellent';
    if (percentage >= 70) return 'good';
    if (percentage >= 55) return 'average';
    if (percentage >= 40) return 'needs_improvement';
    return 'urgent_action';
  }

  /**
   * Helper methods for data fetching and analysis
   */
  private async getSectorBenchmarks(sector: string, year: number) {
    // In real implementation, this would fetch from ONS/DEFRA APIs
    return {
      averageIntensity: 45.2, // tCO2e per £M or per employee
      medianIntensity: 38.7,
      dataPoints: 1250,
      sector,
      year
    };
  }

  private async getNationalBenchmarks(year: number) {
    // In real implementation, this would fetch from UK national statistics
    return {
      averageCompanyEmissions: 1250, // tCO2e
      medianCompanyEmissions: 650,
      totalCompanies: 125000,
      year
    };
  }

  private async getNetZeroPathway(sector: string, year: number) {
    // In real implementation, this would fetch from CCC data
    const sectorPathways = {
      manufacturing: { requiredAnnualReduction: 7.2 },
      transport: { requiredAnnualReduction: 8.1 },
      energy: { requiredAnnualReduction: 12.5 },
      default: { requiredAnnualReduction: 6.8 }
    };
    
    return sectorPathways[sector] || sectorPathways.default;
  }

  private async getPeerBenchmarks(input: GapAnalysisInput) {
    // In real implementation, this would fetch peer company data
    return {
      medianIntensity: 42.1,
      averageIntensity: 48.6,
      peerCount: 28,
      sector: input.sector
    };
  }

  private categorizePerformance(yourValue: number, benchmarkValue: number): 'above_average' | 'average' | 'below_average' {
    const difference = (yourValue - benchmarkValue) / benchmarkValue;
    if (difference < -0.1) return 'above_average'; // 10% better than benchmark
    if (difference > 0.1) return 'below_average';  // 10% worse than benchmark
    return 'average';
  }

  private isSubjectToSECR(input: GapAnalysisInput): boolean {
    return (input.employeeCount && input.employeeCount > 250) || 
           (input.revenue && input.revenue > 36000000); // £36M turnover threshold
  }

  private isSubjectToUKETS(input: GapAnalysisInput): boolean {
    return input.currentEmissions.total > 25000; // 25,000 tCO2e threshold
  }

  private shouldFollowTCFD(input: GapAnalysisInput): boolean {
    return (input.employeeCount && input.employeeCount > 500) || 
           (input.revenue && input.revenue > 500000000); // £500M turnover
  }

  private async assessCarbonBudgetAlignment(input: GapAnalysisInput): Promise<ComplianceGap | null> {
    // Check alignment with UK Carbon Budgets
    const currentBudgetPeriod = this.getCurrentCarbonBudgetPeriod(input.reportingYear);
    
    if (currentBudgetPeriod) {
      return {
        regulation: 'Carbon_Budgets',
        requirement: `Align with Carbon Budget ${currentBudgetPeriod.number} (${currentBudgetPeriod.period})`,
        currentStatus: 'unknown',
        gapDescription: 'Ensure emission reduction trajectory aligns with UK Carbon Budget pathway',
        priority: 'medium',
        actionRequired: `Set science-based targets aligned with ${currentBudgetPeriod.annualReduction}% annual reduction`
      };
    }
    
    return null;
  }

  private getCurrentCarbonBudgetPeriod(year: number) {
    // UK Carbon Budget periods
    if (year >= 2023 && year <= 2027) {
      return { number: 4, period: '2023-2027', annualReduction: 7.8 };
    }
    if (year >= 2028 && year <= 2032) {
      return { number: 5, period: '2028-2032', annualReduction: 8.5 };
    }
    if (year >= 2033 && year <= 2037) {
      return { number: 6, period: '2033-2037', annualReduction: 9.2 };
    }
    return null;
  }

  private loadBenchmarkData() {
    // Load cached benchmark data from UK government sources
    // This would typically load from a database or cache
  }

  private loadComplianceRules() {
    // Load compliance rule sets
    // This would typically load from a configuration system
  }

  private getUsedDataSources(input: GapAnalysisInput): string[] {
    // Return list of data sources used in analysis
    return [
      'defra-uk-emissions-statistics',
      'ons-atmospheric-emissions',
      'ccc-carbon-budgets',
      'uk-ets-registry'
    ];
  }

  private calculateNextAnalysisDate(currentDate: string): string {
    const date = new Date(currentDate);
    date.setMonth(date.getMonth() + 6); // Recommend re-analysis every 6 months
    return date.toISOString();
  }
}

export const gapAnalysisEngine = new GapAnalysisEngine();