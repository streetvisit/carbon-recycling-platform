import { create } from 'zustand';
import { authenticatedFetch, getApiBaseUrl, handleAuthError } from '../lib/auth.ts';

export interface AnalyticsFilters {
  period: string;
  scope?: 'scope_1' | 'scope_2' | 'scope_3' | 'all';
  groupBy?: 'month' | 'quarter';
}

export interface TimeseriesDataPoint {
  date: string;
  totalCo2e: number;
}

export interface BreakdownDataPoint {
  category: string;
  scope: 'scope_1' | 'scope_2' | 'scope_3';
  totalCo2e: number;
  percentage: number;
}

export interface BenchmarkData {
  industry: string;
  metric: string;
  userValue: number;
  percentileRank: number;
  benchmarks: {
    percentile_25: number;
    percentile_50: number;
    percentile_75: number;
    percentile_90: number;
    unit: string;
  };
  comparison: {
    vsMedian: number;
    vsTopQuartile: number;
  };
}

export interface PredictionData {
  date: string;
  predictedCo2e: number;
  confidence: number;
  algorithm: string;
}

export interface AlertData {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high';
  status: 'active' | 'resolved' | 'snoozed';
  title: string;
  message: string;
  timestamp: string;
  metric: string;
  value: number;
  threshold: number;
}

export interface RealTimeMetric {
  current: number;
  trend: number;
  unit: string;
  status: 'good' | 'normal' | 'warning' | 'critical';
  lastUpdated: string;
}

export interface RealTimeData {
  timestamp: string;
  organizationId: string;
  metrics: {
    emissions?: RealTimeMetric;
    energy?: RealTimeMetric;
    intensity?: RealTimeMetric;
  };
}

interface AnalyticsState {
  // Filters
  filters: AnalyticsFilters;
  setFilters: (filters: Partial<AnalyticsFilters>) => void;
  
  // Timeseries data
  timeseriesData: TimeseriesDataPoint[];
  timeseriesLoading: boolean;
  timeseriesError: string | null;
  setTimeseriesData: (data: TimeseriesDataPoint[]) => void;
  setTimeseriesLoading: (loading: boolean) => void;
  setTimeseriesError: (error: string | null) => void;
  
  // Breakdown data
  breakdownData: BreakdownDataPoint[];
  breakdownLoading: boolean;
  breakdownError: string | null;
  setBreakdownData: (data: BreakdownDataPoint[]) => void;
  setBreakdownLoading: (loading: boolean) => void;
  setBreakdownError: (error: string | null) => void;
  
  // Benchmarking data
  benchmarkData: BenchmarkData | null;
  benchmarkLoading: boolean;
  benchmarkError: string | null;
  setBenchmarkData: (data: BenchmarkData | null) => void;
  setBenchmarkLoading: (loading: boolean) => void;
  setBenchmarkError: (error: string | null) => void;
  
  // Predictions data
  predictionsData: PredictionData[];
  predictionsLoading: boolean;
  predictionsError: string | null;
  setPredictionsData: (data: PredictionData[]) => void;
  setPredictionsLoading: (loading: boolean) => void;
  setPredictionsError: (error: string | null) => void;
  
  // Alerts data
  alertsData: AlertData[];
  alertsLoading: boolean;
  alertsError: string | null;
  setAlertsData: (data: AlertData[]) => void;
  setAlertsLoading: (loading: boolean) => void;
  setAlertsError: (error: string | null) => void;
  
  // Real-time data
  realTimeData: RealTimeData | null;
  realTimeLoading: boolean;
  realTimeError: string | null;
  realTimeAutoRefresh: boolean;
  setRealTimeData: (data: RealTimeData | null) => void;
  setRealTimeLoading: (loading: boolean) => void;
  setRealTimeError: (error: string | null) => void;
  setRealTimeAutoRefresh: (autoRefresh: boolean) => void;
  
  // Auto-refresh intervals
  refreshIntervals: {
    timeseries: NodeJS.Timeout | null;
    realTime: NodeJS.Timeout | null;
    alerts: NodeJS.Timeout | null;
  };
  
  // Utility functions
  resetAllData: () => void;
  refreshAllData: (apiBaseUrl?: string) => Promise<void>;
  startRealTimeUpdates: (apiBaseUrl?: string) => void;
  stopRealTimeUpdates: () => void;
  fetchBenchmarkData: (industry?: string, metric?: string, apiBaseUrl?: string) => Promise<void>;
  fetchPredictions: (months?: number, algorithm?: string, apiBaseUrl?: string) => Promise<void>;
  fetchAlerts: (status?: string, severity?: string, apiBaseUrl?: string) => Promise<void>;
}

