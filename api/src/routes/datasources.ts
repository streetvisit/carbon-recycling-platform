/**
 * Datasources API Routes
 * Manage user integration connections
 */

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { generateId } from '../utils/crypto';
import { allIntegrations } from '../data/integrations';
import { initializeOAuthFlow, validateApiKey } from '../services/auth';

export const datasourceRoutes = new Hono<{
  Bindings: {
    DB: D1Database;
    CLERK_SECRET_KEY: string;
    ENCRYPTION_KEY: string;
    OAUTH_REDIRECT_URL: string;
  };
  Variables: {
    userId: string;
    clerkUser: any;
  };
}>();

/**
 * GET /api/v1/datasources
 * List all connected data sources for the authenticated user
 */
datasourceRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  
  try {
    const userIntegrations = await c.env.DB.prepare(`
      SELECT 
        ui.id,
        ui.integration_id as provider,
        ui.display_name,
        ui.status,
        ui.last_synced_at as lastSyncedAt,
        ui.sync_frequency,
        ui.error_message,
        ui.created_at,
        i.name as integration_name,
        i.category,
        i.type,
        i.description,
        i.logo,
        i.setup_complexity,
        i.estimated_setup_time,
        i.data_types,
        i.emission_scopes
      FROM user_integrations ui
      JOIN integrations i ON ui.integration_id = i.id
      WHERE ui.user_id = ?
      ORDER BY ui.created_at DESC
    `).bind(userId).all();

    const results = userIntegrations.results?.map(row => ({
      id: row.id,
      provider: row.provider,
      type: mapIntegrationType(row.type as string),
      status: row.status,
      lastSyncedAt: row.lastSyncedAt,
      integration_id: row.integration_id,
      metadata: {
        name: row.integration_name,
        description: row.description,
        setup_complexity: row.setup_complexity,
        estimated_setup_time: row.estimated_setup_time,
        data_types: JSON.parse(row.data_types as string || '[]'),
        emission_scopes: JSON.parse(row.emission_scopes as string || '[]')
      }
    })) || [];

    return c.json({
      data: results,
      count: results.length
    });
  } catch (error) {
    console.error('Error fetching datasources:', error);
    throw new HTTPException(500, { message: 'Failed to fetch data sources' });
  }
});

/**
 * POST /api/v1/datasources
 * Create a new data source connection
 */
