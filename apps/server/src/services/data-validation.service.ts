import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

export interface ValidationRule {
  id: string;
  field: string;
  type: 'REQUIRED' | 'RANGE' | 'PATTERN' | 'CUSTOM' | 'CONSISTENCY' | 'BENCHMARK' | 'ANOMALY';
  severity: 'ERROR' | 'WARNING' | 'INFO';
  condition: any;
  message: string;
  category?: string;
  enabled: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  score: number; // 0-100
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  suggestions: ValidationSuggestion[];
  dataQualityMetrics: DataQualityMetrics;
}

export interface ValidationIssue {
  ruleId: string;
  field: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  message: string;
  currentValue?: any;
  expectedValue?: any;
  suggestion?: string;
}

export interface ValidationSuggestion {
  type: 'DATA_IMPROVEMENT' | 'METHODOLOGY' | 'ACCURACY' | 'COMPLETENESS';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  estimatedImpact: string;
  implementationGuide?: string;
}

export interface DataQualityMetrics {
  completeness: number; // % of required fields filled
  accuracy: number; // % of values passing validation
  consistency: number; // % consistency across related fields
  timeliness: number; // % data submitted on time
  validity: number; // % values within expected ranges
  uniqueness: number; // % non-duplicate entries
  overall: number; // weighted average
}

export interface AnomalyDetectionResult {
  isAnomaly: boolean;
  confidence: number; // 0-1
  type: 'STATISTICAL' | 'PATTERN' | 'TEMPORAL' | 'CONTEXTUAL';
  description: string;
  expectedRange?: { min: number; max: number };
  similarValues?: number[];
  recommendation: string;
}

@Injectable()
export class DataValidationService {
  private readonly logger = new Logger(DataValidationService.name);
  private validationRules: ValidationRule[] = [];

  constructor(private prisma: PrismaService) {
    this.initializeValidationRules();
  }

  /**
   * Initialize comprehensive validation rules
   */
  private initializeValidationRules() {
    this.validationRules = [
      // Required Field Rules
      {
        id: 'req_scope1',
        field: 'scope1Emissions',
        type: 'REQUIRED',
        severity: 'ERROR',
        condition: { notNull: true, notZero: true },
        message: 'Scope 1 emissions must be provided and greater than zero',
        category: 'EMISSIONS',
        enabled: true
      },
      {
        id: 'req_energy_consumption',
        field: 'totalEnergyConsumption',
        type: 'REQUIRED',
        severity: 'ERROR',
        condition: { notNull: true, positive: true },
        message: 'Total energy consumption is required',
        category: 'ENERGY',
        enabled: true
      },

      // Range Validation Rules
      {
        id: 'range_emissions_intensity',
        field: 'emissionsIntensity',
        type: 'RANGE',
        severity: 'WARNING',
        condition: { min: 0.01, max: 1000 },
        message: 'Emissions intensity appears unusually high or low',
        category: 'EMISSIONS',
        enabled: true
      },
      {
        id: 'range_employee_count',
        field: 'employeeCount',
        type: 'RANGE',
        severity: 'WARNING',
        condition: { min: 1, max: 1000000 },
        message: 'Employee count seems unrealistic',
        category: 'ORGANIZATION',
        enabled: true
      },

      // Pattern Validation Rules
      {
        id: 'pattern_postcode',
        field: 'postcode',
        type: 'PATTERN',
        severity: 'WARNING',
        condition: { regex: '^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$' },
        message: 'Invalid UK postcode format',
        category: 'ADDRESS',
        enabled: true
      },
      {
        id: 'pattern_sic_code',
        field: 'sicCode',
        type: 'PATTERN',
        severity: 'INFO',
        condition: { regex: '^[0-9]{4,5}$' },
        message: 'SIC code should be 4-5 digits',
        category: 'ORGANIZATION',
        enabled: true
      },

      // Consistency Rules
      {
        id: 'consistency_total_emissions',
        field: 'totalEmissions',
        type: 'CONSISTENCY',
        severity: 'ERROR',
        condition: { 
          equation: 'scope1Emissions + scope2Emissions + scope3Emissions',
          tolerance: 0.01 
        },
        message: 'Total emissions does not match sum of individual scopes',
        category: 'EMISSIONS',
        enabled: true
      },
      {
        id: 'consistency_energy_emissions',
        field: 'scope2Emissions',
        type: 'CONSISTENCY',
        severity: 'WARNING',
        condition: { 
          correlateWith: 'electricityConsumption',
          expectedFactor: 0.0002 // Rough UK grid factor
        },
        message: 'Scope 2 emissions seem inconsistent with electricity consumption',
        category: 'ENERGY',
        enabled: true
      },

      // Benchmark Rules
      {
        id: 'benchmark_sector_intensity',
        field: 'emissionsIntensity',
        type: 'BENCHMARK',
        severity: 'INFO',
        condition: { 
          compareTo: 'SECTOR_AVERAGE',
          deviationThreshold: 2.0 // Standard deviations
        },
        message: 'Emissions intensity significantly different from sector average',
        category: 'BENCHMARKING',
        enabled: true
      },

      // Anomaly Detection Rules
      {
        id: 'anomaly_sudden_change',
        field: 'totalEmissions',
        type: 'ANOMALY',
        severity: 'WARNING',
        condition: { 
          yearOverYear: true,
          changeThreshold: 0.5 // 50% change
        },
        message: 'Significant change in emissions from previous year',
        category: 'TEMPORAL',
        enabled: true
      }
    ];

    this.logger.log(`Initialized ${this.validationRules.length} validation rules`);
  }

