/**
 * Enhanced Emissions Calculation Engine
 * 
 * Comprehensive calculation system with:
 * - Extended emission factors database
 * - Custom factor support
 * - Industry-specific methodologies
 * - Advanced calculation algorithms
 * - Multi-region support
 * - Uncertainty analysis
 */

import { getD1Database, generateId } from '../../../../../packages/db/d1-connection';
import { getEmissionFactor } from './emissionFactors';

export interface EnhancedEmissionFactor {
  id: string;
  activityType: string;
  value: number;
  unit: string;
  region: string;
  source: string;
  scope: 'scope_1' | 'scope_2' | 'scope_3';
  category: string;
  subcategory?: string;
  industry?: string;
  methodology: string;
  uncertainty: number; // percentage uncertainty
  validFrom: string;
  validTo?: string;
  isCustom: boolean;
  organizationId?: string;
  createdAt: string;
}

export interface CalculationResult {
  id: string;
  activityDataId: string;
  organizationId: string;
  ghgScope: 'scope_1' | 'scope_2' | 'scope_3';
  category: string;
  subcategory?: string;
  co2e: number;
  co2eMin: number; // uncertainty range
  co2eMax: number;
  emissionFactor: EnhancedEmissionFactor;
  methodology: string;
  calculationDate: string;
  biogenicCo2?: number;
  qualityScore: number; // 1-5 quality rating
  metadata: {
    inputValue: number;
    inputUnit: string;
    conversionFactor?: number;
    calculationNotes?: string;
  };
}

export interface IndustryMethodology {
  industry: string;
  methodology: string;
  description: string;
  applicableActivities: string[];
  qualityTier: 1 | 2 | 3; // Tier 1: basic, Tier 2: intermediate, Tier 3: advanced
  requiredData: string[];
  optionalData: string[];
}

