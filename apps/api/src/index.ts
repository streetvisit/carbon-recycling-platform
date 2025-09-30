import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { clerkMiddleware, getAuth } from '@clerk/backend'
import { 
  createActivityData, 
  processAllActivityData, 
  calculateEmissionsSummary 
} from './services/calculationService'
import { getSupportedActivityTypes } from './services/emissionFactors'
import { 
  getEmissionsTimeseries, 
  getEmissionsBreakdown, 
  getAvailableDateRange 
} from './services/analyticsService'
import { 
  createInitiative, 
  getAllInitiatives, 
  getInitiativeById, 
  updateInitiative, 
  deleteInitiative,
  getAvailableCategories 
} from './services/initiativeService'
import { 
  calculateProjectedReduction, 
  generateForecast, 
  getForecastsForInitiative,
  deleteForecastsForInitiative 
} from './services/forecastingService'
import { CreateInitiativeRequest, UpdateInitiativeRequest } from './types/initiatives'
import { CreateReportRequest } from './types/reports'
import { 
  createReport, 
  getAllReports, 
  getReportById,
  updateReportStatus,
  getAvailableReportTypes
} from './services/reportService'
import { generateReport } from './services/reportGenerationService'
import { R2Client } from './utils/r2Client'
import { 
  CreateSupplierRequest,
  CreateSupplierInviteRequest, 
  CreateDataRequestRequest
} from './types/suppliers'
import { 
  createSupplier,
  getAllSuppliers,
  getSupplierById,
  deleteSupplier,
  createSupplierInvite
} from './services/supplierService'
import { 
  createDataRequest,
  getAllDataRequests,
  getDataRequestById,
  approveDataSubmission
} from './services/dataRequestService'
import { getDataTypeOptions } from './services/supplierDataProcessor'

export interface Env {
	CLERK_PUBLISHABLE_KEY: string
	CLERK_SECRET_KEY: string
	// Database bindings will be added later
	// DATABASE_URL: string
	// Module 5: Report generation environment variables
	BROWERLESS_API_KEY?: string
	BROWERLESS_ENDPOINT?: string
	R2_BUCKET_NAME?: string
	R2_ACCESS_KEY_ID?: string
	R2_SECRET_ACCESS_KEY?: string
	R2_ENDPOINT?: string
}

interface DataSource {
	id: string
	organizationId: string
	type: 'api_integration' | 'file_upload' | 'manual_entry'
	provider: string
	status: 'active' | 'pending' | 'error'
	lastSyncedAt: string | null
	createdAt: string
}

// Mock data for now - will be replaced with actual database queries
const mockDataSources: DataSource[] = [
	{
		id: 'ds_1',
		organizationId: 'org_1',
		type: 'api_integration',
		provider: 'aws',
		status: 'active',
		lastSyncedAt: '2025-09-29T10:00:00Z',
		createdAt: '2025-09-25T08:00:00Z'
	},
	{
		id: 'ds_2',
		organizationId: 'org_1',
		type: 'file_upload',
		provider: 'csv_fleet_data',
		status: 'active',
		lastSyncedAt: '2025-09-28T15:30:00Z',
		createdAt: '2025-09-20T12:00:00Z'
	}
]

function generateId(prefix: string): string {
	return `${prefix}_${Math.random().toString(36).substr(2, 9)}`
}

const app = new Hono<{ Bindings: Env }>()

// CORS middleware
app.use('*', cors({
	origin: ['http://localhost:4321', 'https://carbon-recycling.pages.dev'],
	credentials: true
}))

// Clerk authentication middleware
app.use('/api/*', async (c, next) => {
	const authHeader = c.req.header('authorization')
	
	if (!authHeader) {
		return c.json({ error: 'Unauthorized - No auth header' }, 401)
	}
	
	// For now, mock the authentication - in production, verify JWT token
	// const auth = getAuth(c.req.raw)
	// Mock organization assignment - in real app, fetch from database
	c.set('userId', 'user_mock_123')
	c.set('organizationId', 'org_1') // Mock org ID
	
	return next()
})

