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

// Analytics functions
export async function getEmissionsTimeseries(
  env: any,
  organizationId: string,
  filters: { period: string; scope: string; groupBy: string }
): Promise<any[]> {
  const db = getD1Database(env);
  
  // Calculate date range based on period
  const now = new Date()
  let startDate = new Date(now)
  
  switch (filters.period) {
    case '3m':
      startDate.setMonth(now.getMonth() - 3)
      break
    case '6m':
      startDate.setMonth(now.getMonth() - 6)
      break
    case '12m':
      startDate.setFullYear(now.getFullYear() - 1)
      break
    case '24m':
      startDate.setFullYear(now.getFullYear() - 2)
      break
    default:
      startDate.setFullYear(now.getFullYear() - 1)
  }
  
  let query = `
    SELECT 
      DATE(calculationDate) as date,
      SUM(co2e) as totalCo2e,
      ghgScope,
      category
    FROM calculated_emissions 
    WHERE organizationId = ? 
      AND calculationDate >= ?
  `
  
  const params = [organizationId, startDate.toISOString().split('T')[0]]
  
  if (filters.scope !== 'all') {
    query += ' AND ghgScope = ?'
    params.push(filters.scope)
  }
  
  query += ' GROUP BY DATE(calculationDate), ghgScope, category ORDER BY date ASC'
  
  const result = await db.prepare(query).bind(...params).all()
  
  // Group by date and sum totals
  const grouped = result.results?.reduce((acc: any, row: any) => {
    const date = row.date
    if (!acc[date]) {
      acc[date] = { date, totalCo2e: 0 }
    }
    acc[date].totalCo2e += row.totalCo2e || 0
    return acc
  }, {})
  
  return Object.values(grouped || {})
}

export async function getEmissionsBreakdown(
  env: any,
  organizationId: string,
  filters: { period: string; scope: string; sortBy: string; limit: number }
): Promise<any[]> {
  const db = getD1Database(env);
  
  const now = new Date()
  let startDate = new Date(now)
  
  switch (filters.period) {
    case '3m':
      startDate.setMonth(now.getMonth() - 3)
      break
    case '6m':
      startDate.setMonth(now.getMonth() - 6)
      break
    case '12m':
      startDate.setFullYear(now.getFullYear() - 1)
      break
    default:
      startDate.setFullYear(now.getFullYear() - 1)
  }
  
  let query = `
    SELECT 
      category,
      ghgScope as scope,
      SUM(co2e) as totalCo2e,
      COUNT(*) as count
    FROM calculated_emissions 
    WHERE organizationId = ? 
      AND calculationDate >= ?
  `
  
  const params = [organizationId, startDate.toISOString().split('T')[0]]
  
  if (filters.scope !== 'all') {
    query += ' AND ghgScope = ?'
    params.push(filters.scope)
  }
  
  query += ' GROUP BY category, ghgScope'
  
  if (filters.sortBy === 'co2e_desc') {
    query += ' ORDER BY totalCo2e DESC'
  } else if (filters.sortBy === 'co2e_asc') {
    query += ' ORDER BY totalCo2e ASC'
  }
  
  query += ` LIMIT ${filters.limit}`
  
  const result = await db.prepare(query).bind(...params).all()
  
  // Calculate total for percentage
  const total = result.results?.reduce((sum: number, row: any) => sum + (row.totalCo2e || 0), 0) || 0
  
  return result.results?.map((row: any) => ({
    category: row.category,
    scope: row.scope,
    totalCo2e: Math.round((row.totalCo2e || 0) * 100) / 100,
    percentage: total > 0 ? Math.round(((row.totalCo2e || 0) / total) * 1000) / 10 : 0
  })) || []
}

export async function getIndustryBenchmarks(
  env: any,
  organizationId: string,
  industry: string,
  metric: string
): Promise<any> {
  // Get organization's current metrics
  const orgMetrics = await calculateEmissionsSummary(env, organizationId)
  
  // Industry benchmarks (this would typically come from a benchmarks table)
  const benchmarks: any = {
    general: {
      carbon_intensity: {
        percentile_25: 0.15,
        percentile_50: 0.28,
        percentile_75: 0.42,
        percentile_90: 0.65,
        unit: 'tCO2e/£k revenue'
      },
      total_emissions: {
        percentile_25: 850,
        percentile_50: 1250,
        percentile_75: 1850,
        percentile_90: 2500,
        unit: 'tCO2e'
      }
    },
    manufacturing: {
      carbon_intensity: {
        percentile_25: 0.25,
        percentile_50: 0.45,
        percentile_75: 0.68,
        percentile_90: 0.95,
        unit: 'tCO2e/£k revenue'
      }
    },
    services: {
      carbon_intensity: {
        percentile_25: 0.08,
        percentile_50: 0.15,
        percentile_75: 0.25,
        percentile_90: 0.38,
        unit: 'tCO2e/£k revenue'
      }
    }
  }
  
  const industryData = benchmarks[industry] || benchmarks.general
  const metricData = industryData[metric]
  
  if (!metricData) {
    return { error: 'Metric not found' }
  }
  
  // Calculate user's percentile position
  let userValue = 0
  if (metric === 'carbon_intensity') {
    userValue = 0.34 // Mock value - would calculate from orgMetrics
  } else if (metric === 'total_emissions') {
    userValue = orgMetrics.totalCo2e || 0
  }
  
  let percentileRank = 0
  if (userValue <= metricData.percentile_25) percentileRank = 25
  else if (userValue <= metricData.percentile_50) percentileRank = 50
  else if (userValue <= metricData.percentile_75) percentileRank = 75
  else if (userValue <= metricData.percentile_90) percentileRank = 90
  else percentileRank = 95
  
  return {
    industry,
    metric,
    userValue,
    percentileRank,
    benchmarks: metricData,
    comparison: {
      vsMedian: userValue - metricData.percentile_50,
      vsTopQuartile: userValue - metricData.percentile_25
    }
  }
}

