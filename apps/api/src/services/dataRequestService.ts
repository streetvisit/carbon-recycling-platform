// services/dataRequestService.ts - Business logic for supplier data requests

import { 
  DataRequest, 
  CreateDataRequestRequest, 
  DataRequestWithSupplier,
  DataRequestWithSubmissions,
  SupplierDataSubmission,
  SubmitDataRequest
} from '../types/suppliers'
import { getSupplierById } from './supplierService'

// In-memory storage for data requests (to be replaced with database)
let dataRequests: DataRequest[] = []
let supplierSubmissions: SupplierDataSubmission[] = []

function generateId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Create a new data request
 */
export async function createDataRequest(
  organizationId: string, 
  data: CreateDataRequestRequest
): Promise<DataRequest> {
  // Verify supplier exists and belongs to this organization
  const supplier = await getSupplierById(organizationId, data.supplierId)
  if (!supplier) {
    throw new Error('Supplier not found')
  }

  const dataRequest: DataRequest = {
    id: generateId('dr'),
    organizationId,
    supplierId: data.supplierId,
    title: data.title,
    description: data.description,
    requestedDataType: data.requestedDataType,
    periodStart: data.periodStart,
    periodEnd: data.periodEnd,
    status: 'sent', // Auto-send when created
    dueDate: data.dueDate,
    createdAt: new Date().toISOString()
  }
  
  dataRequests.push(dataRequest)
  return dataRequest
}

/**
 * Get all data requests for an organization
 */
export async function getAllDataRequests(organizationId: string): Promise<DataRequestWithSupplier[]> {
  const orgRequests = dataRequests.filter(dr => dr.organizationId === organizationId)
  
  const requestsWithSuppliers: DataRequestWithSupplier[] = []
  
  for (const request of orgRequests) {
    const supplier = await getSupplierById(organizationId, request.supplierId)
    if (supplier) {
      requestsWithSuppliers.push({
        ...request,
        supplier
      })
    }
  }
  
  return requestsWithSuppliers
}

/**
 * Get data requests for a specific supplier (supplier portal view)
 */
export async function getDataRequestsForSupplier(supplierId: string): Promise<DataRequest[]> {
  return dataRequests.filter(dr => dr.supplierId === supplierId && dr.status !== 'draft')
}

/**
 * Get a single data request with submissions
 */
export async function getDataRequestById(
  organizationId: string, 
  requestId: string
): Promise<DataRequestWithSubmissions | null> {
  const request = dataRequests.find(dr => dr.id === requestId && dr.organizationId === organizationId)
  if (!request) {
    return null
  }
  
  const supplier = await getSupplierById(organizationId, request.supplierId)
  if (!supplier) {
    return null
  }
  
  const submissions = supplierSubmissions.filter(sub => sub.dataRequestId === requestId)
  
  return {
    ...request,
    supplier,
    submissions
  }
}

/**
 * Submit data for a request (supplier portal)
 */
export async function submitDataForRequest(
  requestId: string,
  supplierId: string,
  data: SubmitDataRequest
): Promise<SupplierDataSubmission> {
  // Verify request exists and belongs to this supplier
  const request = dataRequests.find(dr => dr.id === requestId && dr.supplierId === supplierId)
  if (!request) {
    throw new Error('Data request not found')
  }
  
  if (request.status === 'approved') {
    throw new Error('Cannot submit data for already approved request')
  }
  
  const submission: SupplierDataSubmission = {
    id: generateId('sub'),
    dataRequestId: requestId,
    submittedBySupplierId: supplierId,
    submittedValue: data.submittedValue,
    submittedUnit: data.submittedUnit,
    notes: data.notes,
    submittedAt: new Date().toISOString()
  }
  
  supplierSubmissions.push(submission)
  
  // Update request status to submitted
  const requestIndex = dataRequests.findIndex(dr => dr.id === requestId)
  dataRequests[requestIndex].status = 'submitted'
  
  return submission
}

/**
 * Approve a data submission (host organization)
 */
export async function approveDataSubmission(
  organizationId: string,
  requestId: string,
  submissionId: string
): Promise<boolean> {
  // Verify request belongs to organization
  const request = dataRequests.find(dr => dr.id === requestId && dr.organizationId === organizationId)
  if (!request) {
    return false
  }
  
  // Verify submission exists
  const submission = supplierSubmissions.find(sub => sub.id === submissionId && sub.dataRequestId === requestId)
  if (!submission) {
    return false
  }
  
  // Update request status to approved
  const requestIndex = dataRequests.findIndex(dr => dr.id === requestId)
  dataRequests[requestIndex].status = 'approved'
  
  return true
}

/**
 * Get submissions for a data request
 */
export async function getSubmissionsForRequest(requestId: string): Promise<SupplierDataSubmission[]> {
  return supplierSubmissions.filter(sub => sub.dataRequestId === requestId)
}

/**
 * Get available data types for requests
 */
export function getAvailableDataTypes(): string[] {
  return [
    'electricity_usage_kwh',
    'natural_gas_usage_kwh',
    'fuel_consumption_litres',
    'waste_generated_tonnes',
    'water_usage_cubic_meters',
    'total_co2e_tonnes',
    'renewable_energy_percentage',
    'recycling_rate_percentage'
  ]
}