// UK Power Stations Data API
// Combines Elexon BMRS physical data with geographic information
// License: Contains BMRS data © Elexon Limited copyright and database right 2025

const ELEXON_API_BASE = 'https://data.elexon.co.uk/bmrs/api/v1';

export interface PowerStation {
  id: string;
  name: string;
  fuelType: string;
  registeredCapacity: number; // MW
  currentGeneration: number; // MW
  latitude: number;
  longitude: number;
  status: 'online' | 'offline' | 'partial';
  operator?: string;
  bmUnitId?: string;
}

export interface PowerStationGeneration {
  bmUnitId: string;
  bmUnitName: string;
  fuelType: string;
  generation: number; // MW
  settlementDate: string;
  settlementPeriod: number;
}

/**
 * Fetch physical data for all BM Units (power stations)
 * Endpoint: /datasets/PHYBMDATA
 */
export async function getBMUnitPhysicalData(): Promise<any[]> {
  try {
    const url = `${ELEXON_API_BASE}/datasets/PHYBMDATA`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Elexon API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching BM Unit physical data:', error);
    throw error;
  }
}

/**
 * Fetch current generation by BM Unit
 * Endpoint: /datasets/B1610 (Actual or Estimated Wind and Solar Power Generation)
 */
export async function getCurrentBMUnitGeneration(): Promise<PowerStationGeneration[]> {
  try {
    const url = `${ELEXON_API_BASE}/datasets/B1610`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Elexon API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching BM Unit generation:', error);
    throw error;
  }
}

/**
 * UK Power Station Locations Database
 * This is a curated list of major UK power stations with coordinates
 * Data sources: Public domain, OS OpenData, company websites
 */
const UK_POWER_STATIONS: Record<string, { lat: number; lng: number; capacity: number; operator: string }> = {
  // Nuclear Power Stations
  'Sizewell B': { lat: 52.2136, lng: 1.6206, capacity: 1198, operator: 'EDF Energy' },
  'Heysham 1': { lat: 54.0294, lng: -2.9186, capacity: 1160, operator: 'EDF Energy' },
  'Heysham 2': { lat: 54.0294, lng: -2.9186, capacity: 1250, operator: 'EDF Energy' },
  'Hartlepool': { lat: 54.6369, lng: -1.1814, capacity: 1190, operator: 'EDF Energy' },
  'Torness': { lat: 55.9694, lng: -2.4083, capacity: 1250, operator: 'EDF Energy' },
  'Hinkley Point B': { lat: 51.2097, lng: -3.1314, capacity: 965, operator: 'EDF Energy' },
  
  // Gas Power Stations (Major CCGT)
  'Pembroke': { lat: 51.6756, lng: -5.0106, capacity: 2180, operator: 'RWE' },
  'Grain': { lat: 51.4497, lng: 0.7208, capacity: 1365, operator: 'Uniper' },
  'Peterhead': { lat: 57.5078, lng: -1.7850, capacity: 1180, operator: 'SSE' },
  'Drax': { lat: 53.7372, lng: -0.9967, capacity: 660, operator: 'Drax Group' }, // CCGT only
  'Carrington': { lat: 53.4417, lng: -2.4014, capacity: 880, operator: 'Uniper' },
  'Killingholme': { lat: 53.6422, lng: -0.2567, capacity: 1360, operator: 'EP UK Investments' },
  'Seabank': { lat: 51.5500, lng: -2.7500, capacity: 1140, operator: 'RWE' },
  'Saltend': { lat: 53.7450, lng: -0.2250, capacity: 1200, operator: 'Equinor' },
  
  // Biomass
  'Drax Biomass': { lat: 53.7372, lng: -0.9967, capacity: 2600, operator: 'Drax Group' },
  
  // Wind Farms (Major Offshore)
  'Hornsea One': { lat: 53.8833, lng: 1.7667, capacity: 1218, operator: 'Ørsted' },
  'Hornsea Two': { lat: 53.9167, lng: 1.4167, capacity: 1386, operator: 'Ørsted' },
  'Walney Extension': { lat: 54.0333, lng: -3.5000, capacity: 659, operator: 'Ørsted' },
  'London Array': { lat: 51.6500, lng: 1.5000, capacity: 630, operator: 'Ørsted/La Caisse/Masdar' },
  'Gwynt y Môr': { lat: 53.4333, lng: -3.6000, capacity: 576, operator: 'RWE' },
  'Greater Gabbard': { lat: 51.9833, lng: 2.0000, capacity: 504, operator: 'SSE/RWE' },
  'Thanet': { lat: 51.4833, lng: 1.6500, capacity: 300, operator: 'Vattenfall' },
  
  // Wind Farms (Major Onshore)
  'Whitelee': { lat: 55.6944, lng: -4.4417, capacity: 539, operator: 'ScottishPower Renewables' },
  'Clyde': { lat: 55.6167, lng: -3.7833, capacity: 350, operator: 'SSE' },
  
  // Solar Farms (Largest)
  'Shotwick': { lat: 53.2333, lng: -3.0167, capacity: 72, operator: 'Tata Power' },
  
  // Hydro
  'Dinorwig': { lat: 53.1192, lng: -4.1119, capacity: 1728, operator: 'Engie' }, // Pumped storage
  'Cruachan': { lat: 56.4167, lng: -5.0833, capacity: 440, operator: 'Drax Group' }, // Pumped storage
  
  // Interconnectors (Virtual "stations" for visualization)
  'IFA': { lat: 50.9, lng: 1.3, capacity: 2000, operator: 'National Grid/RTE' }, // GB-France
  'IFA2': { lat: 50.9, lng: 1.3, capacity: 1000, operator: 'National Grid/RTE' }, // GB-France
  'BritNed': { lat: 52.2, lng: 3.0, capacity: 1000, operator: 'National Grid/TenneT' }, // GB-Netherlands
  'Nemo': { lat: 51.3, lng: 2.9, capacity: 1000, operator: 'National Grid/Elia' }, // GB-Belgium
  'NSL': { lat: 59.5, lng: 1.0, capacity: 1400, operator: 'National Grid/Statnett' }, // GB-Norway
  'EWIC': { lat: 54.5, lng: -5.5, capacity: 500, operator: 'Mutual Energy' }, // GB-Ireland
  'Moyle': { lat: 55.2, lng: -6.0, capacity: 500, operator: 'Mutual Energy' }, // GB-N.Ireland
};

