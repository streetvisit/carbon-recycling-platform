import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { authenticateRequest, requireAuth } from './services/authService'
import * as db from './services/d1DatabaseService'
import { getEmissionFactor } from './services/emissionFactors'
import { handleScheduledSync, triggerManualSync } from './workers/syncWorker'
import { 
  generateAuthorizationUrl, 
  handleOAuthCallback, 
  refreshAccessToken, 
  revokeAccess 
} from './services/oauthService'
import {
  getRealTimeMetrics,
  getIndustryBenchmarks as getBenchmarks,
  generateEmissionsPredictions,
  getAnalyticsAlerts,
  getEmissionsKPIs
} from './services/realTimeAnalytics'
import { EnhancedCalculationEngine } from './services/enhancedCalculationEngine'
import { suppliers } from './routes/suppliers'
import { suppliersTest } from './routes/suppliers-test'
import { reports } from './routes/reports'
import { reportsTest } from './routes/reports-test'
import { portal } from './routes/portal'
import { runSupplierMigration, checkSupplierTablesSchema } from '../../../packages/db/migrate'
import { getMarketDataService } from './services/marketDataService'
import { getTestAccountService } from './services/testAccountService'
import { createTradingTables, checkTradingTablesExist } from './services/migrations/tradingTables'

export interface Env {
  // Cloudflare D1 Database binding
  DB: D1Database
  // Optional Clerk keys
  CLERK_PUBLISHABLE_KEY?: string
  CLERK_SECRET_KEY?: string
  // Module 5: Report generation environment variables
  BROWSERLESS_API_KEY?: string
  BROWSERLESS_ENDPOINT?: string
  R2_BUCKET_NAME?: string
  R2_ACCESS_KEY_ID?: string
  R2_SECRET_ACCESS_KEY?: string
  R2_ENDPOINT?: string
}

const app = new Hono<{ Bindings: Env }>()

// CORS middleware
app.use('*', cors({
  origin: ['http://localhost:4321', 'https://carbon-recycling.pages.dev'],
  credentials: true
}))

// Mount routes
app.route('/api/v1/suppliers', suppliers)
app.route('/api/v1/suppliers-test', suppliersTest)
app.route('/api/v1/reports', reports)
app.route('/api/v1/reports-test', reportsTest)
app.route('/portal/api/v1', portal)

// Authentication middleware
app.use('/api/*', async (c, next) => {
  try {
    const authContext = await authenticateRequest(c.env, c.req.raw)
    c.set('authContext', authContext)
    c.set('user', authContext.user)
    
    if (authContext.user) {
      c.set('userId', authContext.user.userId)
      c.set('organizationId', authContext.user.organizationId)
    }
    
    return next()
  } catch (error) {
    return c.json({ error: 'Authentication failed' }, 401)
  }
})

// GET /api/v1/datasources - Fetch all data sources for organization
app.get('/api/v1/datasources', async (c) => {
  try {
    const authContext = c.get('authContext')
    const user = requireAuth(authContext)
    
    const dataSources = await db.getDataSourcesByOrganization(c.env, user.organizationId)
    
    return c.json({
      data: dataSources.map(ds => ({
        id: ds.id,
        provider: ds.provider,
        type: ds.type,
        status: ds.status,
        lastSyncedAt: ds.lastSyncedAt
      }))
    })
  } catch (error) {
    console.error('Error fetching data sources:', error)
    return c.json({ error: error instanceof Error ? error.message : 'Failed to fetch data sources' }, 500)
  }
})

// POST /api/v1/datasources - Create new data source
app.post('/api/v1/datasources', async (c) => {
  try {
    const authContext = c.get('authContext')
    const user = requireAuth(authContext)
    const body = await c.req.json()
    
    if (!body.type || !body.provider) {
      return c.json({ error: 'Missing required fields: type, provider' }, 400)
    }
    
    const newDataSource = await db.createDataSource(c.env, {
      organizationId: user.organizationId,
      type: body.type,
      provider: body.provider,
      status: 'pending'
    })
    
    return c.json({
      id: newDataSource.id,
      provider: newDataSource.provider,
      type: newDataSource.type,
      status: newDataSource.status,
      lastSyncedAt: newDataSource.lastSyncedAt
    }, 201)
  } catch (error) {
    console.error('Error creating data source:', error)
    return c.json({ error: error instanceof Error ? error.message : 'Failed to create data source' }, 500)
  }
})

