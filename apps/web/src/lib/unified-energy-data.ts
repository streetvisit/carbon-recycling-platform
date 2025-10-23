/**
 * Unified Energy Data Service
 * 
 * Aggregates data from multiple sources:
 * - NESO (National Energy System Operator) - Real-time grid data
 * - Energy Dashboard API - Additional metrics
 * - Carbon Intensity API - Carbon forecasts
 */

import { nesoClient, type GenerationMixData, type RenewableForecast, type InterconnectorFlow } from './neso-client';

export interface UnifiedEnergySnapshot {
  timestamp: Date;
  
  // Generation
  generation: {
    total: number; // MW
    byType: {
      renewable: number; // wind + solar + hydro
      fossil: number; // coal + ccgt + oil
      nuclear: number;
      other: number;
    };
    breakdown: {
      wind: number;
      solar: number;
      hydro: number;
      nuclear: number;
      coal: number;
      gas: number;
      biomass: number;
      oil: number;
      other: number;
    };
  };
  
  // Carbon
  carbon: {
    intensity: number; // gCO2/kWh
    rating: 'very-low' | 'low' | 'moderate' | 'high' | 'very-high';
    forecast24h?: Array<{
      timestamp: Date;
      intensity: number;
    }>;
  };
  
  // Demand
  demand: {
    current: number; // MW
    forecast1Day?: number[];
    forecast7Day?: number[];
  };
  
  // Renewables
  renewables: {
    current: number; // MW
    percentage: number;
    forecast14Day?: RenewableForecast[];
  };
  
  // Interconnectors
  interconnectors: {
    totalImport: number; // MW (net import)
    totalExport: number; // MW (net export)
    netFlow: number; // MW (positive = import, negative = export)
    byCountry: {
      france: number;
      netherlands: number;
      belgium: number;
      denmark: number;
    };
  };
  
  // Metadata
  dataQuality: {
    nesoAvailable: boolean;
    carbonApiAvailable: boolean;
    lastUpdate: Date;
  };
}

export interface BestTimeRecommendation {
  timestamp: Date;
  score: number; // 0-100 (higher is better)
  carbonIntensity: number;
  renewablePercentage: number;
  demand: number;
  recommendation: 'excellent' | 'good' | 'moderate' | 'poor';
  reason: string;
}

export interface FlexibilityAlert {
  active: boolean;
  message: string;
  startTime?: Date;
  endTime?: Date;
  incentive?: string;
  targetReduction?: number;
}

class UnifiedEnergyDataService {
  /**
   * Get comprehensive current energy snapshot
   */
  async getCurrentSnapshot(): Promise<UnifiedEnergySnapshot> {
    const [generationMix, interconnectors, renewableForecasts, demandForecast1Day, demandForecast7Day] = 
      await Promise.allSettled([
        nesoClient.getGenerationMix(),
        nesoClient.getAllInterconnectors(),
        nesoClient.getRenewableForecasts(),
        nesoClient.getDemandForecast1Day(),
        nesoClient.getDemandForecast7Day(),
      ]);

    // Get latest generation mix
    const latestGen = generationMix.status === 'fulfilled' && generationMix.value.length > 0
      ? generationMix.value[generationMix.value.length - 1]
      : null;

    // Calculate generation totals
    const generation = this.calculateGeneration(latestGen);

    // Process interconnector data
    const interconnectorData = interconnectors.status === 'fulfilled'
      ? this.processInterconnectors(interconnectors.value)
      : this.getEmptyInterconnectorData();

    // Get current demand
    const currentDemand = generation.total;

    // Calculate renewable percentage
    const renewablePercentage = generation.total > 0
      ? (generation.byType.renewable / generation.total) * 100
      : 0;

    // Carbon intensity rating
    const carbonIntensity = latestGen?.carbonIntensity || 0;
    const carbonRating = this.getCarbonRating(carbonIntensity);

    return {
      timestamp: latestGen?.timestamp || new Date(),
      
      generation,
      
      carbon: {
        intensity: carbonIntensity,
        rating: carbonRating,
      },
      
      demand: {
        current: currentDemand,
        forecast1Day: demandForecast1Day.status === 'fulfilled'
          ? demandForecast1Day.value.map(f => f.demand)
          : undefined,
        forecast7Day: demandForecast7Day.status === 'fulfilled'
          ? demandForecast7Day.value.map(f => f.demand)
          : undefined,
      },
      
      renewables: {
        current: generation.byType.renewable,
        percentage: renewablePercentage,
        forecast14Day: renewableForecasts.status === 'fulfilled'
          ? renewableForecasts.value
          : undefined,
      },
      
      interconnectors: interconnectorData,
      
      dataQuality: {
        nesoAvailable: generationMix.status === 'fulfilled',
        carbonApiAvailable: true,
        lastUpdate: new Date(),
      },
    };
  }

