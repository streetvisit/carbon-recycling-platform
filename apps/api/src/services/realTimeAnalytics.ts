/**
 * Real-time Analytics Service
 * 
 * Provides advanced analytics capabilities:
 * - Real-time emissions monitoring
 * - Industry benchmarking
 * - Predictive analytics and forecasting
 * - Smart alerts and anomaly detection
 * - Performance metrics and KPIs
 */

import { getD1Database } from '../../../../../packages/db/d1-connection';

export interface RealTimeMetrics {
  timestamp: string;
  totalEmissions: number;
  energyIntensity: number;
  carbonIntensity: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  percentageChange: number;
  period: string;
}

export interface IndustryBenchmark {
  industry: string;
  metric: string;
  organizationValue: number;
  industryMedian: number;
  industryPercentile: number;
  performanceRating: 'excellent' | 'good' | 'average' | 'below_average' | 'poor';
  unit: string;
}

export interface EmissionsPrediction {
  date: string;
  predictedEmissions: number;
  confidenceInterval: {
    lower: number;
    upper: number;
  };
  trend: 'increasing' | 'decreasing' | 'stable';
  factors: string[];
}

export interface Alert {
  id: string;
  type: 'threshold_exceeded' | 'anomaly_detected' | 'trend_warning' | 'target_risk' | 'compliance_issue';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  value: number;
  threshold?: number;
  unit?: string;
  category: string;
  timestamp: string;
  isRead: boolean;
}

/**
 * Get real-time emissions metrics
 */
export async function getRealTimeMetrics(
  env: any,
  organizationId: string,
  metrics: string[] = ['emissions', 'energy', 'intensity']
): Promise<RealTimeMetrics> {
  const db = getD1Database(env);
  
  // Get latest emissions data (last 24 hours)
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  // Current day emissions
  const todayResult = await db.prepare(`
    SELECT 
      SUM(ce.co2e) as totalEmissions,
      COUNT(ad.id) as activityCount,
      AVG(CASE WHEN ad.activityType = 'electricity_usage' THEN ad.value ELSE NULL END) as avgElectricity
    FROM calculated_emissions ce
    JOIN activity_data ad ON ce.activityDataId = ad.id
    WHERE ce.organizationId = ? 
      AND DATE(ce.calculationDate) = DATE('now')
  `).bind(organizationId).first();
  
  // Previous day for comparison
  const yesterdayResult = await db.prepare(`
    SELECT SUM(co2e) as totalEmissions
    FROM calculated_emissions 
    WHERE organizationId = ? 
      AND DATE(calculationDate) = DATE('now', '-1 day')
  `).bind(organizationId).first();
  
  // Weekly average for trend analysis
  const weeklyResult = await db.prepare(`
    SELECT 
      DATE(calculationDate) as date,
      SUM(co2e) as dailyEmissions
    FROM calculated_emissions 
    WHERE organizationId = ? 
      AND calculationDate >= ?
    GROUP BY DATE(calculationDate)
    ORDER BY date ASC
  `).bind(organizationId, lastWeek.toISOString()).all();
  
  const currentEmissions = todayResult?.totalEmissions || 0;
  const previousEmissions = yesterdayResult?.totalEmissions || 0;
  const avgElectricity = todayResult?.avgElectricity || 0;
  
  // Calculate percentage change
  let percentageChange = 0;
  if (previousEmissions > 0) {
    percentageChange = ((currentEmissions - previousEmissions) / previousEmissions) * 100;
  }
  
  // Determine trend based on weekly data
  let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
  if (weeklyResult.results && weeklyResult.results.length >= 3) {
    const recentDays = weeklyResult.results.slice(-3);
    const values = recentDays.map((r: any) => r.dailyEmissions || 0);
    
    if (values[2] > values[1] && values[1] > values[0]) {
      trend = 'increasing';
    } else if (values[2] < values[1] && values[1] < values[0]) {
      trend = 'decreasing';
    }
  }
  
  // Calculate energy and carbon intensity
  const energyIntensity = avgElectricity > 0 ? currentEmissions / avgElectricity : 0;
  const carbonIntensity = currentEmissions; // Simplified - would normally be per revenue/output unit
  
  return {
    timestamp: new Date().toISOString(),
    totalEmissions: Math.round(currentEmissions * 100) / 100,
    energyIntensity: Math.round(energyIntensity * 1000) / 1000,
    carbonIntensity: Math.round(carbonIntensity * 100) / 100,
    trend,
    percentageChange: Math.round(percentageChange * 10) / 10,
    period: 'last_24_hours'
  };
}

