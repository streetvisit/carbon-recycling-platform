/**
 * Carbon Recycling Platform API
 * Cloudflare Workers backend for integration management and data synchronization
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { HTTPException } from 'hono/http-exception';
import { clerkAuth } from './middleware/auth';
import { datasourceRoutes } from './routes/datasources';
import { integrationRoutes } from './routes/integrations';
import { webhookRoutes } from './routes/webhooks';
import { syncWorker } from './workers/sync';

// Initialize Hono app
const app = new Hono<{
  Bindings: {
    DB: D1Database;
    CLERK_PUBLISHABLE_KEY: string;
    CLERK_SECRET_KEY: string;
    ENCRYPTION_KEY: string;
    OAUTH_REDIRECT_URL: string;
  };
  Variables: {
    userId: string;
    clerkUser: any;
  };
}>();

// Global middleware
app.use('*', logger());
app.use('*', cors({
  origin: ['http://localhost:4321', 'https://carbonrecycling.co.uk'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API routes with authentication
app.use('/api/v1/datasources/*', clerkAuth());
app.route('/api/v1/datasources', datasourceRoutes);

app.use('/api/v1/integrations/*', clerkAuth());
app.route('/api/v1/integrations', integrationRoutes);

app.route('/api/v1/webhooks', webhookRoutes); // No auth for webhooks

// Scheduled sync worker
app.scheduled = async (event, env, ctx) => {
  ctx.waitUntil(syncWorker(env.DB));
};

// Error handling
app.onError((err, c) => {
  console.error('API Error:', err);
  
  if (err instanceof HTTPException) {
    return c.json({
      error: err.message,
      status: err.status
    }, err.status);
  }
  
  return c.json({
    error: 'Internal server error',
    status: 500
  }, 500);
});

// 404 handler
app.notFound((c) => {
  return c.json({
    error: 'Not found',
    status: 404
  }, 404);
});

export default app;