  /**
   * Get "Best Time to Use Energy" recommendations for next 24 hours
   */
  async getBestTimeRecommendations(): Promise<BestTimeRecommendation[]> {
    const [renewableForecasts, demandForecast] = await Promise.allSettled([
      nesoClient.getRenewableForecasts(),
      nesoClient.getDemandForecast1Day(),
    ]);

    const recommendations: BestTimeRecommendation[] = [];

    if (renewableForecasts.status === 'fulfilled' && demandForecast.status === 'fulfilled') {
      const forecasts = renewableForecasts.value.slice(0, 48); // Next 24 hours (30-min intervals)
      const demands = demandForecast.value.slice(0, 48);

      forecasts.forEach((forecast, index) => {
        const demand = demands[index]?.demand || 35000; // Default typical demand
        const totalRenewable = forecast.windForecast + forecast.solarForecast;
        const renewablePercentage = (totalRenewable / demand) * 100;

        // Estimate carbon intensity based on renewable percentage
        const estimatedCarbon = this.estimateCarbonFromRenewables(renewablePercentage);

        // Calculate score (0-100)
        // Higher renewable % = better score
        // Lower demand = better score (less strain on grid)
        const renewableScore = Math.min(renewablePercentage, 100);
        const demandScore = 100 - ((demand - 30000) / 200); // Normalize demand (30-50 GW typical)
        const score = (renewableScore * 0.7 + demandScore * 0.3);

        // Determine recommendation level
        let recommendation: BestTimeRecommendation['recommendation'];
        let reason: string;

        if (score >= 80) {
          recommendation = 'excellent';
          reason = `${renewablePercentage.toFixed(0)}% renewable energy - perfect time to use power!`;
        } else if (score >= 60) {
          recommendation = 'good';
          reason = `${renewablePercentage.toFixed(0)}% renewable energy - good time for energy-intensive tasks`;
        } else if (score >= 40) {
          recommendation = 'moderate';
          reason = `${renewablePercentage.toFixed(0)}% renewable energy - acceptable but not optimal`;
        } else {
          recommendation = 'poor';
          reason = `Only ${renewablePercentage.toFixed(0)}% renewable energy - consider delaying non-essential usage`;
        }

        recommendations.push({
          timestamp: forecast.timestamp,
          score,
          carbonIntensity: estimatedCarbon,
          renewablePercentage,
          demand,
          recommendation,
          reason,
        });
      });
    }

    return recommendations;
  }

  /**
   * Get active flexibility alerts
   */
  async getFlexibilityAlerts(): Promise<FlexibilityAlert[]> {
    try {
      const events = await nesoClient.getFlexibilityEvents();
      
      return events.map(event => ({
        active: event.type === 'active',
        message: event.type === 'active'
          ? `Grid needs your help! Reduce usage to earn ${event.incentive}`
          : `Upcoming flexibility event from ${event.startTime.toLocaleTimeString()} to ${event.endTime.toLocaleTimeString()}`,
        startTime: event.startTime,
        endTime: event.endTime,
        incentive: event.incentive,
        targetReduction: event.targetReduction,
      }));
    } catch (error) {
      console.error('Failed to fetch flexibility alerts:', error);
      return [];
    }
  }

