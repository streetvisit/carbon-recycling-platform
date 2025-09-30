// types/initiatives.ts - TypeScript interfaces for Module 4

export interface Initiative {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  status: 'planning' | 'in_progress' | 'completed' | 'on_hold';
  startDate?: string; // ISO date string
  endDate?: string; // ISO date string
  estimatedCost?: number;
  projectedCo2eReduction?: number; // tonnes per year
  createdAt: string;
}

export interface EmissionForecast {
  id: string;
  initiativeId: string;
  organizationId: string;
  forecastDate: string; // ISO date string
  projectedCo2e: number; // tonnes
  isBaseline: boolean;
  createdAt: string;
}

export interface CreateInitiativeRequest {
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

export interface UpdateInitiativeRequest {
  name?: string;
  description?: string;
  status?: 'planning' | 'in_progress' | 'completed' | 'on_hold';
  startDate?: string;
  endDate?: string;
  estimatedCost?: number;
}

export interface InitiativeWithForecasts extends Initiative {
  forecasts: EmissionForecast[];
}

export interface ReductionTarget {
  category: string;
  percentage: number;
}