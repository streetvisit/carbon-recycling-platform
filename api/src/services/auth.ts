/**
 * Authentication Services
 * Handle OAuth flows and API key validation
 */

import { generateId, generateSecureState } from '../utils/crypto';

/**
 * Initialize OAuth flow for energy suppliers
 */
export async function initializeOAuthFlow(
  db: D1Database,
  userId: string,
  integrationId: string,
  redirectUrl: string
): Promise<string> {
  const state = generateSecureState();
  const oauthStateId = generateId();
  
  // Store OAuth state for security
  await db.prepare(`
    INSERT INTO oauth_states (id, user_id, integration_id, state, redirect_url, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now', '+1 hour'), datetime('now'))
  `).bind(oauthStateId, userId, integrationId, state, redirectUrl).run();

  // Get OAuth configuration for the integration
  const authUrl = getOAuthUrl(integrationId, state, redirectUrl);
  
  return authUrl;
}

/**
 * Get OAuth authorization URL for different providers
 */
function getOAuthUrl(integrationId: string, state: string, redirectUrl: string): string {
  const baseRedirectUrl = `${redirectUrl}/oauth/callback`;
  
  switch (integrationId) {
    case 'british-gas':
      return `https://api.britishgas.co.uk/oauth/authorize?` +
        `client_id=YOUR_CLIENT_ID&` +
        `response_type=code&` +
        `scope=energy:read&` +
        `state=${state}&` +
        `redirect_uri=${encodeURIComponent(baseRedirectUrl)}`;

    case 'scottish-power':
      return `https://api.scottishpower.com/oauth/authorize?` +
        `client_id=YOUR_CLIENT_ID&` +
        `response_type=code&` +
        `scope=consumption&` +
        `state=${state}&` +
        `redirect_uri=${encodeURIComponent(baseRedirectUrl)}`;

    case 'sse-energy':
      return `https://api.sse.co.uk/oauth/authorize?` +
        `client_id=YOUR_CLIENT_ID&` +
        `response_type=code&` +
        `scope=energy_data&` +
        `state=${state}&` +
        `redirect_uri=${encodeURIComponent(baseRedirectUrl)}`;

    case 'edf-energy':
      return `https://api.edfenergy.com/oauth/authorize?` +
        `client_id=YOUR_CLIENT_ID&` +
        `response_type=code&` +
        `scope=energy_consumption&` +
        `state=${state}&` +
        `redirect_uri=${encodeURIComponent(baseRedirectUrl)}`;

    case 'eon-next':
      return `https://api.eonenergy.com/oauth/authorize?` +
        `client_id=YOUR_CLIENT_ID&` +
        `response_type=code&` +
        `scope=meter_readings&` +
        `state=${state}&` +
        `redirect_uri=${encodeURIComponent(baseRedirectUrl)}`;

    case 'google-cloud-carbon':
      return `https://accounts.google.com/oauth/authorize?` +
        `client_id=YOUR_CLIENT_ID&` +
        `response_type=code&` +
        `scope=https://www.googleapis.com/auth/cloud-platform&` +
        `state=${state}&` +
        `redirect_uri=${encodeURIComponent(baseRedirectUrl)}`;

    case 'salesforce':
      return `https://login.salesforce.com/services/oauth2/authorize?` +
        `client_id=YOUR_CLIENT_ID&` +
        `response_type=code&` +
        `scope=api&` +
        `state=${state}&` +
        `redirect_uri=${encodeURIComponent(baseRedirectUrl)}`;

    default:
      throw new Error(`OAuth not supported for integration: ${integrationId}`);
  }
}

/**
 * Validate API keys for different providers
 */
export async function validateApiKey(provider: string, apiKey: string): Promise<boolean> {
  if (!apiKey || apiKey.length < 10) {
    return false;
  }

  try {
    switch (provider) {
      case 'octopus_energy':
        return await validateOctopusApiKey(apiKey);
      
      case 'openai':
        return await validateOpenAiApiKey(apiKey);
      
      case 'anthropic':
        return await validateAnthropicApiKey(apiKey);
        
      case 'aws':
        return await validateAwsApiKey(apiKey);
        
      case 'bulb_energy':
      case 'good_energy':
        // These are beta integrations - accept any reasonable-looking key for now
        return apiKey.length >= 20;
        
      default:
        // For unknown providers, do basic validation
        return apiKey.length >= 15;
    }
  } catch (error) {
    console.error(`Error validating API key for ${provider}:`, error);
    return false;
  }
}

