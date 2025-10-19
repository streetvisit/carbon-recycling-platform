// stores/reportsStore.ts - State management for the reports module

import { create } from 'zustand';
import { authenticatedFetch, getApiBaseUrl, handleAuthError } from '../utils/auth';

export interface Report {
  id: string;
  organizationId: string;
  reportType: string;
  reportingPeriodStart: string;
  reportingPeriodEnd: string;
  status: 'generating' | 'complete' | 'failed';
  fileUrl?: string;
  version: number;
  generatedAt: string;
}

export interface ReportType {
  type: string;
  name: string;
  description: string;
}

export interface CreateReportData {
  reportType: string;
  reportingPeriodStart: string;
  reportingPeriodEnd: string;
}

interface ReportsState {
  // Data state
  reports: Report[];
  reportTypes: ReportType[];
  
  // UI state
  loading: boolean;
  error: string | null;
  isGenerating: boolean;
  
  // Actions
  setReports: (reports: Report[]) => void;
  addReport: (report: Report) => void;
  updateReport: (id: string, updates: Partial<Report>) => void;
  setReportTypes: (types: ReportType[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setIsGenerating: (generating: boolean) => void;
  
  // API functions
  fetchReports: (apiBaseUrl?: string) => Promise<void>;
  fetchReportTypes: (apiBaseUrl?: string) => Promise<void>;
  createReport: (data: CreateReportData, apiBaseUrl?: string) => Promise<void>;
  downloadReport: (id: string, apiBaseUrl?: string) => Promise<void>;
  
  // Polling functionality for report status updates
  startPolling: (apiBaseUrl?: string) => void;
  stopPolling: () => void;
  
  // Utility functions
  resetState: () => void;
}

let pollingInterval: NodeJS.Timeout | null = null;

export const useReportsStore = create<ReportsState>((set, get) => ({
  // Initial state
  reports: [],
  reportTypes: [],
  loading: false,
  error: null,
  isGenerating: false,
  
  // Basic setters
  setReports: (reports) => set({ reports }),
  addReport: (report) => set(state => ({ 
    reports: [report, ...state.reports] 
  })),
  updateReport: (id, updates) => set(state => ({
    reports: state.reports.map(report => 
      report.id === id ? { ...report, ...updates } : report
    )
  })),
  setReportTypes: (types) => set({ reportTypes: types }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setIsGenerating: (generating) => set({ isGenerating: generating }),
  
  // API functions
  fetchReports: async (customApiUrl?: string) => {
    const { setLoading, setError } = get();
    
    const apiBaseUrl = customApiUrl || getApiBaseUrl();
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await authenticatedFetch(`${apiBaseUrl}/api/v1/reports`);
      
      if (!response.ok) {
        handleAuthError(response);
        throw new Error(`Failed to fetch reports: ${response.status}`);
      }
      
      const data = await response.json();
      set({ reports: data.data });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to fetch reports');
    } finally {
      setLoading(false);
    }
  },
  
  fetchReportTypes: async (customApiUrl?: string) => {
    const { setError } = get();
    
    const apiBaseUrl = customApiUrl || getApiBaseUrl();
    
    try {
      const response = await authenticatedFetch(`${apiBaseUrl}/api/v1/report-types`);
      
      if (!response.ok) {
        handleAuthError(response);
        throw new Error(`Failed to fetch report types: ${response.status}`);
      }
      
      const data = await response.json();
      set({ reportTypes: data.data });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to fetch report types');
    }
  },
  
  createReport: async (data: CreateReportData, customApiUrl?: string) => {
    const { setIsGenerating, setError, addReport } = get();
    
    const apiBaseUrl = customApiUrl || getApiBaseUrl();
    
    setIsGenerating(true);
    setError(null);
    
    try {
      const response = await authenticatedFetch(`${apiBaseUrl}/api/v1/reports`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        handleAuthError(response);
        throw new Error(`Failed to create report: ${response.status}`);
      }
      
      const newReport = await response.json();
      addReport(newReport);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create report');
    } finally {
      setIsGenerating(false);
    }
  },
  
  downloadReport: async (id: string, customApiUrl?: string) => {
    const { setError } = get();
    
    const apiBaseUrl = customApiUrl || getApiBaseUrl();
    
    try {
      // Create a direct link to the download endpoint
      const downloadUrl = `${apiBaseUrl}/api/v1/reports/${id}/download`;
      
      // Open in new tab/window for download
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.target = '_blank';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to download report');
    }
  },
  
  // Polling functionality
  startPolling: (customApiUrl?: string) => {
    const { stopPolling, fetchReports } = get();
    
    const apiBaseUrl = customApiUrl || getApiBaseUrl();
    
    // Clear any existing polling
    stopPolling();
    
    // Start new polling every 10 seconds
    pollingInterval = setInterval(() => {
      const { reports } = get();
      
      // Only poll if we have reports that are still generating
      const hasGeneratingReports = reports.some(report => report.status === 'generating');
      
      if (hasGeneratingReports) {
        fetchReports(apiBaseUrl);
      } else {
        // Stop polling if no reports are generating
        stopPolling();
      }
    }, 10000); // 10 seconds
  },
  
  stopPolling: () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
  },
  
  resetState: () => {
    const { stopPolling } = get();
    stopPolling();
    set({
      reports: [],
      reportTypes: [],
      loading: false,
      error: null,
      isGenerating: false,
    });
  }
}));