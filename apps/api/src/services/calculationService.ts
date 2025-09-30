/**
 * Calculation Service
 * 
 * Processes activity data and calculates carbon emissions using emission factors
 */

import { getEmissionFactor } from './emissionFactors';

export interface ActivityData {
  id: string;
  dataSourceId: string;
  organizationId: string;
  activityType: string;
  value: number;
  unit: string;
  startDate: string;
  endDate: string;
  isProcessed: boolean;
  createdAt: string;
}

export interface CalculatedEmissions {
  id: string;
  activityDataId: string;
  organizationId: string;
  ghgScope: 'scope_1' | 'scope_2' | 'scope_3';
  category: string;
  co2e: number;
  emissionFactorSource: string;
  calculationDate: string;
}

function generateId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).substr(2, 9)}`;
}

// Mock database operations - in production, these would connect to PlanetScale
const mockActivityData: ActivityData[] = [];
const mockCalculatedEmissions: CalculatedEmissions[] = [];

/**
 * Create a new activity data record
 */
export function createActivityData(data: {
  dataSourceId: string;
  organizationId: string;
  activityType: string;
  value: number;
  unit: string;
  startDate: string;
  endDate: string;
}): ActivityData {
  const activityData: ActivityData = {
    id: generateId('act'),
    ...data,
    isProcessed: false,
    createdAt: new Date().toISOString(),
  };

  mockActivityData.push(activityData);
  return activityData;
}

/**
 * Get activity data by ID
 */
export function getActivityDataById(id: string): ActivityData | null {
  return mockActivityData.find(data => data.id === id) || null;
}

/**
 * Get all unprocessed activity data for an organization
 */
export function getUnprocessedActivityData(organizationId: string): ActivityData[] {
  return mockActivityData.filter(
    data => data.organizationId === organizationId && !data.isProcessed
  );
}

/**
 * Mark activity data as processed
 */
export function markActivityDataAsProcessed(id: string): void {
  const activity = mockActivityData.find(data => data.id === id);
  if (activity) {
    activity.isProcessed = true;
  }
}

/**
 * Save calculated emissions
 */
export function saveCalculatedEmissions(emissions: Omit<CalculatedEmissions, 'id' | 'calculationDate'>): CalculatedEmissions {
  const calculatedEmissions: CalculatedEmissions = {
    id: generateId('em'),
    ...emissions,
    calculationDate: new Date().toISOString(),
  };

  mockCalculatedEmissions.push(calculatedEmissions);
  return calculatedEmissions;
}

/**
 * Get calculated emissions for an organization
 */
export function getCalculatedEmissionsByOrganization(organizationId: string): CalculatedEmissions[] {
  return mockCalculatedEmissions.filter(
    emissions => emissions.organizationId === organizationId
  );
}

/**
 * Process a single activity data record and calculate emissions
 */
export async function processActivityData(activityDataId: string): Promise<CalculatedEmissions> {
  // 1. Fetch activity data record
  const activityData = getActivityDataById(activityDataId);
  
  if (!activityData) {
    throw new Error(`Activity data not found: ${activityDataId}`);
  }

  if (activityData.isProcessed) {
    throw new Error(`Activity data already processed: ${activityDataId}`);
  }

  try {
    // 2. Get emission factor
    const emissionFactor = getEmissionFactor(activityData.activityType, activityData.unit);

    // 3. Calculate CO2e emissions
    // Convert kgCO2e to tonnes CO2e (divide by 1000)
    const co2eKg = activityData.value * emissionFactor.value;
    const co2eTonnes = co2eKg / 1000;

    // 4. Create calculated emissions record
    const calculatedEmissions = saveCalculatedEmissions({
      activityDataId: activityData.id,
      organizationId: activityData.organizationId,
      ghgScope: emissionFactor.scope,
      category: emissionFactor.category,
      co2e: co2eTonnes,
      emissionFactorSource: emissionFactor.source,
    });

    // 5. Mark activity data as processed
    markActivityDataAsProcessed(activityDataId);

    return calculatedEmissions;

  } catch (error) {
    throw new Error(`Failed to process activity data ${activityDataId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Process all unprocessed activity data for an organization
 */
export async function processAllActivityData(organizationId: string): Promise<{
  processed: number;
  errors: string[];
}> {
  const unprocessedData = getUnprocessedActivityData(organizationId);
  const results = { processed: 0, errors: [] as string[] };

  for (const activity of unprocessedData) {
    try {
      await processActivityData(activity.id);
      results.processed++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      results.errors.push(`${activity.id}: ${errorMessage}`);
    }
  }

  return results;
}

/**
 * Calculate emissions summary for an organization
 */
export function calculateEmissionsSummary(organizationId: string): {
  totalCo2e: number;
  byScope: {
    scope_1: number;
    scope_2: number;
    scope_3: number;
  };
  period: {
    start: string;
    end: string;
  };
} {
  const emissions = getCalculatedEmissionsByOrganization(organizationId);

  const summary = {
    totalCo2e: 0,
    byScope: {
      scope_1: 0,
      scope_2: 0,
      scope_3: 0,
    },
    period: {
      start: new Date().getFullYear() + '-01-01',
      end: new Date().getFullYear() + '-12-31',
    },
  };

  emissions.forEach(emission => {
    summary.totalCo2e += emission.co2e;
    summary.byScope[emission.ghgScope] += emission.co2e;
  });

  // Round to 2 decimal places
  summary.totalCo2e = Math.round(summary.totalCo2e * 100) / 100;
  summary.byScope.scope_1 = Math.round(summary.byScope.scope_1 * 100) / 100;
  summary.byScope.scope_2 = Math.round(summary.byScope.scope_2 * 100) / 100;
  summary.byScope.scope_3 = Math.round(summary.byScope.scope_3 * 100) / 100;

  return summary;
}