/**
 * Get industry benchmarking data
 */
export async function getIndustryBenchmarks(
  env: any,
  organizationId: string,
  industry: string = 'general',
  metric: string = 'carbon_intensity'
): Promise<IndustryBenchmark> {
  const db = getD1Database(env);
  
  // Get organization's current total emissions
  const orgResult = await db.prepare(`
    SELECT SUM(co2e) as totalEmissions
    FROM calculated_emissions 
    WHERE organizationId = ?
      AND calculationDate >= DATE('now', 'start of year')
  `).bind(organizationId).first();
  
  const organizationValue = orgResult?.totalEmissions || 0;
  
  // Industry benchmark data (in production, this would come from a benchmarks database)
  const industryBenchmarks: Record<string, Record<string, any>> = {
    general: {
      carbon_intensity: {
        percentiles: [150, 300, 500, 750, 1200], // tCO2e per year for different company sizes
        median: 500,
        unit: 'tCO2e/year'
      },
      energy_efficiency: {
        percentiles: [0.15, 0.25, 0.35, 0.50, 0.75],
        median: 0.35,
        unit: 'tCO2e/MWh'
      }
    },
    manufacturing: {
      carbon_intensity: {
        percentiles: [300, 600, 900, 1400, 2000],
        median: 900,
        unit: 'tCO2e/year'
      }
    },
    services: {
      carbon_intensity: {
        percentiles: [50, 120, 200, 320, 500],
        median: 200,
        unit: 'tCO2e/year'
      }
    },
    retail: {
      carbon_intensity: {
        percentiles: [80, 180, 280, 450, 650],
        median: 280,
        unit: 'tCO2e/year'
      }
    }
  };
  
  const benchmark = industryBenchmarks[industry]?.[metric] || industryBenchmarks.general[metric];
  
  if (!benchmark) {
    throw new Error(`Benchmark not found for industry: ${industry}, metric: ${metric}`);
  }
  
  // Calculate percentile position
  let percentile = 50; // Default to median
  let performanceRating: IndustryBenchmark['performanceRating'] = 'average';
  
  if (organizationValue <= benchmark.percentiles[0]) {
    percentile = 10;
    performanceRating = 'excellent';
  } else if (organizationValue <= benchmark.percentiles[1]) {
    percentile = 25;
    performanceRating = 'good';
  } else if (organizationValue <= benchmark.percentiles[2]) {
    percentile = 50;
    performanceRating = 'average';
  } else if (organizationValue <= benchmark.percentiles[3]) {
    percentile = 75;
    performanceRating = 'below_average';
  } else {
    percentile = 90;
    performanceRating = 'poor';
  }
  
  return {
    industry,
    metric,
    organizationValue: Math.round(organizationValue * 100) / 100,
    industryMedian: benchmark.median,
    industryPercentile: percentile,
    performanceRating,
    unit: benchmark.unit
  };
}

/**
 * Generate emissions predictions using simple linear regression
 */
export async function generateEmissionsPredictions(
  env: any,
  organizationId: string,
  months: number = 6,
  algorithm: string = 'linear_trend'
): Promise<EmissionsPrediction[]> {
  const db = getD1Database(env);
  
  // Get historical monthly data for the last year
  const historicalResult = await db.prepare(`
    SELECT 
      strftime('%Y-%m', calculationDate) as month,
      SUM(co2e) as monthlyEmissions
    FROM calculated_emissions 
    WHERE organizationId = ?
      AND calculationDate >= DATE('now', '-12 months')
    GROUP BY strftime('%Y-%m', calculationDate)
    ORDER BY month ASC
  `).bind(organizationId).all();
  
  const historicalData = historicalResult.results as any[];
  
  if (!historicalData || historicalData.length < 3) {
    throw new Error('Insufficient historical data for predictions (minimum 3 months required)');
  }
  
  // Simple linear regression
  const values = historicalData.map(d => d.monthlyEmissions || 0);
  const n = values.length;
  const x = Array.from({length: n}, (_, i) => i + 1);
  
  // Calculate slope and intercept
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * values[i], 0);
  const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  // Calculate R-squared for confidence
  const yMean = sumY / n;
  const ssRes = values.reduce((sum, yi, i) => {
    const predicted = slope * x[i] + intercept;
    return sum + Math.pow(yi - predicted, 2);
  }, 0);
  const ssTot = values.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
  const rSquared = 1 - (ssRes / ssTot);
  
  // Generate predictions
  const predictions: EmissionsPrediction[] = [];
  const lastMonth = new Date();
  
  for (let i = 1; i <= months; i++) {
    const futureMonth = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + i, 1);
    const xValue = n + i;
    const predictedValue = Math.max(0, slope * xValue + intercept);
    
    // Calculate confidence interval (simplified)
    const standardError = Math.sqrt(ssRes / (n - 2));
    const marginOfError = 1.96 * standardError; // 95% confidence
    
    // Determine trend
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (slope > 0.05) trend = 'increasing';
    else if (slope < -0.05) trend = 'decreasing';
    
    predictions.push({
      date: futureMonth.toISOString().substring(0, 7), // YYYY-MM format
      predictedEmissions: Math.round(predictedValue * 100) / 100,
      confidenceInterval: {
        lower: Math.max(0, Math.round((predictedValue - marginOfError) * 100) / 100),
        upper: Math.round((predictedValue + marginOfError) * 100) / 100
      },
      trend,
      factors: [
        'Historical emission trends',
        'Seasonal patterns',
        rSquared > 0.7 ? 'Strong correlation' : 'Moderate correlation'
      ]
    });
  }
  
  return predictions;
}