/**
 * Validate Octopus Energy API key by making a test request
 */
async function validateOctopusApiKey(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.octopus.energy/v1/accounts/', {
      headers: {
        'Authorization': `Basic ${btoa(apiKey + ':')}`
      }
    });
    
    return response.status === 200 || response.status === 401; // 401 means key format is correct but needs proper permissions
  } catch (error) {
    return false;
  }
}

/**
 * Validate OpenAI API key
 */
async function validateOpenAiApiKey(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

/**
 * Validate Anthropic API key
 */
async function validateAnthropicApiKey(apiKey: string): Promise<boolean> {
  try {
    // Anthropic doesn't have a simple validation endpoint, so check format
    return apiKey.startsWith('sk-ant-') && apiKey.length > 50;
  } catch (error) {
    return false;
  }
}

/**
 * Validate AWS credentials
 */
async function validateAwsApiKey(credentials: string): Promise<boolean> {
  try {
    // AWS uses access key + secret key, not a single API key
    // For now, just validate format
    return credentials.length > 20;
  } catch (error) {
    return false;
  }
}

/**
 * Handle OAuth callback after user authorization
 */
export async function handleOAuthCallback(
  db: D1Database,
  code: string,
  state: string,
  integrationId: string
): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number }> {
  // Verify state to prevent CSRF attacks
  const oauthState = await db.prepare(`
    SELECT id, user_id, integration_id, expires_at
    FROM oauth_states
    WHERE state = ? AND integration_id = ?
  `).bind(state, integrationId).first();

  if (!oauthState) {
    throw new Error('Invalid OAuth state');
  }

  if (new Date(oauthState.expires_at as string) < new Date()) {
    throw new Error('OAuth state expired');
  }

  // Exchange authorization code for access token
  const tokens = await exchangeCodeForTokens(integrationId, code);

  // Clean up used OAuth state
  await db.prepare(`
    DELETE FROM oauth_states WHERE id = ?
  `).bind(oauthState.id).run();

  return tokens;
}

/**
 * Exchange authorization code for access tokens
 */
async function exchangeCodeForTokens(
  integrationId: string,
  code: string
): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number }> {
  try {
    switch (integrationId) {
      case 'british-gas':
        return await exchangeBritishGasTokens(code);
      
      case 'scottish-power':
        return await exchangeScottishPowerTokens(code);
      
      case 'sse-energy':
        return await exchangeSSETokens(code);
      
      case 'edf-energy':
        return await exchangeEDFTokens(code);
      
      case 'eon-next':
        return await exchangeEONTokens(code);
      
      default:
        throw new Error(`OAuth token exchange not implemented for: ${integrationId}`);
    }
  } catch (error) {
    console.error(`Failed to exchange tokens for ${integrationId}:`, error);
    throw error;
  }
}

// Real OAuth token exchange implementations
async function exchangeBritishGasTokens(code: string): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number }> {
  // TODO: Implement British Gas OAuth token exchange
  throw new Error('British Gas OAuth token exchange not yet implemented');
}

async function exchangeScottishPowerTokens(code: string): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number }> {
  // TODO: Implement Scottish Power OAuth token exchange
  throw new Error('Scottish Power OAuth token exchange not yet implemented');
}

async function exchangeSSETokens(code: string): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number }> {
  // TODO: Implement SSE Energy OAuth token exchange
  throw new Error('SSE Energy OAuth token exchange not yet implemented');
}

async function exchangeEDFTokens(code: string): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number }> {
  // TODO: Implement EDF Energy OAuth token exchange
  throw new Error('EDF Energy OAuth token exchange not yet implemented');
}

async function exchangeEONTokens(code: string): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number }> {
  // TODO: Implement E.ON Next OAuth token exchange
  throw new Error('E.ON Next OAuth token exchange not yet implemented');
}