// GET /api/v1/datasources - Fetch all data sources for organization
app.get('/api/v1/datasources', async (c) => {
	const organizationId = c.get('organizationId')
	
	// Filter mock data by organization
	const userDataSources = mockDataSources.filter(
		ds => ds.organizationId === organizationId
	)
	
	return c.json({
		data: userDataSources.map(ds => ({
			id: ds.id,
			provider: ds.provider,
			type: ds.type,
			status: ds.status,
			lastSyncedAt: ds.lastSyncedAt
		}))
	})
})

// POST /api/v1/datasources - Create new data source
app.post('/api/v1/datasources', async (c) => {
	const organizationId = c.get('organizationId')
	const body = await c.req.json()
	
	if (!body.type || !body.provider) {
		return c.json({ error: 'Missing required fields: type, provider' }, 400)
	}
	
	const newDataSource: DataSource = {
		id: generateId('ds'),
		organizationId,
		type: body.type,
		provider: body.provider,
		status: 'pending',
		lastSyncedAt: null,
		createdAt: new Date().toISOString()
	}
	
	// Add to mock data
	mockDataSources.push(newDataSource)
	
	return c.json({
		id: newDataSource.id,
		provider: newDataSource.provider,
		type: newDataSource.type,
		status: newDataSource.status,
		lastSyncedAt: newDataSource.lastSyncedAt
	}, 201)
})

// DELETE /api/v1/datasources/:id - Delete data source
app.delete('/api/v1/datasources/:id', async (c) => {
	const organizationId = c.get('organizationId')
	const dataSourceId = c.req.param('id')
	
	const index = mockDataSources.findIndex(
		ds => ds.id === dataSourceId && ds.organizationId === organizationId
	)
	
	if (index === -1) {
		return c.json({ error: 'Data source not found' }, 404)
	}
	
	// Remove from mock data
	mockDataSources.splice(index, 1)
	
	return c.body(null, 204)
})

// MODULE 2: EMISSIONS CALCULATION ENGINE ENDPOINTS

// POST /api/v1/ingestion/mock - Create mock activity data for testing
app.post('/api/v1/ingestion/mock', async (c) => {
	const organizationId = c.get('organizationId')
	const body = await c.req.json()
	
	if (!body.dataSourceId || !body.activityType || !body.value || !body.unit || !body.startDate || !body.endDate) {
		return c.json({ 
			error: 'Missing required fields: dataSourceId, activityType, value, unit, startDate, endDate' 
		}, 400)
	}
	
	// Validate activity type is supported
	const supportedTypes = getSupportedActivityTypes()
	if (!supportedTypes.includes(body.activityType)) {
		return c.json({ 
			error: `Unsupported activity type: ${body.activityType}. Supported types: ${supportedTypes.join(', ')}` 
		}, 400)
	}
	
	try {
		const activityData = createActivityData({
			dataSourceId: body.dataSourceId,
			organizationId,
			activityType: body.activityType,
			value: parseFloat(body.value),
			unit: body.unit,
			startDate: body.startDate,
			endDate: body.endDate,
		})
		
		return c.json(activityData, 201)
	} catch (error) {
		return c.json({ 
			error: error instanceof Error ? error.message : 'Failed to create activity data' 
		}, 500)
	}
})

// POST /api/v1/calculations - Trigger calculation for all unprocessed activity data
app.post('/api/v1/calculations', async (c) => {
	const organizationId = c.get('organizationId')
	
	try {
		const results = await processAllActivityData(organizationId)
		
		if (results.errors.length > 0) {
			return c.json({
				message: `Calculation process completed with errors. Processed: ${results.processed} records.`,
				processed: results.processed,
				errors: results.errors
			}, 207) // 207 Multi-Status
		}
		
		return c.json({
			message: `Calculation process started for ${results.processed} records.`,
			processed: results.processed
		}, 202) // 202 Accepted
	} catch (error) {
		return c.json({ 
			error: error instanceof Error ? error.message : 'Calculation process failed' 
		}, 500)
	}
})

