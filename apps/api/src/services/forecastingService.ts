// services/forecastingService.ts - Core business logic for forecasting and modeling

import { Initiative, EmissionForecast, ReductionTarget } from '../types/initiatives';
import { getAvailableCategories } from './initiativeService';

// Mock database for forecasts - in production this would connect to PlanetScale
let mockForecasts: EmissionForecast[] = [];

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Calculate the projected annual CO2e reduction based on a reduction target
 * @param organizationId - The organization ID
 * @param reductionTarget - Object containing category and percentage reduction
 * @returns The calculated annual reduction in tonnes CO2e
 */
export async function calculateProjectedReduction(
  organizationId: string,
  reductionTarget: ReductionTarget
): Promise<number> {
  // Get available categories and their emissions
  const categories = await getAvailableCategories(organizationId);
  
  // Find the target category
  const categoryData = categories.find(cat => cat.category === reductionTarget.category);
  
  if (!categoryData) {
    throw new Error(`Category "${reductionTarget.category}" not found for organization`);
  }

  // Calculate the reduction: totalCategoryEmissions * (percentage / 100)
  const annualReduction = categoryData.totalCo2e * (reductionTarget.percentage / 100);
  
  return Math.round(annualReduction * 100) / 100; // Round to 2 decimal places
}

/**
 * Generate baseline and initiative forecast data points
 * @param initiative - The initiative to generate forecasts for
 * @returns Promise that resolves when forecasts are generated
 */
export async function generateForecast(initiative: Initiative): Promise<EmissionForecast[]> {
  const organizationId = initiative.organizationId;
  const startDate = new Date(initiative.startDate || new Date());
  const forecastPeriod = 24; // 24 months of forecast data
  const forecasts: EmissionForecast[] = [];

  // Get the organization's current total emissions (mock data)
  const currentAnnualEmissions = 50.5; // In production, calculate from calculated_emissions table
  const monthlyEmissions = currentAnnualEmissions / 12;

  // Generate monthly data points for the forecast period
  for (let month = 0; month < forecastPeriod; month++) {
    const forecastDate = new Date(startDate);
    forecastDate.setMonth(forecastDate.getMonth() + month);
    const forecastDateString = forecastDate.toISOString().split('T')[0];

    // Baseline forecast (business as usual) - slight growth trend
    const growthRate = 1.02; // 2% annual growth
    const baselineEmissions = monthlyEmissions * Math.pow(growthRate, month / 12);
    
    const baselineForecast: EmissionForecast = {
      id: generateId('forecast'),
      initiativeId: initiative.id,
      organizationId,
      forecastDate: forecastDateString,
      projectedCo2e: Math.round(baselineEmissions * 100) / 100,
      isBaseline: true,
      createdAt: new Date().toISOString(),
    };

    forecasts.push(baselineForecast);

    // Initiative forecast (with reduction applied after start date)
    const initiativeStarted = forecastDate >= startDate;
    let withInitiativeEmissions = baselineEmissions;
    
    if (initiativeStarted && initiative.projectedCo2eReduction) {
      // Apply the annual reduction proportionally per month
      const monthlyReduction = initiative.projectedCo2eReduction / 12;
      withInitiativeEmissions = Math.max(0, baselineEmissions - monthlyReduction);
    }

    const initiativeForecast: EmissionForecast = {
      id: generateId('forecast'),
      initiativeId: initiative.id,
      organizationId,
      forecastDate: forecastDateString,
      projectedCo2e: Math.round(withInitiativeEmissions * 100) / 100,
      isBaseline: false,
      createdAt: new Date().toISOString(),
    };

    forecasts.push(initiativeForecast);
  }

  // Store forecasts in mock database
  mockForecasts.push(...forecasts);

  return forecasts;
}

/**
 * Get forecasts for a specific initiative
 * @param organizationId - The organization ID
 * @param initiativeId - The initiative ID
 * @returns Array of forecast data points
 */
export async function getForecastsForInitiative(
  organizationId: string,
  initiativeId: string
): Promise<EmissionForecast[]> {
  return mockForecasts.filter(
    forecast => forecast.initiativeId === initiativeId && forecast.organizationId === organizationId
  );
}

/**
 * Delete forecasts for an initiative
 * @param organizationId - The organization ID
 * @param initiativeId - The initiative ID
 */
export async function deleteForecastsForInitiative(
  organizationId: string,
  initiativeId: string
): Promise<void> {
  mockForecasts = mockForecasts.filter(
    forecast => !(forecast.initiativeId === initiativeId && forecast.organizationId === organizationId)
  );
}