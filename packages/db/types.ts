export interface Organization {
  id: string;
  name: string;
  createdAt: Date;
}

export interface User {
  id: string;
  organizationId: string;
  email: string;
  role: 'admin' | 'member';
  createdAt: Date;
}

export interface DataSource {
  id: string;
  organizationId: string;
  type: 'api_integration' | 'file_upload' | 'manual_entry';
  provider: string;
  status: 'active' | 'pending' | 'error';
  lastSyncedAt: Date | null;
  createdAt: Date;
}

export interface SourceCredentials {
  dataSourceId: string;
  encryptedCredentials: string;
}

export interface CreateDataSourceRequest {
  type: 'api_integration' | 'file_upload' | 'manual_entry';
  provider: string;
}

export interface DataSourceResponse {
  id: string;
  provider: string;
  type: string;
  status: string;
  lastSyncedAt: string | null;
}

// Module 2: Emissions Calculation Engine Types

export interface ActivityData {
  id: string;
  dataSourceId: string;
  organizationId: string;
  activityType: string;
  value: number;
  unit: string;
  startDate: Date;
  endDate: Date;
  isProcessed: boolean;
  createdAt: Date;
}

export interface CalculatedEmissions {
  id: string;
  activityDataId: string;
  organizationId: string;
  ghgScope: 'scope_1' | 'scope_2' | 'scope_3';
  category: string;
  co2e: number;
  emissionFactorSource: string;
  calculationDate: Date;
}

export interface CreateActivityDataRequest {
  dataSourceId: string;
  activityType: string;
  value: number;
  unit: string;
  startDate: string;
  endDate: string;
}

export interface EmissionsSummary {
  totalCo2e: number;
  byScope: {
    scope_1: number;
    scope_2: number;
    scope_3: number;
  };
  period: {
    start: string;
    end: string;
  };
}

export interface EmissionFactor {
  value: number;
  unit: string;
  region: string;
  source: string;
}

// Module 3: Analytics Dashboard Types

export interface TimeseriesDataPoint {
  date: string;
  totalCo2e: number;
}

export interface TimeseriesResponse {
  data: TimeseriesDataPoint[];
}

export interface BreakdownDataPoint {
  category: string;
  scope: 'scope_1' | 'scope_2' | 'scope_3';
  totalCo2e: number;
  percentage: number;
}

export interface BreakdownResponse {
  data: BreakdownDataPoint[];
}

export interface AnalyticsFilters {
  period: string; // e.g., '12m', '24m', 'ytd'
  scope?: 'scope_1' | 'scope_2' | 'scope_3';
  groupBy?: 'month' | 'quarter';
  sortBy?: 'co2e_desc' | 'co2e_asc';
  limit?: number;
}
