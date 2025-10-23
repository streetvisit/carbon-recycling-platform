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
    console.log('Generation mix API response:', data); // Debug log
    
    if (!data || !data.data || !Array.isArray(data.data) || data.data.length === 0) {
      throw new Error('Invalid generation mix data structure');
    }
    
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

// Fetch statistics for demand estimation using Elexon BMRS
export async function getGridStatistics(): Promise<{ demand: number }> {
  try {
    // Try to fetch real demand data from Elexon BMRS
    const { getCurrentDemand } = await import('./bmrsApi');
    const demandData = await getCurrentDemand();
    
    if (demandData && demandData.length > 0) {
      // Get the most recent demand value and convert MW to GW
      const latestDemand = demandData[0].demand / 1000;
      return { demand: latestDemand };
    }
  } catch (error) {
    console.warn('Could not fetch real demand data, using estimate:', error);
  }
  
  // Fallback: estimate demand based on typical UK patterns
  const hour = new Date().getHours();
  const baseDemand = 32; // Average UK demand in GW
  const timeVariation = Math.sin((hour - 6) * Math.PI / 12) * 6; // Daily pattern
  const randomVariation = (Math.random() - 0.5) * 2; // Small random variation
  
  return {
    demand: Math.max(25, baseDemand + timeVariation + randomVariation)
  };
}