  /**
   * Validate emissions data comprehensively
   */
  async validateEmissionsData(
    organizationId: string,
    emissionsData: any,
    reportingYear: number
  ): Promise<ValidationResult> {
    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];
    const suggestions: ValidationSuggestion[] = [];

    // Get organization context for benchmarking
    const organization = await this.getOrganizationContext(organizationId);
    const historicalData = await this.getHistoricalData(organizationId, reportingYear);
    const sectorBenchmarks = await this.getSectorBenchmarks(organization?.sector);

    // Apply all validation rules
    for (const rule of this.validationRules.filter(r => r.enabled)) {
      const ruleResult = await this.applyValidationRule(
        rule,
        emissionsData,
        { organization, historicalData, sectorBenchmarks }
      );

      if (ruleResult) {
        if (ruleResult.severity === 'ERROR') {
          errors.push(ruleResult);
        } else if (ruleResult.severity === 'WARNING') {
          warnings.push(ruleResult);
        }
      }
    }

    // Calculate data quality metrics
    const dataQualityMetrics = this.calculateDataQualityMetrics(
      emissionsData,
      errors,
      warnings,
      organization
    );

    // Generate suggestions for improvement
    const improvementSuggestions = this.generateImprovementSuggestions(
      emissionsData,
      errors,
      warnings,
      dataQualityMetrics
    );

    suggestions.push(...improvementSuggestions);

    // Calculate overall validation score
    const score = this.calculateValidationScore(dataQualityMetrics, errors, warnings);

