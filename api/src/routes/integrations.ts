/**
 * Integrations API Routes
 * List available integrations and their metadata
 */

import { Hono } from 'hono';
import { allIntegrations, getIntegrationsByCategory, getProductionIntegrations, searchIntegrations } from '../data/integrations';

export const integrationRoutes = new Hono<{
  Variables: {
    userId?: string;
    clerkUser?: any;
  };
}>();

/**
 * GET /api/v1/integrations
 * List all available integrations
 */
integrationRoutes.get('/', async (c) => {
  const category = c.req.query('category');
  const status = c.req.query('status');
  const search = c.req.query('search');

  let integrations = allIntegrations;

  // Filter by category
  if (category) {
    integrations = getIntegrationsByCategory(category as any);
  }

  // Filter by status
  if (status === 'production') {
    integrations = getProductionIntegrations();
  } else if (status) {
    integrations = integrations.filter(i => i.status === status);
  }

  // Search
  if (search) {
    integrations = searchIntegrations(search);
  }

  return c.json({
    data: integrations,
    count: integrations.length,
    categories: [
      'energy',
      'ai', 
      'cloud',
      'transport',
      'finance',
      'enterprise',
      'manufacturing',
      'retail',
      'utilities',
      'other'
    ]
  });
});

/**
 * GET /api/v1/integrations/:id
 * Get a specific integration by ID
 */
integrationRoutes.get('/:id', async (c) => {
  const integrationId = c.req.param('id');
  const integration = allIntegrations.find(i => i.id === integrationId);

  if (!integration) {
    return c.json({
      error: 'Integration not found',
      status: 404
    }, 404);
  }

  return c.json({
    data: integration
  });
});