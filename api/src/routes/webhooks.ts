/**
 * Webhook API Routes
 * Handle real-time data from integrations
 */

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { generateId } from '../utils/crypto';

export const webhookRoutes = new Hono<{
  Bindings: {
    DB: D1Database;
  };
}>();

/**
 * POST /api/v1/webhooks/octopus-energy
 * Handle Octopus Energy webhook data
 */
webhookRoutes.post('/octopus-energy', async (c) => {
  const signature = c.req.header('X-Octopus-Signature');
  const body = await c.req.text();
  
  // Verify webhook signature (in production)
  // if (!verifyOctopusSignature(body, signature)) {
  //   throw new HTTPException(401, { message: 'Invalid signature' });
  // }

  const payload = JSON.parse(body);
  
  // Store webhook delivery
  await c.env.DB.prepare(`
    INSERT INTO webhook_deliveries (
      id, user_integration_id, webhook_source, payload, signature, created_at
    )
    VALUES (?, ?, 'octopus_energy', ?, ?, datetime('now'))
  `).bind(
    generateId(),
    payload.user_integration_id || 'unknown',
    body,
    signature
  ).run();

  return c.json({ received: true });
});

/**
 * POST /api/v1/webhooks/british-gas
 * Handle British Gas webhook data
 */
webhookRoutes.post('/british-gas', async (c) => {
  const body = await c.req.text();
  const payload = JSON.parse(body);
  
  await c.env.DB.prepare(`
    INSERT INTO webhook_deliveries (
      id, user_integration_id, webhook_source, payload, created_at
    )
    VALUES (?, ?, 'british_gas', ?, datetime('now'))
  `).bind(
    generateId(),
    payload.user_integration_id || 'unknown',
    body
  ).run();

  return c.json({ received: true });
});

/**
 * POST /api/v1/webhooks/generic
 * Handle generic webhook data from any integration
 */
webhookRoutes.post('/generic/:source', async (c) => {
  const source = c.req.param('source');
  const body = await c.req.text();
  
  try {
    const payload = JSON.parse(body);
    
    await c.env.DB.prepare(`
      INSERT INTO webhook_deliveries (
        id, user_integration_id, webhook_source, payload, created_at
      )
      VALUES (?, ?, ?, ?, datetime('now'))
    `).bind(
      generateId(),
      payload.user_integration_id || 'unknown',
      source,
      body
    ).run();

    return c.json({ received: true });
  } catch (error) {
    throw new HTTPException(400, { message: 'Invalid JSON payload' });
  }
});