import { BaseIntegration, IntegrationType, IntegrationStatus, IntegrationConfig } from './base';

export interface UtilitaMeterReading {
  meter_id: string;
  reading_date: string;
  electricity_kwh: number;
  gas_kwh?: number;
  cost_gbp: number;
}

export interface UtilitaAccount {
  account_number: string;
  business_name?: string;
  meters: string[];
}

export class UtilitaIntegration extends BaseIntegration {
  protected baseUrl = 'https://api.utilita.co.uk/business/v1';
  
  constructor(config: IntegrationConfig) {
    super({
      ...config,
      type: IntegrationType.UTILITY,
      provider: 'Utilita',
      requiredCredentials: ['client_id', 'client_secret']
    });
  }

  async authenticate(): Promise<boolean> {
    try {
      this.setStatus(IntegrationStatus.AUTHENTICATING);
      
      const tokenResponse = await fetch(`${this.baseUrl}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.credentials.client_id,
          client_secret: this.credentials.client_secret
        })
      });
      
      if (!tokenResponse.ok) {
        throw new Error(`OAuth failed: ${tokenResponse.statusText}`);
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

      const response = await fetch(`${this.baseUrl}/accounts/${this.credentials.account_number}/readings`, {
        headers: {
          'Authorization': `Bearer ${this.credentials.access_token}`,
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
    return !!(
        this.credentials.access_token &&
        this.credentials.expires_at &&
        Date.now() < this.credentials.expires_at
      );
  }
}
