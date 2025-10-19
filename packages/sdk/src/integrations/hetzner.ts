import { BaseIntegration, IntegrationType, IntegrationStatus, IntegrationConfig } from './base';

export interface HetznerUsage {
  id: string;
  date: string;
  usage_hours: number; cost: number;
}

export class HetznerIntegration extends BaseIntegration {
  protected baseUrl = 'https://api.hetzner.cloud/v1';
  
  constructor(config: IntegrationConfig) {
    super({
      ...config,
      type: IntegrationType.CLOUD,
      provider: 'Hetzner Cloud',
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

      const endpoint = '/usage';

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
    let totalHours = 0;
    data.forEach(item => totalHours += item.usage_hours || 0);
    const emissions = totalHours * 0.000065;
    
    this.emissionsData = {
      total_co2e_kg: Math.round(emissions * 100) / 100,
      compute_hours: totalHours,
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