// GET /api/v1/emissions/summary - Get aggregated emissions data
app.get('/api/v1/emissions/summary', async (c) => {
	const organizationId = c.get('organizationId')
	
	try {
		const summary = calculateEmissionsSummary(organizationId)
		return c.json(summary)
	} catch (error) {
		return c.json({ 
			error: error instanceof Error ? error.message : 'Failed to calculate emissions summary' 
		}, 500)
	}
})

// GET /api/v1/activity-types - Get supported activity types (helper endpoint)
app.get('/api/v1/activity-types', async (c) => {
	try {
		const activityTypes = getSupportedActivityTypes()
		return c.json({ activityTypes })
	} catch (error) {
		return c.json({ 
			error: error instanceof Error ? error.message : 'Failed to get activity types' 
		}, 500)
	}
})

// MODULE 3: ANALYTICS DASHBOARD ENDPOINTS

// GET /api/v1/emissions/timeseries - Get emissions data over time
app.get('/api/v1/emissions/timeseries', async (c) => {
	const organizationId = c.get('organizationId')
	
	// Parse query parameters
	const period = c.req.query('period') || '12m'
	const groupBy = c.req.query('groupBy') as 'month' | 'quarter' || 'month'
	const scope = c.req.query('scope') as 'scope_1' | 'scope_2' | 'scope_3' | undefined
	
	try {
		const data = getEmissionsTimeseries(organizationId, {
			period,
			groupBy,
			scope
		})
		
		return c.json({ data })
	} catch (error) {
		return c.json({ 
			error: error instanceof Error ? error.message : 'Failed to get timeseries data' 
		}, 500)
	}
})

// GET /api/v1/emissions/breakdown - Get emissions breakdown by category
app.get('/api/v1/emissions/breakdown', async (c) => {
	const organizationId = c.get('organizationId')
	
	// Parse query parameters
	const period = c.req.query('period') || '12m'
	const scope = c.req.query('scope') as 'scope_1' | 'scope_2' | 'scope_3' | undefined
	const sortBy = c.req.query('sortBy') as 'co2e_desc' | 'co2e_asc' || 'co2e_desc'
	const limitStr = c.req.query('limit')
	const limit = limitStr ? parseInt(limitStr) : undefined
	
	try {
		const data = getEmissionsBreakdown(organizationId, {
			period,
			scope,
			sortBy,
			limit
		})
		
		return c.json({ data })
	} catch (error) {
		return c.json({ 
			error: error instanceof Error ? error.message : 'Failed to get breakdown data' 
		}, 500)
	}
})

// GET /api/v1/emissions/date-range - Get available date range for organization
app.get('/api/v1/emissions/date-range', async (c) => {
	const organizationId = c.get('organizationId')
	
	try {
		const dateRange = getAvailableDateRange(organizationId)
		return c.json(dateRange)
	} catch (error) {
		return c.json({ 
			error: error instanceof Error ? error.message : 'Failed to get date range' 
		}, 500)
	}
})

// MODULE 4: DECARBONISATION PLANNER ENDPOINTS

// POST /api/v1/initiatives - Create a new initiative
app.post('/api/v1/initiatives', async (c) => {
	const organizationId = c.get('organizationId')
	const body = await c.req.json() as CreateInitiativeRequest
	
	if (!body.name || !body.reductionTarget) {
		return c.json({ 
			error: 'Missing required fields: name, reductionTarget' 
		}, 400)
	}
	
	if (!body.reductionTarget.category || !body.reductionTarget.percentage) {
		return c.json({ 
			error: 'reductionTarget must include category and percentage' 
		}, 400)
	}
	
	try {
		// Calculate the projected reduction
		const projectedReduction = await calculateProjectedReduction(
			organizationId, 
			body.reductionTarget
		)
		
		// Create the initiative
		const initiative = await createInitiative(organizationId, {
			...body,
			projectedCo2eReduction: projectedReduction
		})
		
		// Generate forecast data for the initiative
		await generateForecast(initiative)
		
		return c.json(initiative, 201)
	} catch (error) {
		return c.json({ 
			error: error instanceof Error ? error.message : 'Failed to create initiative' 
		}, 500)
	}
})

