/**
 * Data Synchronization Worker
 * Background job to sync data from all active integrations
 */

import { generateId } from '../utils/crypto';

/**
 * Main sync worker - runs periodically via Cloudflare Cron Triggers
 */
export async function syncWorker(db: D1Database): Promise<void> {
  console.log('Starting data synchronization worker...');
  
  try {
    // Get all active integrations that need syncing
    const integrations = await db.prepare(`
      SELECT 
        ui.id,
        ui.user_id,
        ui.integration_id,
        ui.display_name,
        ui.status,
        ui.last_synced_at,
        ui.sync_frequency,
        i.name,
        i.provider,
        i.type,
        i.category
      FROM user_integrations ui
      JOIN integrations i ON ui.integration_id = i.id
      WHERE ui.status = 'active'
        AND (
          ui.last_synced_at IS NULL 
          OR ui.last_synced_at < datetime('now', '-1 hour')
        )
      ORDER BY ui.last_synced_at ASC NULLS FIRST
      LIMIT 100
    `).all();

    if (!integrations.results || integrations.results.length === 0) {
      console.log('No integrations need syncing');
      return;
    }

    console.log(`Found ${integrations.results.length} integrations to sync`);

    // Process each integration
    for (const integration of integrations.results) {
      try {
        await syncIntegration(db, integration as any);
      } catch (error) {
        console.error(`Error syncing integration ${integration.id}:`, error);
        
        // Update error status
        await db.prepare(`
          UPDATE user_integrations 
          SET 
            error_message = ?,
            error_count = error_count + 1,
            status = CASE 
              WHEN error_count >= 5 THEN 'error'
              ELSE status
            END,
            updated_at = datetime('now')
          WHERE id = ?
        `).bind(error instanceof Error ? error.message : 'Unknown error', integration.id).run();
      }
    }

    console.log('Data synchronization worker completed');
  } catch (error) {
    console.error('Error in sync worker:', error);
  }
}

/**
 * Sync a single integration
 */
async function syncIntegration(db: D1Database, integration: any): Promise<void> {
  const syncLogId = generateId();
  const startTime = Date.now();
  
  // Create sync log
  await db.prepare(`
    INSERT INTO sync_logs (
      id, user_integration_id, sync_type, status, started_at, created_at
    )
    VALUES (?, ?, 'scheduled', 'running', datetime('now'), datetime('now'))
  `).bind(syncLogId, integration.id).run();

  try {
    let recordsProcessed = 0;
    let recordsFailed = 0;

    // Sync based on integration type
    switch (integration.type) {
      case 'oauth':
        ({ recordsProcessed, recordsFailed } = await syncOAuthIntegration(db, integration));
        break;
      
      case 'api_key':
        ({ recordsProcessed, recordsFailed } = await syncApiKeyIntegration(db, integration));
        break;
      
      case 'webhook':
        ({ recordsProcessed, recordsFailed } = await processWebhookData(db, integration));
        break;
      
      default:
        console.log(`Skipping sync for integration type: ${integration.type}`);
        return;
    }

    const syncDuration = Date.now() - startTime;

    // Update sync log with success
    await db.prepare(`
      UPDATE sync_logs
      SET 
        status = 'success',
        records_processed = ?,
        records_failed = ?,
        sync_duration_ms = ?,
        completed_at = datetime('now')
      WHERE id = ?
    `).bind(recordsProcessed, recordsFailed, syncDuration, syncLogId).run();

    // Update integration last sync time
    await db.prepare(`
      UPDATE user_integrations
      SET 
        last_synced_at = datetime('now'),
        error_message = NULL,
        error_count = 0,
        updated_at = datetime('now')
      WHERE id = ?
    `).bind(integration.id).run();

    console.log(`Synced ${integration.name}: ${recordsProcessed} records processed, ${recordsFailed} failed`);

  } catch (error) {
    const syncDuration = Date.now() - startTime;
    
    // Update sync log with error
    await db.prepare(`
      UPDATE sync_logs
      SET 
        status = 'error',
        error_message = ?,
        sync_duration_ms = ?,
        completed_at = datetime('now')
      WHERE id = ?
    `).bind(error instanceof Error ? error.message : 'Unknown error', syncDuration, syncLogId).run();

    throw error;
  }
}

