/**
 * Analytics Service
 * 
 * Advanced data querying and aggregation for emissions analytics dashboard
 */

import { getCalculatedEmissionsByOrganization } from './calculationService';

export interface TimeseriesDataPoint {
  date: string;
  totalCo2e: number;
}

export interface BreakdownDataPoint {
  category: string;
  scope: 'scope_1' | 'scope_2' | 'scope_3';
  totalCo2e: number;
  percentage: number;
}

export interface AnalyticsFilters {
  period: string;
  scope?: 'scope_1' | 'scope_2' | 'scope_3';
  groupBy?: 'month' | 'quarter';
  sortBy?: 'co2e_desc' | 'co2e_asc';
  limit?: number;
}

/**
 * Parse period string into start and end dates
 */
function parsePeriod(period: string): { startDate: Date; endDate: Date } {
  const now = new Date();
  const currentYear = now.getFullYear();
  let startDate: Date;
  let endDate = new Date(now);

  switch (period) {
    case '12m':
      startDate = new Date(now);
      startDate.setFullYear(currentYear - 1);
      break;
    case '24m':
      startDate = new Date(now);
      startDate.setFullYear(currentYear - 2);
      break;
    case 'ytd':
      startDate = new Date(currentYear, 0, 1); // January 1st of current year
      break;
    case '6m':
      startDate = new Date(now);
      startDate.setMonth(now.getMonth() - 6);
      break;
    case '3m':
      startDate = new Date(now);
      startDate.setMonth(now.getMonth() - 3);
      break;
    case 'all':
    default:
      startDate = new Date(2020, 0, 1); // Start from 2020
      break;
  }

  return { startDate, endDate };
}

/**
 * Group date by month or quarter
 */
function getDateKey(date: Date, groupBy: 'month' | 'quarter' = 'month'): string {
  if (groupBy === 'quarter') {
    const quarter = Math.floor(date.getMonth() / 3) + 1;
    return `${date.getFullYear()}-Q${quarter}`;
  } else {
    // Month format: YYYY-MM
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }
}

/**
 * Convert grouped date key back to display format
 */
function formatDateKey(key: string, groupBy: 'month' | 'quarter' = 'month'): string {
  if (groupBy === 'quarter') {
    // Convert "2025-Q1" to "2025-03-31" (end of quarter)
    const [year, quarter] = key.split('-Q');
    const quarterNum = parseInt(quarter);
    const endMonth = quarterNum * 3; // Q1=3, Q2=6, Q3=9, Q4=12
    const endDate = new Date(parseInt(year), endMonth, 0); // Last day of the quarter's last month
    return endDate.toISOString().split('T')[0];
  } else {
    // Convert "2025-01" to "2025-01-31" (end of month)
    const [year, month] = key.split('-');
    const endDate = new Date(parseInt(year), parseInt(month), 0); // Last day of month
    return endDate.toISOString().split('T')[0];
  }
}

/**
 * Get emissions timeseries data
 */
export function getEmissionsTimeseries(
  organizationId: string,
  filters: AnalyticsFilters
): TimeseriesDataPoint[] {
  const emissions = getCalculatedEmissionsByOrganization(organizationId);
  const { startDate, endDate } = parsePeriod(filters.period);
  const groupBy = filters.groupBy || 'month';

  // Filter by date range and scope
  const filteredEmissions = emissions.filter(emission => {
    const emissionDate = new Date(emission.calculationDate);
    const inDateRange = emissionDate >= startDate && emissionDate <= endDate;
    const inScope = !filters.scope || emission.ghgScope === filters.scope;
    return inDateRange && inScope;
  });

  // Group by time period
  const grouped: { [key: string]: number } = {};
  filteredEmissions.forEach(emission => {
    const dateKey = getDateKey(new Date(emission.calculationDate), groupBy);
    grouped[dateKey] = (grouped[dateKey] || 0) + emission.co2e;
  });

  // Convert to array and sort by date
  const result = Object.entries(grouped)
    .map(([dateKey, totalCo2e]) => ({
      date: formatDateKey(dateKey, groupBy),
      totalCo2e: Math.round(totalCo2e * 100) / 100 // Round to 2 decimal places
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return result;
}

/**
 * Get emissions breakdown by category
 */
export function getEmissionsBreakdown(
  organizationId: string,
  filters: AnalyticsFilters
): BreakdownDataPoint[] {
  const emissions = getCalculatedEmissionsByOrganization(organizationId);
  const { startDate, endDate } = parsePeriod(filters.period);

  // Filter by date range and scope
  const filteredEmissions = emissions.filter(emission => {
    const emissionDate = new Date(emission.calculationDate);
    const inDateRange = emissionDate >= startDate && emissionDate <= endDate;
    const inScope = !filters.scope || emission.ghgScope === filters.scope;
    return inDateRange && inScope;
  });

  // Group by category
  const grouped: { [key: string]: { totalCo2e: number; scope: string } } = {};
  filteredEmissions.forEach(emission => {
    const key = emission.category;
    if (!grouped[key]) {
      grouped[key] = { totalCo2e: 0, scope: emission.ghgScope };
    }
    grouped[key].totalCo2e += emission.co2e;
  });

  // Calculate total for percentage calculation
  const totalCo2e = Object.values(grouped).reduce((sum, item) => sum + item.totalCo2e, 0);

  // Convert to array
  let result = Object.entries(grouped)
    .map(([category, data]) => ({
      category,
      scope: data.scope as 'scope_1' | 'scope_2' | 'scope_3',
      totalCo2e: Math.round(data.totalCo2e * 100) / 100,
      percentage: Math.round((data.totalCo2e / totalCo2e) * 1000) / 10 // Round to 1 decimal place
    }));

  // Sort by emissions (descending by default)
  const sortBy = filters.sortBy || 'co2e_desc';
  if (sortBy === 'co2e_desc') {
    result.sort((a, b) => b.totalCo2e - a.totalCo2e);
  } else if (sortBy === 'co2e_asc') {
    result.sort((a, b) => a.totalCo2e - b.totalCo2e);
  }

  // Apply limit
  if (filters.limit && filters.limit > 0) {
    result = result.slice(0, filters.limit);
  }

  return result;
}

/**
 * Get available date range for the organization
 */
export function getAvailableDateRange(organizationId: string): {
  startDate: string;
  endDate: string;
  totalRecords: number;
} {
  const emissions = getCalculatedEmissionsByOrganization(organizationId);
  
  if (emissions.length === 0) {
    return {
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      totalRecords: 0
    };
  }

  const dates = emissions.map(e => new Date(e.calculationDate));
  const startDate = new Date(Math.min(...dates.map(d => d.getTime())));
  const endDate = new Date(Math.max(...dates.map(d => d.getTime())));

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    totalRecords: emissions.length
  };
}