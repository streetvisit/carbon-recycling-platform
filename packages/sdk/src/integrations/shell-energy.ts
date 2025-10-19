import { BaseIntegration, IntegrationType, IntegrationStatus, IntegrationConfig } from './base';

export interface ShellEnergyMeterReading {
  id: string;
  date: string;
  electricity_kwh: number; gas_kwh?: number;
}

export class ShellEnergyIntegration extends BaseIntegration {
  protected baseUrl = 'https://api.shellenergy.co.uk/v1';
  
  constructor(config: IntegrationConfig) {
    super({
      ...config,
      type: IntegrationType.UTILITIES,
      provider: 'Shell Energy',
      requiredCredentials: ['api_key']
    });
  }

  async authenticate(): Promise<boolean> {
    try {
      this.setStatus(IntegrationStatus.AUTHENTICATING);
      if (!this.credentials.api_key) throw new Error('API key required');
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
        if (!authSuccess) throw new Error('Authentication required');
      }

      const endpoint = '/accounts/${this.credentials.account_number}/readings';

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${this.credentials.api_key}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error(`Failed to fetch data: ${response.statusText}`);

      const data = await response.json();
      this.rawData = { data: data.data || data, timestamp: new Date().toISOString() };
      return this.rawData.data;
    } catch (error) {
      this.setStatus(IntegrationStatus.ERROR, `Data fetch failed: ${error.message}`);
      throw error;
    }
  }

  async calculateEmissions(): Promise<any> {
    if (!this.rawData?.data) throw new Error('No data available for emission calculations');

    const data = this.rawData.data;
    let totalElectricityKwh = 0, totalGasKwh = 0;
    data.forEach(reading => {
      totalElectricityKwh += reading.electricity_kwh || 0;
      totalGasKwh += reading.gas_kwh || 0;
    });
    
    const electricityEmissions = totalElectricityKwh * 0.193;
    const gasEmissions = totalGasKwh * 0.184;
    
    this.emissionsData = {
      total_co2e_kg: Math.round((electricityEmissions + gasEmissions) * 100) / 100,
      electricity: { consumption_kwh: totalElectricityKwh, emissions_kg_co2e: electricityEmissions },
      gas: { consumption_kwh: totalGasKwh, emissions_kg_co2e: gasEmissions },
      calculation_timestamp: new Date().toISOString()
    };

    return this.emissionsData;
  }

  async getEmissions(): Promise<any> {
    if (!this.emissionsData) await this.calculateEmissions();
    return this.emissionsData;
  }

  private isAuthenticated(): boolean {
    return !!(this.credentials.api_key || this.credentials.access_token);
  }
}