/**
 * Sync OAuth-based integration (energy suppliers)
 */
async function syncOAuthIntegration(db: D1Database, integration: any): Promise<{ recordsProcessed: number; recordsFailed: number }> {
  // Get stored OAuth tokens
  const credentials = await db.prepare(`
    SELECT encrypted_data FROM integration_credentials
    WHERE user_integration_id = ? AND credential_type = 'oauth_tokens'
    ORDER BY created_at DESC LIMIT 1
  `).bind(integration.id).first();

  if (!credentials) {
    throw new Error('No OAuth credentials found');
  }

  // Decrypt credentials and make actual API calls
  const decryptedCreds = JSON.parse(credentials.encrypted_data);
  const energyData = await fetchRealEnergyData(integration, decryptedCreds);
  
  let recordsProcessed = 0;
  let recordsFailed = 0;

  for (const record of energyData) {
    try {
      // Store raw data
      await db.prepare(`
        INSERT OR REPLACE INTO raw_data (
          id, user_integration_id, data_type, external_id, raw_payload, record_date, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(
        generateId(),
        integration.id,
        record.type,
        record.external_id,
        JSON.stringify(record),
        record.date
      ).run();

      recordsProcessed++;
    } catch (error) {
      console.error(`Failed to store record:`, error);
      recordsFailed++;
    }
  }

  return { recordsProcessed, recordsFailed };
}

/**
 * Sync API key-based integration
 */
async function syncApiKeyIntegration(db: D1Database, integration: any): Promise<{ recordsProcessed: number; recordsFailed: number }> {
  // Get stored API key
  const credentials = await db.prepare(`
    SELECT encrypted_data FROM integration_credentials
    WHERE user_integration_id = ? AND credential_type = 'api_key'
    ORDER BY created_at DESC LIMIT 1
  `).bind(integration.id).first();

  if (!credentials) {
    throw new Error('No API key found');
  }

  // Decrypt credentials and make real API calls
  const decryptedCreds = JSON.parse(credentials.encrypted_data);
  const apiData = await fetchRealApiData(integration, decryptedCreds);
  
  let recordsProcessed = 0;
  let recordsFailed = 0;

  for (const record of apiData) {
    try {
      await db.prepare(`
        INSERT OR REPLACE INTO raw_data (
          id, user_integration_id, data_type, external_id, raw_payload, record_date, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(
        generateId(),
        integration.id,
        record.type,
        record.external_id,
        JSON.stringify(record),
        record.date
      ).run();

      recordsProcessed++;
    } catch (error) {
      recordsFailed++;
    }
  }

  return { recordsProcessed, recordsFailed };
}

/**
 * Process webhook data that's already been received
 */
async function processWebhookData(db: D1Database, integration: any): Promise<{ recordsProcessed: number; recordsFailed: number }> {
  // Get unprocessed webhook deliveries
  const webhooks = await db.prepare(`
    SELECT id, payload, created_at
    FROM webhook_deliveries
    WHERE user_integration_id = ? AND processed = 0
    ORDER BY created_at ASC
    LIMIT 50
  `).bind(integration.id).all();

  let recordsProcessed = 0;
  let recordsFailed = 0;

  for (const webhook of webhooks.results || []) {
    try {
      const payload = JSON.parse(webhook.payload as string);
      
      // Store as raw data
      await db.prepare(`
        INSERT INTO raw_data (
          id, user_integration_id, data_type, external_id, raw_payload, record_date, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(
        generateId(),
        integration.id,
        payload.type || 'webhook',
        payload.id || webhook.id,
        webhook.payload,
        payload.date || webhook.created_at
      ).run();

      // Mark webhook as processed
      await db.prepare(`
        UPDATE webhook_deliveries SET processed = 1, processed_at = datetime('now')
        WHERE id = ?
      `).bind(webhook.id).run();

      recordsProcessed++;
    } catch (error) {
      recordsFailed++;
      
      // Mark webhook as failed
      await db.prepare(`
        UPDATE webhook_deliveries SET processing_error = ?
        WHERE id = ?
      `).bind(error instanceof Error ? error.message : 'Unknown error', webhook.id).run();
    }
  }

  return { recordsProcessed, recordsFailed };
}

/**
 * Fetch real energy data from provider APIs
 */
async function fetchRealEnergyData(integration: any, credentials: any): Promise<any[]> {
  const data = [];
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
  
  try {
    switch (integration.provider) {
      case 'british_gas':
        return await fetchBritishGasData(credentials, startDate, endDate);
      
      case 'octopus_energy':
        return await fetchOctopusEnergyData(credentials, startDate, endDate);
      
      case 'edf_energy':
        return await fetchEDFEnergyData(credentials, startDate, endDate);
      
      case 'scottish_power':
        return await fetchScottishPowerData(credentials, startDate, endDate);
      
      case 'sse_energy':
        return await fetchSSEEnergyData(credentials, startDate, endDate);
      
      case 'eon_next':
        return await fetchEONNextData(credentials, startDate, endDate);
      
      default:
        throw new Error(`Unsupported energy provider: ${integration.provider}`);
    }
  } catch (error) {
    console.error(`Failed to fetch energy data from ${integration.provider}:`, error);
    throw error;
  }
}

/**
 * Fetch real API usage data from provider APIs
 */
async function fetchRealApiData(integration: any, credentials: any): Promise<any[]> {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
  
  try {
    switch (integration.provider) {
      case 'openai':
        return await fetchOpenAIUsageData(credentials.apiKey, startDate, endDate);
      
      case 'anthropic':
        return await fetchAnthropicUsageData(credentials.apiKey, startDate, endDate);
      
      default:
        throw new Error(`Unsupported API provider: ${integration.provider}`);
    }
  } catch (error) {
    console.error(`Failed to fetch API data from ${integration.provider}:`, error);
    throw error;
  }
}

// Real API implementations - these would call actual provider APIs
async function fetchBritishGasData(credentials: any, startDate: Date, endDate: Date): Promise<any[]> {
  // TODO: Implement British Gas API calls
  throw new Error('British Gas API integration not yet implemented');
}

async function fetchOctopusEnergyData(credentials: any, startDate: Date, endDate: Date): Promise<any[]> {
  // TODO: Implement Octopus Energy API calls
  throw new Error('Octopus Energy API integration not yet implemented');
}

async function fetchEDFEnergyData(credentials: any, startDate: Date, endDate: Date): Promise<any[]> {
  // TODO: Implement EDF Energy API calls
  throw new Error('EDF Energy API integration not yet implemented');
}

async function fetchScottishPowerData(credentials: any, startDate: Date, endDate: Date): Promise<any[]> {
  // TODO: Implement Scottish Power API calls
  throw new Error('Scottish Power API integration not yet implemented');
}

async function fetchSSEEnergyData(credentials: any, startDate: Date, endDate: Date): Promise<any[]> {
  // TODO: Implement SSE Energy API calls
  throw new Error('SSE Energy API integration not yet implemented');
}

async function fetchEONNextData(credentials: any, startDate: Date, endDate: Date): Promise<any[]> {
  // TODO: Implement E.ON Next API calls
  throw new Error('E.ON Next API integration not yet implemented');
}

async function fetchOpenAIUsageData(apiKey: string, startDate: Date, endDate: Date): Promise<any[]> {
  // TODO: Implement OpenAI usage API calls
  throw new Error('OpenAI usage API integration not yet implemented');
}

async function fetchAnthropicUsageData(apiKey: string, startDate: Date, endDate: Date): Promise<any[]> {
  // TODO: Implement Anthropic usage API calls
  throw new Error('Anthropic usage API integration not yet implemented');
}
