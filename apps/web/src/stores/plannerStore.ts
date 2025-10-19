// stores/plannerStore.ts - State management for the decarbonisation planner

import { create } from 'zustand';

export interface Initiative {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  status: 'planning' | 'in_progress' | 'completed' | 'on_hold';
  startDate?: string;
  endDate?: string;
  estimatedCost?: number;
  projectedCo2eReduction?: number;
  createdAt: string;
}

export interface EmissionForecast {
  id: string;
  initiativeId: string;
  organizationId: string;
  forecastDate: string;
  projectedCo2e: number;
  isBaseline: boolean;
  createdAt: string;
}

export interface InitiativeWithForecasts extends Initiative {
  forecasts: EmissionForecast[];
}

export interface Category {
  category: string;
  totalCo2e: number;
}

export interface CreateInitiativeData {
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  estimatedCost?: number;
  reductionTarget: {
    category: string;
    percentage: number;
  };
}

interface PlannerState {
  // Data state
  initiatives: Initiative[];
  selectedInitiative: InitiativeWithForecasts | null;
  categories: Category[];
  
  // UI state
  loading: boolean;
  error: string | null;
  showCreateModal: boolean;
  
  // Actions for initiatives
  setInitiatives: (initiatives: Initiative[]) => void;
  addInitiative: (initiative: Initiative) => void;
  updateInitiativeInList: (id: string, updates: Partial<Initiative>) => void;
  removeInitiative: (id: string) => void;
  
  // Actions for selected initiative
  setSelectedInitiative: (initiative: InitiativeWithForecasts | null) => void;
  
  // Actions for categories
  setCategories: (categories: Category[]) => void;
  
  // UI actions
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setShowCreateModal: (show: boolean) => void;
  
  // API functions
  fetchInitiatives: (apiBaseUrl?: string) => Promise<void>;
  fetchCategories: (apiBaseUrl?: string) => Promise<void>;
  fetchInitiativeDetails: (id: string, apiBaseUrl?: string) => Promise<void>;
  createInitiative: (data: CreateInitiativeData, apiBaseUrl?: string) => Promise<void>;
  updateInitiative: (id: string, updates: Partial<Initiative>, apiBaseUrl?: string) => Promise<void>;
  deleteInitiative: (id: string, apiBaseUrl?: string) => Promise<void>;
  
  // Utility functions
  resetState: () => void;
}

export const usePlannerStore = create<PlannerState>((set, get) => ({
  // Initial state
  initiatives: [],
  selectedInitiative: null,
  categories: [],
  loading: false,
  error: null,
  showCreateModal: false,
  
  // Basic setters
  setInitiatives: (initiatives) => set({ initiatives }),
  addInitiative: (initiative) => set(state => ({ 
    initiatives: [...state.initiatives, initiative] 
  })),
  updateInitiativeInList: (id, updates) => set(state => ({
    initiatives: state.initiatives.map(init => 
      init.id === id ? { ...init, ...updates } : init
    )
  })),
  removeInitiative: (id) => set(state => ({
    initiatives: state.initiatives.filter(init => init.id !== id),
    selectedInitiative: state.selectedInitiative?.id === id ? null : state.selectedInitiative
  })),
  
  setSelectedInitiative: (initiative) => set({ selectedInitiative: initiative }),
  setCategories: (categories) => set({ categories }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setShowCreateModal: (show) => set({ showCreateModal: show }),
  
  // API functions
  fetchInitiatives: async (apiBaseUrl = 'http://localhost:8787') => {
    const { setLoading, setError, setInitiatives } = get();
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/initiatives`, {
        headers: {
          'Authorization': 'Bearer mock-token',
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch initiatives: ${response.status}`);
      }
      
      const data = await response.json();
      setInitiatives(data.data);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to fetch initiatives');
    } finally {
      setLoading(false);
    }
  },
  
  fetchCategories: async (apiBaseUrl = 'http://localhost:8787') => {
    const { setError, setCategories } = get();
    
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/categories`, {
        headers: {
          'Authorization': 'Bearer mock-token',
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch categories: ${response.status}`);
      }
      
      const data = await response.json();
      setCategories(data.data);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to fetch categories');
    }
  },
  
  fetchInitiativeDetails: async (id: string, apiBaseUrl = 'http://localhost:8787') => {
    const { setLoading, setError, setSelectedInitiative } = get();
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/initiatives/${id}`, {
        headers: {
          'Authorization': 'Bearer mock-token',
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch initiative: ${response.status}`);
      }
      
      const initiative = await response.json();
      setSelectedInitiative(initiative);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to fetch initiative');
    } finally {
      setLoading(false);
    }
  },
  
  createInitiative: async (data: CreateInitiativeData, apiBaseUrl = 'http://localhost:8787') => {
    const { setLoading, setError, addInitiative, setShowCreateModal } = get();
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/initiatives`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer mock-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create initiative: ${response.status}`);
      }
      
      const newInitiative = await response.json();
      addInitiative(newInitiative);
      setShowCreateModal(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create initiative');
    } finally {
      setLoading(false);
    }
  },
  
  updateInitiative: async (id: string, updates: Partial<Initiative>, apiBaseUrl = 'http://localhost:8787') => {
    const { setLoading, setError, updateInitiativeInList } = get();
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/initiatives/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': 'Bearer mock-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update initiative: ${response.status}`);
      }
      
      const updatedInitiative = await response.json();
      updateInitiativeInList(id, updatedInitiative);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update initiative');
    } finally {
      setLoading(false);
    }
  },
  
  deleteInitiative: async (id: string, apiBaseUrl = 'http://localhost:8787') => {
    const { setLoading, setError, removeInitiative } = get();
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/initiatives/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer mock-token',
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete initiative: ${response.status}`);
      }
      
      removeInitiative(id);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to delete initiative');
    } finally {
      setLoading(false);
    }
  },
  
  resetState: () => set({
    initiatives: [],
    selectedInitiative: null,
    categories: [],
    loading: false,
    error: null,
    showCreateModal: false,
  })
}));