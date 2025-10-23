/**
 * Unified Energy Data API
 * Combines data from Carbon Intensity API and Elexon BMRS
 */

import { getUKGridData, getFallbackGridData } from './ukCarbonIntensityApi';
import { getCurrentGeneration, getCurrentDemand, getSystemPrices as getBMRSSystemPrices } from './bmrsApi';

export interface GenerationMix {
  total: number;
  byFuelType: {
    [key: string]: number;
  };
}

export interface DemandData {
  demand: number;
  timestamp: string;
}

export interface SystemPrices {
  imbalancePrice: number;
  timestamp: string;
}

export interface CarbonIntensityData {
  actual: number;
  forecast: number;
  timestamp: string;
}

/**
 * Get current generation mix from BMRS
 */
export async function getGenerationMix(): Promise<GenerationMix> {
  try {
    const bmrsData = await getCurrentGeneration();
    
    const byFuelType: { [key: string]: number } = {};
    let total = 0;

    bmrsData.forEach(item => {
      const fuelType = item.fuelType.toLowerCase();
      const mw = item.generation || 0;
      
      if (!byFuelType[fuelType]) {
        byFuelType[fuelType] = 0;
      }
      
      byFuelType[fuelType] += mw;
      total += mw;
    });

    return {
      total,
      byFuelType
    };
  } catch (error) {
    console.error('Error fetching generation mix:', error);
    // Fallback data
    return {
      total: 35000,
      byFuelType: {
        gas: 12000,
        nuclear: 6000,
        wind: 8000,
        solar: 3000,
        biomass: 2000,
        hydro: 1000,
        imports: 3000
      }
    };
  }
}

/**
 * Get current demand from BMRS
 */
export async function getDemandData(): Promise<DemandData> {
  try {
    const demandData = await getCurrentDemand();
    const latest = demandData[0];
    return {
      demand: latest?.demand || 35000,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error fetching demand data:', error);
    return {
      demand: 35000,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Get current system prices from BMRS
 */
export async function getSystemPrices(): Promise<SystemPrices> {
  try {
    const pricesData = await getBMRSSystemPrices();
    const latest = pricesData[0];
    return {
      imbalancePrice: latest?.systemBuyPrice || 75,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error fetching system prices:', error);
    return {
      imbalancePrice: 75,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Get carbon intensity from Carbon Intensity API
 */
export async function getCarbonIntensity(): Promise<CarbonIntensityData> {
  try {
    const gridData = await getUKGridData();
    return {
      actual: gridData.carbonIntensity,
      forecast: gridData.carbonIntensity, // Same for now
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error fetching carbon intensity:', error);
    const fallback = getFallbackGridData();
    return {
      actual: fallback.carbonIntensity,
      forecast: fallback.carbonIntensity,
      timestamp: new Date().toISOString()
    };
  }
}