// GET /api/v1/initiatives - Get all initiatives for organization
app.get('/api/v1/initiatives', async (c) => {
	const organizationId = c.get('organizationId')
	
	try {
		const initiatives = await getAllInitiatives(organizationId)
		return c.json({ data: initiatives })
	} catch (error) {
		return c.json({ 
			error: error instanceof Error ? error.message : 'Failed to fetch initiatives' 
		}, 500)
	}
})

// GET /api/v1/initiatives/:id - Get a single initiative with forecasts
app.get('/api/v1/initiatives/:id', async (c) => {
	const organizationId = c.get('organizationId')
	const initiativeId = c.req.param('id')
	
	try {
		const initiative = await getInitiativeById(organizationId, initiativeId)
		
		if (!initiative) {
			return c.json({ error: 'Initiative not found' }, 404)
		}
		
		// Get associated forecasts
		const forecasts = await getForecastsForInitiative(organizationId, initiativeId)
		
		return c.json({ 
			...initiative, 
			forecasts 
		})
	} catch (error) {
		return c.json({ 
			error: error instanceof Error ? error.message : 'Failed to fetch initiative' 
		}, 500)
	}
})

// PUT /api/v1/initiatives/:id - Update an initiative
app.put('/api/v1/initiatives/:id', async (c) => {
	const organizationId = c.get('organizationId')
	const initiativeId = c.req.param('id')
	const body = await c.req.json() as UpdateInitiativeRequest
	
	try {
		const updatedInitiative = await updateInitiative(organizationId, initiativeId, body)
		
		if (!updatedInitiative) {
			return c.json({ error: 'Initiative not found' }, 404)
		}
		
		return c.json(updatedInitiative)
	} catch (error) {
		return c.json({ 
			error: error instanceof Error ? error.message : 'Failed to update initiative' 
		}, 500)
	}
})

// DELETE /api/v1/initiatives/:id - Delete an initiative
app.delete('/api/v1/initiatives/:id', async (c) => {
	const organizationId = c.get('organizationId')
	const initiativeId = c.req.param('id')
	
	try {
		// Delete associated forecasts first
		await deleteForecastsForInitiative(organizationId, initiativeId)
		
		// Delete the initiative
		const deleted = await deleteInitiative(organizationId, initiativeId)
		
		if (!deleted) {
			return c.json({ error: 'Initiative not found' }, 404)
		}
		
		return c.body(null, 204)
	} catch (error) {
		return c.json({ 
			error: error instanceof Error ? error.message : 'Failed to delete initiative' 
		}, 500)
	}
})

// GET /api/v1/categories - Get available emission categories for targeting
app.get('/api/v1/categories', async (c) => {
	const organizationId = c.get('organizationId')
	
	try {
		const categories = await getAvailableCategories(organizationId)
		return c.json({ data: categories })
	} catch (error) {
		return c.json({ 
			error: error instanceof Error ? error.message : 'Failed to fetch categories' 
		}, 500)
	}
})

// MODULE 5: REPORTING & COMPLIANCE SUITE ENDPOINTS

// POST /api/v1/reports - Kick off new report generation (async)
app.post('/api/v1/reports', async (c) => {
  const organizationId = c.get('organizationId')
  const body = await c.req.json() as CreateReportRequest

  if (!body.reportType || !body.reportingPeriodStart || !body.reportingPeriodEnd) {
    return c.json({ error: 'Missing required fields: reportType, reportingPeriodStart, reportingPeriodEnd' }, 400)
  }

  try {
    // Create report record with status 'generating'
    const report = await createReport(organizationId, body)

    // Start async report generation
    // In production, this would use Cloudflare Queues
    processReportGeneration(report.id, organizationId, body, c.env)
      .catch(error => console.error('Report generation error:', error))

    return c.json(report, 202) // 202 Accepted
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Failed to queue report generation' }, 500)
  }
})

