/**
 * Data Synchronization Worker
 * 
 * Handles automated data synchronization from various integrations:
 * - Energy supplier APIs (EDF Energy, British Gas, etc.)
 * - Cloud providers (AWS CloudWatch, Azure Monitor)
 * - File uploads and manual entries
 * - Third-party carbon tracking services
 */

import { getD1Database } from '../../../../../packages/db/d1-connection';
import * as db from '../services/d1DatabaseService';
import { getEmissionFactor } from '../services/emissionFactors';
import { EnergySupplierConnector } from '../integrations/energySupplierConnector';
import { AWSCloudWatchConnector } from '../integrations/awsConnector';

export interface SyncJobResult {
  success: boolean;
  recordsProcessed: number;
  recordsCreated: number;
  errors: string[];
  lastSyncedAt: string;
}

export interface DataSourceConfig {
  id: string;
  organizationId: string;
  type: 'api_integration' | 'file_upload' | 'manual_entry';
  provider: string;
  credentials?: any;
  lastSyncedAt?: string;
}

/**
 * Main sync worker entry point - called by Cloudflare Scheduled Events
 */
export async function handleScheduledSync(env: any): Promise<void> {
  console.log('Starting scheduled data synchronization...');
  
  try {
    // Get all active data sources that need syncing
    const activeSources = await getActiveDataSources(env);
    console.log(`Found ${activeSources.length} active data sources to sync`);
    
    const results = [];
    
    for (const source of activeSources) {
      try {
        const result = await syncDataSource(env, source);
        results.push({ sourceId: source.id, result });
        
        // Update last synced timestamp
        if (result.success) {
          await updateLastSyncedAt(env, source.id, result.lastSyncedAt);
        }
        
      } catch (error) {
        console.error(`Failed to sync data source ${source.id}:`, error);
        results.push({ 
          sourceId: source.id, 
          result: { 
            success: false, 
            recordsProcessed: 0, 
            recordsCreated: 0, 
            errors: [error instanceof Error ? error.message : 'Unknown sync error'], 
            lastSyncedAt: new Date().toISOString() 
          } 
        });
      }
    }
    
    // Log sync summary
    const totalProcessed = results.reduce((sum, r) => sum + r.result.recordsProcessed, 0);
    const totalCreated = results.reduce((sum, r) => sum + r.result.recordsCreated, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.result.errors.length, 0);
    
    console.log(`Sync completed: ${totalProcessed} processed, ${totalCreated} created, ${totalErrors} errors`);
    
  } catch (error) {
    console.error('Scheduled sync failed:', error);
    throw error;
  }
}

/**
 * Sync a single data source
 */
export async function syncDataSource(env: any, source: DataSourceConfig): Promise<SyncJobResult> {
  console.log(`Syncing data source: ${source.id} (${source.provider})`);
  
  const result: SyncJobResult = {
    success: false,
    recordsProcessed: 0,
    recordsCreated: 0,
    errors: [],
    lastSyncedAt: new Date().toISOString()
  };
  
  try {
    switch (source.provider) {
      case 'edf_energy':
      case 'british_gas':
      case 'octopus_energy':
        return await syncEnergySupplier(env, source, result);
        
      case 'aws_cloudwatch':
        return await syncAWSCloudWatch(env, source, result);
        
      case 'manual_entry':
        // Manual entries don't need automatic sync
        result.success = true;
        return result;
        
      default:
        result.errors.push(`Unsupported provider: ${source.provider}`);
        return result;
    }
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'Unknown sync error');
    return result;
  }
}

/**
 * Sync energy supplier data (electricity, gas usage)
 */
