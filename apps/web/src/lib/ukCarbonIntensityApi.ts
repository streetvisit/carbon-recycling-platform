// UK Carbon Intensity API Service
// Official API from National Grid ESO: https://api.carbonintensity.org.uk/
// Documentation: https://carbon-intensity.github.io/api-definitions/

// Base API URL
const API_BASE_URL = 'https://api.carbonintensity.org.uk';

export interface CarbonIntensityData {
  from: string;
  to: string;
  intensity: {
    forecast: number;
    actual: number;
    index: string; // 'very low' | 'low' | 'moderate' | 'high' | 'very high'
  };
}

export interface GenerationMixData {
  from: string;
  to: string;
  generationmix: Array<{
    fuel: string;
    perc: number;
  }>;
}

export interface RegionalIntensityData {
  regionid: number;
  dnoregion: string;
  shortname: string;
  data: Array<{
    from: string;
    to: string;
    intensity: {
      forecast: number;
      actual: number;
      index: string;
    };
    generationmix: Array<{
      fuel: string;
      perc: number;
    }>;
  }>;
}

export interface UKGridData {
  timestamp: string;
  demand: number;
  generation: number;
  carbonIntensity: number;
  price: number; // Estimated based on carbon intensity and mix
  generationMix: {
    gas: number;
    nuclear: number;
    wind: number;
    solar: number;
    hydroelectric: number;
    biomass: number;
    coal: number;
    imports: number;
    other: number;
  };
  percentages: {
    renewables: number;
    fossil: number;
    nuclear: number;
    imports: number;
  };
}

export interface RegionData {
  name: string;
  regionId: number;
  renewableCapacity: number;
  currentGeneration: number;
  carbonIntensity: number;
  population: number;
  dominantSource: string;
}