// DELETE /api/v1/datasources/:id - Delete data source
app.delete('/api/v1/datasources/:id', async (c) => {
  try {
    const authContext = c.get('authContext')
    requireAuth(authContext)
    const dataSourceId = c.req.param('id')
    
    const deleted = await db.deleteDataSource(c.env, dataSourceId)
    
    if (!deleted) {
      return c.json({ error: 'Data source not found' }, 404)
    }
    
    return c.body(null, 204)
  } catch (error) {
    console.error('Error deleting data source:', error)
    return c.json({ error: error instanceof Error ? error.message : 'Failed to delete data source' }, 500)
  }
})

// POST /api/v1/ingestion/mock - Create mock activity data for testing
app.post('/api/v1/ingestion/mock', async (c) => {
  try {
    const authContext = c.get('authContext')
    const user = requireAuth(authContext)
    const body = await c.req.json()
    
    if (!body.dataSourceId || !body.activityType || !body.value || !body.unit || !body.startDate || !body.endDate) {
      return c.json({ 
        error: 'Missing required fields: dataSourceId, activityType, value, unit, startDate, endDate' 
      }, 400)
    }
    
    const activityData = await db.createActivityData(c.env, {
      dataSourceId: body.dataSourceId,
      organizationId: user.organizationId,
      activityType: body.activityType,
      value: parseFloat(body.value),
      unit: body.unit,
      startDate: body.startDate,
      endDate: body.endDate,
    })
    
    return c.json(activityData, 201)
  } catch (error) {
    console.error('Error creating activity data:', error)
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to create activity data' 
    }, 500)
  }
})