// Extended emission factors with industry-specific and regional variations
const EXTENDED_EMISSION_FACTORS: Record<string, EnhancedEmissionFactor[]> = {
  // Electricity with regional grid factors
  electricity_usage: [
    {
      id: 'elec_uk_2024',
      activityType: 'electricity_usage',
      value: 0.21233,
      unit: 'kWh',
      region: 'uk',
      source: 'UK DEFRA 2024',
      scope: 'scope_2',
      category: 'Purchased Electricity',
      methodology: 'location_based',
      uncertainty: 5.2,
      validFrom: '2024-01-01',
      validTo: '2024-12-31',
      isCustom: false,
      createdAt: '2024-01-01T00:00:00Z'
    },
    {
      id: 'elec_us_2024',
      activityType: 'electricity_usage',
      value: 0.386,
      unit: 'kWh',
      region: 'us',
      source: 'US EPA eGRID 2024',
      scope: 'scope_2',
      category: 'Purchased Electricity',
      methodology: 'location_based',
      uncertainty: 8.1,
      validFrom: '2024-01-01',
      isCustom: false,
      createdAt: '2024-01-01T00:00:00Z'
    },
    {
      id: 'elec_eu_2024',
      activityType: 'electricity_usage',
      value: 0.275,
      unit: 'kWh',
      region: 'eu',
      source: 'EU EEA 2024',
      scope: 'scope_2',
      category: 'Purchased Electricity',
      methodology: 'location_based',
      uncertainty: 6.8,
      validFrom: '2024-01-01',
      isCustom: false,
      createdAt: '2024-01-01T00:00:00Z'
    }
  ],

  // Manufacturing-specific factors
  steel_production: [
    {
      id: 'steel_basic_oxygen',
      activityType: 'steel_production',
      value: 2100,
      unit: 'tonnes_steel',
      region: 'global',
      source: 'IPCC 2019',
      scope: 'scope_1',
      category: 'Industrial Processes',
      subcategory: 'Metal Production',
      industry: 'manufacturing',
      methodology: 'mass_balance',
      uncertainty: 12.5,
      validFrom: '2019-01-01',
      isCustom: false,
      createdAt: '2024-01-01T00:00:00Z'
    },
    {
      id: 'steel_electric_arc',
      activityType: 'steel_production',
      value: 450,
      unit: 'tonnes_steel',
      region: 'global',
      source: 'IPCC 2019',
      scope: 'scope_1',
      category: 'Industrial Processes',
      subcategory: 'Metal Production',
      industry: 'manufacturing',
      methodology: 'mass_balance',
      uncertainty: 8.3,
      validFrom: '2019-01-01',
      isCustom: false,
      createdAt: '2024-01-01T00:00:00Z'
    }
  ],

  // Data center specific factors
  cloud_compute: [
    {
      id: 'cloud_aws_us',
      activityType: 'cloud_compute',
      value: 0.0008,
      unit: 'instance_hours',
      region: 'us',
      source: 'AWS Sustainability 2024',
      scope: 'scope_3',
      category: 'Purchased Goods and Services',
      subcategory: 'Cloud Services',
      industry: 'technology',
      methodology: 'supplier_specific',
      uncertainty: 15.0,
      validFrom: '2024-01-01',
      isCustom: false,
      createdAt: '2024-01-01T00:00:00Z'
    },
    {
      id: 'cloud_azure_eu',
      activityType: 'cloud_compute',
      value: 0.0006,
      unit: 'instance_hours',
      region: 'eu',
      source: 'Microsoft Sustainability 2024',
      scope: 'scope_3',
      category: 'Purchased Goods and Services',
      subcategory: 'Cloud Services',
      industry: 'technology',
      methodology: 'supplier_specific',
      uncertainty: 12.0,
      validFrom: '2024-01-01',
      isCustom: false,
      createdAt: '2024-01-01T00:00:00Z'
    }
  ],

  // Agriculture and food specific
  agricultural_land_use: [
    {
      id: 'agri_cropland',
      activityType: 'agricultural_land_use',
      value: 0.5,
      unit: 'hectares',
      region: 'global',
      source: 'IPCC 2019 AFOLU',
      scope: 'scope_3',
      category: 'Land Use Change',
      industry: 'agriculture',
      methodology: 'ipcc_tier_2',
      uncertainty: 25.0,
      validFrom: '2019-01-01',
      isCustom: false,
      createdAt: '2024-01-01T00:00:00Z'
    }
  ],

  // Waste treatment
  waste_treatment: [
    {
      id: 'waste_landfill',
      activityType: 'waste_treatment',
      value: 467,
      unit: 'tonnes_waste',
      region: 'global',
      source: 'IPCC 2019 Waste',
      scope: 'scope_3',
      category: 'Waste Generated',
      methodology: 'first_order_decay',
      uncertainty: 30.0,
      validFrom: '2019-01-01',
      isCustom: false,
      createdAt: '2024-01-01T00:00:00Z'
    },
    {
      id: 'waste_incineration',
      activityType: 'waste_treatment',
      value: 21,
      unit: 'tonnes_waste',
      region: 'global',
      source: 'IPCC 2019 Waste',
      scope: 'scope_3',
      category: 'Waste Generated',
      methodology: 'mass_balance',
      uncertainty: 15.0,
      validFrom: '2019-01-01',
      isCustom: false,
      createdAt: '2024-01-01T00:00:00Z'
    }
  ]
};

// Industry-specific calculation methodologies
const INDUSTRY_METHODOLOGIES: IndustryMethodology[] = [
  {
    industry: 'manufacturing',
    methodology: 'ghg_protocol_manufacturing',
    description: 'GHG Protocol guidance for manufacturing with process emissions',
    applicableActivities: ['steel_production', 'cement_production', 'chemical_production'],
    qualityTier: 3,
    requiredData: ['production_volume', 'fuel_consumption', 'electricity_usage'],
    optionalData: ['process_temperatures', 'efficiency_ratings', 'waste_streams']
  },
  {
    industry: 'technology',
    methodology: 'ict_protocol',
    description: 'ICT sector guidance for digital services and cloud computing',
    applicableActivities: ['cloud_compute', 'data_storage', 'network_usage'],
    qualityTier: 2,
    requiredData: ['compute_hours', 'storage_gb_hours', 'data_transfer_gb'],
    optionalData: ['server_utilization', 'pue_ratio', 'renewable_percentage']
  },
  {
    industry: 'agriculture',
    methodology: 'ipcc_afolu',
    description: 'IPCC Agriculture, Forestry and Other Land Use guidance',
    applicableActivities: ['agricultural_land_use', 'livestock', 'fertilizer_use'],
    qualityTier: 3,
    requiredData: ['land_area', 'crop_type', 'management_practices'],
    optionalData: ['soil_carbon_content', 'climate_zone', 'irrigation_method']
  },
  {
    industry: 'retail',
    methodology: 'retail_protocol',
    description: 'Retail sector guidance focusing on scope 3 emissions',
    applicableActivities: ['purchased_goods', 'transportation', 'waste_treatment'],
    qualityTier: 2,
    requiredData: ['revenue', 'product_categories', 'supplier_data'],
    optionalData: ['supply_chain_mapping', 'transportation_modes', 'packaging_materials']
  }
];

