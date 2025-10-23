/**
 * NESO (National Energy System Operator) API Client
 * 
 * Free, unlimited access to UK energy system data via CKAN API
 * Documentation: https://www.neso.energy/data-portal
 * License: NESO Open Licence (commercial use allowed)
 */

import Papa from 'papaparse';

const NESO_BASE_URL = 'https://api.neso.energy';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class NESOCache {
  private cache = new Map<string, CacheEntry<any>>();

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > CACHE_DURATION) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  set<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }
}

export interface NESODatasetMetadata {
  id: string;
  name: string;
  title: string;
  resources: Array<{
    id: string;
    name: string;
    format: string;
    url: string;
    last_modified: string;
  }>;
}

export interface InterconnectorFlow {
  timestamp: Date;
  flow: number; // MW (positive = import, negative = export)
  capacity: number;
}

export interface GenerationMixData {
  timestamp: Date;
  coal: number;
  nuclear: number;
  ccgt: number; // Combined Cycle Gas Turbine
  wind: number;
  solar: number;
  hydro: number;
  biomass: number;
  oil: number;
  other: number;
  carbonIntensity: number; // gCO2/kWh
}

export interface RenewableForecast {
  timestamp: Date;
  windForecast: number; // MW
  solarForecast: number; // MW
  confidenceInterval?: {
    lower: number;
    upper: number;
  };
}

export interface DemandForecast {
  timestamp: Date;
  demand: number; // MW
  temperature?: number;
}

export interface FlexibilityEvent {
  id: string;
  startTime: Date;
  endTime: Date;
  type: 'active' | 'scheduled';
  targetReduction: number; // MW
  incentive: string;
}

export interface GISBoundary {
  type: 'Feature';
  properties: {
    name: string;
    code: string;
    operator?: string;
  };
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][];
  };
}

class NESOClient {
  private cache = new NESOCache();

  /**
   * Fetch CKAN API metadata for a dataset
   */
  private async fetchDatasetMetadata(datasetId: string): Promise<NESODatasetMetadata> {
    const cacheKey = `metadata:${datasetId}`;
    const cached = this.cache.get<NESODatasetMetadata>(cacheKey);
    if (cached) return cached;

    const response = await fetch(
      `${NESO_BASE_URL}/api/3/action/package_show?id=${datasetId}`
    );
    
    if (!response.ok) {
      throw new Error(`NESO API error: ${response.status} ${response.statusText}`);
    }

    const json = await response.json();
    const metadata = json.result;
    
    this.cache.set(cacheKey, metadata);
    return metadata;
  }

