import { BaseIntegration, IntegrationType, IntegrationStatus, IntegrationConfig } from './base';

export interface IbmCloudUsage {
  resource_id: string;
  resource_type: string;
  usage_hours: number;
  cost: number;
  region: string;
}

export class IbmCloudIntegration extends BaseIntegration {
  protected baseUrl = 'https://resource-controller.cloud.ibm.com/v2';
  
  constructor(config: IntegrationConfig) {
    super({
      ...config,
      type: IntegrationType.CLOUD,
      provider: 'IBM Cloud',
      requiredCredentials: ['access_key_id', 'secret_access_key']
    });
  }

  async authenticate(): Promise<boolean> {
    try {
      this.setStatus(IntegrationStatus.AUTHENTICATING);
      
      // Access key authentication
      if (!this.credentials.access_key_id || !this.credentials.secret_access_key) {
        throw new Error('Access key credentials required');
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

      const response = await fetch(`${this.baseUrl}/usage`, {
        headers: {
          'Authorization': `AWS4-HMAC-SHA256 ${this.credentials.access_key_id}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.statusText}`);
      }

      const data = await response.json();
      this.rawData = {
        usage: data.usage || data,
        timestamp: new Date().toISOString()
      };

      return this.rawData.usage;
      
    } catch (error) {
      this.setStatus(IntegrationStatus.ERROR, `Data fetch failed: ${error.message}`);
      throw error;
    }
  }

  async calculateEmissions(): Promise<any> {
    if (!this.rawData?.usage) {
      throw new Error('No data available for emission calculations');
    }

    const usage = this.rawData.usage;
    let totalComputeHours = 0;
    let totalCost = 0;

    usage.forEach(item => {
      totalComputeHours += item.usage_hours || 0;
      totalCost += item.cost || 0;
    });

    // Cloud emission factors (example values)
    const computeEmissions = totalComputeHours * 0.000065;

    this.emissionsData = {
      total_co2e_kg: Math.round(computeEmissions * 100) / 100,
      compute: {
        hours: totalComputeHours,
        emissions_kg_co2e: Math.round(computeEmissions * 100) / 100,
        emission_factor: 0.000065
      },
      cost_analysis: {
        total_cost: totalCost,
        cost_per_hour: totalCost / totalComputeHours
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