/**
 * Enhanced calculation engine with industry-specific methodologies
 */
export class EnhancedCalculationEngine {
  private env: any;
  
  constructor(env: any) {
    this.env = env;
  }

  /**
   * Get emission factor with fallback logic and regional preferences
   */
  async getEnhancedEmissionFactor(
    activityType: string,
    unit: string,
    region: string = 'uk',
    industry?: string,
    organizationId?: string
  ): Promise<EnhancedEmissionFactor> {
    // First, try custom factors for the organization
    if (organizationId) {
      const customFactor = await this.getCustomEmissionFactor(
        organizationId, activityType, unit, region
      );
      if (customFactor) {
        return customFactor;
      }
    }

    // Then, look for extended factors
    const activityFactors = EXTENDED_EMISSION_FACTORS[activityType];
    if (activityFactors) {
      // Prioritize by: exact region + industry > exact region > global + industry > global
      let bestMatch = activityFactors.find(f => 
        f.region === region && f.unit === unit && f.industry === industry
      );
      
      if (!bestMatch) {
        bestMatch = activityFactors.find(f => 
          f.region === region && f.unit === unit
        );
      }
      
      if (!bestMatch && industry) {
        bestMatch = activityFactors.find(f => 
          f.region === 'global' && f.unit === unit && f.industry === industry
        );
      }
      
      if (!bestMatch) {
        bestMatch = activityFactors.find(f => 
          f.region === 'global' && f.unit === unit
        );
      }
      
      if (bestMatch) {
        return bestMatch;
      }
    }

    // Fallback to legacy emission factors
    const legacyFactor = getEmissionFactor(activityType, unit, region);
    return {
      id: generateId('ef'),
      activityType,
      value: legacyFactor.value,
      unit: legacyFactor.unit,
      region: legacyFactor.region,
      source: legacyFactor.source,
      scope: legacyFactor.scope,
      category: legacyFactor.category,
      methodology: 'legacy_defra',
      uncertainty: 10.0, // Default uncertainty
      validFrom: '2024-01-01',
      isCustom: false,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Calculate emissions with uncertainty analysis
   */
  async calculateEnhancedEmissions(
    activityDataId: string,
    organizationId: string,
    activityType: string,
    value: number,
    unit: string,
    region: string = 'uk',
    industry?: string,
    methodology?: string
  ): Promise<CalculationResult> {
    const emissionFactor = await this.getEnhancedEmissionFactor(
      activityType, unit, region, industry, organizationId
    );

    // Apply unit conversions if needed
    const { convertedValue, conversionFactor } = await this.applyUnitConversions(
      value, unit, emissionFactor.unit, activityType
    );

    // Calculate base emissions
    const baseCo2e = convertedValue * emissionFactor.value / 1000; // Convert kg to tonnes

    // Calculate uncertainty range
    const uncertaintyMultiplier = emissionFactor.uncertainty / 100;
    const co2eMin = baseCo2e * (1 - uncertaintyMultiplier);
    const co2eMax = baseCo2e * (1 + uncertaintyMultiplier);

    // Apply methodology-specific adjustments
    const adjustedResults = await this.applyMethodologyAdjustments(
      baseCo2e, co2eMin, co2eMax, methodology || emissionFactor.methodology, 
      industry, activityType
    );

    // Calculate quality score
    const qualityScore = this.calculateQualityScore(
      emissionFactor, methodology || emissionFactor.methodology, industry
    );

    const result: CalculationResult = {
      id: generateId('calc'),
      activityDataId,
      organizationId,
      ghgScope: emissionFactor.scope,
      category: emissionFactor.category,
      subcategory: emissionFactor.subcategory,
      co2e: Math.round(adjustedResults.co2e * 1000) / 1000, // 3 decimal places
      co2eMin: Math.round(adjustedResults.co2eMin * 1000) / 1000,
      co2eMax: Math.round(adjustedResults.co2eMax * 1000) / 1000,
      emissionFactor,
      methodology: methodology || emissionFactor.methodology,
      calculationDate: new Date().toISOString(),
      biogenicCo2: adjustedResults.biogenicCo2,
      qualityScore,
      metadata: {
        inputValue: value,
        inputUnit: unit,
        conversionFactor,
        calculationNotes: adjustedResults.notes
      }
    };

    // Save to database
    await this.saveEnhancedCalculation(result);
    
    return result;
  }

  /**
   * Apply unit conversions
   */
  private async applyUnitConversions(
    value: number, 
    fromUnit: string, 
    toUnit: string, 
    activityType: string
  ): Promise<{ convertedValue: number; conversionFactor?: number }> {
    if (fromUnit === toUnit) {
      return { convertedValue: value };
    }

    // Common conversion factors
    const conversions: Record<string, Record<string, number>> = {
      // Energy conversions
      'MWh': { 'kWh': 1000 },
      'GWh': { 'kWh': 1000000, 'MWh': 1000 },
      'BTU': { 'kWh': 0.000293071 },
      'therm': { 'kWh': 29.3071 },
      
      // Volume conversions
      'gallons_us': { 'litres': 3.78541 },
      'gallons_uk': { 'litres': 4.54609 },
      'cubic_metres': { 'litres': 1000 },
      
      // Mass conversions
      'kg': { 'tonnes': 0.001 },
      'lbs': { 'kg': 0.453592, 'tonnes': 0.000453592 },
      
      // Distance conversions
      'miles': { 'km': 1.60934 },
      'nautical_miles': { 'km': 1.852 }
    };

    const conversionFactor = conversions[fromUnit]?.[toUnit];
    if (conversionFactor) {
      return {
        convertedValue: value * conversionFactor,
        conversionFactor
      };
    }

    // Activity-specific conversions
    if (activityType === 'natural_gas' && fromUnit === 'cubic_metres' && toUnit === 'kWh') {
      // Natural gas: 1 cubic metre ≈ 11.1 kWh (varies by region)
      return {
        convertedValue: value * 11.1,
        conversionFactor: 11.1
      };
    }

    throw new Error(`No conversion available from ${fromUnit} to ${toUnit} for ${activityType}`);
  }

  /**
   * Apply methodology-specific adjustments
   */
  private async applyMethodologyAdjustments(
    baseCo2e: number,
    co2eMin: number,
    co2eMax: number,
    methodology: string,
    industry?: string,
    activityType?: string
  ): Promise<{
    co2e: number;
    co2eMin: number;
    co2eMax: number;
    biogenicCo2?: number;
    notes?: string;
  }> {
    let adjustedCo2e = baseCo2e;
    let adjustedMin = co2eMin;
    let adjustedMax = co2eMax;
    let biogenicCo2: number | undefined;
    let notes = '';

    switch (methodology) {
      case 'market_based':
        // Apply renewable energy certificates or guarantees of origin
        const renewablePercentage = 0; // Would be retrieved from organization settings
        adjustedCo2e = baseCo2e * (1 - renewablePercentage);
        adjustedMin = co2eMin * (1 - renewablePercentage);
        adjustedMax = co2eMax * (1 - renewablePercentage);
        notes = 'Market-based methodology applied with renewable certificates';
        break;

      case 'mass_balance':
        // For industrial processes, may include process emissions
        if (industry === 'manufacturing') {
          // Add typical process emissions (varies by activity)
          const processEmissionMultiplier = 1.15; // 15% additional process emissions
          adjustedCo2e = baseCo2e * processEmissionMultiplier;
          adjustedMin = co2eMin * processEmissionMultiplier;
          adjustedMax = co2eMax * processEmissionMultiplier;
          notes = 'Mass balance with process emissions included';
        }
        break;

      case 'biogenic_separate':
        // Separate biogenic CO2 (e.g., biomass combustion)
        if (activityType?.includes('biomass') || activityType?.includes('wood')) {
          biogenicCo2 = baseCo2e * 0.9; // Assume 90% biogenic
          adjustedCo2e = baseCo2e * 0.1; // Only fossil portion
          adjustedMin = co2eMin * 0.1;
          adjustedMax = co2eMax * 0.1;
          notes = 'Biogenic CO2 separated from fossil CO2';
        }
        break;

      case 'supplier_specific':
        // Use supplier-provided emission factors (typically lower uncertainty)
        adjustedMin = baseCo2e * 0.95; // Tighter uncertainty range
        adjustedMax = baseCo2e * 1.05;
        notes = 'Supplier-specific emission factors used';
        break;
    }

    return {
      co2e: adjustedCo2e,
      co2eMin: adjustedMin,
      co2eMax: adjustedMax,
      biogenicCo2,
      notes
    };
  }

  /**
   * Calculate quality score based on data sources and methodology
   */
  private calculateQualityScore(
    emissionFactor: EnhancedEmissionFactor,
    methodology: string,
    industry?: string
  ): number {
    let score = 3; // Base score

    // Source quality
    if (emissionFactor.source.includes('IPCC')) score += 0.5;
    if (emissionFactor.source.includes('DEFRA')) score += 0.4;
    if (emissionFactor.isCustom) score += 0.3;

    // Methodology quality
    if (methodology.includes('supplier_specific')) score += 0.5;
    if (methodology.includes('tier_3')) score += 0.4;
    if (methodology.includes('tier_2')) score += 0.2;

    // Industry alignment
    if (emissionFactor.industry === industry) score += 0.3;

    // Uncertainty penalty
    if (emissionFactor.uncertainty > 20) score -= 0.5;
    if (emissionFactor.uncertainty > 30) score -= 0.5;

    // Regional specificity
    if (emissionFactor.region !== 'global') score += 0.2;

    return Math.min(5, Math.max(1, Math.round(score * 10) / 10));
  }

  /**
   * Get custom emission factor for organization
   */
  private async getCustomEmissionFactor(
    organizationId: string,
    activityType: string,
    unit: string,
    region: string
  ): Promise<EnhancedEmissionFactor | null> {
    const db = getD1Database(this.env);
    
    const result = await db.prepare(`
      SELECT * FROM custom_emission_factors 
      WHERE organizationId = ? AND activityType = ? AND unit = ? AND region = ?
        AND (validTo IS NULL OR validTo > DATE('now'))
      ORDER BY createdAt DESC
      LIMIT 1
    `).bind(organizationId, activityType, unit, region).first();

    return result ? result as EnhancedEmissionFactor : null;
  }

  /**
   * Save enhanced calculation result
   */
  private async saveEnhancedCalculation(result: CalculationResult): Promise<void> {
    const db = getD1Database(this.env);
    
    await db.prepare(`
      INSERT INTO enhanced_calculations (
        id, activityDataId, organizationId, ghgScope, category, subcategory,
        co2e, co2eMin, co2eMax, emissionFactorId, methodology, calculationDate,
        biogenicCo2, qualityScore, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      result.id,
      result.activityDataId,
      result.organizationId,
      result.ghgScope,
      result.category,
      result.subcategory,
      result.co2e,
      result.co2eMin,
      result.co2eMax,
      result.emissionFactor.id,
      result.methodology,
      result.calculationDate,
      result.biogenicCo2,
      result.qualityScore,
      JSON.stringify(result.metadata)
    ).run();
  }

  /**
   * Create custom emission factor for organization
   */
  async createCustomEmissionFactor(
    organizationId: string,
    factor: Omit<EnhancedEmissionFactor, 'id' | 'isCustom' | 'organizationId' | 'createdAt'>
  ): Promise<EnhancedEmissionFactor> {
    const db = getD1Database(this.env);
    const id = generateId('cef');
    const createdAt = new Date().toISOString();

    const customFactor: EnhancedEmissionFactor = {
      id,
      ...factor,
      isCustom: true,
      organizationId,
      createdAt
    };

    await db.prepare(`
      INSERT INTO custom_emission_factors (
        id, organizationId, activityType, value, unit, region, source, scope,
        category, subcategory, industry, methodology, uncertainty, validFrom,
        validTo, isCustom, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, organizationId, factor.activityType, factor.value, factor.unit,
      factor.region, factor.source, factor.scope, factor.category,
      factor.subcategory, factor.industry, factor.methodology,
      factor.uncertainty, factor.validFrom, factor.validTo, true, createdAt
    ).run();

    return customFactor;
  }

  /**
   * Get industry methodology recommendations
   */
  getIndustryMethodologies(industry: string): IndustryMethodology[] {
    return INDUSTRY_METHODOLOGIES.filter(m => m.industry === industry);
  }

  /**
   * Batch process multiple activity data records
   */
  async batchCalculateEmissions(
    activities: {
      activityDataId: string;
      organizationId: string;
      activityType: string;
      value: number;
      unit: string;
      region?: string;
      industry?: string;
      methodology?: string;
    }[]
  ): Promise<CalculationResult[]> {
    const results: CalculationResult[] = [];
    
    for (const activity of activities) {
      try {
        const result = await this.calculateEnhancedEmissions(
          activity.activityDataId,
          activity.organizationId,
          activity.activityType,
          activity.value,
          activity.unit,
          activity.region,
          activity.industry,
          activity.methodology
        );
        results.push(result);
      } catch (error) {
        console.error(`Failed to calculate emissions for ${activity.activityDataId}:`, error);
        // Continue with other calculations
      }
    }
    
    return results;
  }
}