datasourceRoutes.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  
  const { integration_id, authentication_type, category, metadata, credentials } = body;

  if (!integration_id) {
    throw new HTTPException(400, { message: 'integration_id is required' });
  }

  // Find integration in registry
  const integration = allIntegrations.find(i => i.id === integration_id);
  if (!integration) {
    throw new HTTPException(400, { message: 'Invalid integration_id' });
  }

  try {
    // Check if integration already exists for this user
    const existingIntegration = await c.env.DB.prepare(`
      SELECT id FROM user_integrations 
      WHERE user_id = ? AND integration_id = ?
    `).bind(userId, integration_id).first();

    if (existingIntegration) {
      throw new HTTPException(409, { message: 'Integration already connected' });
    }

    // Ensure integration exists in integrations table
    await upsertIntegration(c.env.DB, integration);

    const userIntegrationId = generateId();
    let status = 'pending';
    let errorMessage = null;

    // Handle authentication based on type
    if (integration.type === 'oauth') {
      // Initiate OAuth flow
      const authUrl = await initializeOAuthFlow(
        c.env.DB, 
        userId, 
        integration_id, 
        c.env.OAUTH_REDIRECT_URL
      );
      
      return c.json({
        message: 'OAuth flow initiated',
        auth_url: authUrl,
        integration_id: userIntegrationId
      });
      
    } else if (integration.type === 'api_key') {
      // Validate and store API key
      if (!credentials?.apiKey) {
        throw new HTTPException(400, { message: 'API key is required' });
      }

      const isValid = await validateApiKey(integration.provider, credentials.apiKey);
      if (!isValid) {
        throw new HTTPException(400, { message: 'Invalid API key' });
      }

      status = 'active';
      
      // Store encrypted credentials
      await storeCredentials(c.env.DB, userIntegrationId, 'api_key', credentials, c.env.ENCRYPTION_KEY);
      
    } else if (integration.type === 'file_upload') {
      // File upload integrations start as pending until files are uploaded
      status = 'pending';
      
    } else if (integration.type === 'manual_entry') {
      // Manual integrations are immediately active
      status = 'active';
    }

    // Create user integration record
    await c.env.DB.prepare(`
      INSERT INTO user_integrations (
        id, user_id, integration_id, display_name, status, 
        sync_frequency, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(
      userIntegrationId,
      userId,
      integration_id,
      metadata?.name || integration.name,
      status,
      'daily'
    ).run();

    // Return created integration
    const result = {
      id: userIntegrationId,
      provider: integration.provider,
      type: mapIntegrationType(integration.type),
      status: status,
      lastSyncedAt: null,
      integration_id: integration_id,
      metadata: {
        name: integration.name,
        description: integration.description,
        setup_complexity: integration.setup_complexity,
        estimated_setup_time: integration.estimated_setup_time,
        data_types: integration.data_types,
        emission_scopes: integration.emission_scopes
      }
    };

    return c.json({
      message: 'Integration created successfully',
      data: result
    }, 201);

  } catch (error) {
    console.error('Error creating datasource:', error);
    if (error instanceof HTTPException) throw error;
    throw new HTTPException(500, { message: 'Failed to create data source' });
  }
});

/**
 * DELETE /api/v1/datasources/:id
 * Remove a data source connection
 */
datasourceRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const integrationId = c.req.param('id');

  if (!integrationId) {
    throw new HTTPException(400, { message: 'Integration ID is required' });
  }

  try {
    // Verify ownership and get integration details
    const integration = await c.env.DB.prepare(`
      SELECT id, integration_id, status 
      FROM user_integrations 
      WHERE id = ? AND user_id = ?
    `).bind(integrationId, userId).first();

    if (!integration) {
      throw new HTTPException(404, { message: 'Integration not found' });
    }

    // Delete all related data (cascading deletes handled by foreign keys)
    await c.env.DB.prepare(`
      DELETE FROM user_integrations WHERE id = ? AND user_id = ?
    `).bind(integrationId, userId).run();

    return c.json({
      message: 'Integration deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting datasource:', error);
    if (error instanceof HTTPException) throw error;
    throw new HTTPException(500, { message: 'Failed to delete data source' });
  }
});

/**
 * PUT /api/v1/datasources/:id
 * Update a data source connection
 */
datasourceRoutes.put('/:id', async (c) => {
  const userId = c.get('userId');
  const integrationId = c.req.param('id');
  const body = await c.req.json();

  const { display_name, sync_frequency, status } = body;

  try {
    // Verify ownership
    const integration = await c.env.DB.prepare(`
      SELECT id FROM user_integrations WHERE id = ? AND user_id = ?
    `).bind(integrationId, userId).first();

    if (!integration) {
      throw new HTTPException(404, { message: 'Integration not found' });
    }

    // Update integration
    await c.env.DB.prepare(`
      UPDATE user_integrations 
      SET display_name = COALESCE(?, display_name),
          sync_frequency = COALESCE(?, sync_frequency),
          status = COALESCE(?, status),
          updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `).bind(
      display_name,
      sync_frequency,
      status,
      integrationId,
      userId
    ).run();

    return c.json({
      message: 'Integration updated successfully'
    });

  } catch (error) {
    console.error('Error updating datasource:', error);
    if (error instanceof HTTPException) throw error;
    throw new HTTPException(500, { message: 'Failed to update data source' });
  }
});

/**
 * POST /api/v1/datasources/:id/sync
 * Manually trigger data synchronization
 */
datasourceRoutes.post('/:id/sync', async (c) => {
  const userId = c.get('userId');
  const integrationId = c.req.param('id');

  try {
    // Verify ownership and get integration details
    const integration = await c.env.DB.prepare(`
      SELECT ui.id, ui.integration_id, ui.status, i.type, i.provider
      FROM user_integrations ui
      JOIN integrations i ON ui.integration_id = i.id
      WHERE ui.id = ? AND ui.user_id = ?
    `).bind(integrationId, userId).first();

    if (!integration) {
      throw new HTTPException(404, { message: 'Integration not found' });
    }

    if (integration.status !== 'active') {
      throw new HTTPException(400, { message: 'Integration is not active' });
    }

    // Create sync log entry
    const syncLogId = generateId();
    await c.env.DB.prepare(`
      INSERT INTO sync_logs (
        id, user_integration_id, sync_type, status, started_at, created_at
      )
      VALUES (?, ?, 'manual', 'running', datetime('now'), datetime('now'))
    `).bind(syncLogId, integration.id).run();

    // Queue sync job (in a real implementation, you'd use a queue)
    // For now, we'll return success and handle sync asynchronously
    
    return c.json({
      message: 'Sync initiated successfully',
      sync_id: syncLogId
    });

  } catch (error) {
    console.error('Error initiating sync:', error);
    if (error instanceof HTTPException) throw error;
    throw new HTTPException(500, { message: 'Failed to initiate sync' });
  }
});

// Helper functions

function mapIntegrationType(type: string): string {
  switch (type) {
    case 'oauth':
    case 'api_key':
      return 'api_integration';
    case 'file_upload':
      return 'file_upload';
    case 'manual_entry':
      return 'manual_entry';
    case 'webhook':
      return 'webhook';
    default:
      return 'manual_entry';
  }
}

async function upsertIntegration(db: D1Database, integration: any) {
  await db.prepare(`
    INSERT OR REPLACE INTO integrations (
      id, name, provider, category, type, description, logo, status,
      authentication_guide, setup_complexity, estimated_setup_time,
      data_types, emission_scopes, has_info_page, has_setup_guide, has_faq,
      api_documentation_url, official_website, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).bind(
    integration.id,
    integration.name,
    integration.provider,
    integration.category,
    integration.type,
    integration.description,
    integration.logo,
    integration.status,
    integration.authentication_guide,
    integration.setup_complexity,
    integration.estimated_setup_time,
    JSON.stringify(integration.data_types),
    JSON.stringify(integration.emission_scopes),
    integration.has_info_page,
    integration.has_setup_guide,
    integration.has_faq,
    integration.api_documentation_url,
    integration.official_website
  ).run();
}

async function storeCredentials(
  db: D1Database, 
  userIntegrationId: string, 
  credentialType: string, 
  credentials: any, 
  encryptionKey: string
) {
  // In a real implementation, encrypt the credentials
  const encryptedData = JSON.stringify(credentials); // Simplified - should use actual encryption
  
  await db.prepare(`
    INSERT INTO integration_credentials (
      id, user_integration_id, credential_type, encrypted_data, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
  `).bind(
    generateId(),
    userIntegrationId,
    credentialType,
    encryptedData
  ).run();
}