// BMRS (Balancing Mechanism Reporting Service) API
// Official Elexon API: https://bmrs.elexon.co.uk/
// Documentation: https://www.elexonportal.co.uk/
//
// License: Contains BMRS data © Elexon Limited copyright and database right 2025

const BMRS_API_BASE = 'https://api.bmreports.com/BMRS';
// You'll need to register for a free API key at: https://www.elexonportal.co.uk/
const BMRS_API_KEY = import.meta.env.PUBLIC_BMRS_API_KEY || '';

export interface BMRSGenerationData {
  recordType: string;
  businessType: string;
  quantity: number;
  settlementDate: string;
  settlementPeriod: number;
  powerSystemResourceType: string;
}

export interface BMRSDemandData {
  recordType: string;
  businessType: string;
  settlementDate: string;
  settlementPeriod: number;
  quantity: number;
}

/**
 * Fetch current generation by fuel type (B1620)
 * Returns actual generation in MW for each fuel type
 */
export async function getCurrentGeneration(): Promise<BMRSGenerationData[]> {
  if (!BMRS_API_KEY) {
    console.warn('BMRS API key not configured - using fallback data');
    throw new Error('BMRS API key not configured');
  }

  try {
    const now = new Date();
    const fromDate = now.toISOString().split('T')[0].replace(/-/g, '');
    const toDate = fromDate;
    
    const url = `${BMRS_API_BASE}/B1620/v1?APIKey=${BMRS_API_KEY}&SettlementDate=${fromDate}&Period=*&ServiceType=xml`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`BMRS API error: ${response.status}`);
    }
    
    const text = await response.text();
    // Parse XML response - you may need to add XML parsing library
    // For now, throw to use fallback
    throw new Error('XML parsing not implemented yet');
  } catch (error) {
    console.error('Error fetching BMRS generation data:', error);
    throw error;
  }
}

/**
 * Fetch current system demand (INDOD)
 * Returns national demand in MW
 */
export async function getCurrentDemand(): Promise<number> {
  if (!BMRS_API_KEY) {
    console.warn('BMRS API key not configured - using fallback data');
    throw new Error('BMRS API key not configured');
  }

  try {
    const now = new Date();
    const fromDate = now.toISOString().split('T')[0].replace(/-/g, '');
    
    const url = `${BMRS_API_BASE}/INDOD/v1?APIKey=${BMRS_API_KEY}&FromDate=${fromDate}&ServiceType=xml`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`BMRS API error: ${response.status}`);
    }
    
    const text = await response.text();
    // Parse XML response
    throw new Error('XML parsing not implemented yet');
  } catch (error) {
    console.error('Error fetching BMRS demand data:', error);
    throw error;
  }
}

/**
 * Fetch system prices (MID)
 * Returns market index data including prices
 */
export async function getSystemPrices(): Promise<number> {
  if (!BMRS_API_KEY) {
    throw new Error('BMRS API key not configured');
  }

  try {
    const now = new Date();
    const fromDate = now.toISOString().split('T')[0].replace(/-/g, '');
    
    const url = `${BMRS_API_BASE}/MID/v1?APIKey=${BMRS_API_KEY}&FromDate=${fromDate}&ServiceType=xml`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`BMRS API error: ${response.status}`);
    }
    
    const text = await response.text();
    throw new Error('XML parsing not implemented yet');
  } catch (error) {
    console.error('Error fetching BMRS price data:', error);
    throw error;
  }
}

// Helper function to check if BMRS is configured
export function isBMRSConfigured(): boolean {
  return Boolean(BMRS_API_KEY && BMRS_API_KEY.length > 0);
}