// GET /api/v1/reports - List all reports for organization
app.get('/api/v1/reports', async (c) => {
  const organizationId = c.get('organizationId')
  try {
    const reports = await getAllReports(organizationId)
    return c.json({ data: reports })
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Failed to fetch reports' }, 500)
  }
})

// GET /api/v1/reports/:id/download - Redirect to signed URL for completed report
app.get('/api/v1/reports/:id/download', async (c) => {
  const organizationId = c.get('organizationId')
  const reportId = c.req.param('id')

  try {
    const report = await getReportById(organizationId, reportId)
    if (!report) {
      return c.json({ error: 'Report not found' }, 404)
    }
    if (report.status !== 'complete' || !report.fileUrl) {
      return c.json({ error: 'Report not ready for download' }, 409)
    }

    // Generate a signed URL if we have R2 credentials
    if (c.env.R2_ACCESS_KEY_ID && c.env.R2_SECRET_ACCESS_KEY && c.env.R2_ENDPOINT && c.env.R2_BUCKET_NAME) {
      const r2Client = new R2Client({
        accessKeyId: c.env.R2_ACCESS_KEY_ID,
        secretAccessKey: c.env.R2_SECRET_ACCESS_KEY,
        endpoint: c.env.R2_ENDPOINT,
        bucketName: c.env.R2_BUCKET_NAME,
        region: 'auto'
      });
      
      const fileName = `reports/${reportId}.pdf`;
      const signedUrl = await r2Client.getSignedDownloadUrl(fileName, 3600); // 1 hour expiry
      return c.redirect(signedUrl, 302);
    } else {
      // Fallback to direct URL (for mock/development)
      return c.redirect(report.fileUrl, 302);
    }
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Failed to download report' }, 500)
  }
})

// GET /api/v1/report-types - Helper endpoint to list available report types
app.get('/api/v1/report-types', (c) => {
  const types = getAvailableReportTypes()
  return c.json({ data: types })
})

// MODULE 6: SUPPLIER COLLABORATION PORTAL ENDPOINTS (HOST DASHBOARD)

// POST /api/v1/suppliers - Create a new supplier
app.post('/api/v1/suppliers', async (c) => {
  const organizationId = c.get('organizationId')
  const body = await c.req.json() as CreateSupplierRequest

  if (!body.name || !body.contactEmail) {
    return c.json({ error: 'Missing required fields: name, contactEmail' }, 400)
  }

  try {
    const supplier = await createSupplier(organizationId, body)
    return c.json(supplier, 201)
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Failed to create supplier' }, 500)
  }
})

// GET /api/v1/suppliers - List all suppliers for organization
app.get('/api/v1/suppliers', async (c) => {
  const organizationId = c.get('organizationId')

  try {
    const suppliers = await getAllSuppliers(organizationId)
    return c.json({ data: suppliers })
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Failed to fetch suppliers' }, 500)
  }
})

// DELETE /api/v1/suppliers/:id - Delete a supplier
app.delete('/api/v1/suppliers/:id', async (c) => {
  const organizationId = c.get('organizationId')
  const supplierId = c.req.param('id')

  try {
    const deleted = await deleteSupplier(organizationId, supplierId)
    if (!deleted) {
      return c.json({ error: 'Supplier not found' }, 404)
    }
    return c.body(null, 204)
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Failed to delete supplier' }, 500)
  }
})

// POST /api/v1/suppliers/:id/invite - Send invitation to supplier
app.post('/api/v1/suppliers/:id/invite', async (c) => {
  const organizationId = c.get('organizationId')
  const userId = c.get('userId')
  const supplierId = c.req.param('id')
  const body = await c.req.json() as CreateSupplierInviteRequest

  try {
    const invite = await createSupplierInvite(
      organizationId, 
      supplierId, 
      userId, 
      body.expirationDays
    )
    
    // TODO: Send email with invite link
    // const inviteUrl = `${FRONTEND_URL}/portal/accept-invite/${invite.id}`
    // await sendInviteEmail(supplier.contactEmail, inviteUrl)
    
    return c.json({
      ...invite,
      inviteUrl: `http://localhost:4321/portal/accept-invite/${invite.id}` // Mock URL
    }, 201)
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Failed to create invite' }, 500)
  }
})

