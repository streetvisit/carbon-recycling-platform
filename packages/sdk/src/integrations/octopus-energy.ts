import { BaseIntegration, IntegrationType, IntegrationStatus, IntegrationConfig } from './base';

export interface OctopusEnergyMeterReading {
  meter_id: string;
  reading_date: string;
  electricity_kwh: number;
  gas_kwh?: number;
  cost_gbp: number;
}

export interface OctopusEnergyAccount {
  account_number: string;
  business_name?: string;
  meters: string[];
}

export class OctopusEnergyIntegration extends BaseIntegration {
  protected baseUrl = 'https://api.octopus.energy/v1';
  
  constructor(config: IntegrationConfig) {
    super({
      ...config,
      type: IntegrationType.UTILITY,
      provider: 'Octopus Energy',
      requiredCredentials: ['api_key']
    });
  }

  async authenticate(): Promise<boolean> {
    try {
      this.setStatus(IntegrationStatus.AUTHENTICATING);
      
      // API key authentication - no additional setup required
      if (!this.credentials.api_key) {
        throw new Error('API key required');
      }
      
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

      const response = await fetch(`${this.baseUrl}/accounts/${this.credentials.account_number}/readings`, {
        headers: {
          'Authorization': `Bearer ${this.credentials.api_key}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.statusText}`);
      }

      const data = await response.json();
      this.rawData = {
        readings: data.readings || data,
        timestamp: new Date().toISOString()
      };

      return this.rawData.readings;
      
    } catch (error) {
      this.setStatus(IntegrationStatus.ERROR, `Data fetch failed: ${error.message}`);
      throw error;
    }
  }

  async calculateEmissions(): Promise<any> {
    if (!this.rawData?.readings) {
      throw new Error('No data available for emission calculations');
    }

    const readings = this.rawData.readings;
    let totalElectricityKwh = 0;
    let totalGasKwh = 0;
    let totalCostGbp = 0;

    readings.forEach(reading => {
      totalElectricityKwh += reading.electricity_kwh || 0;
      totalGasKwh += reading.gas_kwh || 0;
      totalCostGbp += reading.cost_gbp || 0;
    });

    // Standard UK emission factors
    const electricityEmissions = totalElectricityKwh * 0.193;
    const gasEmissions = totalGasKwh * 0.184;
    const totalEmissions = electricityEmissions + gasEmissions;

    this.emissionsData = {
      total_co2e_kg: Math.round(totalEmissions * 100) / 100,
      electricity: {
        consumption_kwh: totalElectricityKwh,
        emissions_kg_co2e: Math.round(electricityEmissions * 100) / 100,
        emission_factor: 0.193
      },
      gas: {
        consumption_kwh: totalGasKwh,
        emissions_kg_co2e: Math.round(gasEmissions * 100) / 100,
        emission_factor: 0.184
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
    return !!(this.credentials.api_key || this.credentials.access_token);
  }
}