  /**
   * Fetch and parse CSV resource
   */
  private async fetchCSV<T = any>(url: string): Promise<T[]> {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch CSV: ${response.status}`);
    }

    const csvText = await response.text();
    
    return new Promise((resolve, reject) => {
      Papa.parse<T>(csvText, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            console.warn('CSV parsing warnings:', results.errors);
          }
          resolve(results.data);
        },
        error: (error) => reject(error),
      });
    });
  }

  /**
   * Get most recent resource URL from dataset
   */
  private async getLatestResourceUrl(
    datasetId: string,
    resourceNamePattern?: RegExp
  ): Promise<string> {
    const metadata = await this.fetchDatasetMetadata(datasetId);
    
    let resources = metadata.resources;
    
    if (resourceNamePattern) {
      resources = resources.filter(r => resourceNamePattern.test(r.name));
    }
    
    if (resources.length === 0) {
      throw new Error(`No resources found for dataset ${datasetId}`);
    }

    // Sort by last_modified descending
    resources.sort((a, b) => 
      new Date(b.last_modified).getTime() - new Date(a.last_modified).getTime()
    );

    return resources[0].url;
  }

  /**
   * List all available datasets
   */
  async listDatasets(): Promise<string[]> {
    const cacheKey = 'datasets:list';
    const cached = this.cache.get<string[]>(cacheKey);
    if (cached) return cached;

    const response = await fetch(`${NESO_BASE_URL}/api/3/action/package_list`);
    const json = await response.json();
    const datasets = json.result;
    
    this.cache.set(cacheKey, datasets);
    return datasets;
  }

  // ========== PHASE 1: REAL-TIME DATA ==========

  /**
   * Get embedded wind and solar forecasts (14-day ahead)
   */
  async getRenewableForecasts(): Promise<RenewableForecast[]> {
    const cacheKey = 'forecasts:renewables';
    const cached = this.cache.get<RenewableForecast[]>(cacheKey);
    if (cached) return cached;

    try {
      const url = await this.getLatestResourceUrl(
        'embedded-wind-and-solar-forecasts',
        /_embedded_forecast\.csv$/
      );

      const rawData = await this.fetchCSV<{
        DATETIME: string;
        EMBEDDED_WIND_FORECAST: number;
        EMBEDDED_SOLAR_FORECAST: number;
      }>(url);

      const forecasts: RenewableForecast[] = rawData.map(row => ({
        timestamp: new Date(row.DATETIME),
        windForecast: row.EMBEDDED_WIND_FORECAST || 0,
        solarForecast: row.EMBEDDED_SOLAR_FORECAST || 0,
      }));

      this.cache.set(cacheKey, forecasts);
      return forecasts;
    } catch (error) {
      console.error('Failed to fetch renewable forecasts:', error);
      return [];
    }
  }

  /**
   * Get historic generation mix (real-time, 30-min updates)
   */
  async getGenerationMix(): Promise<GenerationMixData[]> {
    const cacheKey = 'generation:mix';
    const cached = this.cache.get<GenerationMixData[]>(cacheKey);
    if (cached) return cached;

    try {
      const url = await this.getLatestResourceUrl('historic-generation-mix');

      const rawData = await this.fetchCSV<{
        DATETIME: string;
        COAL: number;
        NUCLEAR: number;
        CCGT: number;
        WIND: number;
        SOLAR: number;
        HYDRO: number;
        BIOMASS: number;
        OIL: number;
        OTHER: number;
        CARBON_INTENSITY: number;
      }>(url);

      const mix: GenerationMixData[] = rawData.map(row => ({
        timestamp: new Date(row.DATETIME),
        coal: row.COAL || 0,
        nuclear: row.NUCLEAR || 0,
        ccgt: row.CCGT || 0,
        wind: row.WIND || 0,
        solar: row.SOLAR || 0,
        hydro: row.HYDRO || 0,
        biomass: row.BIOMASS || 0,
        oil: row.OIL || 0,
        other: row.OTHER || 0,
        carbonIntensity: row.CARBON_INTENSITY || 0,
      }));

      this.cache.set(cacheKey, mix);
      return mix;
    } catch (error) {
      console.error('Failed to fetch generation mix:', error);
      return [];
    }
  }

  /**
   * Get interconnector flow data for a specific interconnector
   */
  async getInterconnectorFlow(
    interconnector: 'ifa' | 'ifa2' | 'britned' | 'nemolink' | 'eleclink' | 'ik-viking-link'
  ): Promise<InterconnectorFlow[]> {
    const cacheKey = `interconnector:${interconnector}`;
    const cached = this.cache.get<InterconnectorFlow[]>(cacheKey);
    if (cached) return cached;

    try {
      const url = await this.getLatestResourceUrl(interconnector);

      const rawData = await this.fetchCSV<{
        DATETIME: string;
        FLOW: number;
        CAPACITY?: number;
      }>(url);

      const flows: InterconnectorFlow[] = rawData.map(row => ({
        timestamp: new Date(row.DATETIME),
        flow: row.FLOW || 0,
        capacity: row.CAPACITY || 2000, // Default capacity
      }));

      this.cache.set(cacheKey, flows);
      return flows;
    } catch (error) {
      console.error(`Failed to fetch ${interconnector} flow:`, error);
      return [];
    }
  }

  /**
   * Get all interconnector flows
   */
  async getAllInterconnectors(): Promise<Record<string, InterconnectorFlow[]>> {
    const interconnectors = ['ifa', 'ifa2', 'britned', 'nemolink', 'eleclink', 'ik-viking-link'] as const;
    
    const results = await Promise.allSettled(
      interconnectors.map(ic => this.getInterconnectorFlow(ic))
    );

    const flows: Record<string, InterconnectorFlow[]> = {};
    
    interconnectors.forEach((ic, index) => {
      const result = results[index];
      if (result.status === 'fulfilled') {
        flows[ic] = result.value;
      } else {
        console.warn(`Failed to fetch ${ic}:`, result.reason);
        flows[ic] = [];
      }
    });

    return flows;
  }

  // ========== PHASE 2: FORECASTING ==========

  /**
   * Get 1-day ahead demand forecast
   */
  async getDemandForecast1Day(): Promise<DemandForecast[]> {
    const cacheKey = 'forecast:demand:1day';
    const cached = this.cache.get<DemandForecast[]>(cacheKey);
    if (cached) return cached;

    try {
      const url = await this.getLatestResourceUrl('1-day-ahead-demand-forecast');

      const rawData = await this.fetchCSV<{
        DATETIME: string;
        DEMAND: number;
        TEMPERATURE?: number;
      }>(url);

      const forecasts: DemandForecast[] = rawData.map(row => ({
        timestamp: new Date(row.DATETIME),
        demand: row.DEMAND || 0,
        temperature: row.TEMPERATURE,
      }));

      this.cache.set(cacheKey, forecasts);
      return forecasts;
    } catch (error) {
      console.error('Failed to fetch 1-day demand forecast:', error);
      return [];
    }
  }

  /**
   * Get 7-day ahead national forecast
   */
  async getDemandForecast7Day(): Promise<DemandForecast[]> {
    const cacheKey = 'forecast:demand:7day';
    const cached = this.cache.get<DemandForecast[]>(cacheKey);
    if (cached) return cached;

    try {
      const url = await this.getLatestResourceUrl('7-day-ahead-national-forecast');

      const rawData = await this.fetchCSV<{
        DATETIME: string;
        DEMAND: number;
      }>(url);

      const forecasts: DemandForecast[] = rawData.map(row => ({
        timestamp: new Date(row.DATETIME),
        demand: row.DEMAND || 0,
      }));

      this.cache.set(cacheKey, forecasts);
      return forecasts;
    } catch (error) {
      console.error('Failed to fetch 7-day demand forecast:', error);
      return [];
    }
  }

  /**
   * Get demand flexibility service live events
   */
  async getFlexibilityEvents(): Promise<FlexibilityEvent[]> {
    const cacheKey = 'flexibility:events';
    const cached = this.cache.get<FlexibilityEvent[]>(cacheKey);
    if (cached) return cached;

    try {
      const url = await this.getLatestResourceUrl('demand-flexibility-service-live-events');

      const rawData = await this.fetchCSV<{
        EVENT_ID: string;
        START_TIME: string;
        END_TIME: string;
        STATUS: string;
        TARGET_REDUCTION_MW: number;
        INCENTIVE: string;
      }>(url);

      const events: FlexibilityEvent[] = rawData.map(row => ({
        id: row.EVENT_ID,
        startTime: new Date(row.START_TIME),
        endTime: new Date(row.END_TIME),
        type: row.STATUS === 'active' ? 'active' : 'scheduled',
        targetReduction: row.TARGET_REDUCTION_MW || 0,
        incentive: row.INCENTIVE || 'Standard',
      }));

      this.cache.set(cacheKey, events);
      return events;
    } catch (error) {
      console.error('Failed to fetch flexibility events:', error);
      return [];
    }
  }

  // ========== PHASE 3: GEOGRAPHIC & ADVANCED ==========

  /**
   * Get GIS boundaries for GB DNO license areas
   */
  async getDNOBoundaries(): Promise<GISBoundary[]> {
    const cacheKey = 'gis:dno:boundaries';
    const cached = this.cache.get<GISBoundary[]>(cacheKey);
    if (cached) return cached;

    try {
      const url = await this.getLatestResourceUrl(
        'gis-boundaries-for-gb-dno-license-areas',
        /\.geojson$/
      );

      const response = await fetch(url);
      const geojson = await response.json();

      const boundaries: GISBoundary[] = geojson.features || [];
      
      this.cache.set(cacheKey, boundaries);
      return boundaries;
    } catch (error) {
      console.error('Failed to fetch DNO boundaries:', error);
      return [];
    }
  }

  /**
   * Get GIS boundaries for GB grid supply points
   */
  async getGridSupplyPoints(): Promise<GISBoundary[]> {
    const cacheKey = 'gis:grid:points';
    const cached = this.cache.get<GISBoundary[]>(cacheKey);
    if (cached) return cached;

    try {
      const url = await this.getLatestResourceUrl(
        'gis-boundaries-for-gb-grid-supply-points',
        /\.geojson$/
      );

      const response = await fetch(url);
      const geojson = await response.json();

      const points: GISBoundary[] = geojson.features || [];
      
      this.cache.set(cacheKey, points);
      return points;
    } catch (error) {
      console.error('Failed to fetch grid supply points:', error);
      return [];
    }
  }

  /**
   * Get current total GB demand
   */
  async getCurrentDemand(): Promise<number> {
    try {
      const mix = await this.getGenerationMix();
      if (mix.length === 0) return 0;

      // Get most recent entry
      const latest = mix[mix.length - 1];
      
      // Sum all generation sources
      return (
        latest.coal +
        latest.nuclear +
        latest.ccgt +
        latest.wind +
        latest.solar +
        latest.hydro +
        latest.biomass +
        latest.oil +
        latest.other
      );
    } catch (error) {
      console.error('Failed to calculate current demand:', error);
      return 0;
    }
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// Export singleton instance
export const nesoClient = new NESOClient();