// POST /api/v1/data-requests - Create a new data request
app.post('/api/v1/data-requests', async (c) => {
  const organizationId = c.get('organizationId')
  const body = await c.req.json() as CreateDataRequestRequest

  if (!body.supplierId || !body.title || !body.requestedDataType || !body.periodStart || !body.periodEnd) {
    return c.json({ 
      error: 'Missing required fields: supplierId, title, requestedDataType, periodStart, periodEnd' 
    }, 400)
  }

  try {
    const dataRequest = await createDataRequest(organizationId, body)
    return c.json(dataRequest, 201)
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Failed to create data request' }, 500)
  }
})

// GET /api/v1/data-requests - List all data requests for organization
app.get('/api/v1/data-requests', async (c) => {
  const organizationId = c.get('organizationId')

  try {
    const dataRequests = await getAllDataRequests(organizationId)
    return c.json({ data: dataRequests })
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Failed to fetch data requests' }, 500)
  }
})

// GET /api/v1/data-requests/:id/submissions - View submissions for a data request
app.get('/api/v1/data-requests/:id/submissions', async (c) => {
  const organizationId = c.get('organizationId')
  const requestId = c.req.param('id')

  try {
    const requestWithSubmissions = await getDataRequestById(organizationId, requestId)
    if (!requestWithSubmissions) {
      return c.json({ error: 'Data request not found' }, 404)
    }
    return c.json(requestWithSubmissions)
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Failed to fetch submissions' }, 500)
  }
})

// POST /api/v1/data-requests/:id/submissions/:submissionId/approve - Approve a submission
app.post('/api/v1/data-requests/:id/submissions/:submissionId/approve', async (c) => {
  const organizationId = c.get('organizationId')
  const requestId = c.req.param('id')
  const submissionId = c.req.param('submissionId')

  try {
    const approved = await approveDataSubmission(organizationId, requestId, submissionId)
    if (!approved) {
      return c.json({ error: 'Submission not found or already processed' }, 404)
    }
    
    // TODO: Process the approved submission into activity_data
    // This would trigger the supplier data processor
    
    return c.json({ message: 'Submission approved successfully' })
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Failed to approve submission' }, 500)
  }
})

// GET /api/v1/data-types - Helper endpoint to get available data types for requests
app.get('/api/v1/data-types', (c) => {
  const dataTypes = getDataTypeOptions()
  return c.json({ data: dataTypes })
})

// MODULE 6: SUPPLIER PORTAL API ENDPOINTS (/portal/api/v1)
// These endpoints use supplier-specific authentication

import { 
  getDataRequestsForSupplier, 
  submitDataForRequest 
} from './services/dataRequestService'
import { getSupplierByEmail, getInviteByToken, acceptSupplierInvite } from './services/supplierService'

// Supplier authentication middleware
app.use('/portal/api/*', async (c, next) => {
  const authHeader = c.req.header('authorization')
  
  if (!authHeader) {
    return c.json({ error: 'Unauthorized - No auth header' }, 401)
  }
  
  // Mock supplier authentication - in production, verify supplier JWT token
  // For now, extract supplier email from a mock token format
  const token = authHeader.replace('Bearer ', '')
  
  // Mock: assume token format is "supplier:email@example.com"
  if (!token.startsWith('supplier:')) {
    return c.json({ error: 'Invalid supplier token' }, 401)
  }
  
  const supplierEmail = token.replace('supplier:', '')
  const supplier = await getSupplierByEmail(supplierEmail)
  
  if (!supplier) {
    return c.json({ error: 'Supplier not found or inactive' }, 401)
  }
  
  c.set('supplierId', supplier.id)
  c.set('supplierEmail', supplier.contactEmail)
  c.set('organizationId', supplier.organizationId) // Host organization
  
  return next()
})

