/**
 * Database Service
 * 
 * Real database operations using PlanetScale connection
 */

import { createConnectionFromEnv, generateId } from '../../../../packages/db/connection';
import type { Connection } from '@planetscale/database';

export interface ActivityData {
  id: string;
  dataSourceId: string;
  organizationId: string;
  activityType: string;
  value: number;
  unit: string;
  startDate: string;
  endDate: string;
  isProcessed: boolean;
  createdAt: string;
}

export interface CalculatedEmissions {
  id: string;
  activityDataId: string;
  organizationId: string;
  ghgScope: 'scope_1' | 'scope_2' | 'scope_3';
  category: string;
  co2e: number;
  emissionFactorSource: string;
  calculationDate: string;
}

export interface Organization {
  id: string;
  name: string;
  createdAt: string;
}

export interface DataSource {
  id: string;
  organizationId: string;
  type: 'api_integration' | 'file_upload' | 'manual_entry';
  provider: string;
  status: 'active' | 'pending' | 'error';
  lastSyncedAt: string | null;
  createdAt: string;
}

let connection: Connection | null = null;

function getConnection(env: any): Connection {
  if (!connection) {
    connection = createConnectionFromEnv(env);
  }
  return connection;
}

// Organization operations
export async function createOrganization(env: any, name: string): Promise<Organization> {
  const conn = getConnection(env);
  const id = generateId('org');
  const createdAt = new Date().toISOString();
  
  await conn.execute(
    'INSERT INTO organizations (id, name, createdAt) VALUES (?, ?, ?)',
    [id, name, createdAt]
  );

  return { id, name, createdAt };
}

export async function getOrganizationById(env: any, id: string): Promise<Organization | null> {
  const conn = getConnection(env);
  const results = await conn.execute('SELECT * FROM organizations WHERE id = ?', [id]);
  
  return results.rows.length > 0 ? results.rows[0] as Organization : null;
}

// Data source operations
export async function createDataSource(env: any, data: {
  organizationId: string;
  type: 'api_integration' | 'file_upload' | 'manual_entry';
  provider: string;
  status?: 'active' | 'pending' | 'error';
}): Promise<DataSource> {
  const conn = getConnection(env);
  const id = generateId('ds');
  const createdAt = new Date().toISOString();
  
  await conn.execute(
    'INSERT INTO data_sources (id, organizationId, type, provider, status, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
    [id, data.organizationId, data.type, data.provider, data.status || 'pending', createdAt]
  );

  return {
    id,
    organizationId: data.organizationId,
    type: data.type,
    provider: data.provider,
    status: data.status || 'pending',
    lastSyncedAt: null,
    createdAt
  };
}

export async function getDataSourcesByOrganization(env: any, organizationId: string): Promise<DataSource[]> {
  const conn = getConnection(env);
  const results = await conn.execute(
    'SELECT * FROM data_sources WHERE organizationId = ? ORDER BY createdAt DESC',
    [organizationId]
  );
  
  return results.rows as DataSource[];
}

export async function deleteDataSource(env: any, id: string): Promise<boolean> {
  const conn = getConnection(env);
  const result = await conn.execute('DELETE FROM data_sources WHERE id = ?', [id]);
  
  return result.rowsAffected > 0;
}

// Activity data operations
export async function createActivityData(env: any, data: {
  dataSourceId: string;
  organizationId: string;
  activityType: string;
  value: number;
  unit: string;
  startDate: string;
  endDate: string;
}): Promise<ActivityData> {
  const conn = getConnection(env);
  const id = generateId('act');
  const createdAt = new Date().toISOString();
  
  await conn.execute(
    'INSERT INTO activity_data (id, dataSourceId, organizationId, activityType, value, unit, startDate, endDate, isProcessed, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, data.dataSourceId, data.organizationId, data.activityType, data.value, data.unit, data.startDate, data.endDate, false, createdAt]
  );

  return {
    id,
    ...data,
    isProcessed: false,
    createdAt
  };
}

export async function getActivityDataById(env: any, id: string): Promise<ActivityData | null> {
  const conn = getConnection(env);
  const results = await conn.execute('SELECT * FROM activity_data WHERE id = ?', [id]);
  
  return results.rows.length > 0 ? results.rows[0] as ActivityData : null;
}

export async function getUnprocessedActivityData(env: any, organizationId: string): Promise<ActivityData[]> {
  const conn = getConnection(env);
  const results = await conn.execute(
    'SELECT * FROM activity_data WHERE organizationId = ? AND isProcessed = false ORDER BY createdAt ASC',
    [organizationId]
  );
  
  return results.rows as ActivityData[];
}

export async function markActivityDataAsProcessed(env: any, id: string): Promise<void> {
  const conn = getConnection(env);
  await conn.execute('UPDATE activity_data SET isProcessed = true WHERE id = ?', [id]);
}

// Calculated emissions operations
export async function saveCalculatedEmissions(env: any, emissions: Omit<CalculatedEmissions, 'id' | 'calculationDate'>): Promise<CalculatedEmissions> {
  const conn = getConnection(env);
  const id = generateId('em');
  const calculationDate = new Date().toISOString();
  
  await conn.execute(
    'INSERT INTO calculated_emissions (id, activityDataId, organizationId, ghgScope, category, co2e, emissionFactorSource, calculationDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, emissions.activityDataId, emissions.organizationId, emissions.ghgScope, emissions.category, emissions.co2e, emissions.emissionFactorSource, calculationDate]
  );

  return {
    id,
    ...emissions,
    calculationDate
  };
}

export async function getCalculatedEmissionsByOrganization(env: any, organizationId: string): Promise<CalculatedEmissions[]> {
  const conn = getConnection(env);
  const results = await conn.execute(
    'SELECT * FROM calculated_emissions WHERE organizationId = ? ORDER BY calculationDate DESC',
    [organizationId]
  );
  
  return results.rows as CalculatedEmissions[];
}

// Summary operations
export async function calculateEmissionsSummary(env: any, organizationId: string): Promise<{
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
}> {
  const conn = getConnection(env);
  const results = await conn.execute(
    'SELECT ghgScope, SUM(co2e) as total FROM calculated_emissions WHERE organizationId = ? GROUP BY ghgScope',
    [organizationId]
  );
  
  const summary = {
    totalCo2e: 0,
    byScope: {
      scope_1: 0,
      scope_2: 0,
      scope_3: 0,
    },
    period: {
      start: new Date().getFullYear() + '-01-01',
      end: new Date().getFullYear() + '-12-31',
    },
  };

  results.rows.forEach((row: any) => {
    const total = parseFloat(row.total);
    summary.totalCo2e += total;
    summary.byScope[row.ghgScope as keyof typeof summary.byScope] = Math.round(total * 100) / 100;
  });

  summary.totalCo2e = Math.round(summary.totalCo2e * 100) / 100;

  return summary;
}