/**
 * Get real-time alerts based on thresholds and anomalies
 */
export async function getAnalyticsAlerts(
  env: any,
  organizationId: string,
  filters: { status?: string; severity?: string } = {}
): Promise<Alert[]> {
  const db = getD1Database(env);
  
  const alerts: Alert[] = [];
  
  // Check for threshold alerts (last 24 hours vs previous period)
  const currentResult = await db.prepare(`
    SELECT 
      SUM(co2e) as totalEmissions,
      MAX(co2e) as maxEmission,
      category,
      ghgScope
    FROM calculated_emissions 
    WHERE organizationId = ?
      AND calculationDate >= DATE('now', '-1 day')
    GROUP BY category, ghgScope
  `).bind(organizationId).all();
  
  // Previous period for comparison
  const previousResult = await db.prepare(`
    SELECT SUM(co2e) as totalEmissions
    FROM calculated_emissions 
    WHERE organizationId = ?
      AND calculationDate >= DATE('now', '-2 days')
      AND calculationDate < DATE('now', '-1 day')
  `).bind(organizationId).first();
  
  const currentTotal = currentResult.results?.reduce((sum: number, row: any) => 
    sum + (row.totalEmissions || 0), 0) || 0;
  const previousTotal = previousResult?.totalEmissions || 0;
  
  // Alert for significant increase (>20%)
  if (previousTotal > 0 && currentTotal > previousTotal * 1.2) {
    const increase = ((currentTotal - previousTotal) / previousTotal) * 100;
    alerts.push({
      id: `alert_${Date.now()}_increase`,
      type: 'threshold_exceeded',
      severity: increase > 50 ? 'critical' : increase > 30 ? 'high' : 'medium',
      title: 'Emissions Spike Detected',
      message: `Total emissions increased by ${Math.round(increase)}% compared to yesterday`,
      value: currentTotal,
      threshold: previousTotal * 1.2,
      unit: 'tCO2e',
      category: 'emissions_trend',
      timestamp: new Date().toISOString(),
      isRead: false
    });
  }
  
  // Check for unusually high single emissions
  if (currentResult.results) {
    for (const row of currentResult.results as any[]) {
      if (row.maxEmission > 10) { // Threshold: 10 tCO2e for single activity
        alerts.push({
          id: `alert_${Date.now()}_anomaly_${row.category}`,
          type: 'anomaly_detected',
          severity: row.maxEmission > 50 ? 'critical' : 'high',
          title: 'High Emission Activity Detected',
          message: `Unusually high emission recorded for ${row.category}`,
          value: row.maxEmission,
          threshold: 10,
          unit: 'tCO2e',
          category: row.category,
          timestamp: new Date().toISOString(),
          isRead: false
        });
      }
    }
  }
  
  // Monthly target risk alert
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const monthlyResult = await db.prepare(`
    SELECT SUM(co2e) as monthlyEmissions
    FROM calculated_emissions 
    WHERE organizationId = ?
      AND calculationDate >= ?
  `).bind(organizationId, monthStart.toISOString()).first();
  
  const monthlyEmissions = monthlyResult?.monthlyEmissions || 0;
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const dayOfMonth = new Date().getDate();
  const projectedMonthly = (monthlyEmissions / dayOfMonth) * daysInMonth;
  
  // Assuming monthly target of 100 tCO2e (this would be configurable)
  const monthlyTarget = 100;
  if (projectedMonthly > monthlyTarget * 0.9) {
    alerts.push({
      id: `alert_${Date.now()}_target_risk`,
      type: 'target_risk',
      severity: projectedMonthly > monthlyTarget ? 'high' : 'medium',
      title: 'Monthly Target at Risk',
      message: `Current trajectory suggests monthly emissions will be ${Math.round(projectedMonthly)} tCO2e (target: ${monthlyTarget} tCO2e)`,
      value: projectedMonthly,
      threshold: monthlyTarget,
      unit: 'tCO2e',
      category: 'monthly_target',
      timestamp: new Date().toISOString(),
      isRead: false
    });
  }
  
  // Filter alerts based on request parameters
  let filteredAlerts = alerts;
  
  if (filters.status === 'active') {
    filteredAlerts = alerts.filter(alert => !alert.isRead);
  }
  
  if (filters.severity) {
    filteredAlerts = filteredAlerts.filter(alert => alert.severity === filters.severity);
  }
  
  return filteredAlerts.sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

/**
 * Get key performance indicators dashboard
 */
export async function getEmissionsKPIs(
  env: any,
  organizationId: string
): Promise<{
  totalEmissions: number;
  monthlyChange: number;
  yearlyProjection: number;
  intensityRatio: number;
  reductionProgress: number;
  complianceStatus: 'on_track' | 'at_risk' | 'behind';
}> {
  const db = getD1Database(env);
  
  // Current month emissions
  const thisMonthResult = await db.prepare(`
    SELECT SUM(co2e) as emissions
    FROM calculated_emissions 
    WHERE organizationId = ?
      AND calculationDate >= DATE('now', 'start of month')
  `).bind(organizationId).first();
  
  // Previous month emissions  
  const lastMonthResult = await db.prepare(`
    SELECT SUM(co2e) as emissions
    FROM calculated_emissions 
    WHERE organizationId = ?
      AND calculationDate >= DATE('now', 'start of month', '-1 month')
      AND calculationDate < DATE('now', 'start of month')
  `).bind(organizationId).first();
  
  // Year-to-date emissions
  const ytdResult = await db.prepare(`
    SELECT SUM(co2e) as emissions
    FROM calculated_emissions 
    WHERE organizationId = ?
      AND calculationDate >= DATE('now', 'start of year')
  `).bind(organizationId).first();
  
  const thisMonth = thisMonthResult?.emissions || 0;
  const lastMonth = lastMonthResult?.emissions || 0;
  const ytdEmissions = ytdResult?.emissions || 0;
  
  // Calculate metrics
  const monthlyChange = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0;
  
  // Yearly projection (simple extrapolation)
  const monthsElapsed = new Date().getMonth() + 1;
  const yearlyProjection = monthsElapsed > 0 ? (ytdEmissions / monthsElapsed) * 12 : 0;
  
  // Intensity ratio (emissions per activity - simplified)
  const activityCount = await db.prepare(`
    SELECT COUNT(*) as count
    FROM activity_data 
    WHERE organizationId = ?
      AND createdAt >= DATE('now', 'start of year')
  `).bind(organizationId).first();
  
  const intensityRatio = (activityCount?.count || 0) > 0 ? ytdEmissions / activityCount.count : 0;
  
  // Reduction progress (assuming 20% reduction target)
  const targetReduction = 0.2; // 20%
  const baselineEmissions = yearlyProjection / (1 - targetReduction); // Reverse calculate baseline
  const actualReduction = Math.max(0, (baselineEmissions - yearlyProjection) / baselineEmissions);
  const reductionProgress = Math.min(100, (actualReduction / targetReduction) * 100);
  
  // Compliance status
  let complianceStatus: 'on_track' | 'at_risk' | 'behind' = 'on_track';
  if (reductionProgress < 50) {
    complianceStatus = 'behind';
  } else if (reductionProgress < 80) {
    complianceStatus = 'at_risk';
  }
  
  return {
    totalEmissions: Math.round(ytdEmissions * 100) / 100,
    monthlyChange: Math.round(monthlyChange * 10) / 10,
    yearlyProjection: Math.round(yearlyProjection * 100) / 100,
    intensityRatio: Math.round(intensityRatio * 1000) / 1000,
    reductionProgress: Math.round(reductionProgress * 10) / 10,
    complianceStatus
  };
}