export async function generateEmissionsPredictions(
  env: any,
  organizationId: string,
  months: number,
  algorithm: string
): Promise<any[]> {
  // Get historical data for the last 12 months
  const historicalData = await getEmissionsTimeseries(env, organizationId, {
    period: '12m',
    scope: 'all',
    groupBy: 'month'
  })
  
  if (historicalData.length < 3) {
    throw new Error('Insufficient historical data for predictions')
  }
  
  const predictions = []
  const lastDataPoint = historicalData[historicalData.length - 1]
  const lastValue = lastDataPoint.totalCo2e
  
  // Simple linear trend prediction
  if (algorithm === 'linear_trend' && historicalData.length >= 2) {
    const firstValue = historicalData[0].totalCo2e
    const trend = (lastValue - firstValue) / (historicalData.length - 1)
    
    for (let i = 1; i <= months; i++) {
      const futureDate = new Date(lastDataPoint.date)
      futureDate.setMonth(futureDate.getMonth() + i)
      
      predictions.push({
        date: futureDate.toISOString().split('T')[0],
        predictedCo2e: Math.max(0, Math.round((lastValue + (trend * i)) * 100) / 100),
        confidence: Math.max(0.3, 0.9 - (i * 0.1)),
        algorithm: 'linear_trend'
      })
    }
  }
  
  // Seasonal prediction (simple)
  if (algorithm === 'seasonal' && historicalData.length >= 6) {
    const monthlyAverages: { [key: number]: number[] } = {}
    
    historicalData.forEach(point => {
      const month = new Date(point.date).getMonth()
      if (!monthlyAverages[month]) monthlyAverages[month] = []
      monthlyAverages[month].push(point.totalCo2e)
    })
    
    Object.keys(monthlyAverages).forEach(month => {
      const values = monthlyAverages[parseInt(month)]
      monthlyAverages[parseInt(month)] = values.reduce((a, b) => a + b, 0) / values.length
    })
    
    for (let i = 1; i <= months; i++) {
      const futureDate = new Date(lastDataPoint.date)
      futureDate.setMonth(futureDate.getMonth() + i)
      const month = futureDate.getMonth()
      
      const seasonalValue = monthlyAverages[month] || lastValue
      
      predictions.push({
        date: futureDate.toISOString().split('T')[0],
        predictedCo2e: Math.round(seasonalValue * 100) / 100,
        confidence: 0.7,
        algorithm: 'seasonal'
      })
    }
  }
  
  return predictions
}

export async function getAnalyticsAlerts(
  env: any,
  organizationId: string,
  filters: { status: string; severity?: string }
): Promise<any[]> {
  // Mock alerts - in real implementation, these would be stored in database
  const mockAlerts = [
    {
      id: '1',
      type: 'threshold_exceeded',
      severity: 'high',
      status: 'active',
      title: 'Monthly emissions target exceeded',
      message: 'Current month emissions are 15% above target threshold',
      timestamp: new Date().toISOString(),
      metric: 'monthly_emissions',
      value: 125.4,
      threshold: 109.0
    },
    {
      id: '2',
      type: 'anomaly_detected',
      severity: 'medium',
      status: 'active',
      title: 'Unusual energy consumption pattern',
      message: 'Energy usage is 22% higher than typical for this time period',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      metric: 'energy_consumption',
      value: 2840,
      threshold: 2300
    },
    {
      id: '3',
      type: 'trend_alert',
      severity: 'low',
      status: 'active',
      title: 'Positive trend in renewable energy',
      message: 'Renewable energy percentage has increased 5% this quarter',
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      metric: 'renewable_percentage',
      value: 73,
      threshold: 70
    }
  ]
  
  let filtered = mockAlerts.filter(alert => alert.status === filters.status)
  
  if (filters.severity) {
    filtered = filtered.filter(alert => alert.severity === filters.severity)
  }
  
  return filtered
}

export async function getRealTimeMetrics(
  env: any,
  organizationId: string,
  metrics: string[]
): Promise<any> {
  // Mock real-time data - in real implementation, this would come from live data streams
  const currentTime = new Date().toISOString()
  
  const realtimeData: any = {
    timestamp: currentTime,
    organizationId,
    metrics: {}
  }
  
  if (metrics.includes('emissions')) {
    realtimeData.metrics.emissions = {
      current: 125.4,
      trend: -2.3,
      unit: 'tCO2e',
      status: 'warning',
      lastUpdated: currentTime
    }
  }
  
  if (metrics.includes('energy')) {
    realtimeData.metrics.energy = {
      current: 2840,
      trend: 5.2,
      unit: 'kWh',
      status: 'normal',
      lastUpdated: currentTime
    }
  }
  
  if (metrics.includes('intensity')) {
    realtimeData.metrics.intensity = {
      current: 0.34,
      trend: -1.8,
      unit: 'kgCO2e/£',
      status: 'good',
      lastUpdated: currentTime
    }
  }
  
  return realtimeData
}