  /**
   * Get 14-day renewable energy outlook
   */
  async getRenewableOutlook() {
    const forecasts = await nesoClient.getRenewableForecasts();
    
    // Group by day
    const dailyOutlook = new Map<string, { wind: number; solar: number; count: number }>();
    
    forecasts.forEach(forecast => {
      const dateKey = forecast.timestamp.toISOString().split('T')[0];
      const existing = dailyOutlook.get(dateKey) || { wind: 0, solar: 0, count: 0 };
      
      dailyOutlook.set(dateKey, {
        wind: existing.wind + forecast.windForecast,
        solar: existing.solar + forecast.solarForecast,
        count: existing.count + 1,
      });
    });

    // Calculate daily averages
    return Array.from(dailyOutlook.entries()).map(([date, data]) => ({
      date: new Date(date),
      avgWind: data.wind / data.count,
      avgSolar: data.solar / data.count,
      total: (data.wind + data.solar) / data.count,
    }));
  }

  // ========== HELPER METHODS ==========

  private calculateGeneration(latestGen: GenerationMixData | null) {
    if (!latestGen) {
      return {
        total: 0,
        byType: { renewable: 0, fossil: 0, nuclear: 0, other: 0 },
        breakdown: {
          wind: 0, solar: 0, hydro: 0, nuclear: 0,
          coal: 0, gas: 0, biomass: 0, oil: 0, other: 0,
        },
      };
    }

    const renewable = latestGen.wind + latestGen.solar + latestGen.hydro;
    const fossil = latestGen.coal + latestGen.ccgt + latestGen.oil;
    const total = renewable + fossil + latestGen.nuclear + latestGen.biomass + latestGen.other;

    return {
      total,
      byType: {
        renewable,
        fossil,
        nuclear: latestGen.nuclear,
        other: latestGen.biomass + latestGen.other,
      },
      breakdown: {
        wind: latestGen.wind,
        solar: latestGen.solar,
        hydro: latestGen.hydro,
        nuclear: latestGen.nuclear,
        coal: latestGen.coal,
        gas: latestGen.ccgt,
        biomass: latestGen.biomass,
        oil: latestGen.oil,
        other: latestGen.other,
      },
    };
  }

  private processInterconnectors(flows: Record<string, InterconnectorFlow[]>) {
    let totalImport = 0;
    let totalExport = 0;

    const france = this.getLatestFlow(flows.ifa) + this.getLatestFlow(flows.ifa2) + this.getLatestFlow(flows.eleclink);
    const netherlands = this.getLatestFlow(flows.britned);
    const belgium = this.getLatestFlow(flows.nemolink);
    const denmark = this.getLatestFlow(flows['ik-viking-link']);

    const byCountry = { france, netherlands, belgium, denmark };

    Object.values(byCountry).forEach(flow => {
      if (flow > 0) totalImport += flow;
      else totalExport += Math.abs(flow);
    });

    return {
      totalImport,
      totalExport,
      netFlow: totalImport - totalExport,
      byCountry,
    };
  }

  private getLatestFlow(flows: InterconnectorFlow[] | undefined): number {
    if (!flows || flows.length === 0) return 0;
    return flows[flows.length - 1].flow;
  }

  private getEmptyInterconnectorData() {
    return {
      totalImport: 0,
      totalExport: 0,
      netFlow: 0,
      byCountry: { france: 0, netherlands: 0, belgium: 0, denmark: 0 },
    };
  }

  private getCarbonRating(intensity: number): UnifiedEnergySnapshot['carbon']['rating'] {
    if (intensity < 50) return 'very-low';
    if (intensity < 100) return 'low';
    if (intensity < 150) return 'moderate';
    if (intensity < 200) return 'high';
    return 'very-high';
  }

  private estimateCarbonFromRenewables(renewablePercentage: number): number {
    // Rough estimation: 100% renewable ≈ 0 gCO2/kWh, 0% renewable ≈ 300 gCO2/kWh
    return Math.round(300 * (1 - renewablePercentage / 100));
  }
}

// Export singleton instance
export const unifiedEnergyData = new UnifiedEnergyDataService();
