// Energy Dashboard API Integration
// API Docs: https://www.energydashboard.co.uk/access
// Rate Limit: 1000 calls/month (Basic tier)
// Strategy: 30min intervals 6am-6pm, 2hr intervals 6pm-6am = ~900 calls/month

const API_BASE_URL = import.meta.env.PUBLIC_ENERGY_DASHBOARD_API_URL || 'https://api.energydashboard.co.uk/v1';
const API_KEY = import.meta.env.ENERGY_DASHBOARD_API_KEY; // Server-side only

// Cache duration: 30 minutes for peak hours, 2 hours for off-peak
const CACHE_DURATION_PEAK = 30 * 60 * 1000; // 30 minutes
const CACHE_DURATION_OFF_PEAK = 2 * 60 * 60 * 1000; // 2 hours

interface CachedData<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface EnergyDashboardStation {
  id: string;
  name: string;
  fuelType: string;
  capacity: number; // MW
  generation: number; // MW current output
  latitude: number;
  longitude: number;
  operator?: string;
  status: 'online' | 'offline' | 'partial';
}

// In-memory cache
const cache = new Map<string, CachedData<any>>();

/**
 * Determine if current time is peak hours (6am-6pm)
 */
function isPeakHours(): boolean {
  const hour = new Date().getHours();
  return hour >= 6 && hour < 18;
}

/**
 * Get appropriate cache duration based on time of day
 */
function getCacheDuration(): number {
  return isPeakHours() ? CACHE_DURATION_PEAK : CACHE_DURATION_OFF_PEAK;
}

/**
 * Get data from cache if valid
 */
function getFromCache<T>(key: string): T | null {
  const cached = cache.get(key);
  if (!cached) return null;
  
  if (Date.now() > cached.expiresAt) {
    cache.delete(key);
    return null;
  }
  
  return cached.data as T;
}

/**
 * Store data in cache
 */
function setCache<T>(key: string, data: T): void {
  const now = Date.now();
  cache.set(key, {
    data,
    timestamp: now,
    expiresAt: now + getCacheDuration()
  });
}

/**
 * Fetch all power stations with current generation data
 * This is the main endpoint we'll call every 30min-2hr
 */
export async function getAllStationsWithGeneration(): Promise<EnergyDashboardStation[]> {
  const cacheKey = 'all-stations';
  
  // Check cache first
  const cached = getFromCache<EnergyDashboardStation[]>(cacheKey);
  if (cached) {
    console.log('Returning cached station data');
    return cached;
  }
  
  // TODO: Replace with actual endpoint once you have API docs
  // const response = await fetch(`${API_BASE_URL}/stations?apikey=${API_KEY}`);
  
  try {
    // Placeholder - update with real endpoint
    const response = await fetch(`${API_BASE_URL}/generation/stations`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Energy Dashboard API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // TODO: Transform response to our format once you see the actual structure
    const stations: EnergyDashboardStation[] = data.stations || [];
    
    // Cache the result
    setCache(cacheKey, stations);
    
    console.log(`Fetched ${stations.length} stations from Energy Dashboard API`);
    return stations;
    
  } catch (error) {
    console.error('Error fetching from Energy Dashboard API:', error);
    
    // Return cached data even if expired, as fallback
    const cached = cache.get(cacheKey);
    if (cached) {
      console.warn('API failed, returning stale cached data');
      return cached.data as EnergyDashboardStation[];
    }
    
    throw error;
  }
}

/**
 * Get cache statistics for monitoring
 */
export function getCacheStats() {
  const stats = {
    cachedItems: cache.size,
    isPeakHours: isPeakHours(),
    cacheDuration: getCacheDuration() / 1000 / 60, // minutes
    items: Array.from(cache.entries()).map(([key, value]) => ({
      key,
      age: (Date.now() - value.timestamp) / 1000 / 60, // minutes
      expiresIn: (value.expiresAt - Date.now()) / 1000 / 60 // minutes
    }))
  };
  
  return stats;
}

/**
 * Clear all cached data (useful for testing)
 */
export function clearCache(): void {
  cache.clear();
  console.log('Cache cleared');
}

/**
 * Check if API key is configured
 */
export function isApiConfigured(): boolean {
  return !!API_KEY && API_KEY !== 'YOUR_API_KEY_HERE';
}
