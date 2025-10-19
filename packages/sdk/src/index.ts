/**
 * Carbon Recycling Platform SDK
 * Main SDK for managing integrations and data collection
 */

export interface CarbonRecyclingConfig {
  apiKey: string;
  baseUrl?: string;
  debug?: boolean;
}

export interface IntegrationCredentials {
  [key: string]: string;
}

export interface DataMapping {
  [sourceField: string]: string;
}

export interface IntegrationConfig {
  provider: string;
  credentials: IntegrationCredentials;
  dataMapping: DataMapping;
  frequency: 'real-time' | 'daily' | 'weekly' | 'monthly';
}

export interface EmissionsData {
  totalCO2e: number;
  scope1: number;
  scope2: number;
  scope3: number;
  breakdown: {
    electricity: number;
    gas: number;
    transport: number;
    travel: number;
    waste: number;
  };
  period: {
    startDate: string;
    endDate: string;
  };
  rawData: any[];
}

export interface Integration {
  id: string;
  provider: string;
  status: 'active' | 'inactive' | 'error' | 'syncing';
  lastSync: string;
  nextSync: string;
  
  startSync(): Promise<void>;
  stopSync(): Promise<void>;
  getEmissions(options: { startDate: string; endDate: string }): Promise<EmissionsData>;
  validateConnection(): Promise<boolean>;
  getLastError(): Promise<string | null>;
}

export class CarbonRecyclingAPI {
  private config: CarbonRecyclingConfig;
  
  constructor(config: CarbonRecyclingConfig) {
    this.config = {
      baseUrl: 'https://api.carbonrecycling.co.uk',
      debug: false,
      ...config
    };
  }
  
  get integrations() {
    return {
      configure: async (integrationConfig: IntegrationConfig): Promise<Integration> => {
        const response = await this.request('POST', '/integrations', integrationConfig);
        return this.createIntegrationInstance(response.data);
      },
      
      list: async (): Promise<Integration[]> => {
        const response = await this.request('GET', '/integrations');
        return response.data.map((integration: any) => 
          this.createIntegrationInstance(integration)
        );
      },
      
      get: async (integrationId: string): Promise<Integration> => {
        const response = await this.request('GET', `/integrations/${integrationId}`);
        return this.createIntegrationInstance(response.data);
      },
      
      delete: async (integrationId: string): Promise<void> => {
        await this.request('DELETE', `/integrations/${integrationId}`);
      }
    };
  }
  
  private createIntegrationInstance(data: any): Integration {
    return new IntegrationInstance(this, data);
  }
  
  private async request(method: string, endpoint: string, body?: any) {
    const url = `${this.config.baseUrl}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json'
    };
    
    if (this.config.debug) {
      console.log(`[CarbonRecycling SDK] ${method} ${url}`, body);
    }
    
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  }
}

class IntegrationInstance implements Integration {
  constructor(private api: CarbonRecyclingAPI, private data: any) {}
  
  get id() { return this.data.id; }
  get provider() { return this.data.provider; }
  get status() { return this.data.status; }
  get lastSync() { return this.data.lastSync; }
  get nextSync() { return this.data.nextSync; }
  
  async startSync(): Promise<void> {
    await (this.api as any).request('POST', `/integrations/${this.id}/sync/start`);
  }
  
  async stopSync(): Promise<void> {
    await (this.api as any).request('POST', `/integrations/${this.id}/sync/stop`);
  }
  
  async getEmissions(options: { startDate: string; endDate: string }): Promise<EmissionsData> {
    const response = await (this.api as any).request('GET', 
      `/integrations/${this.id}/emissions?startDate=${options.startDate}&endDate=${options.endDate}`
    );
    return response.data;
  }
  
  async validateConnection(): Promise<boolean> {
    const response = await (this.api as any).request('POST', `/integrations/${this.id}/validate`);
    return response.data.valid;
  }
  
  async getLastError(): Promise<string | null> {
    const response = await (this.api as any).request('GET', `/integrations/${this.id}/errors/latest`);
    return response.data.error;
  }
}

// Export specific integration classes
export { BritishGasIntegration } from './integrations/british-gas';
export { AWSIntegration } from './integrations/aws';
export { SAPIntegration } from './integrations/sap';
export { OctopusEnergyIntegration } from './integrations/octopus-energy';
export { MicrosoftAzureIntegration } from './integrations/azure';

export { GoodEnergyIntegration } from './integrations/good-energy';
export { MicrosoftDynamicsCrmIntegration } from './integrations/microsoft-dynamics-crm';
export { OracleHcmCloudIntegration } from './integrations/oracle-hcm-cloud';
export { SapSuccessfactorsIntegration } from './integrations/sap-successfactors';
export { CoupaProcurementIntegration } from './integrations/coupa-procurement';
export { AribaProcurementIntegration } from './integrations/ariba-procurement';
export { FleetCompleteAdvancedIntegration } from './integrations/fleet-complete-advanced';
export { UberFreightIntegration } from './integrations/uber-freight';
export { SiemensTeamcenterIntegration } from './integrations/siemens-teamcenter';
export { Dassault3dexperienceIntegration } from './integrations/dassault-3dexperience';
export { AutodeskVaultIntegration } from './integrations/autodesk-vault';
export { PtcWindchillIntegration } from './integrations/ptc-windchill';
export { ServicenowIntegration } from './integrations/servicenow';
export { AtlassianJiraIntegration } from './integrations/atlassian-jira';

// Export utility functions
export { validateCredentials, encryptCredentials } from './utils/auth';
export { calculateEmissions, convertUnits } from './utils/emissions';
export { validateDataMapping, transformData } from './utils/data-transform';