async function syncEnergySupplier(env: any, source: DataSourceConfig, result: SyncJobResult): Promise<SyncJobResult> {
  try {
    const connector = new EnergySupplierConnector(source.provider, source.credentials);
    
    // Calculate sync period (last sync or last 30 days)
    const fromDate = source.lastSyncedAt 
      ? new Date(source.lastSyncedAt) 
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = new Date();
    
    console.log(`Fetching energy data from ${fromDate.toISOString()} to ${toDate.toISOString()}`);
    
    // Fetch electricity usage data
    const electricityData = await connector.getElectricityUsage(fromDate, toDate);
    result.recordsProcessed += electricityData.length;
    
    for (const record of electricityData) {
      try {
        await db.createActivityData(env, {
          dataSourceId: source.id,
          organizationId: source.organizationId,
          activityType: 'electricity_usage',
          value: record.usage_kwh,
          unit: 'kWh',
          startDate: record.period_start,
          endDate: record.period_end
        });
        result.recordsCreated++;
      } catch (error) {
        result.errors.push(`Failed to save electricity record: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    // Fetch gas usage data if available
    try {
      const gasData = await connector.getGasUsage(fromDate, toDate);
      result.recordsProcessed += gasData.length;
      
      for (const record of gasData) {
        try {
          await db.createActivityData(env, {
            dataSourceId: source.id,
            organizationId: source.organizationId,
            activityType: 'natural_gas',
            value: record.usage_kwh,
            unit: 'kWh',
            startDate: record.period_start,
            endDate: record.period_end
          });
          result.recordsCreated++;
        } catch (error) {
          result.errors.push(`Failed to save gas record: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    } catch (error) {
      // Gas data might not be available for all suppliers
      console.log(`Gas data not available for ${source.provider}:`, error);
    }
    
    result.success = result.errors.length === 0;
    return result;
    
  } catch (error) {
    result.errors.push(`Energy supplier sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return result;
  }
}

/**
 * Sync AWS CloudWatch metrics (compute, storage usage)
 */
async function syncAWSCloudWatch(env: any, source: DataSourceConfig, result: SyncJobResult): Promise<SyncJobResult> {
  try {
    const connector = new AWSCloudWatchConnector(source.credentials);
    
    const fromDate = source.lastSyncedAt 
      ? new Date(source.lastSyncedAt) 
      : new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours
    const toDate = new Date();
    
    console.log(`Fetching AWS metrics from ${fromDate.toISOString()} to ${toDate.toISOString()}`);
    
    // Fetch EC2 instance hours
    const ec2Data = await connector.getEC2Usage(fromDate, toDate);
    result.recordsProcessed += ec2Data.length;
    
    for (const record of ec2Data) {
      try {
        await db.createActivityData(env, {
          dataSourceId: source.id,
          organizationId: source.organizationId,
          activityType: 'cloud_compute',
          value: record.instance_hours,
          unit: 'instance_hours',
          startDate: record.period_start,
          endDate: record.period_end
        });
        result.recordsCreated++;
      } catch (error) {
        result.errors.push(`Failed to save AWS compute record: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    // Fetch S3 storage usage
    const s3Data = await connector.getS3Usage(fromDate, toDate);
    result.recordsProcessed += s3Data.length;
    
    for (const record of s3Data) {
      try {
        await db.createActivityData(env, {
          dataSourceId: source.id,
          organizationId: source.organizationId,
          activityType: 'cloud_storage',
          value: record.storage_gb_hours,
          unit: 'GB_hours',
          startDate: record.period_start,
          endDate: record.period_end
        });
        result.recordsCreated++;
      } catch (error) {
        result.errors.push(`Failed to save AWS storage record: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    result.success = result.errors.length === 0;
    return result;
    
  } catch (error) {
    result.errors.push(`AWS CloudWatch sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return result;
  }
}

/**
 * Get all active data sources that need syncing
 */
async function getActiveDataSources(env: any): Promise<DataSourceConfig[]> {
  const database = getD1Database(env);
  
  const result = await database.prepare(`
    SELECT ds.*, sc.encryptedCredentials
    FROM data_sources ds
    LEFT JOIN source_credentials sc ON ds.id = sc.dataSourceId
    WHERE ds.status = 'active'
    AND ds.type = 'api_integration'
    ORDER BY ds.lastSyncedAt ASC NULLS FIRST
  `).all();
  
  return result.results.map((row: any) => ({
    id: row.id,
    organizationId: row.organizationId,
    type: row.type,
    provider: row.provider,
    credentials: row.encryptedCredentials ? JSON.parse(row.encryptedCredentials) : null,
    lastSyncedAt: row.lastSyncedAt
  }));
}

/**
 * Update the last synced timestamp for a data source
 */
async function updateLastSyncedAt(env: any, dataSourceId: string, timestamp: string): Promise<void> {
  const database = getD1Database(env);
  
  await database.prepare(`
    UPDATE data_sources 
    SET lastSyncedAt = ? 
    WHERE id = ?
  `).bind(timestamp, dataSourceId).run();
}

/**
 * Manual sync trigger for a specific data source
 */
export async function triggerManualSync(env: any, dataSourceId: string): Promise<SyncJobResult> {
  console.log(`Manual sync triggered for data source: ${dataSourceId}`);
  
  try {
    // Get the data source config
    const database = getD1Database(env);
    const result = await database.prepare(`
      SELECT ds.*, sc.encryptedCredentials
      FROM data_sources ds
      LEFT JOIN source_credentials sc ON ds.id = sc.dataSourceId
      WHERE ds.id = ?
    `).bind(dataSourceId).first();
    
    if (!result) {
      throw new Error(`Data source not found: ${dataSourceId}`);
    }
    
    const sourceConfig: DataSourceConfig = {
      id: result.id,
      organizationId: result.organizationId,
      type: result.type,
      provider: result.provider,
      credentials: result.encryptedCredentials ? JSON.parse(result.encryptedCredentials) : null,
      lastSyncedAt: result.lastSyncedAt
    };
    
    // Perform the sync
    const syncResult = await syncDataSource(env, sourceConfig);
    
    // Update last synced timestamp if successful
    if (syncResult.success) {
      await updateLastSyncedAt(env, dataSourceId, syncResult.lastSyncedAt);
    }
    
    return syncResult;
    
  } catch (error) {
    return {
      success: false,
      recordsProcessed: 0,
      recordsCreated: 0,
      errors: [error instanceof Error ? error.message : 'Unknown sync error'],
      lastSyncedAt: new Date().toISOString()
    };
  }
}