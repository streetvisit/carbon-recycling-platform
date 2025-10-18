/**
 * D1 Database Service - FREE Cloudflare SQLite Database
 * 
 * This replaces PlanetScale with Cloudflare's free D1 database
 */

import { getD1Database, generateId } from '../../../../packages/db/d1-connection';
import type { D1Database } from '../../../../packages/db/d1-connection';

export interface ActivityData {
  id: string;
  dataSourceId: string;
  organizationId: string;
  activityType: string;
  value: number;
  unit: string;
  startDate: string;
  endDate: string;
  isProcessed: number; // SQLite uses 0/1 for boolean
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

// Organization operations
export async function createOrganization(env: any, name: string): Promise<Organization> {
  const db = getD1Database(env);
  const id = generateId('org');
  const createdAt = new Date().toISOString();
  
  await db.prepare(
    'INSERT INTO organizations (id, name, createdAt) VALUES (?, ?, ?)'
  ).bind(id, name, createdAt).run();

  return { id, name, createdAt };
}

export async function getOrganizationById(env: any, id: string): Promise<Organization | null> {
  const db = getD1Database(env);
  const result = await db.prepare('SELECT * FROM organizations WHERE id = ?').bind(id).first();
  
  return result ? result as Organization : null;
}

// Data source operations
export async function createDataSource(env: any, data: {
  organizationId: string;
  type: 'api_integration' | 'file_upload' | 'manual_entry';
  provider: string;
  status?: 'active' | 'pending' | 'error';
}): Promise<DataSource> {
  const db = getD1Database(env);
  const id = generateId('ds');
  const createdAt = new Date().toISOString();
  const status = data.status || 'pending';
  
  await db.prepare(
    'INSERT INTO data_sources (id, organizationId, type, provider, status, createdAt) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(id, data.organizationId, data.type, data.provider, status, createdAt).run();

  return {
    id,
    organizationId: data.organizationId,
    type: data.type,
    provider: data.provider,
    status,
    lastSyncedAt: null,
    createdAt
  };
}

export async function getDataSourcesByOrganization(env: any, organizationId: string): Promise<DataSource[]> {
  const db = getD1Database(env);
  const result = await db.prepare(
    'SELECT * FROM data_sources WHERE organizationId = ? ORDER BY createdAt DESC'
  ).bind(organizationId).all();
  
  return result.results as DataSource[];
}

export async function deleteDataSource(env: any, id: string): Promise<boolean> {
  const db = getD1Database(env);
  const result = await db.prepare('DELETE FROM data_sources WHERE id = ?').bind(id).run();
  
  return result.meta.changes > 0;
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
  const db = getD1Database(env);
  const id = generateId('act');
  const createdAt = new Date().toISOString();
  
  await db.prepare(
    'INSERT INTO activity_data (id, dataSourceId, organizationId, activityType, value, unit, startDate, endDate, isProcessed, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, data.dataSourceId, data.organizationId, data.activityType, data.value, data.unit, data.startDate, data.endDate, 0, createdAt).run();

  return {
    id,
    ...data,
    isProcessed: 0,
    createdAt
  };
}

export async function getActivityDataById(env: any, id: string): Promise<ActivityData | null> {
  const db = getD1Database(env);
  const result = await db.prepare('SELECT * FROM activity_data WHERE id = ?').bind(id).first();
  
  return result ? result as ActivityData : null;
}

export async function getUnprocessedActivityData(env: any, organizationId: string): Promise<ActivityData[]> {
  const db = getD1Database(env);
  const result = await db.prepare(
    'SELECT * FROM activity_data WHERE organizationId = ? AND isProcessed = 0 ORDER BY createdAt ASC'
  ).bind(organizationId).all();
  
  return result.results as ActivityData[];
}

export async function markActivityDataAsProcessed(env: any, id: string): Promise<void> {
  const db = getD1Database(env);
  await db.prepare('UPDATE activity_data SET isProcessed = 1 WHERE id = ?').bind(id).run();
}

// Calculated emissions operations
export async function saveCalculatedEmissions(env: any, emissions: Omit<CalculatedEmissions, 'id' | 'calculationDate'>): Promise<CalculatedEmissions> {
  const db = getD1Database(env);
  const id = generateId('em');
  const calculationDate = new Date().toISOString();
  
  await db.prepare(
    'INSERT INTO calculated_emissions (id, activityDataId, organizationId, ghgScope, category, co2e, emissionFactorSource, calculationDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, emissions.activityDataId, emissions.organizationId, emissions.ghgScope, emissions.category, emissions.co2e, emissions.emissionFactorSource, calculationDate).run();

  return {
    id,
    ...emissions,
    calculationDate
  };
}

export async function getCalculatedEmissionsByOrganization(env: any, organizationId: string): Promise<CalculatedEmissions[]> {
  const db = getD1Database(env);
  const result = await db.prepare(
    'SELECT * FROM calculated_emissions WHERE organizationId = ? ORDER BY calculationDate DESC'
  ).bind(organizationId).all();
  
  return result.results as CalculatedEmissions[];
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
  const db = getD1Database(env);
  const result = await db.prepare(
    'SELECT ghgScope, SUM(co2e) as total FROM calculated_emissions WHERE organizationId = ? GROUP BY ghgScope'
  ).bind(organizationId).all();
  
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

  if (result.results) {
    result.results.forEach((row: any) => {
      const total = parseFloat(row.total);
      summary.totalCo2e += total;
      summary.byScope[row.ghgScope as keyof typeof summary.byScope] = Math.round(total * 100) / 100;
    });
  }

  summary.totalCo2e = Math.round(summary.totalCo2e * 100) / 100;

  return summary;
}