// Comprehensive Elexon BMRS API Service
// Implements all 4 phases of dataset integration
// Documentation: https://developer.data.elexon.co.uk/

const BMRS_BASE = 'https://data.elexon.co.uk/bmrs/api/v1';

// ========================================
// TYPES - All Dataset Response Types
// ========================================

// Phase 1: Core Real-time Data
export interface SystemFrequency {
  startTime: string;
  frequency: number; // Hz
}

export interface TemperatureData {
  publishTime: string;
  temperature: number; // °C
}

export interface MarketIndexData {
  settlementDate: string;
  settlementPeriod: number;
  systemSellPrice: number; // £/MWh
  systemBuyPrice: number; // £/MWh
}

export interface WindForecast {
  startTime: string;
  publishTime: string;
  forecast: number; // MW
}

// Phase 2: Enhanced Features
export interface WindSolarGeneration {
  settlementDate: string;
  settlementPeriod: number;
  quantity: number; // MW
  powerSystemResourceType: string; // 'Solar' | 'Wind Onshore' | 'Wind Offshore'
  bmUnit: string;
}

export interface IndividualGeneration {
  startTime: string;
  settlementDate: string;
  settlementPeriod: number;
  bmUnit: string;
  levelFrom: number; // MW
  levelTo: number; // MW
}

export interface DayAheadForecast {
  startTime: string;
  publishTime: string;
  forecastGeneration?: number; // MW (for generation)
  forecastDemand?: number; // MW (for demand)
}

export interface InterconnectorFlow {
  startTime: string;
  settlementDate: string;
  settlementPeriod: number;
  interconnectorName: string;
  flow: number; // MW (positive = import, negative = export)
}

export interface SystemWarning {
  publishTime: string;
  warningType: string;
  warningText: string;
}

// Phase 3: Advanced Analytics
export interface MediumTermForecast {
  startTime: string;
  publishTime: string;
  forecastValue: number; // MW
}

export interface LossOfLoadProbability {
  publishTime: string;
  startTime: string;
  lossOfLoadProbability: number; // Probability value
}

export interface CapacityMargin {
  forecastDate: string;
  margin: number; // MW
  deRatedMargin: number; // MW
  publishTime: string;
}

export interface NonBMData {
  settlementDate: string;
  settlementPeriod: number;
  storVolume: number; // MW
  storFlag: boolean;
}

export interface PeakDemand {
  startTime: string;
  peakDemand: number; // MW
  triadSeason?: string;
}

// Phase 4: Specialized Features
export interface REMITMessage {
  messageId: string;
  messageType: string;
  eventType: string;
  eventStart: string;
  eventEnd?: string;
  fuelType?: string;
  unavailableCapacity?: number; // MW
  affectedUnit?: string;
}

export interface BalancingData {
  settlementDate: string;
  settlementPeriod: number;
  bmUnit: string;
  bidOfferLevelFrom: number;
  bidOfferLevelTo: number;
  bidOfferPrice: number; // £/MWh
}

export interface SettlementData {
  settlementDate: string;
  settlementPeriod: number;
  acceptanceNumber: number;
  acceptanceTime: string;
  bmUnit: string;
  volume: number; // MW
  cashflow: number; // £
}

// ========================================
// PHASE 1: CORE REAL-TIME DATA
// ========================================

/**
 * Get real-time system frequency (50Hz nominal)
 * Updates every 5-30 seconds
 */
