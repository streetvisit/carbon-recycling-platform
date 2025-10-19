import { BaseIntegration, IntegrationType, IntegrationStatus, IntegrationConfig } from './base';

export interface EDFEnergyMeterReading {
  meter_id: string;
  reading_date: string;
  electricity_kwh: number;
  gas_kwh: number;
  cost_gbp: number;
  tariff_type: string;
  supply_number: string;
}

export interface EDFEnergyBusinessAccount {
  account_number: string;
  business_name: string;
  site_address: string;
  contract_type: 'nuclear_green' | 'blue_plus' | 'fixed_price' | 'industrial_supply';
  meters: {
    electricity: string[];
    gas: string[];
  };
}

export interface EDFEnergySupplyData {
  fuel_mix: {
    nuclear: number; // EDF's high nuclear percentage
    renewable: number;
    gas: number;
    coal: number;
    other: number;
  };
  carbon_intensity: {
    electricity: number; // Lower due to nuclear focus
    gas: number;
  };
}

export class EDFEnergyIntegration extends BaseIntegration {
  protected baseUrl = 'https://api.edfenergy.com/business/v2';
  
  constructor(config: IntegrationConfig) {
    super({
      ...config,
      type: IntegrationType.UTILITY,
      provider: 'EDF Energy',
      requiredCredentials: ['client_id', 'client_secret', 'account_number']
    });
  }

