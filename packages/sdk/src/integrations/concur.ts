import { BaseIntegration, IntegrationType, IntegrationStatus, IntegrationConfig } from './base';

export interface ConcurVehicleData {
  id: string;
  date: string;
  mileage: number; fuel_consumption: number;
}

export class ConcurIntegration extends BaseIntegration {
  protected baseUrl = 'https://www.concursolutions.com/api/v3.0';
  
  constructor(config: IntegrationConfig) {
    super({
      ...config,
      type: IntegrationType.TRANSPORT,
      provider: 'SAP Concur',
      requiredCredentials: ['client_id', 'client_secret']
    });
  }

  async authenticate(): Promise<boolean> {
    try {
      this.setStatus(IntegrationStatus.AUTHENTICATING);
      const tokenResponse = await fetch(`${this.baseUrl}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.credentials.client_id,
          client_secret: this.credentials.client_secret
        })
      });
      
      if (!tokenResponse.ok) throw new Error(`OAuth failed: ${tokenResponse.statusText}`);
      
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
        if (!authSuccess) throw new Error('Authentication required');
      }

      const endpoint = '/vehicles';

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${this.credentials.access_token}`,
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
    let totalFuel = 0;
    data.forEach(vehicle => totalFuel += vehicle.fuel_consumption || 0);
    const emissions = totalFuel * 2.687;
    
    this.emissionsData = {
      total_co2e_kg: Math.round(emissions * 100) / 100,
      fuel_consumption: totalFuel,
      calculation_timestamp: new Date().toISOString()
    };

    return this.emissionsData;
  }

  async getEmissions(): Promise<any> {
    if (!this.emissionsData) await this.calculateEmissions();
    return this.emissionsData;
  }

  private isAuthenticated(): boolean {
    return !!(this.credentials.access_token && this.credentials.expires_at && Date.now() < this.credentials.expires_at);
  }
}
