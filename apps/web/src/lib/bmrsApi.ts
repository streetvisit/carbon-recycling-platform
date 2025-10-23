// Elexon Insights Solution API
// Official Developer Portal: https://developer.data.elexon.co.uk/
// Documentation: https://developer.data.elexon.co.uk/
//
// License: Contains BMRS data © Elexon Limited copyright and database right 2025
// No API key required - completely free and open!

const ELEXON_API_BASE = 'https://data.elexon.co.uk/bmrs/api/v1';

export interface ElexonGenerationData {
  startTime: string;
  fuelType: string;
  generation: number; // MW
}

export interface ElexonDemandData {
  startTime: string;
  demand: number; // MW
}

export interface ElexonSystemPriceData {
  startTime: string;
  systemBuyPrice: number;
  systemSellPrice: number;
}

/**
 * Fetch current generation by fuel type (FUELINST - Instantaneous Generation)
 * Returns actual generation in MW for each fuel type
 * Endpoint: /datasets/FUELINST
 */
export async function getCurrentGeneration(): Promise<ElexonGenerationData[]> {
  try {
    const url = `${ELEXON_API_BASE}/datasets/FUELINST`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Elexon API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching Elexon generation data:', error);
    // Return empty array to allow fallback logic
    return [];
  }
}

/**
 * Fetch current system demand (INDO - Initial Demand Outturn)
 * Returns national demand in MW
 * Endpoint: /datasets/INDO (without /latest as it may not be supported)
 */
export async function getCurrentDemand(): Promise<ElexonDemandData[]> {
  try {
    // Try without /latest first
    let url = `${ELEXON_API_BASE}/datasets/INDO`;
    let response = await fetch(url);
    
    // If that fails, try with /latest
    if (!response.ok) {
      url = `${ELEXON_API_BASE}/datasets/INDO/latest`;
      response = await fetch(url);
    }
    
    if (!response.ok) {
      throw new Error(`Elexon API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching Elexon demand data:', error);
    // Return empty array to allow fallback logic
    return [];
  }
}

/**
 * Fetch system prices (MID - Market Index Data)
 * Returns market index data including buy/sell prices
 * Endpoint: /datasets/MID/latest
 */
export async function getSystemPrices(): Promise<ElexonSystemPriceData[]> {
  try {
    // Try without /latest first
    let url = `${ELEXON_API_BASE}/datasets/MID`;
    let response = await fetch(url);
    
    // If that fails, try with /latest
    if (!response.ok) {
      url = `${ELEXON_API_BASE}/datasets/MID/latest`;
      response = await fetch(url);
    }
    
    if (!response.ok) {
      throw new Error(`Elexon API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching Elexon price data:', error);
    // Return empty array to allow fallback logic
    return [];
  }
}

/**
 * Get live UK grid data combining generation and demand
 * This combines FUELINST (instantaneous generation) with INDO (demand)
 */
export async function getLiveGridData(): Promise<{
  generation: ElexonGenerationData[];
  demand: ElexonDemandData[];
  prices: ElexonSystemPriceData[];
}> {
  try {
    const [generation, demand, prices] = await Promise.all([
      getCurrentGeneration(),
      getCurrentDemand(),
      getSystemPrices()
    ]);

    return { generation, demand, prices };
  } catch (error) {
    console.error('Error fetching live grid data:', error);
    throw error;
  }
}

/**
 * Check if Elexon API is available (it always is - no key needed!)
 */
export function isElexonAvailable(): boolean {
  return true; // No API key required!
}
