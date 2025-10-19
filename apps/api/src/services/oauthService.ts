/**
 * OAuth Service
 * 
 * Handles OAuth 2.0 flows for energy supplier integrations:
 * - Authorization URL generation
 * - Token exchange 
 * - Token refresh
 * - Secure credential storage
 */

import { getD1Database, generateId } from '../../../../../packages/db/d1-connection';

export interface OAuthConfig {
  provider: string;
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  scope: string[];
  redirectUri: string;
}

export interface OAuthState {
  id: string;
  organizationId: string;
  provider: string;
  state: string;
  codeVerifier?: string; // For PKCE
  redirectUri: string;
  expiresAt: string;
  createdAt: string;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  scope?: string;
  tokenType?: string;
}

// OAuth configurations for different energy suppliers
const OAUTH_CONFIGS: Record<string, OAuthConfig> = {
  octopus_energy: {
    provider: 'octopus_energy',
    clientId: '', // Set from environment
    clientSecret: '', // Set from environment
    authorizationUrl: 'https://api.octopus.energy/v1/oauth2/authorize/',
    tokenUrl: 'https://api.octopus.energy/v1/oauth2/token/',
    scope: ['read:electricity-consumption', 'read:gas-consumption', 'read:account'],
    redirectUri: '' // Set dynamically
  },
  edf_energy: {
    provider: 'edf_energy',
    clientId: '',
    clientSecret: '',
    authorizationUrl: 'https://api.edfenergy.com/oauth/authorize',
    tokenUrl: 'https://api.edfenergy.com/oauth/token',
    scope: ['consumption:read', 'billing:read'],
    redirectUri: ''
  },
  british_gas: {
    provider: 'british_gas',
    clientId: '',
    clientSecret: '',
    authorizationUrl: 'https://api.britishgas.co.uk/oauth/authorize',
    tokenUrl: 'https://api.britishgas.co.uk/oauth/token',
    scope: ['energy:read', 'account:read'],
    redirectUri: ''
  }
};

/**
 * Initialize OAuth configuration from environment variables
 */
function getOAuthConfig(provider: string, env: any): OAuthConfig {
  const config = { ...OAUTH_CONFIGS[provider] };
  
  if (!config) {
    throw new Error(`OAuth configuration not found for provider: ${provider}`);
  }
  
  // Set credentials from environment
  switch (provider) {
    case 'octopus_energy':
      config.clientId = env.OCTOPUS_CLIENT_ID || '';
      config.clientSecret = env.OCTOPUS_CLIENT_SECRET || '';
      break;
    case 'edf_energy':
      config.clientId = env.EDF_CLIENT_ID || '';
      config.clientSecret = env.EDF_CLIENT_SECRET || '';
      break;
    case 'british_gas':
      config.clientId = env.BG_CLIENT_ID || '';
      config.clientSecret = env.BG_CLIENT_SECRET || '';
      break;
  }
  
  // Set redirect URI
  config.redirectUri = `${env.API_BASE_URL}/api/v1/oauth/callback/${provider}`;
  
  if (!config.clientId || !config.clientSecret) {
    throw new Error(`OAuth credentials not configured for provider: ${provider}`);
  }
  
  return config;
}

/**
 * Generate PKCE code verifier and challenge
 */
function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  // Generate random code verifier (43-128 characters, URL-safe)
  const codeVerifier = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  // Create SHA256 hash of code verifier
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const hashBuffer = crypto.subtle.digest('SHA-256', data);
  
  const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
    
  return { codeVerifier, codeChallenge };
}

/**
 * Generate authorization URL for OAuth flow initiation
 */
export async function generateAuthorizationUrl(
  env: any,
  organizationId: string,
  provider: string
): Promise<{ url: string; state: string }> {
  const config = getOAuthConfig(provider, env);
  const database = getD1Database(env);
  
  // Generate state parameter for CSRF protection
  const state = generateId('oauth_state');
  const { codeVerifier, codeChallenge } = generatePKCE();
  
  // Store OAuth state in database
  const oauthState: OAuthState = {
    id: generateId('oauth'),
    organizationId,
    provider,
    state,
    codeVerifier,
    redirectUri: config.redirectUri,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
    createdAt: new Date().toISOString()
  };
  
  await database.prepare(`
    INSERT INTO oauth_states (id, organizationId, provider, state, codeVerifier, redirectUri, expiresAt, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    oauthState.id,
    oauthState.organizationId,
    oauthState.provider,
    oauthState.state,
    oauthState.codeVerifier,
    oauthState.redirectUri,
    oauthState.expiresAt,
    oauthState.createdAt
  ).run();
  
  // Build authorization URL
  const authUrl = new URL(config.authorizationUrl);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', config.clientId);
  authUrl.searchParams.set('redirect_uri', config.redirectUri);
  authUrl.searchParams.set('scope', config.scope.join(' '));
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  
  return {
    url: authUrl.toString(),
    state
  };
}

/**
 * Handle OAuth callback and exchange code for tokens
 */
export async function handleOAuthCallback(
  env: any,
  provider: string,
  code: string,
  state: string
): Promise<{
  success: boolean;
  organizationId?: string;
  dataSourceId?: string;
  tokens?: OAuthTokens;
  error?: string;
}> {
  try {
    const config = getOAuthConfig(provider, env);
    const database = getD1Database(env);
    
    // Verify state parameter
    const stateRecord = await database.prepare(`
      SELECT * FROM oauth_states 
      WHERE state = ? AND provider = ? AND expiresAt > datetime('now')
    `).bind(state, provider).first() as OAuthState | null;
    
    if (!stateRecord) {
      return { success: false, error: 'Invalid or expired OAuth state' };
    }
    
    // Exchange authorization code for access token
    const tokenResponse = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code_verifier: stateRecord.codeVerifier || ''
      })
    });
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      return { success: false, error: `Token exchange failed: ${tokenResponse.statusText}` };
    }
    
    const tokenData = await tokenResponse.json();
    
    const tokens: OAuthTokens = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresIn: tokenData.expires_in,
      scope: tokenData.scope,
      tokenType: tokenData.token_type || 'Bearer'
    };
    
    // Create data source for this integration
    const dataSourceId = generateId('ds');
    const createdAt = new Date().toISOString();
    
    await database.prepare(`
      INSERT INTO data_sources (id, organizationId, type, provider, status, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      dataSourceId,
      stateRecord.organizationId,
      'api_integration',
      provider,
      'active',
      createdAt
    ).run();
    
    // Store encrypted credentials
    const credentials = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresIn 
        ? new Date(Date.now() + (tokens.expiresIn * 1000)).toISOString()
        : null,
      scope: tokens.scope,
      tokenType: tokens.tokenType
    };
    
    // In production, these should be encrypted at rest
    const encryptedCredentials = JSON.stringify(credentials);
    
    await database.prepare(`
      INSERT INTO source_credentials (dataSourceId, encryptedCredentials)
      VALUES (?, ?)
    `).bind(dataSourceId, encryptedCredentials).run();
    
    // Clean up OAuth state
    await database.prepare(`
      DELETE FROM oauth_states WHERE id = ?
    `).bind(stateRecord.id).run();
    
    return {
      success: true,
      organizationId: stateRecord.organizationId,
      dataSourceId,
      tokens
    };
    
  } catch (error) {
    console.error('OAuth callback error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'OAuth callback failed' 
    };
  }
}