    return {
      isValid: errors.length === 0,
      score,
      errors,
      warnings,
      suggestions,
      dataQualityMetrics
    };
  }

  /**
   * Apply individual validation rule
   */
  private async applyValidationRule(
    rule: ValidationRule,
    data: any,
    context: any
  ): Promise<ValidationIssue | null> {
    const fieldValue = this.getNestedValue(data, rule.field);

    switch (rule.type) {
      case 'REQUIRED':
        return this.validateRequired(rule, fieldValue);

      case 'RANGE':
        return this.validateRange(rule, fieldValue);

      case 'PATTERN':
        return this.validatePattern(rule, fieldValue);

      case 'CONSISTENCY':
        return this.validateConsistency(rule, data);

      case 'BENCHMARK':
        return await this.validateBenchmark(rule, fieldValue, context.sectorBenchmarks);

      case 'ANOMALY':
        return await this.detectAnomaly(rule, fieldValue, context.historicalData);

      default:
        return null;
    }
  }

  /**
   * Validate required fields
   */
  private validateRequired(rule: ValidationRule, value: any): ValidationIssue | null {
    const condition = rule.condition;
    
    if (condition.notNull && (value === null || value === undefined)) {
      return {
        ruleId: rule.id,
        field: rule.field,
        severity: rule.severity,
        message: rule.message,
        currentValue: value,
        suggestion: 'Please provide a value for this required field'
      };
    }

    if (condition.notZero && (value === 0 || value === '0')) {
      return {
        ruleId: rule.id,
        field: rule.field,
        severity: rule.severity,
        message: rule.message,
        currentValue: value,
        suggestion: 'Value should be greater than zero'
      };
    }

    if (condition.positive && value <= 0) {
      return {
        ruleId: rule.id,
        field: rule.field,
        severity: rule.severity,
        message: rule.message,
        currentValue: value,
        suggestion: 'Value must be positive'
      };
    }

    return null;
  }

  /**
   * Validate numeric ranges
   */
  private validateRange(rule: ValidationRule, value: any): ValidationIssue | null {
    if (value === null || value === undefined) return null;

    const numValue = Number(value);
    const { min, max } = rule.condition;

    if (min !== undefined && numValue < min) {
      return {
        ruleId: rule.id,
        field: rule.field,
        severity: rule.severity,
        message: `${rule.message} (minimum: ${min})`,
        currentValue: numValue,
        expectedValue: `>= ${min}`,
        suggestion: `Consider reviewing this value as it's below expected minimum of ${min}`
      };
    }

    if (max !== undefined && numValue > max) {
      return {
        ruleId: rule.id,
        field: rule.field,
        severity: rule.severity,
        message: `${rule.message} (maximum: ${max})`,
        currentValue: numValue,
        expectedValue: `<= ${max}`,
        suggestion: `Consider reviewing this value as it's above expected maximum of ${max}`
      };
    }

    return null;
  }

  /**
   * Validate pattern matching
   */
  private validatePattern(rule: ValidationRule, value: any): ValidationIssue | null {
    if (!value) return null;

    const regex = new RegExp(rule.condition.regex);
    if (!regex.test(String(value))) {
      return {
        ruleId: rule.id,
        field: rule.field,
        severity: rule.severity,
        message: rule.message,
        currentValue: value,
        suggestion: 'Please check the format of this field'
      };
    }

    return null;
  }

  /**
   * Validate data consistency
   */
  private validateConsistency(rule: ValidationRule, data: any): ValidationIssue | null {
    const condition = rule.condition;

    if (condition.equation) {
      // Parse and evaluate equation
      const calculatedValue = this.evaluateEquation(condition.equation, data);
      const actualValue = Number(this.getNestedValue(data, rule.field));
      const tolerance = condition.tolerance || 0.01;

      if (Math.abs(calculatedValue - actualValue) > tolerance) {
        return {
          ruleId: rule.id,
          field: rule.field,
          severity: rule.severity,
          message: rule.message,
          currentValue: actualValue,
          expectedValue: calculatedValue,
          suggestion: `Expected value: ${calculatedValue.toFixed(2)}, but got ${actualValue}`
        };
      }
    }

    if (condition.correlateWith) {
      const correlatedField = condition.correlateWith;
      const expectedFactor = condition.expectedFactor;
      const correlatedValue = Number(this.getNestedValue(data, correlatedField));
      const actualValue = Number(this.getNestedValue(data, rule.field));
      
      if (correlatedValue > 0) {
        const actualRatio = actualValue / correlatedValue;
        const expectedRatio = expectedFactor;
        const deviation = Math.abs(actualRatio - expectedRatio) / expectedRatio;

        if (deviation > 0.5) { // 50% deviation threshold
          return {
            ruleId: rule.id,
            field: rule.field,
            severity: rule.severity,
            message: rule.message,
            currentValue: actualValue,
            suggestion: `Expected ratio with ${correlatedField}: ~${expectedRatio.toFixed(4)}, actual: ${actualRatio.toFixed(4)}`
          };
        }
      }
    }

    return null;
  }

  /**
   * Validate against benchmarks
   */
  private async validateBenchmark(
    rule: ValidationRule,
    value: any,
    benchmarks: any
  ): Promise<ValidationIssue | null> {
    if (!value || !benchmarks) return null;

    const condition = rule.condition;
    const numValue = Number(value);

    if (condition.compareTo === 'SECTOR_AVERAGE' && benchmarks.sectorAverage) {
      const sectorAverage = benchmarks.sectorAverage;
      const standardDeviation = benchmarks.standardDeviation || sectorAverage * 0.5;
      const deviationThreshold = condition.deviationThreshold || 2.0;

      const deviations = Math.abs(numValue - sectorAverage) / standardDeviation;

      if (deviations > deviationThreshold) {
        return {
          ruleId: rule.id,
          field: rule.field,
          severity: rule.severity,
          message: rule.message,
          currentValue: numValue,
          expectedValue: sectorAverage,
          suggestion: `Sector average: ${sectorAverage.toFixed(2)}, your value: ${numValue.toFixed(2)} (${deviations.toFixed(1)}σ from average)`
        };
      }
    }

    return null;
  }

  /**
   * Detect anomalies in data
   */
  private async detectAnomaly(
    rule: ValidationRule,
    value: any,
    historicalData: any[]
  ): Promise<ValidationIssue | null> {
    if (!value || !historicalData || historicalData.length === 0) return null;

    const condition = rule.condition;
    const numValue = Number(value);

    if (condition.yearOverYear && historicalData.length > 0) {
      const previousValue = Number(historicalData[0]?.totalEmissions || 0);
      
      if (previousValue > 0) {
        const changeRate = Math.abs(numValue - previousValue) / previousValue;
        const threshold = condition.changeThreshold || 0.3;

        if (changeRate > threshold) {
          return {
            ruleId: rule.id,
            field: rule.field,
            severity: rule.severity,
            message: rule.message,
            currentValue: numValue,
            expectedValue: previousValue,
            suggestion: `${(changeRate * 100).toFixed(1)}% change from previous year (${previousValue.toFixed(2)} → ${numValue.toFixed(2)}). Consider reviewing calculation methods.`
          };
        }
      }
    }

    return null;
  }

  /**
   * Calculate comprehensive data quality metrics
   */
  private calculateDataQualityMetrics(
    data: any,
    errors: ValidationIssue[],
    warnings: ValidationIssue[],
    organization: any
  ): DataQualityMetrics {
    // Count total fields and filled fields
    const totalFields = this.countTotalFields(data);
    const filledFields = this.countFilledFields(data);
    const completeness = totalFields > 0 ? (filledFields / totalFields) * 100 : 0;

    // Calculate accuracy (fields passing validation)
    const totalValidatedFields = this.validationRules.length;
    const failedValidations = errors.length + warnings.length;
    const accuracy = totalValidatedFields > 0 ? 
      ((totalValidatedFields - failedValidations) / totalValidatedFields) * 100 : 100;

    // Calculate consistency (internal consistency checks)
    const consistencyRules = this.validationRules.filter(r => r.type === 'CONSISTENCY');
    const consistencyFailures = errors.filter(e => consistencyRules.some(r => r.id === e.ruleId)).length;
    const consistency = consistencyRules.length > 0 ?
      ((consistencyRules.length - consistencyFailures) / consistencyRules.length) * 100 : 100;

    // Calculate timeliness (mock - would need submission timestamps)
    const timeliness = 85; // Placeholder

    // Calculate validity (values within expected ranges)
    const rangeRules = this.validationRules.filter(r => r.type === 'RANGE');
    const rangeFailures = errors.concat(warnings).filter(e => rangeRules.some(r => r.id === e.ruleId)).length;
    const validity = rangeRules.length > 0 ?
      ((rangeRules.length - rangeFailures) / rangeRules.length) * 100 : 100;

    // Calculate uniqueness (no duplicates - mock)
    const uniqueness = 98; // Placeholder

    // Calculate weighted overall score
    const weights = {
      completeness: 0.25,
      accuracy: 0.25,
      consistency: 0.20,
      timeliness: 0.10,
      validity: 0.15,
      uniqueness: 0.05
    };

    const overall = 
      (completeness * weights.completeness) +
      (accuracy * weights.accuracy) +
      (consistency * weights.consistency) +
      (timeliness * weights.timeliness) +
      (validity * weights.validity) +
      (uniqueness * weights.uniqueness);

    return {
      completeness: Math.round(completeness),
      accuracy: Math.round(accuracy),
      consistency: Math.round(consistency),
      timeliness: Math.round(timeliness),
      validity: Math.round(validity),
      uniqueness: Math.round(uniqueness),
      overall: Math.round(overall)
    };
  }

  /**
   * Generate improvement suggestions
   */
  private generateImprovementSuggestions(
    data: any,
    errors: ValidationIssue[],
    warnings: ValidationIssue[],
    metrics: DataQualityMetrics
  ): ValidationSuggestion[] {
    const suggestions: ValidationSuggestion[] = [];

    // Completeness suggestions
    if (metrics.completeness < 80) {
      suggestions.push({
        type: 'COMPLETENESS',
        priority: 'HIGH',
        title: 'Improve Data Completeness',
        description: `Only ${metrics.completeness}% of fields are complete. Consider providing more comprehensive data.`,
        estimatedImpact: 'Significant improvement in data quality score and analysis accuracy',
        implementationGuide: 'Review missing fields and gather additional data from source systems'
      });
    }

    // Accuracy suggestions
    if (metrics.accuracy < 85) {
      suggestions.push({
        type: 'ACCURACY',
        priority: 'HIGH',
        title: 'Address Validation Issues',
        description: `${errors.length} errors and ${warnings.length} warnings detected. Review flagged data points.`,
        estimatedImpact: 'Improved data reliability and compliance with reporting standards',
        implementationGuide: 'Address each validation issue individually, starting with errors'
      });
    }

    // Consistency suggestions
    if (metrics.consistency < 90) {
      suggestions.push({
        type: 'METHODOLOGY',
        priority: 'MEDIUM',
        title: 'Review Calculation Methodology',
        description: 'Some inconsistencies detected in calculations. Verify emission factors and calculation methods.',
        estimatedImpact: 'More reliable and auditable emissions data',
        implementationGuide: 'Review GHG Protocol standards and ensure consistent application'
      });
    }

    // Scope 3 suggestion
    const scope3Value = this.getNestedValue(data, 'scope3Emissions');
    if (!scope3Value || scope3Value === 0) {
      suggestions.push({
        type: 'DATA_IMPROVEMENT',
        priority: 'MEDIUM',
        title: 'Consider Scope 3 Emissions',
        description: 'Scope 3 emissions are not reported. These typically represent 70-90% of total emissions.',
        estimatedImpact: 'Complete carbon footprint picture and better sustainability insights',
        implementationGuide: 'Start with significant categories like purchased goods and business travel'
      });
    }

    return suggestions;
  }

  /**
   * Calculate overall validation score
   */
  private calculateValidationScore(
    metrics: DataQualityMetrics,
    errors: ValidationIssue[],
    warnings: ValidationIssue[]
  ): number {
    let score = metrics.overall;

    // Penalize for errors and warnings
    const errorPenalty = errors.length * 10;
    const warningPenalty = warnings.length * 2;

    score = Math.max(0, score - errorPenalty - warningPenalty);
    return Math.round(score);
  }

  /**
   * Perform anomaly detection on numeric data
   */
  async detectAnomalies(
    organizationId: string,
    field: string,
    value: number,
    context: any = {}
  ): Promise<AnomalyDetectionResult> {
    // Statistical anomaly detection
    const historicalValues = await this.getHistoricalValues(organizationId, field);
    
    if (historicalValues.length >= 3) {
      const mean = historicalValues.reduce((sum, val) => sum + val, 0) / historicalValues.length;
      const variance = historicalValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / historicalValues.length;
      const stdDev = Math.sqrt(variance);
      
      const zScore = Math.abs(value - mean) / stdDev;
      
      if (zScore > 2.5) { // 2.5 standard deviations
        return {
          isAnomaly: true,
          confidence: Math.min(zScore / 3.0, 1.0),
          type: 'STATISTICAL',
          description: `Value is ${zScore.toFixed(1)} standard deviations from historical average`,
          expectedRange: {
            min: mean - (2 * stdDev),
            max: mean + (2 * stdDev)
          },
          similarValues: historicalValues.slice(0, 5),
          recommendation: 'Review calculation method and data sources for accuracy'
        };
      }
    }

    return {
      isAnomaly: false,
      confidence: 0,
      type: 'STATISTICAL',
      description: 'Value appears normal within expected range',
      recommendation: 'No action required'
    };
  }

  /**
   * Get validation rules for specific category
   */
  getValidationRules(category?: string): ValidationRule[] {
    if (category) {
      return this.validationRules.filter(rule => rule.category === category);
    }
    return this.validationRules;
  }

  /**
   * Update validation rule
   */
  async updateValidationRule(ruleId: string, updates: Partial<ValidationRule>): Promise<boolean> {
    const ruleIndex = this.validationRules.findIndex(rule => rule.id === ruleId);
    
    if (ruleIndex !== -1) {
      this.validationRules[ruleIndex] = {
        ...this.validationRules[ruleIndex],
        ...updates
      };
      
      this.logger.log(`Updated validation rule: ${ruleId}`);
      return true;
    }
    
    return false;
  }

  /**
   * Helper methods
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private evaluateEquation(equation: string, data: any): number {
    // Simple equation evaluator - would need more robust implementation
    try {
      const variables = equation.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
      let expression = equation;
      
      for (const variable of variables) {
        const value = this.getNestedValue(data, variable) || 0;
        expression = expression.replace(new RegExp(variable, 'g'), String(value));
      }
      
      // Security note: In production, use a safer math expression evaluator
      return eval(expression);
    } catch (error) {
      this.logger.error('Failed to evaluate equation:', equation, error);
      return 0;
    }
  }

  private countTotalFields(obj: any): number {
    return Object.keys(obj).length;
  }

  private countFilledFields(obj: any): number {
    return Object.values(obj).filter(value => 
      value !== null && value !== undefined && value !== ''
    ).length;
  }

  private async getOrganizationContext(organizationId: string): Promise<any> {
    return this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        sector: true,
        employeeCount: true,
        annualRevenue: true,
        location: true
      }
    });
  }

  private async getHistoricalData(organizationId: string, currentYear: number): Promise<any[]> {
    return this.prisma.emissions.findMany({
      where: {
        organizationId,
        reportingYear: { lt: currentYear }
      },
      orderBy: { reportingYear: 'desc' },
      take: 5
    });
  }

  private async getSectorBenchmarks(sector?: string): Promise<any> {
    // Mock implementation - would fetch from benchmark database
    return {
      sectorAverage: 125.5,
      standardDeviation: 45.2,
      median: 112.3,
      percentile75: 185.7,
      percentile25: 78.9
    };
  }

  private async getHistoricalValues(organizationId: string, field: string): Promise<number[]> {
    // Mock implementation - would fetch field-specific historical values
    return [120.5, 118.3, 125.7, 122.1, 119.8];
  }
}