// GET /portal/api/v1/requests - Get data requests for authenticated supplier
app.get('/portal/api/v1/requests', async (c) => {
  const supplierId = c.get('supplierId')
  
  try {
    const requests = await getDataRequestsForSupplier(supplierId)
    return c.json({ data: requests })
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Failed to fetch requests' }, 500)
  }
})

// POST /portal/api/v1/requests/:id/submit - Submit data for a request
app.post('/portal/api/v1/requests/:id/submit', async (c) => {
  const supplierId = c.get('supplierId')
  const requestId = c.req.param('id')
  const body = await c.req.json()
  
  if (body.submittedValue !== undefined && (isNaN(body.submittedValue) || body.submittedValue < 0)) {
    return c.json({ error: 'Submitted value must be a positive number' }, 400)
  }
  
  try {
    const submission = await submitDataForRequest(requestId, supplierId, body)
    return c.json(submission, 201)
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Failed to submit data' }, 500)
  }
})

// PUBLIC ENDPOINTS (no auth required)

// GET /portal/api/v1/invite/:token - Validate invite token
app.get('/portal/api/v1/invite/:token', async (c) => {
  const token = c.req.param('token')
  
  try {
    const invite = await getInviteByToken(token)
    if (!invite) {
      return c.json({ error: 'Invalid or expired invite' }, 404)
    }
    
    // Get supplier info for the invite
    const supplier = await getSupplierById(invite.organizationId, invite.supplierId)
    if (!supplier) {
      return c.json({ error: 'Supplier not found' }, 404)
    }
    
    return c.json({
      invite,
      supplier,
      valid: true
    })
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Failed to validate invite' }, 500)
  }
})

// POST /portal/api/v1/invite/:token/accept - Accept invite and activate supplier
app.post('/portal/api/v1/invite/:token/accept', async (c) => {
  const token = c.req.param('token')
  
  try {
    const result = await acceptSupplierInvite(token)
    if (!result) {
      return c.json({ error: 'Invalid or expired invite' }, 404)
    }
    
    return c.json({
      message: 'Invite accepted successfully',
      supplier: result.supplier,
      // In a real app, return a JWT token for the supplier
      token: `supplier:${result.supplier.contactEmail}` // Mock token
    })
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Failed to accept invite' }, 500)
  }
})

/**
 * Process report generation asynchronously
 * In production, this would be handled by a Cloudflare Queue consumer
 */
async function processReportGeneration(
  reportId: string, 
  organizationId: string, 
  reportRequest: CreateReportRequest,
  env: Env
): Promise<void> {
  // Add a small delay to simulate queue processing
  setTimeout(async () => {
    try {
      // Check if we have the required environment variables
      if (!env.BROWSERLESS_API_KEY || !env.R2_BUCKET_NAME) {
        console.warn('Missing environment variables for report generation, using mock generation');
        
        // Mock successful generation after 5 seconds
        setTimeout(async () => {
          await updateReportStatus(
            organizationId, 
            reportId, 
            'complete', 
            `https://mock-storage.example.com/reports/${reportId}.pdf`
          );
        }, 5000);
        return;
      }
      
      // Real report generation
      await generateReport(
        reportId,
        organizationId,
        reportRequest.reportType,
        reportRequest.reportingPeriodStart,
        reportRequest.reportingPeriodEnd,
        {
          BROWSERLESS_API_KEY: env.BROWSERLESS_API_KEY!,
          BROWSERLESS_ENDPOINT: env.BROWSERLESS_ENDPOINT || 'https://chrome.browserless.io',
          R2_BUCKET_NAME: env.R2_BUCKET_NAME!,
          R2_ACCESS_KEY_ID: env.R2_ACCESS_KEY_ID!,
          R2_SECRET_ACCESS_KEY: env.R2_SECRET_ACCESS_KEY!,
          R2_ENDPOINT: env.R2_ENDPOINT!,
        }
      );
      
    } catch (error) {
      console.error(`Report generation failed for ${reportId}:`, error);
      await updateReportStatus(organizationId, reportId, 'failed');
    }
  }, 1000); // 1 second delay to simulate queue processing
}

export default app