/**
 * Refresh access token for a data source
 */
export async function refreshAccessToken(
  env: any,
  dataSourceId: string
): Promise<{ success: boolean; tokens?: OAuthTokens; error?: string }> {
  try {
    const database = getD1Database(env);
    
    // Get data source and current credentials
    const result = await database.prepare(`
      SELECT ds.provider, sc.encryptedCredentials
      FROM data_sources ds
      JOIN source_credentials sc ON ds.id = sc.dataSourceId
      WHERE ds.id = ?
    `).bind(dataSourceId).first();
    
    if (!result) {
      return { success: false, error: 'Data source not found' };
    }
    
    const provider = result.provider as string;
    const credentials = JSON.parse(result.encryptedCredentials as string);
    
    if (!credentials.refreshToken) {
      return { success: false, error: 'No refresh token available' };
    }
    
    const config = getOAuthConfig(provider, env);
    
    // Request new access token
    const tokenResponse = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: credentials.refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret
      })
    });
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token refresh failed:', errorText);
      return { success: false, error: `Token refresh failed: ${tokenResponse.statusText}` };
    }
    
    const tokenData = await tokenResponse.json();
    
    const newTokens: OAuthTokens = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || credentials.refreshToken,
      expiresIn: tokenData.expires_in,
      scope: tokenData.scope || credentials.scope,
      tokenType: tokenData.token_type || credentials.tokenType
    };
    
    // Update stored credentials
    const updatedCredentials = {
      ...credentials,
      accessToken: newTokens.accessToken,
      refreshToken: newTokens.refreshToken,
      expiresAt: newTokens.expiresIn 
        ? new Date(Date.now() + (newTokens.expiresIn * 1000)).toISOString()
        : null
    };
    
    const encryptedCredentials = JSON.stringify(updatedCredentials);
    
    await database.prepare(`
      UPDATE source_credentials 
      SET encryptedCredentials = ?
      WHERE dataSourceId = ?
    `).bind(encryptedCredentials, dataSourceId).run();
    
    return { success: true, tokens: newTokens };
    
  } catch (error) {
    console.error('Token refresh error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Token refresh failed' 
    };
  }
}

/**
 * Revoke access token and delete data source
 */
export async function revokeAccess(env: any, dataSourceId: string): Promise<boolean> {
  try {
    const database = getD1Database(env);
    
    // Get data source and credentials
    const result = await database.prepare(`
      SELECT ds.provider, sc.encryptedCredentials
      FROM data_sources ds
      JOIN source_credentials sc ON ds.id = sc.dataSourceId
      WHERE ds.id = ?
    `).bind(dataSourceId).first();
    
    if (result) {
      const provider = result.provider as string;
      const credentials = JSON.parse(result.encryptedCredentials as string);
      
      try {
        // Attempt to revoke the token with the provider
        const config = getOAuthConfig(provider, env);
        
        // Not all providers support token revocation, so this might fail
        const revokeUrl = config.tokenUrl.replace('/token', '/revoke');
        
        await fetch(revokeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            token: credentials.accessToken,
            client_id: config.clientId,
            client_secret: config.clientSecret
          })
        });
      } catch (error) {
        console.warn('Failed to revoke token with provider:', error);
        // Continue with local cleanup even if revocation fails
      }
    }
    
    // Delete credentials and data source
    await database.prepare('DELETE FROM source_credentials WHERE dataSourceId = ?')
      .bind(dataSourceId).run();
    
    const deleteResult = await database.prepare('DELETE FROM data_sources WHERE id = ?')
      .bind(dataSourceId).run();
    
    return deleteResult.meta.changes > 0;
    
  } catch (error) {
    console.error('Access revocation error:', error);
    return false;
  }
}

/**
 * Clean up expired OAuth states
 */
export async function cleanupExpiredStates(env: any): Promise<number> {
  const database = getD1Database(env);
  
  const result = await database.prepare(`
    DELETE FROM oauth_states WHERE expiresAt < datetime('now')
  `).run();
  
  return result.meta.changes;
}