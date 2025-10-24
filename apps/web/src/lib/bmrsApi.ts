// Elexon Insights Solution (BMRS) API
// Official Developer Portal: https://developer.data.elexon.co.uk/
// API Documentation: https://developer.data.elexon.co.uk/
// Dataset List: https://bscdocs.elexon.co.uk/data-integration-platform
//
// License: Contains BMRS data © Elexon Limited copyright and database right 2025
// No API key required - completely free and open!
//
// AVAILABLE DATASETS (as of 2024):
// Generation & Demand:
//   - FUELINST: Instantaneous fuel generation (⭐ USED)
//   - FUELHH: Half-hourly fuel generation by settlement period  
//   - INDGEN: Individual BM unit generation
//   - INDO: Initial demand outturn (⭐ USED)
//   - INDDEM: Indicative demand
// Prices:
//   - MID: Market Index Data (system prices)
// Forecast:
//   - WINDFOR: Wind generation forecast
//   - FOUT2T14D: 2-14 day ahead generation forecast
//   - NOU2T14D: 2-14 day ahead demand forecast
// And 40+ other datasets for balancing, constraints, frequency, etc.
//
// REMOVED/DEPRECATED:
//   - PHYBMDATA: Physical BM unit data (removed ~2024)

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
 * NOTE: MID (Market Index Data) endpoint does not exist in BMRS API v1
 * System prices are not available through this API
 * For price data, alternative sources should be used
 */
export async function getSystemPrices(): Promise<ElexonSystemPriceData[]> {
  // MID endpoint doesn't exist in BMRS API v1 - silently return empty array
  return [];
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
    const [generation, demand] = await Promise.all([
      getCurrentGeneration(),
      getCurrentDemand()
    ]);

    // Prices not available from BMRS API
    return { generation, demand, prices: [] };
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