// POST /api/v1/calculations - Process activity data and calculate emissions
app.post('/api/v1/calculations', async (c) => {
  try {
    const authContext = c.get('authContext')
    const user = requireAuth(authContext)
    
    // Get all unprocessed activity data
    const unprocessedData = await db.getUnprocessedActivityData(c.env, user.organizationId)
    
    let processed = 0
    const errors: string[] = []
    
    // Process each activity data record
    for (const activity of unprocessedData) {
      try {
        // Get emission factor
        const emissionFactor = getEmissionFactor(activity.activityType, activity.unit)
        
        // Calculate CO2e emissions (convert kgCO2e to tonnes)
        const co2eKg = activity.value * emissionFactor.value
        const co2eTonnes = co2eKg / 1000
        
        // Save calculated emissions
        await db.saveCalculatedEmissions(c.env, {
          activityDataId: activity.id,
          organizationId: user.organizationId,
          ghgScope: emissionFactor.scope,
          category: emissionFactor.category,
          co2e: co2eTonnes,
          emissionFactorSource: emissionFactor.source,
        })
        
        // Mark as processed
        await db.markActivityDataAsProcessed(c.env, activity.id)
        processed++
      } catch (error) {
        errors.push(`${activity.id}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
    
    return c.json({
      message: `Processed ${processed} records${errors.length > 0 ? ` with ${errors.length} errors` : ''}`,
      processed,
      errors
    }, errors.length > 0 ? 207 : 202)
  } catch (error) {
    console.error('Error processing calculations:', error)
    return c.json({ 
      error: error instanceof Error ? error.message : 'Calculation process failed' 
    }, 500)
  }
})

// POST /api/v1/calculations/enhanced - Enhanced calculations with industry methodologies
app.post('/api/v1/calculations/enhanced', async (c) => {
  try {
    const authContext = c.get('authContext')
    const user = requireAuth(authContext)
    
    const body = await c.req.json()
    const { industry, region = 'uk', methodology } = body
    
    const calculator = new EnhancedCalculationEngine(c.env)
    
    // Get all unprocessed activity data
    const unprocessedData = await db.getUnprocessedActivityData(c.env, user.organizationId)
    
    const activities = unprocessedData.map(activity => ({
      activityDataId: activity.id,
      organizationId: user.organizationId,
      activityType: activity.activityType,
      value: activity.value,
      unit: activity.unit,
      region,
      industry,
      methodology
    }))
    
    const results = await calculator.batchCalculateEmissions(activities)
    
    // Mark processed activities
    for (const activity of unprocessedData) {
      await db.markActivityDataAsProcessed(c.env, activity.id)
    }
    
    return c.json({
      message: `Enhanced calculations completed: ${results.length} records processed`,
      processed: results.length,
      results: results.map(r => ({
        id: r.id,
        activityDataId: r.activityDataId,
        co2e: r.co2e,
        co2eRange: { min: r.co2eMin, max: r.co2eMax },
        methodology: r.methodology,
        qualityScore: r.qualityScore,
        ghgScope: r.ghgScope,
        category: r.category
      }))
    })
  } catch (error) {
    console.error('Error processing enhanced calculations:', error)
    return c.json({ 
      error: error instanceof Error ? error.message : 'Enhanced calculation failed' 
    }, 500)
  }
})

// POST /api/v1/emission-factors/custom - Create custom emission factor
app.post('/api/v1/emission-factors/custom', async (c) => {
  try {
    const authContext = c.get('authContext')
    const user = requireAuth(authContext)
    
    const body = await c.req.json()
    const calculator = new EnhancedCalculationEngine(c.env)
    
    const customFactor = await calculator.createCustomEmissionFactor(
      user.organizationId, body
    )
    
    return c.json({ 
      message: 'Custom emission factor created',
      factor: customFactor 
    }, 201)
  } catch (error) {
    console.error('Error creating custom emission factor:', error)
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to create custom factor' 
    }, 500)
  }
})

// GET /api/v1/methodologies/:industry - Get industry methodologies
app.get('/api/v1/methodologies/:industry', async (c) => {
  try {
    const industry = c.req.param('industry')
    const calculator = new EnhancedCalculationEngine(c.env)
    
    const methodologies = calculator.getIndustryMethodologies(industry)
    
    return c.json({ data: methodologies })
  } catch (error) {
    console.error('Error fetching methodologies:', error)
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch methodologies' 
    }, 500)
  }
})

// GET /api/v1/emissions/summary - Get emissions summary
app.get('/api/v1/emissions/summary', async (c) => {
  try {
    const authContext = c.get('authContext')
    const user = requireAuth(authContext)
    
    const summary = await db.calculateEmissionsSummary(c.env, user.organizationId)
    return c.json(summary)
  } catch (error) {
    console.error('Error calculating emissions summary:', error)
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to calculate emissions summary' 
    }, 500)
  }
})

// GET /api/v1/emissions/timeseries - Get timeseries emissions data
app.get('/api/v1/emissions/timeseries', async (c) => {
  try {
    const authContext = c.get('authContext')
    const user = requireAuth(authContext)
    
    const period = c.req.query('period') || '12m'
    const scope = c.req.query('scope') || 'all'
    const groupBy = c.req.query('groupBy') || 'month'
    
    const timeseries = await db.getEmissionsTimeseries(c.env, user.organizationId, {
      period, scope, groupBy
    })
    
    return c.json({ data: timeseries })
  } catch (error) {
    console.error('Error fetching timeseries data:', error)
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch timeseries data' 
    }, 500)
  }
})

// GET /api/v1/emissions/breakdown - Get emissions breakdown by category
app.get('/api/v1/emissions/breakdown', async (c) => {
  try {
    const authContext = c.get('authContext')
    const user = requireAuth(authContext)
    
    const period = c.req.query('period') || '12m'
    const scope = c.req.query('scope') || 'all'
    const sortBy = c.req.query('sortBy') || 'co2e_desc'
    const limit = parseInt(c.req.query('limit') || '10')
    
    const breakdown = await db.getEmissionsBreakdown(c.env, user.organizationId, {
      period, scope, sortBy, limit
    })
    
    return c.json({ data: breakdown })
  } catch (error) {
    console.error('Error fetching breakdown data:', error)
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch breakdown data' 
    }, 500)
  }
})

// GET /api/v1/analytics/benchmarking - Get industry benchmarking data
app.get('/api/v1/analytics/benchmarking', async (c) => {
  try {
    const authContext = c.get('authContext')
    const user = requireAuth(authContext)
    
    const industry = c.req.query('industry') || 'general'
    const metric = c.req.query('metric') || 'carbon_intensity'
    
    const benchmarking = await getBenchmarks(c.env, user.organizationId, industry, metric)
    
    return c.json({ data: benchmarking })
  } catch (error) {
    console.error('Error fetching benchmarking data:', error)
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch benchmarking data' 
    }, 500)
  }
})

// GET /api/v1/analytics/predictions - Get predictive analytics
app.get('/api/v1/analytics/predictions', async (c) => {
  try {
    const authContext = c.get('authContext')
    const user = requireAuth(authContext)
    
    const months = parseInt(c.req.query('months') || '6')
    const algorithm = c.req.query('algorithm') || 'linear_trend'
    
    const predictions = await generateEmissionsPredictions(c.env, user.organizationId, months, algorithm)
    
    return c.json({ data: predictions })
  } catch (error) {
    console.error('Error generating predictions:', error)
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to generate predictions' 
    }, 500)
  }
})

// GET /api/v1/analytics/alerts - Get real-time alerts
app.get('/api/v1/analytics/alerts', async (c) => {
  try {
    const authContext = c.get('authContext')
    const user = requireAuth(authContext)
    
    const status = c.req.query('status') || 'active'
    const severity = c.req.query('severity')
    
    const alerts = await getAnalyticsAlerts(c.env, user.organizationId, { status, severity })
    
    return c.json({ data: alerts })
  } catch (error) {
    console.error('Error fetching alerts:', error)
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch alerts' 
    }, 500)
  }
})

// GET /api/v1/analytics/real-time - Get real-time monitoring data
app.get('/api/v1/analytics/real-time', async (c) => {
  try {
    const authContext = c.get('authContext')
    const user = requireAuth(authContext)
    
    const metrics = c.req.query('metrics')?.split(',') || ['emissions', 'energy', 'intensity']
    
    const realtimeData = await getRealTimeMetrics(c.env, user.organizationId, metrics)
    
    return c.json({ data: realtimeData })
  } catch (error) {
    console.error('Error fetching real-time data:', error)
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch real-time data' 
    }, 500)
  }
})

// GET /api/v1/analytics/kpis - Get key performance indicators
app.get('/api/v1/analytics/kpis', async (c) => {
  try {
    const authContext = c.get('authContext')
    const user = requireAuth(authContext)
    
    const kpis = await getEmissionsKPIs(c.env, user.organizationId)
    
    return c.json({ data: kpis })
  } catch (error) {
    console.error('Error fetching KPIs:', error)
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch KPIs' 
    }, 500)
  }
})

// Helper endpoints
app.get('/api/v1/health', (c) => {
  return c.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    database: c.env.DB ? 'D1 Connected' : 'No Database',
    version: '1.0.0'
  })
})

app.get('/api/v1/auth/user', async (c) => {
  try {
    const authContext = c.get('authContext')
    if (!authContext.isAuthenticated || !authContext.user) {
      return c.json({ error: 'Not authenticated' }, 401)
    }
    
    return c.json({ user: authContext.user })
  } catch (error) {
    return c.json({ error: 'Failed to get user info' }, 500)
  }
})

// GET /api/v1/oauth/authorize/:provider - Generate authorization URL
app.get('/api/v1/oauth/authorize/:provider', async (c) => {
  try {
    const authContext = c.get('authContext')
    const user = requireAuth(authContext)
    const provider = c.req.param('provider')
    
    const validProviders = ['octopus_energy', 'edf_energy', 'british_gas']
    if (!validProviders.includes(provider)) {
      return c.json({ error: `Unsupported provider: ${provider}` }, 400)
    }
    
    const authUrl = await generateAuthorizationUrl(c.env, user.organizationId, provider)
    
    return c.json({
      authUrl: authUrl.url,
      state: authUrl.state,
      provider
    })
  } catch (error) {
    console.error('Error generating authorization URL:', error)
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to generate authorization URL' 
    }, 500)
  }
})

// GET /api/v1/oauth/callback/:provider - Handle OAuth callback
app.get('/api/v1/oauth/callback/:provider', async (c) => {
  try {
    const provider = c.req.param('provider')
    const code = c.req.query('code')
    const state = c.req.query('state')
    
    if (!code || !state) {
      return c.json({ error: 'Missing required parameters: code, state' }, 400)
    }
    
    const result = await handleOAuthCallback(c.env, provider, code, state)
    
    if (!result.success) {
      return c.json({ error: result.error }, 400)
    }
    
    // Redirect user back to the frontend application
    const frontendUrl = `${c.env.FRONTEND_URL}/dashboard?integration=${provider}&status=success`
    return c.redirect(frontendUrl)
  } catch (error) {
    console.error('Error handling OAuth callback:', error)
    
    // Redirect user back with error status
    const frontendUrl = `${c.env.FRONTEND_URL}/dashboard?status=error`
    return c.redirect(frontendUrl)
  }
})

// POST /api/v1/oauth/refresh/:dataSourceId - Refresh OAuth token
app.post('/api/v1/oauth/refresh/:dataSourceId', async (c) => {
  try {
    const authContext = c.get('authContext')
    requireAuth(authContext)
    const dataSourceId = c.req.param('dataSourceId')
    
    const result = await refreshAccessToken(c.env, dataSourceId)
    
    if (!result.success) {
      return c.json({ error: result.error }, 400)
    }
    
    return c.json({
      message: 'Token refreshed successfully',
      expiresAt: new Date(Date.now() + ((result.tokens?.expiresIn || 3600) * 1000)).toISOString()
    })
  } catch (error) {
    console.error('Error refreshing token:', error)
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to refresh token' 
    }, 500)
  }
})

// DELETE /api/v1/oauth/:dataSourceId - Revoke OAuth access
app.delete('/api/v1/oauth/:dataSourceId', async (c) => {
  try {
    const authContext = c.get('authContext')
    requireAuth(authContext)
    const dataSourceId = c.req.param('dataSourceId')
    
    const success = await revokeAccess(c.env, dataSourceId)
    
    if (!success) {
      return c.json({ error: 'Failed to revoke access' }, 400)
    }
    
    return c.body(null, 204) // No content
  } catch (error) {
    console.error('Error revoking access:', error)
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to revoke access' 
    }, 500)
  }
})

// POST /api/v1/datasources/:id/sync - Manual sync trigger
app.post('/api/v1/datasources/:id/sync', async (c) => {
  try {
    const authContext = c.get('authContext')
    requireAuth(authContext)
    const dataSourceId = c.req.param('id')
    
    const result = await triggerManualSync(c.env, dataSourceId)
    
    return c.json({
      message: result.success 
        ? `Sync completed: ${result.recordsCreated} records created` 
        : `Sync failed: ${result.errors.join(', ')}`,
      ...result
    }, result.success ? 200 : 500)
  } catch (error) {
    console.error('Error triggering sync:', error)
    return c.json({ 
      error: error instanceof Error ? error.message : 'Sync trigger failed' 
    }, 500)
  }
})

// Trading platform migration endpoint
app.post('/api/v1/admin/migrate-trading-tables', async (c) => {
  try {
    const authContext = c.get('authContext')
    // Allow this to work without authentication for initial setup
    
    const db = c.env.DB
    
    // Check if migration is needed
    const migrationNeeded = !(await checkTradingTablesExist(c.env))
    
    if (!migrationNeeded) {
      return c.json({
        message: 'Trading platform tables are already up to date',
        migrationNeeded: false
      })
    }
    
    // Run the migration
    await createTradingTables(c.env)
    
    return c.json({
      message: 'Trading platform tables migration completed successfully',
      migrationNeeded: true,
      completed: true
    })
  } catch (error) {
    console.error('Trading migration error:', error)
    return c.json({
      error: error instanceof Error ? error.message : 'Trading migration failed'
    }, 500)
  }
})

// Database migration endpoint
app.post('/api/v1/admin/migrate-supplier-tables', async (c) => {
  try {
    const authContext = c.get('authContext')
    const user = requireAuth(authContext)
    
    // Check if user has admin permissions (you might want to add role checking)
    // For now, any authenticated user can run migrations in development
    
    const db = c.env.DB
    
    // Check if migration is needed
    const migrationNeeded = !(await checkSupplierTablesSchema(db))
    
    if (!migrationNeeded) {
      return c.json({
        message: 'Supplier tables are already up to date',
        migrationNeeded: false
      })
    }
    
    // Run the migration
    await runSupplierMigration(db)
    
    return c.json({
      message: 'Supplier collaboration tables migration completed successfully',
      migrationNeeded: true,
      completed: true
    })
  } catch (error) {
    console.error('Migration error:', error)
    return c.json({
      error: error instanceof Error ? error.message : 'Migration failed'
    }, 500)
  }
})

// Market Data Endpoints
app.get('/api/v1/market/data', async (c) => {
  try {
    const marketService = getMarketDataService(c.env)
    const data = await marketService.getAllMarketData()
    
    return c.json({ success: true, data })
  } catch (error) {
    console.error('Error fetching market data:', error)
    return c.json({ error: 'Failed to fetch market data' }, 500)
  }
})

app.get('/api/v1/market/data/:symbol', async (c) => {
  try {
    const marketService = getMarketDataService(c.env)
    const symbol = c.req.param('symbol')
    const data = await marketService.getMarketData(symbol)
    
    if (!data) {
      return c.json({ error: 'Symbol not found' }, 404)
    }
    
    return c.json({ success: true, data })
  } catch (error) {
    console.error('Error fetching market data:', error)
    return c.json({ error: 'Failed to fetch market data' }, 500)
  }
})

app.get('/api/v1/market/history/:symbol', async (c) => {
  try {
    const marketService = getMarketDataService(c.env)
    const symbol = c.req.param('symbol')
    const timeframe = c.req.query('timeframe') || '1h'
    const limit = parseInt(c.req.query('limit') || '100')
    
    const data = await marketService.getHistoricalData(symbol, timeframe, limit)
    
    return c.json({ success: true, data })
  } catch (error) {
    console.error('Error fetching historical data:', error)
    return c.json({ error: 'Failed to fetch historical data' }, 500)
  }
})

app.get('/api/v1/market/orderbook/:symbol', async (c) => {
  try {
    const marketService = getMarketDataService(c.env)
    const symbol = c.req.param('symbol')
    const data = await marketService.getOrderBook(symbol)
    
    return c.json({ success: true, data })
  } catch (error) {
    console.error('Error fetching order book:', error)
    return c.json({ error: 'Failed to fetch order book' }, 500)
  }
})

app.get('/api/v1/market/pairs', async (c) => {
  try {
    const marketService = getMarketDataService(c.env)
    const data = await marketService.getTradingPairs()
    
    return c.json({ success: true, data })
  } catch (error) {
    console.error('Error fetching trading pairs:', error)
    return c.json({ error: 'Failed to fetch trading pairs' }, 500)
  }
})

// Test Account Endpoints
app.get('/api/v1/demo/account', async (c) => {
  try {
    const authContext = c.get('authContext')
    const user = requireAuth(authContext)
    
    const testService = getTestAccountService(c.env)
    const account = await testService.getOrCreateTestAccount(user.userId)
    
    return c.json({ success: true, data: account })
  } catch (error) {
    console.error('Error getting test account:', error)
    return c.json({ error: 'Failed to get test account' }, 500)
  }
})

app.post('/api/v1/demo/trade', async (c) => {
  try {
    const authContext = c.get('authContext')
    const user = requireAuth(authContext)
    const body = await c.req.json()
    
    const testService = getTestAccountService(c.env)
    const account = await testService.getOrCreateTestAccount(user.userId)
    
    const trade = await testService.placeDemoTrade(
      account.id,
      body.symbol,
      body.side,
      body.quantity,
      body.price,
      body.orderType || 'market'
    )
    
    return c.json({ success: true, data: trade })
  } catch (error) {
    console.error('Error placing demo trade:', error)
    return c.json({ error: error instanceof Error ? error.message : 'Failed to place trade' }, 500)
  }
})

app.get('/api/v1/demo/portfolio', async (c) => {
  try {
    const authContext = c.get('authContext')
    const user = requireAuth(authContext)
    
    const testService = getTestAccountService(c.env)
    const account = await testService.getOrCreateTestAccount(user.userId)
    const portfolio = await testService.getTestPortfolio(account.id)
    
    return c.json({ success: true, data: portfolio })
  } catch (error) {
    console.error('Error getting portfolio:', error)
    return c.json({ error: 'Failed to get portfolio' }, 500)
  }
})

app.get('/api/v1/demo/trades', async (c) => {
  try {
    const authContext = c.get('authContext')
    const user = requireAuth(authContext)
    
    const testService = getTestAccountService(c.env)
    const account = await testService.getOrCreateTestAccount(user.userId)
    const trades = await testService.getDemoTrades(account.id)
    
    return c.json({ success: true, data: trades })
  } catch (error) {
    console.error('Error getting trades:', error)
    return c.json({ error: 'Failed to get trades' }, 500)
  }
})

app.get('/api/v1/demo/achievements', async (c) => {
  try {
    const authContext = c.get('authContext')
    const user = requireAuth(authContext)
    
    const testService = getTestAccountService(c.env)
    const achievements = await testService.getUserAchievements(user.userId)
    
    return c.json({ success: true, data: achievements })
  } catch (error) {
    console.error('Error getting achievements:', error)
    return c.json({ error: 'Failed to get achievements' }, 500)
  }
})

app.post('/api/v1/demo/reset', async (c) => {
  try {
    const authContext = c.get('authContext')
    const user = requireAuth(authContext)
    
    const testService = getTestAccountService(c.env)
    const account = await testService.getOrCreateTestAccount(user.userId)
    const resetAccount = await testService.resetTestAccount(account.id)
    
    return c.json({ success: true, data: resetAccount })
  } catch (error) {
    console.error('Error resetting account:', error)
    return c.json({ error: 'Failed to reset account' }, 500)
  }
})

// Simple test endpoints
app.post('/api/v1/test/create-sample-data', async (c) => {
  try {
    const authContext = c.get('authContext')
    const user = requireAuth(authContext)
    
    // Get user's first data source or create a default one
    const dataSources = await db.getDataSourcesByOrganization(c.env, user.organizationId)
    let dataSourceId = dataSources[0]?.id
    
    if (!dataSourceId) {
      const newDataSource = await db.createDataSource(c.env, {
        organizationId: user.organizationId,
        type: 'manual_entry',
        provider: 'test_data',
        status: 'active'
      })
      dataSourceId = newDataSource.id
    }
    
    // Create sample activity data
    const sampleActivities = [
      { activityType: 'electricity_usage', value: 1500, unit: 'kWh' },
      { activityType: 'natural_gas', value: 800, unit: 'kWh' },
      { activityType: 'diesel_fuel', value: 200, unit: 'litres' },
      { activityType: 'air_travel_short_haul', value: 2500, unit: 'passenger_km' }
    ]
    
    const created = []
    for (const activity of sampleActivities) {
      const activityData = await db.createActivityData(c.env, {
        dataSourceId,
        organizationId: user.organizationId,
        activityType: activity.activityType,
        value: activity.value,
        unit: activity.unit,
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      })
      created.push(activityData)
    }
    
    return c.json({ 
      message: `Created ${created.length} sample activity records`,
      activities: created
    }, 201)
  } catch (error) {
    console.error('Error creating sample data:', error)
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to create sample data' 
    }, 500)
  }
})

// Initialize database with default organization (for development)
app.post('/api/v1/test/init-db', async (c) => {
  try {
    const authContext = c.get('authContext')
    const user = requireAuth(authContext)
    
    // Check if organization exists
    const existingOrg = await db.getOrganizationById(c.env, user.organizationId)
    
    if (!existingOrg) {
      // Create default organization
      const org = await db.createOrganization(c.env, 'Test Organization')
      console.log('Created organization:', org)
      
      return c.json({
        message: 'Database initialized successfully',
        organization: org
      }, 201)
    }
    
    return c.json({
      message: 'Database already initialized',
      organization: existingOrg
    })
  } catch (error) {
    console.error('Error initializing database:', error)
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to initialize database' 
    }, 500)
  }
})

// Cloudflare Scheduled Event handler for data synchronization
export async function scheduled(
  controller: ScheduledController,
  env: Env,
  ctx: ExecutionContext
): Promise<void> {
  console.log('Scheduled event triggered:', controller.scheduledTime);
  
  try {
    // Run data synchronization every hour
    await handleScheduledSync(env);
    console.log('Scheduled sync completed successfully');
  } catch (error) {
    console.error('Scheduled sync failed:', error);
    // Don't throw - we don't want to retry failed syncs automatically
  }
}

export default app