// Fetch current carbon intensity
export async function getCurrentCarbonIntensity(): Promise<CarbonIntensityData> {
  try {
    const response = await fetch(`${API_BASE_URL}/intensity`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.data[0];
  } catch (error) {
    console.error('Error fetching carbon intensity:', error);
    throw error;
  }
}

// Fetch current generation mix
export async function getCurrentGenerationMix(): Promise<GenerationMixData> {
  try {
    const response = await fetch(`${API_BASE_URL}/generation`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.data[0];
  } catch (error) {
    console.error('Error fetching generation mix:', error);
    throw error;
  }
}

// Fetch regional intensity data
export async function getRegionalIntensity(): Promise<RegionalIntensityData[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/regional`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error fetching regional intensity:', error);
    throw error;
  }
}

// Fetch statistics for demand estimation (using external data source if needed)
export async function getGridStatistics(): Promise<{ demand: number }> {
  // For now, estimate demand based on typical UK patterns
  // In production, this could be enhanced with additional APIs like Elexon BMRS
  const hour = new Date().getHours();
  const baseDemand = 32; // Average UK demand in GW
  const timeVariation = Math.sin((hour - 6) * Math.PI / 12) * 6; // Daily pattern
  const randomVariation = (Math.random() - 0.5) * 2; // Small random variation
  
  return {
    demand: Math.max(25, baseDemand + timeVariation + randomVariation)
  };
}

// Estimate energy price based on carbon intensity and generation mix
export function estimateEnergyPrice(carbonIntensity: number, generationMix: GenerationMixData): number {
  // Base price in £/MWh
  let basePrice = 45;
  
  // Carbon intensity factor (higher CI = higher price)
  const carbonFactor = carbonIntensity / 200; // Normalize around 200g CO2/kWh
  basePrice *= (1 + carbonFactor * 0.5);
  
  // Generation mix factors
  const renewablePercentage = generationMix.generationmix
    .filter(g => ['wind', 'solar', 'hydro'].includes(g.fuel.toLowerCase()))
    .reduce((sum, g) => sum + g.perc, 0);
  
  const gasPercentage = generationMix.generationmix
    .find(g => g.fuel.toLowerCase() === 'gas')?.perc || 0;
  
  // Lower price when renewables are high
  if (renewablePercentage > 50) {
    basePrice *= 0.8;
  } else if (renewablePercentage < 30) {
    basePrice *= 1.2;
  }
  
  // Higher price when gas is dominant (gas prices are volatile)
  if (gasPercentage > 40) {
    basePrice *= 1.1;
  }
  
  return Math.round(basePrice);
}

// Convert API data to our internal UKGridData format
export async function getUKGridData(): Promise<UKGridData> {
  try {
    // Fetch all required data in parallel
    const [intensity, generationMix, stats] = await Promise.all([
      getCurrentCarbonIntensity(),
      getCurrentGenerationMix(),
      getGridStatistics()
    ]);

    // Map generation mix to our format
    const generationData = {
      gas: 0,
      nuclear: 0,
      wind: 0,
      solar: 0,
      hydroelectric: 0,
      biomass: 0,
      coal: 0,
      imports: 0,
      other: 0
    };

    // Map API fuel types to our categories
    generationMix.generationmix.forEach(item => {
      const fuel = item.fuel.toLowerCase();
      const percentage = item.perc;
      
      switch (fuel) {
        case 'gas':
          generationData.gas = percentage;
          break;
        case 'nuclear':
          generationData.nuclear = percentage;
          break;
        case 'wind':
          generationData.wind = percentage;
          break;
        case 'solar':
          generationData.solar = percentage;
          break;
        case 'hydro':
          generationData.hydroelectric = percentage;
          break;
        case 'biomass':
          generationData.biomass = percentage;
          break;
        case 'coal':
          generationData.coal = percentage;
          break;
        case 'imports':
          generationData.imports = percentage;
          break;
        default:
          generationData.other += percentage;
      }
    });

    // Calculate total generation (assume it matches demand for simplicity)
    const totalGeneration = stats.demand;

    // Convert percentages to actual GW values
    const actualGeneration = {
      gas: Math.round((generationData.gas / 100) * totalGeneration * 10) / 10,
      nuclear: Math.round((generationData.nuclear / 100) * totalGeneration * 10) / 10,
      wind: Math.round((generationData.wind / 100) * totalGeneration * 10) / 10,
      solar: Math.round((generationData.solar / 100) * totalGeneration * 10) / 10,
      hydroelectric: Math.round((generationData.hydroelectric / 100) * totalGeneration * 10) / 10,
      biomass: Math.round((generationData.biomass / 100) * totalGeneration * 10) / 10,
      coal: Math.round((generationData.coal / 100) * totalGeneration * 10) / 10,
      imports: Math.round((generationData.imports / 100) * totalGeneration * 10) / 10,
      other: Math.round((generationData.other / 100) * totalGeneration * 10) / 10,
    };

    // Calculate category percentages
    const renewables = generationData.wind + generationData.solar + generationData.hydroelectric;
    const fossil = generationData.gas + generationData.coal;
    const nuclear = generationData.nuclear;
    const imports = generationData.imports;

    return {
      timestamp: new Date().toISOString(),
      demand: Math.round(stats.demand * 10) / 10,
      generation: Math.round(totalGeneration * 10) / 10,
      carbonIntensity: intensity.intensity.actual || intensity.intensity.forecast,
      price: estimateEnergyPrice(intensity.intensity.actual || intensity.intensity.forecast, generationMix),
      generationMix: actualGeneration,
      percentages: {
        renewables: Math.round(renewables * 10) / 10,
        fossil: Math.round(fossil * 10) / 10,
        nuclear: Math.round(nuclear * 10) / 10,
        imports: Math.round(imports * 10) / 10,
      }
    };
  } catch (error) {
    console.error('Error fetching UK grid data:', error);
    throw error;
  }
}

// Convert regional API data to our format
export async function getUKRegionalData(): Promise<Record<string, RegionData>> {
  try {
    const regionalData = await getRegionalIntensity();
    const result: Record<string, RegionData> = {};
    
    // UK population by region (approximate)
    const regionPopulations: Record<string, number> = {
      'North Scotland': 1_500_000,
      'South Scotland': 4_000_000,
      'North West England': 7_300_000,
      'North East England': 2_600_000,
      'Yorkshire': 5_400_000,
      'North Wales': 700_000,
      'South Wales': 2_400_000,
      'West Midlands': 5_900_000,
      'East Midlands': 4_800_000,
      'East England': 6_200_000,
      'South West England': 5_700_000,
      'South England': 8_900_000,
      'London': 9_000_000,
      'South East England': 9_100_000,
      'Northern Ireland': 1_900_000
    };

    regionalData.forEach(region => {
      if (region.data && region.data.length > 0) {
        const latestData = region.data[0];
        const regionName = region.dnoregion;
        
        // Calculate dominant source
        let dominantSource = 'gas';
        let maxPercentage = 0;
        
        if (latestData.generationmix) {
          latestData.generationmix.forEach(mix => {
            if (mix.perc > maxPercentage) {
              maxPercentage = mix.perc;
              dominantSource = mix.fuel.toLowerCase();
            }
          });
        }

        // Estimate renewable capacity and generation based on mix
        const renewablePercentage = latestData.generationmix
          ?.filter(g => ['wind', 'solar', 'hydro'].includes(g.fuel.toLowerCase()))
          .reduce((sum, g) => sum + g.perc, 0) || 30;
        
        const estimatedCapacity = Math.round((renewablePercentage / 100) * 2000); // Rough estimate
        const currentGeneration = Math.round((renewablePercentage / 100) * 1500); // Current output
        
        result[region.shortname.toLowerCase().replace(/\s+/g, '_')] = {
          name: regionName,
          regionId: region.regionid,
          renewableCapacity: estimatedCapacity,
          currentGeneration: currentGeneration,
          carbonIntensity: latestData.intensity.actual || latestData.intensity.forecast,
          population: regionPopulations[regionName] || 2_000_000,
          dominantSource: dominantSource
        };
      }
    });

    return result;
  } catch (error) {
    console.error('Error fetching UK regional data:', error);
    throw error;
  }
}

// Fallback data for when API is unavailable
export function getFallbackGridData(): UKGridData {
  const now = new Date();
  const hour = now.getHours();
  
  // Realistic fallback data based on UK averages
  const baseDemand = 32 + (Math.sin((hour - 6) * Math.PI / 12) * 6);
  
  return {
    timestamp: now.toISOString(),
    demand: Math.round(baseDemand * 10) / 10,
    generation: Math.round(baseDemand * 10) / 10,
    carbonIntensity: 180, // UK average
    price: 65, // Typical price
    generationMix: {
      gas: Math.round(baseDemand * 0.35 * 10) / 10,
      nuclear: Math.round(baseDemand * 0.18 * 10) / 10,
      wind: Math.round(baseDemand * 0.24 * 10) / 10,
      solar: Math.round(baseDemand * 0.04 * 10) / 10,
      hydroelectric: Math.round(baseDemand * 0.03 * 10) / 10,
      biomass: Math.round(baseDemand * 0.06 * 10) / 10,
      coal: 0,
      imports: Math.round(baseDemand * 0.08 * 10) / 10,
      other: Math.round(baseDemand * 0.02 * 10) / 10,
    },
    percentages: {
      renewables: 31.0, // wind + solar + hydro
      fossil: 35.0, // gas + coal
      nuclear: 18.0,
      imports: 8.0,
    }
  };
}