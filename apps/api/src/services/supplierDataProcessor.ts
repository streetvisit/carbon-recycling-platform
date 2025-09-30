// services/supplierDataProcessor.ts - Processes supplier data and feeds it into the calculation engine

import { SupplierDataSubmission, DataRequest } from '../types/suppliers'
import { createActivityData } from './calculationService'

/**
 * Process approved supplier data submission and create activity_data record
 */
export async function processSupplierSubmission(
  submission: SupplierDataSubmission,
  dataRequest: DataRequest
): Promise<void> {
  if (!submission.submittedValue || !submission.submittedUnit) {
    throw new Error('Submission must have both value and unit to be processed')
  }

  // Create a virtual data source for supplier data
  const supplierDataSourceId = `supplier_${submission.submittedBySupplierId}`
  
  // Map supplier data types to our internal activity types
  const activityType = mapSupplierDataTypeToActivityType(dataRequest.requestedDataType)
  
  try {
    // Create activity data record that feeds into the calculation engine
    const activityData = createActivityData({
      dataSourceId: supplierDataSourceId,
      organizationId: dataRequest.organizationId, // This goes to the HOST organization
      activityType,
      value: submission.submittedValue,
      unit: submission.submittedUnit,
      startDate: dataRequest.periodStart,
      endDate: dataRequest.periodEnd,
      // Add metadata to track this came from supplier
      metadata: {
        sourceType: 'supplier_submission',
        supplierId: submission.submittedBySupplierId,
        dataRequestId: dataRequest.id,
        submissionId: submission.id,
        supplierNotes: submission.notes
      }
    })
    
    console.log(`Processed supplier submission ${submission.id} into activity_data ${activityData.id}`)
  } catch (error) {
    console.error(`Failed to process supplier submission ${submission.id}:`, error)
    throw error
  }
}

/**
 * Map supplier-provided data types to internal activity types
 */
function mapSupplierDataTypeToActivityType(supplierDataType: string): string {
  const mapping: Record<string, string> = {
    'electricity_usage_kwh': 'electricity_usage',
    'natural_gas_usage_kwh': 'natural_gas_usage',
    'fuel_consumption_litres': 'vehicle_fuel',
    'waste_generated_tonnes': 'waste_disposal',
    'water_usage_cubic_meters': 'water_usage',
    'total_co2e_tonnes': 'scope_3_purchased_goods', // Generic Scope 3
    'renewable_energy_percentage': 'renewable_energy',
    'recycling_rate_percentage': 'recycling_rate'
  }
  
  return mapping[supplierDataType] || supplierDataType
}

/**
 * Validate supplier submission data before processing
 */
export function validateSupplierSubmission(
  submission: SupplierDataSubmission,
  dataRequest: DataRequest
): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  
  // Check required fields
  if (!submission.submittedValue && submission.submittedValue !== 0) {
    errors.push('Submitted value is required')
  }
  
  if (!submission.submittedUnit) {
    errors.push('Submitted unit is required')
  }
  
  // Validate value is numeric and positive
  if (submission.submittedValue !== undefined && (isNaN(submission.submittedValue) || submission.submittedValue < 0)) {
    errors.push('Submitted value must be a positive number')
  }
  
  // Validate unit matches expected units for data type
  if (submission.submittedUnit && dataRequest.requestedDataType) {
    const expectedUnits = getExpectedUnitsForDataType(dataRequest.requestedDataType)
    if (expectedUnits.length > 0 && !expectedUnits.includes(submission.submittedUnit)) {
      errors.push(`Unit '${submission.submittedUnit}' is not valid for data type '${dataRequest.requestedDataType}'. Expected: ${expectedUnits.join(', ')}`)
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Get expected units for a given data type
 */
function getExpectedUnitsForDataType(dataType: string): string[] {
  const unitMapping: Record<string, string[]> = {
    'electricity_usage_kwh': ['kWh', 'MWh', 'GWh'],
    'natural_gas_usage_kwh': ['kWh', 'MWh', 'cubic_meters', 'm³'],
    'fuel_consumption_litres': ['litres', 'L', 'gallons', 'gal'],
    'waste_generated_tonnes': ['tonnes', 't', 'kg', 'pounds', 'lbs'],
    'water_usage_cubic_meters': ['cubic_meters', 'm³', 'litres', 'L', 'gallons'],
    'total_co2e_tonnes': ['tonnes_co2e', 't_co2e', 'kg_co2e'],
    'renewable_energy_percentage': ['%', 'percent', 'percentage'],
    'recycling_rate_percentage': ['%', 'percent', 'percentage']
  }
  
  return unitMapping[dataType] || []
}

/**
 * Get data type suggestions for creating requests
 */
export function getDataTypeOptions(): Array<{ value: string; label: string; description: string; expectedUnits: string[] }> {
  return [
    {
      value: 'electricity_usage_kwh',
      label: 'Electricity Usage',
      description: 'Total electricity consumption',
      expectedUnits: ['kWh', 'MWh', 'GWh']
    },
    {
      value: 'natural_gas_usage_kwh',
      label: 'Natural Gas Usage', 
      description: 'Natural gas consumption',
      expectedUnits: ['kWh', 'MWh', 'm³']
    },
    {
      value: 'fuel_consumption_litres',
      label: 'Fuel Consumption',
      description: 'Vehicle/machinery fuel usage',
      expectedUnits: ['litres', 'L', 'gallons']
    },
    {
      value: 'waste_generated_tonnes',
      label: 'Waste Generated',
      description: 'Total waste produced',
      expectedUnits: ['tonnes', 't', 'kg']
    },
    {
      value: 'water_usage_cubic_meters',
      label: 'Water Usage',
      description: 'Water consumption',
      expectedUnits: ['m³', 'litres', 'L']
    },
    {
      value: 'total_co2e_tonnes',
      label: 'Total CO2e Emissions',
      description: 'Pre-calculated carbon footprint',
      expectedUnits: ['tonnes_co2e', 't_co2e', 'kg_co2e']
    },
    {
      value: 'renewable_energy_percentage',
      label: 'Renewable Energy %',
      description: 'Percentage of renewable energy used',
      expectedUnits: ['%', 'percent']
    },
    {
      value: 'recycling_rate_percentage',
      label: 'Recycling Rate %',
      description: 'Percentage of waste recycled',
      expectedUnits: ['%', 'percent']
    }
  ]
}