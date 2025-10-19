import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { authenticateRequest, requireAuth } from './services/authService'
import * as db from './services/d1DatabaseService'
import { getEmissionFactor } from './services/emissionFactors'

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
    
    const benchmarking = await db.getIndustryBenchmarks(c.env, user.organizationId, industry, metric)
    
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
    
    const predictions = await db.generateEmissionsPredictions(c.env, user.organizationId, months, algorithm)
    
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
    
    const alerts = await db.getAnalyticsAlerts(c.env, user.organizationId, { status, severity })
    
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
    
    const realtimeData = await db.getRealTimeMetrics(c.env, user.organizationId, metrics)
    
    return c.json({ data: realtimeData })
  } catch (error) {
    console.error('Error fetching real-time data:', error)
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch real-time data' 
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

export default app