export async function getSystemFrequency(): Promise<SystemFrequency[]> {
  try {
    const response = await fetch(`${BMRS_BASE}/datasets/FREQ`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching system frequency:', error);
    return [];
  }
}

/**
 * Get temperature data
 * Updates hourly
 */
export async function getTemperature(): Promise<TemperatureData[]> {
  try {
    const response = await fetch(`${BMRS_BASE}/datasets/TEMP`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching temperature:', error);
    return [];
  }
}

/**
 * Get market index data (system prices)
 * @param from ISO date string
 * @param to ISO date string
 */
export async function getMarketPrices(from?: string, to?: string): Promise<MarketIndexData[]> {
  try {
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    
    const url = `${BMRS_BASE}/datasets/MID${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching market prices:', error);
    return [];
  }
}

/**
 * Get wind generation forecast
 * Updates every 30 minutes
 */
export async function getWindForecast(): Promise<WindForecast[]> {
  try {
    const response = await fetch(`${BMRS_BASE}/datasets/WINDFOR`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching wind forecast:', error);
    return [];
  }
}

// ========================================
// PHASE 2: ENHANCED FEATURES
// ========================================

/**
 * Get actual or estimated wind and solar power generation (B1610)
 * Half-hourly settlement period data
 */
export async function getWindSolarGeneration(
  settlementDate?: string,
  settlementPeriod?: number
): Promise<WindSolarGeneration[]> {
  try {
    const params = new URLSearchParams();
    if (settlementDate) params.append('settlementDate', settlementDate);
    if (settlementPeriod) params.append('settlementPeriod', settlementPeriod.toString());
    
    const url = `${BMRS_BASE}/datasets/B1610${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching wind/solar generation:', error);
    return [];
  }
}

/**
 * Get individual BM unit generation (INDGEN)
 * 5-minute interval data
 */
export async function getIndividualGeneration(): Promise<IndividualGeneration[]> {
  try {
    const response = await fetch(`${BMRS_BASE}/datasets/INDGEN`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching individual generation:', error);
    return [];
  }
}

/**
 * Get day-ahead wind and solar forecast
 */
export async function getDayAheadRenewableForecast(from?: string, to?: string): Promise<DayAheadForecast[]> {
  try {
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    
    const url = `${BMRS_BASE}/forecast/generation/wind-and-solar/day-ahead${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching day-ahead renewable forecast:', error);
    return [];
  }
}

/**
 * Get day-ahead demand forecast
 */
export async function getDayAheadDemandForecast(from?: string, to?: string): Promise<DayAheadForecast[]> {
  try {
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    
    const url = `${BMRS_BASE}/forecast/demand/day-ahead${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching day-ahead demand forecast:', error);
    return [];
  }
}

/**
 * Get interconnector flows
 */
export async function getInterconnectorFlows(): Promise<InterconnectorFlow[]> {
  try {
    const response = await fetch(`${BMRS_BASE}/generation/outturn/interconnectors`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching interconnector flows:', error);
    return [];
  }
}

/**
 * Get system warnings
 */
export async function getSystemWarnings(): Promise<SystemWarning[]> {
  try {
    const response = await fetch(`${BMRS_BASE}/datasets/SYSWARN`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching system warnings:', error);
    return [];
  }
}

// ========================================
// PHASE 3: ADVANCED ANALYTICS
// ========================================

/**
 * Get 2-14 day ahead generation forecast
 */
export async function getMediumTermGenerationForecast(): Promise<MediumTermForecast[]> {
  try {
    const response = await fetch(`${BMRS_BASE}/datasets/FOU2T14D`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching medium-term generation forecast:', error);
    return [];
  }
}

/**
 * Get 2-14 day ahead demand forecast
 */
export async function getMediumTermDemandForecast(): Promise<MediumTermForecast[]> {
  try {
    const response = await fetch(`${BMRS_BASE}/datasets/NOU2T14D`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching medium-term demand forecast:', error);
    return [];
  }
}

/**
 * Get loss of load probability during maintenance
 */
export async function getLossOfLoadProbability(
  publishDateTimeFrom?: string,
  publishDateTimeTo?: string
): Promise<LossOfLoadProbability[]> {
  try {
    const params = new URLSearchParams();
    if (publishDateTimeFrom) params.append('publishDateTimeFrom', publishDateTimeFrom);
    if (publishDateTimeTo) params.append('publishDateTimeTo', publishDateTimeTo);
    
    const url = `${BMRS_BASE}/datasets/LOLPDRM${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching loss of load probability:', error);
    return [];
  }
}

/**
 * Get daily capacity margin forecast
 */
export async function getDailyCapacityMargin(): Promise<CapacityMargin[]> {
  try {
    const response = await fetch(`${BMRS_BASE}/forecast/margin/daily`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching capacity margin:', error);
    return [];
  }
}

/**
 * Get Non-BM STOR data (storage and flexible generation)
 */
export async function getNonBMData(): Promise<NonBMData[]> {
  try {
    const response = await fetch(`${BMRS_BASE}/datasets/NONBM`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching Non-BM data:', error);
    return [];
  }
}

/**
 * Get peak demand data
 */
export async function getPeakDemand(): Promise<PeakDemand[]> {
  try {
    const response = await fetch(`${BMRS_BASE}/demand/peak`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching peak demand:', error);
    return [];
  }
}

// ========================================
// PHASE 4: SPECIALIZED FEATURES
// ========================================

/**
 * Get REMIT messages (transparency obligations)
 */
export async function getREMITMessages(from?: string, to?: string): Promise<REMITMessage[]> {
  try {
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    
    const url = `${BMRS_BASE}/remit/list/by-event${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching REMIT messages:', error);
    return [];
  }
}

/**
 * Get balancing bid-offer data
 */
export async function getBalancingBidOffer(
  settlementDate: string,
  settlementPeriod: number
): Promise<BalancingData[]> {
  try {
    const response = await fetch(
      `${BMRS_BASE}/balancing/bid-offer/all?settlementDate=${settlementDate}&settlementPeriod=${settlementPeriod}`
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching balancing bid-offer:', error);
    return [];
  }
}

/**
 * Get settlement acceptances
 */
export async function getSettlementAcceptances(
  settlementDate: string,
  settlementPeriod: number
): Promise<SettlementData[]> {
  try {
    const response = await fetch(
      `${BMRS_BASE}/balancing/settlement/acceptances/all/${settlementDate}/${settlementPeriod}`
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching settlement acceptances:', error);
    return [];
  }
}

// ========================================
// COMBINED DATA FETCHERS
// ========================================

/**
 * Get all Phase 1 data (core real-time)
 */
export async function getPhase1Data() {
  const [frequency, temperature, prices, windForecast] = await Promise.all([
    getSystemFrequency(),
    getTemperature(),
    getMarketPrices(),
    getWindForecast(),
  ]);
  
  return {
    frequency: frequency[0] || null,
    temperature: temperature[0] || null,
    latestPrice: prices[prices.length - 1] || null,
    windForecast: windForecast,
  };
}

/**
 * Get all Phase 2 data (enhanced features)
 */
export async function getPhase2Data() {
  const [
    windSolar,
    individualGen,
    renewableForecast,
    demandForecast,
    interconnectors,
    warnings,
  ] = await Promise.all([
    getWindSolarGeneration(),
    getIndividualGeneration(),
    getDayAheadRenewableForecast(),
    getDayAheadDemandForecast(),
    getInterconnectorFlows(),
    getSystemWarnings(),
  ]);
  
  return {
    windSolar,
    individualGen,
    renewableForecast,
    demandForecast,
    interconnectors,
    warnings,
  };
}

/**
 * Get comprehensive grid status (Phases 1 + 2)
 */
export async function getComprehensiveGridStatus() {
  const [phase1, phase2] = await Promise.all([
    getPhase1Data(),
    getPhase2Data(),
  ]);
  
  return {
    ...phase1,
    ...phase2,
    timestamp: new Date().toISOString(),
  };
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Format settlement date to YYYY-MM-DD
 */
export function formatSettlementDate(date: Date = new Date()): string {
  return date.toISOString().split('T')[0];
}

/**
 * Get current settlement period (1-50, half-hourly)
 */
export function getCurrentSettlementPeriod(date: Date = new Date()): number {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  return Math.floor((hours * 60 + minutes) / 30) + 1;
}

/**
 * Check if BMRS API is available
 */
export async function checkBMRSAvailability(): Promise<boolean> {
  try {
    const response = await fetch(`${BMRS_BASE}/health`);
    return response.ok;
  } catch {
    return false;
  }
}