// Get energy price from Elexon BMRS or estimate
export async function getEnergyPrice(carbonIntensity: number, generationMix: GenerationMixData): Promise<number> {
  try {
    // Try to fetch real price data from Elexon BMRS
    const { getSystemPrices } = await import('./bmrsApi');
    const priceData = await getSystemPrices();
    
    if (priceData && priceData.length > 0) {
      // Use the system sell price (or average of buy/sell)
      const latestPrice = priceData[0];
      return Math.round((latestPrice.systemSellPrice + latestPrice.systemBuyPrice) / 2);
    }
  } catch (error) {
    console.warn('Could not fetch real price data, using estimate:', error);
  }
  
  // Fallback: estimate based on carbon intensity and generation mix
  let basePrice = 45;
  
  const carbonFactor = carbonIntensity / 200;
  basePrice *= (1 + carbonFactor * 0.5);
  
  // Add null checks
  if (!generationMix || !generationMix.generationmix || !Array.isArray(generationMix.generationmix)) {
    console.warn('Invalid generation mix for price calculation, using base price');
    return Math.round(basePrice);
  }

  const renewablePercentage = generationMix.generationmix
    .filter(g => g && g.fuel && ['wind', 'solar', 'hydro'].includes(g.fuel.toLowerCase()))
    .reduce((sum, g) => sum + g.perc, 0);
  
  const gasPercentage = generationMix.generationmix
    .find(g => g && g.fuel && g.fuel.toLowerCase() === 'gas')?.perc || 0;
  
  if (renewablePercentage > 50) {
    basePrice *= 0.8;
  } else if (renewablePercentage < 30) {
    basePrice *= 1.2;
  }
  
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

    // Check if we have valid generation mix data
    if (!generationMix || !generationMix.generationmix || !Array.isArray(generationMix.generationmix)) {
      console.warn('Invalid generation mix data structure, using fallback');
      console.warn('Received generationMix:', generationMix);
      return getFallbackGridData();
    }
    
    if (generationMix.generationmix.length === 0) {
      console.warn('Empty generation mix array, using fallback');
      return getFallbackGridData();
    }

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

    const price = await getEnergyPrice(
      intensity.intensity.actual || intensity.intensity.forecast, 
      generationMix
    );

    return {
      timestamp: new Date().toISOString(),
      demand: Math.round(stats.demand * 10) / 10,
      generation: Math.round(totalGeneration * 10) / 10,
      carbonIntensity: intensity.intensity.actual || intensity.intensity.forecast,
      price: price,
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

// Dynamic fallback data that simulates realistic UK grid variations
export function getFallbackGridData(): UKGridData {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const second = now.getSeconds();
  
  // Create time-based variations
  const timeValue = (hour * 3600 + minute * 60 + second) / 86400; // 0-1 for the day
  
  // Base demand with daily pattern + small random variations
  const baseDemand = 32 + (Math.sin((hour - 6) * Math.PI / 12) * 6);
  const demandVariation = (Math.sin(timeValue * Math.PI * 24) * 1.5) + ((Math.random() - 0.5) * 1);
  const currentDemand = Math.max(25, baseDemand + demandVariation);
  
  // Variable renewable percentages (wind varies more than solar)
  const baseWind = 24 + (Math.sin(timeValue * Math.PI * 4) * 8) + ((Math.random() - 0.5) * 4);
  const baseSolar = Math.max(0, 4 + (Math.sin((hour - 12) * Math.PI / 12) * 3));
  const renewableTotal = Math.max(15, Math.min(55, baseWind + baseSolar + 3));
  
  // Adjust other sources to compensate
  const nuclear = 18 + ((Math.random() - 0.5) * 3);
  const gas = Math.max(20, 65 - renewableTotal - nuclear + ((Math.random() - 0.5) * 5));
  const imports = Math.max(5, 15 - (renewableTotal - 35) + ((Math.random() - 0.5) * 3));
  
  // Normalize percentages to 100%
  const total = renewableTotal + nuclear + gas + imports;
  const windPerc = (baseWind / total) * 100;
  const solarPerc = (baseSolar / total) * 100;
  const hydroPerc = ((renewableTotal - baseWind - baseSolar) / total) * 100;
  const nuclearPerc = (nuclear / total) * 100;
  const gasPerc = (gas / total) * 100;
  const importsPerc = (imports / total) * 100;
  
  // Calculate carbon intensity based on mix
  const carbonIntensity = Math.round(
    (gasPerc * 3.5) + // Gas: ~350g CO2/kWh
    (windPerc * 0.1) + // Wind: ~10g CO2/kWh
    (solarPerc * 0.4) + // Solar: ~40g CO2/kWh
    (hydroPerc * 0.1) + // Hydro: ~10g CO2/kWh
    (nuclearPerc * 0.12) + // Nuclear: ~12g CO2/kWh
    (importsPerc * 2.0) // Imports: variable, assume ~200g CO2/kWh
  );
  
  // Dynamic pricing based on demand and carbon intensity
  const basePrice = 50 + (currentDemand - 32) * 3 + (carbonIntensity - 180) * 0.15;
  
  return {
    timestamp: now.toISOString(),
    demand: Math.round(currentDemand * 10) / 10,
    generation: Math.round(currentDemand * 10) / 10,
    carbonIntensity: Math.max(80, Math.min(300, carbonIntensity)),
    price: Math.round(Math.max(35, Math.min(150, basePrice))),
    generationMix: {
      gas: Math.round((gasPerc / 100) * currentDemand * 10) / 10,
      nuclear: Math.round((nuclearPerc / 100) * currentDemand * 10) / 10,
      wind: Math.round((windPerc / 100) * currentDemand * 10) / 10,
      solar: Math.round((solarPerc / 100) * currentDemand * 10) / 10,
      hydroelectric: Math.round((hydroPerc / 100) * currentDemand * 10) / 10,
      biomass: Math.round(0.06 * currentDemand * 10) / 10,
      coal: 0,
      imports: Math.round((importsPerc / 100) * currentDemand * 10) / 10,
      other: Math.round(0.02 * currentDemand * 10) / 10,
    },
    percentages: {
      renewables: Math.round((windPerc + solarPerc + hydroPerc) * 10) / 10,
      fossil: Math.round(gasPerc * 10) / 10,
      nuclear: Math.round(nuclearPerc * 10) / 10,
      imports: Math.round(importsPerc * 10) / 10,
    }
  };
}