export const useAnalyticsStore = create<AnalyticsState>((set, get) => ({
  // Initial state
  filters: {
    period: '12m',
    scope: 'all',
    groupBy: 'month'
  },
  
  timeseriesData: [],
  timeseriesLoading: false,
  timeseriesError: null,
  
  breakdownData: [],
  breakdownLoading: false,
  breakdownError: null,
  
  benchmarkData: null,
  benchmarkLoading: false,
  benchmarkError: null,
  
  predictionsData: [],
  predictionsLoading: false,
  predictionsError: null,
  
  alertsData: [],
  alertsLoading: false,
  alertsError: null,
  
  realTimeData: null,
  realTimeLoading: false,
  realTimeError: null,
  realTimeAutoRefresh: false,
  
  refreshIntervals: {
    timeseries: null,
    realTime: null,
    alerts: null
  },
  
  // Actions
  setFilters: (newFilters) => {
    set(state => ({
      filters: { ...state.filters, ...newFilters }
    }));
  },
  
  setTimeseriesData: (data) => set({ timeseriesData: data }),
  setTimeseriesLoading: (loading) => set({ timeseriesLoading: loading }),
  setTimeseriesError: (error) => set({ timeseriesError: error }),
  
  setBreakdownData: (data) => set({ breakdownData: data }),
  setBreakdownLoading: (loading) => set({ breakdownLoading: loading }),
  setBreakdownError: (error) => set({ breakdownError: error }),
  
  setBenchmarkData: (data) => set({ benchmarkData: data }),
  setBenchmarkLoading: (loading) => set({ benchmarkLoading: loading }),
  setBenchmarkError: (error) => set({ benchmarkError: error }),
  
  setPredictionsData: (data) => set({ predictionsData: data }),
  setPredictionsLoading: (loading) => set({ predictionsLoading: loading }),
  setPredictionsError: (error) => set({ predictionsError: error }),
  
  setAlertsData: (data) => set({ alertsData: data }),
  setAlertsLoading: (loading) => set({ alertsLoading: loading }),
  setAlertsError: (error) => set({ alertsError: error }),
  
  setRealTimeData: (data) => set({ realTimeData: data }),
  setRealTimeLoading: (loading) => set({ realTimeLoading: loading }),
  setRealTimeError: (error) => set({ realTimeError: error }),
  setRealTimeAutoRefresh: (autoRefresh) => set({ realTimeAutoRefresh: autoRefresh }),
  
  resetAllData: () => {
    const { refreshIntervals } = get();
    
    // Clear all intervals
    if (refreshIntervals.timeseries) clearInterval(refreshIntervals.timeseries);
    if (refreshIntervals.realTime) clearInterval(refreshIntervals.realTime);
    if (refreshIntervals.alerts) clearInterval(refreshIntervals.alerts);
    
    set({
      timeseriesData: [],
      timeseriesError: null,
      breakdownData: [],
      breakdownError: null,
      benchmarkData: null,
      benchmarkError: null,
      predictionsData: [],
      predictionsError: null,
      alertsData: [],
      alertsError: null,
      realTimeData: null,
      realTimeError: null,
      refreshIntervals: {
        timeseries: null,
        realTime: null,
        alerts: null
      }
    });
  },
  
  refreshAllData: async (customApiUrl?: string) => {
    const { filters, setTimeseriesLoading, setTimeseriesError, setTimeseriesData,
            setBreakdownLoading, setBreakdownError, setBreakdownData } = get();
    
    const apiBaseUrl = customApiUrl || getApiBaseUrl();
    
    // Build query parameters
    const params = new URLSearchParams();
    params.append('period', filters.period);
    if (filters.groupBy) params.append('groupBy', filters.groupBy);
    if (filters.scope && filters.scope !== 'all') params.append('scope', filters.scope);
    
    try {
      // Fetch timeseries data
      setTimeseriesLoading(true);
      setTimeseriesError(null);
      
      const timeseriesResponse = await authenticatedFetch(`${apiBaseUrl}/api/v1/emissions/timeseries?${params}`);
      
      if (!timeseriesResponse.ok) {
        handleAuthError(timeseriesResponse);
        throw new Error(`Timeseries fetch failed: ${timeseriesResponse.status}`);
      }
      
      const timeseriesData = await timeseriesResponse.json();
      setTimeseriesData(timeseriesData.data);
      
      // Fetch breakdown data
      setBreakdownLoading(true);
      setBreakdownError(null);
      
      const breakdownParams = new URLSearchParams();
      breakdownParams.append('period', filters.period);
      if (filters.scope && filters.scope !== 'all') breakdownParams.append('scope', filters.scope);
      breakdownParams.append('sortBy', 'co2e_desc');
      breakdownParams.append('limit', '10');
      
      const breakdownResponse = await authenticatedFetch(`${apiBaseUrl}/api/v1/emissions/breakdown?${breakdownParams}`);
      
      if (!breakdownResponse.ok) {
        handleAuthError(breakdownResponse);
        throw new Error(`Breakdown fetch failed: ${breakdownResponse.status}`);
      }
      
      const breakdownData = await breakdownResponse.json();
      setBreakdownData(breakdownData.data);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setTimeseriesError(errorMessage);
      setBreakdownError(errorMessage);
    } finally {
      setTimeseriesLoading(false);
      setBreakdownLoading(false);
    }
  },
  
  startRealTimeUpdates: (customApiUrl?: string) => {
    const { setRealTimeAutoRefresh, refreshIntervals } = get();
    
    const apiBaseUrl = customApiUrl || getApiBaseUrl();
    
    // Clear existing interval
    if (refreshIntervals.realTime) {
      clearInterval(refreshIntervals.realTime);
    }
    
    // Start real-time updates every 30 seconds
    const interval = setInterval(async () => {
      try {
        const response = await authenticatedFetch(`${apiBaseUrl}/api/v1/analytics/real-time?metrics=emissions,energy,intensity`);
        
        if (response.ok) {
          const data = await response.json();
          get().setRealTimeData(data.data);
          get().setRealTimeError(null);
        } else {
          handleAuthError(response);
        }
      } catch (error) {
        console.error('Real-time update failed:', error);
        get().setRealTimeError(error instanceof Error ? error.message : 'Real-time update failed');
      }
    }, 30000);
    
    setRealTimeAutoRefresh(true);
    set({ refreshIntervals: { ...refreshIntervals, realTime: interval } });
  },
  
  stopRealTimeUpdates: () => {
    const { refreshIntervals, setRealTimeAutoRefresh } = get();
    
    if (refreshIntervals.realTime) {
      clearInterval(refreshIntervals.realTime);
      set({ refreshIntervals: { ...refreshIntervals, realTime: null } });
    }
    
    setRealTimeAutoRefresh(false);
  },
  
  fetchBenchmarkData: async (industry = 'general', metric = 'carbon_intensity', customApiUrl?: string) => {
    const { setBenchmarkLoading, setBenchmarkError, setBenchmarkData } = get();
    
    const apiBaseUrl = customApiUrl || getApiBaseUrl();
    
    try {
      setBenchmarkLoading(true);
      setBenchmarkError(null);
      
      const response = await authenticatedFetch(`${apiBaseUrl}/api/v1/analytics/benchmarking?industry=${industry}&metric=${metric}`);
      
      if (!response.ok) {
        handleAuthError(response);
        throw new Error(`Benchmarking fetch failed: ${response.status}`);
      }
      
      const data = await response.json();
      setBenchmarkData(data.data);
      
    } catch (error) {
      setBenchmarkError(error instanceof Error ? error.message : 'Failed to fetch benchmarking data');
    } finally {
      setBenchmarkLoading(false);
    }
  },
  
  fetchPredictions: async (months = 6, algorithm = 'linear_trend', customApiUrl?: string) => {
    const { setPredictionsLoading, setPredictionsError, setPredictionsData } = get();
    
    const apiBaseUrl = customApiUrl || getApiBaseUrl();
    
    try {
      setPredictionsLoading(true);
      setPredictionsError(null);
      
      const response = await authenticatedFetch(`${apiBaseUrl}/api/v1/analytics/predictions?months=${months}&algorithm=${algorithm}`);
      
      if (!response.ok) {
        handleAuthError(response);
        throw new Error(`Predictions fetch failed: ${response.status}`);
      }
      
      const data = await response.json();
      setPredictionsData(data.data);
      
    } catch (error) {
      setPredictionsError(error instanceof Error ? error.message : 'Failed to fetch predictions');
    } finally {
      setPredictionsLoading(false);
    }
  },
  
  fetchAlerts: async (status = 'active', severity?, customApiUrl?: string) => {
    const { setAlertsLoading, setAlertsError, setAlertsData } = get();
    
    const apiBaseUrl = customApiUrl || getApiBaseUrl();
    
    try {
      setAlertsLoading(true);
      setAlertsError(null);
      
      const params = new URLSearchParams();
      params.append('status', status);
      if (severity) params.append('severity', severity);
      
      const response = await authenticatedFetch(`${apiBaseUrl}/api/v1/analytics/alerts?${params}`);
      
      if (!response.ok) {
        handleAuthError(response);
        throw new Error(`Alerts fetch failed: ${response.status}`);
      }
      
      const data = await response.json();
      setAlertsData(data.data);
      
    } catch (error) {
      setAlertsError(error instanceof Error ? error.message : 'Failed to fetch alerts');
    } finally {
      setAlertsLoading(false);
    }
  }
}));