  async authenticate(): Promise<boolean> {
    try {
      this.setStatus(IntegrationStatus.AUTHENTICATING);
      
      // EDF Energy uses OAuth 2.0 for business APIs
      const tokenResponse = await fetch(`${this.baseUrl}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(
            `${this.credentials.client_id}:${this.credentials.client_secret}`
          ).toString('base64')}`
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          scope: 'business:read'
        })
      });

      if (!tokenResponse.ok) {
        throw new Error(`Authentication failed: ${tokenResponse.statusText}`);
      }

      const tokenData = await tokenResponse.json();
      this.credentials.access_token = tokenData.access_token;
      this.credentials.expires_at = Date.now() + (tokenData.expires_in * 1000);
      
      this.setStatus(IntegrationStatus.CONNECTED);
      return true;
      
    } catch (error) {
      this.setStatus(IntegrationStatus.ERROR, `Authentication failed: ${error.message}`);
      return false;
    }
  }

  async fetchData(): Promise<any[]> {
    try {
      if (!this.isAuthenticated()) {
        const authSuccess = await this.authenticate();
        if (!authSuccess) {
          throw new Error('Authentication required');
        }
      }

      // Get business account details
      const accountResponse = await fetch(
        `${this.baseUrl}/accounts/${this.credentials.account_number}`,
        {
          headers: {
            'Authorization': `Bearer ${this.credentials.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!accountResponse.ok) {
        throw new Error(`Failed to fetch account: ${accountResponse.statusText}`);
      }

      const accountData: EDFEnergyBusinessAccount = await accountResponse.json();

      // Get meter readings for all meters
      const meterReadings: EDFEnergyMeterReading[] = [];
      const allMeters = [...accountData.meters.electricity, ...accountData.meters.gas];
      
      for (const meterId of allMeters) {
        const readingResponse = await fetch(
          `${this.baseUrl}/meters/${meterId}/readings?period=30days`,
          {
            headers: {
              'Authorization': `Bearer ${this.credentials.access_token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (readingResponse.ok) {
          const readings = await readingResponse.json();
          meterReadings.push(...readings.data);
        }
      }

      // Get supply data for emission calculations
      const supplyResponse = await fetch(
        `${this.baseUrl}/supply-data`,
        {
          headers: {
            'Authorization': `Bearer ${this.credentials.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const supplyData: EDFEnergySupplyData = supplyResponse.ok 
        ? await supplyResponse.json()
        : this.getDefaultSupplyData();

      this.rawData = {
        account: accountData,
        readings: meterReadings,
        supply_data: supplyData,
        timestamp: new Date().toISOString()
      };

      return meterReadings;
      
    } catch (error) {
      this.setStatus(IntegrationStatus.ERROR, `Data fetch failed: ${error.message}`);
      throw error;
    }
  }

  private getDefaultSupplyData(): EDFEnergySupplyData {
    return {
      fuel_mix: {
        nuclear: 68.2, // EDF's high nuclear percentage
        renewable: 18.5,
        gas: 11.8,
        coal: 0.8,
        other: 0.7
      },
      carbon_intensity: {
        electricity: 0.156, // Lower due to nuclear focus
        gas: 0.184 // Standard UK gas factor
      }
    };
  }

  async calculateEmissions(): Promise<any> {
    if (!this.rawData?.readings) {
      throw new Error('No data available for emission calculations');
    }

    const readings = this.rawData.readings as EDFEnergyMeterReading[];
    const supplyData = this.rawData.supply_data as EDFEnergySupplyData;

    let totalElectricityKwh = 0;
    let totalGasKwh = 0;
    let totalCostGbp = 0;

    // Aggregate consumption data
    readings.forEach(reading => {
      totalElectricityKwh += reading.electricity_kwh || 0;
      totalGasKwh += reading.gas_kwh || 0;
      totalCostGbp += reading.cost_gbp || 0;
    });

    // Calculate emissions using EDF-specific factors
    const electricityEmissions = totalElectricityKwh * supplyData.carbon_intensity.electricity;
    const gasEmissions = totalGasKwh * supplyData.carbon_intensity.gas;
    const totalEmissions = electricityEmissions + gasEmissions;

    // Scope breakdown
    const scope1Emissions = gasEmissions; // Direct combustion
    const scope2LocationBased = totalElectricityKwh * 0.193; // UK grid average
    const scope2MarketBased = electricityEmissions; // EDF-specific factor
    const scope3Emissions = totalEmissions * 0.12; // Transmission & distribution

    this.emissionsData = {
      total_co2e_kg: Math.round(totalEmissions * 100) / 100,
      electricity: {
        consumption_kwh: totalElectricityKwh,
        emissions_kg_co2e: Math.round(electricityEmissions * 100) / 100,
        emission_factor: supplyData.carbon_intensity.electricity
      },
      gas: {
        consumption_kwh: totalGasKwh,
        emissions_kg_co2e: Math.round(gasEmissions * 100) / 100,
        emission_factor: supplyData.carbon_intensity.gas
      },
      scope_breakdown: {
        scope_1: Math.round(scope1Emissions * 100) / 100,
        scope_2_location: Math.round(scope2LocationBased * 100) / 100,
        scope_2_market: Math.round(scope2MarketBased * 100) / 100,
        scope_3: Math.round(scope3Emissions * 100) / 100
      },
      fuel_mix: supplyData.fuel_mix,
      cost_analysis: {
        total_cost_gbp: totalCostGbp,
        cost_per_kwh: totalCostGbp / (totalElectricityKwh + totalGasKwh),
        carbon_cost_efficiency: totalEmissions / totalCostGbp // kg CO2e per £
      },
      edf_benefits: {
        nuclear_percentage: supplyData.fuel_mix.nuclear,
        carbon_savings_vs_grid: (scope2LocationBased - scope2MarketBased),
        low_carbon_electricity: supplyData.fuel_mix.nuclear + supplyData.fuel_mix.renewable
      },
      period: {
        start_date: readings[0]?.reading_date,
        end_date: readings[readings.length - 1]?.reading_date,
        days_covered: readings.length
      },
      calculation_timestamp: new Date().toISOString()
    };

    return this.emissionsData;
  }

  async getEmissions(): Promise<any> {
    if (!this.emissionsData) {
      await this.calculateEmissions();
    }
    return this.emissionsData;
  }

  private isAuthenticated(): boolean {
    return !!(
      this.credentials.access_token &&
      this.credentials.expires_at &&
      Date.now() < this.credentials.expires_at
    );
  }

  // EDF Energy specific methods
  async getNuclearGenerationData(): Promise<any> {
    try {
      const response = await fetch(
        `${this.baseUrl}/generation/nuclear`,
        {
          headers: {
            'Authorization': `Bearer ${this.credentials.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        return await response.json();
      }
      
      return null;
    } catch (error) {
      console.warn('Nuclear generation data not available:', error.message);
      return null;
    }
  }

  async getTariffDetails(): Promise<any> {
    try {
      const response = await fetch(
        `${this.baseUrl}/tariffs/${this.credentials.account_number}`,
        {
          headers: {
            'Authorization': `Bearer ${this.credentials.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        return await response.json();
      }
      
      return null;
    } catch (error) {
      console.warn('Tariff details not available:', error.message);
      return null;
    }
  }
}