/**
 * Get all power stations with their current generation
 */
export async function getAllPowerStations(): Promise<PowerStation[]> {
  try {
    // For now, return our curated list
    // In production, this would be enhanced with real-time BMRS data
    const stations: PowerStation[] = [];
    
    for (const [name, data] of Object.entries(UK_POWER_STATIONS)) {
      const fuelType = determineFuelType(name);
      
      stations.push({
        id: name.toLowerCase().replace(/\s+/g, '-'),
        name: name,
        fuelType: fuelType,
        registeredCapacity: data.capacity,
        currentGeneration: 0, // Will be updated with real-time data
        latitude: data.lat,
        longitude: data.lng,
        status: 'online',
        operator: data.operator,
      });
    }
    
    return stations;
  } catch (error) {
    console.error('Error getting power stations:', error);
    return [];
  }
}

/**
 * Determine fuel type from station name (helper function)
 */
function determineFuelType(name: string): string {
  const lowerName = name.toLowerCase();
  
  if (lowerName.includes('nuclear') || ['sizewell', 'heysham', 'hartlepool', 'torness', 'hinkley'].some(n => lowerName.includes(n))) {
    return 'nuclear';
  }
  if (lowerName.includes('wind') || lowerName.includes('hornsea') || lowerName.includes('walney') || 
      lowerName.includes('gwynt') || lowerName.includes('array') || lowerName.includes('gabbard') || 
      lowerName.includes('thanet') || lowerName.includes('whitelee') || lowerName.includes('clyde')) {
    return 'wind';
  }
  if (lowerName.includes('solar') || lowerName.includes('shotwick')) {
    return 'solar';
  }
  if (lowerName.includes('biomass')) {
    return 'biomass';
  }
  if (lowerName.includes('hydro') || lowerName.includes('dinorwig') || lowerName.includes('cruachan')) {
    return 'hydro';
  }
  if (lowerName.includes('interconnect') || lowerName.includes('ifa') || lowerName.includes('britned') || 
      lowerName.includes('nemo') || lowerName.includes('nsl') || lowerName.includes('ewic') || lowerName.includes('moyle')) {
    return 'interconnector';
  }
  
  // Default to gas for CCGT stations
  return 'gas';
}

/**
 * Get fuel type color for visualization
 */
export function getFuelColor(fuelType: string): string {
  const colors: Record<string, string> = {
    nuclear: '#9333ea',      // Purple
    gas: '#6b7280',          // Gray
    wind: '#10b981',         // Green
    solar: '#f59e0b',        // Orange/Yellow
    hydro: '#3b82f6',        // Blue
    biomass: '#84cc16',      // Lime
    coal: '#1f2937',         // Dark gray
    interconnector: '#ec4899', // Pink
    other: '#64748b',        // Slate
  };
  
  return colors[fuelType] || colors.other;
}

/**
 * Get fuel type icon
 */
export function getFuelIcon(fuelType: string): string {
  const icons: Record<string, string> = {
    nuclear: '⚛️',
    gas: '🔥',
    wind: '💨',
    solar: '☀️',
    hydro: '💧',
    biomass: '🌿',
    coal: '⚫',
    interconnector: '🔌',
    other: '⚡',
  };
  
  return icons[fuelType] || icons.other;
}
