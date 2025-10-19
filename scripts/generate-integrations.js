#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Define all integrations to generate
const integrations = {
  utilities: [
    { id: 'octopus-energy', name: 'Octopus Energy', auth: 'api-key', baseUrl: 'https://api.octopus.energy/v1' },
    { id: 'sse-energy', name: 'SSE Energy Services', auth: 'oauth', baseUrl: 'https://api.sse.co.uk/energy/v2' },
    { id: 'scottish-power', name: 'ScottishPower', auth: 'oauth', baseUrl: 'https://api.scottishpower.co.uk/business/v1' },
    { id: 'eon-next', name: 'E.ON Next', auth: 'api-key', baseUrl: 'https://api.eon.co.uk/business/v1' },
    { id: 'bulb-energy', name: 'Bulb Energy', auth: 'api-key', baseUrl: 'https://api.bulb.co.uk/v1' },
    { id: 'ovo-energy', name: 'OVO Energy', auth: 'oauth', baseUrl: 'https://api.ovoenergy.com/v2' },
    { id: 'good-energy', name: 'Good Energy', auth: 'oauth', baseUrl: 'https://api.goodenergy.co.uk/v1' },
    { id: 'together-energy', name: 'Together Energy', auth: 'api-key', baseUrl: 'https://api.togetherenergy.co.uk/v1' },
    { id: 'utilita', name: 'Utilita', auth: 'oauth', baseUrl: 'https://api.utilita.co.uk/business/v1' }
  ],
  cloud: [
    { id: 'azure', name: 'Microsoft Azure', auth: 'service-account', baseUrl: 'https://management.azure.com' },
    { id: 'gcp', name: 'Google Cloud Platform', auth: 'service-account', baseUrl: 'https://cloudresourcemanager.googleapis.com/v1' },
    { id: 'ibm-cloud', name: 'IBM Cloud', auth: 'access-key', baseUrl: 'https://resource-controller.cloud.ibm.com/v2' },
    { id: 'oracle-cloud', name: 'Oracle Cloud Infrastructure', auth: 'api-key', baseUrl: 'https://iaas.cloud.oracle.com' },
    { id: 'digitalocean', name: 'DigitalOcean', auth: 'api-key', baseUrl: 'https://api.digitalocean.com/v2' }
  ],
  erp: [
    { id: 'oracle-erp', name: 'Oracle Cloud ERP', auth: 'oauth', baseUrl: 'https://your-domain.oraclecloud.com/fscmRestApi' },
    { id: 'dynamics-365', name: 'Microsoft Dynamics 365', auth: 'oauth', baseUrl: 'https://your-org.crm.dynamics.com/api/data/v9.2' },
    { id: 'netsuite', name: 'NetSuite', auth: 'oauth', baseUrl: 'https://your-account.suitetalk.api.netsuite.com/services/rest' },
    { id: 'workday', name: 'Workday', auth: 'oauth', baseUrl: 'https://your-tenant.workday.com/ccx/api' },
    { id: 'salesforce', name: 'Salesforce', auth: 'oauth', baseUrl: 'https://your-domain.salesforce.com/services/data/v58.0' }
  ],
  transport: [
    { id: 'verizon-connect', name: 'Verizon Connect', auth: 'oauth', baseUrl: 'https://api.verizonconnect.com/v1' },
    { id: 'samsara', name: 'Samsara', auth: 'api-key', baseUrl: 'https://api.samsara.com' },
    { id: 'geotab', name: 'Geotab', auth: 'api-key', baseUrl: 'https://my.geotab.com/apiv1' },
    { id: 'fleet-complete', name: 'Fleet Complete', auth: 'oauth', baseUrl: 'https://api.fleetcomplete.com/v2' }
  ]
};

// Utility template
const utilityTemplate = (integration) => `import { BaseIntegration, IntegrationType, IntegrationStatus, IntegrationConfig } from './base';

export interface ${toPascalCase(integration.id)}MeterReading {
  meter_id: string;
  reading_date: string;
  electricity_kwh: number;
  gas_kwh?: number;
  cost_gbp: number;
}

export interface ${toPascalCase(integration.id)}Account {
  account_number: string;
  business_name?: string;
  meters: string[];
}

export class ${toPascalCase(integration.id)}Integration extends BaseIntegration {
  protected baseUrl = '${integration.baseUrl}';
  
  constructor(config: IntegrationConfig) {
    super({
      ...config,
      type: IntegrationType.UTILITY,
      provider: '${integration.name}',
      requiredCredentials: ${getCredentials(integration.auth)}
    });
  }

  async authenticate(): Promise<boolean> {
    try {
      this.setStatus(IntegrationStatus.AUTHENTICATING);
      
      ${getAuthCode(integration.auth)}
      
      this.setStatus(IntegrationStatus.CONNECTED);
      return true;
      
    } catch (error) {
      this.setStatus(IntegrationStatus.ERROR, \`Authentication failed: \${error.message}\`);
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

      const response = await fetch(\`\${this.baseUrl}/accounts/\${this.credentials.account_number}/readings\`, {
        headers: {
          ${getAuthHeader(integration.auth)},
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(\`Failed to fetch data: \${response.statusText}\`);
      }

      const data = await response.json();
      this.rawData = {
        readings: data.readings || data,
        timestamp: new Date().toISOString()
      };

      return this.rawData.readings;
      
    } catch (error) {
      this.setStatus(IntegrationStatus.ERROR, \`Data fetch failed: \${error.message}\`);
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
    ${getAuthCheck(integration.auth)}
  }
}
`;

// Cloud template
const cloudTemplate = (integration) => `import { BaseIntegration, IntegrationType, IntegrationStatus, IntegrationConfig } from './base';

export interface ${toPascalCase(integration.id)}Usage {
  resource_id: string;
  resource_type: string;
  usage_hours: number;
  cost: number;
  region: string;
}

export class ${toPascalCase(integration.id)}Integration extends BaseIntegration {
  protected baseUrl = '${integration.baseUrl}';
  
  constructor(config: IntegrationConfig) {
    super({
      ...config,
      type: IntegrationType.CLOUD,
      provider: '${integration.name}',
      requiredCredentials: ${getCredentials(integration.auth)}
    });
  }

  async authenticate(): Promise<boolean> {
    try {
      this.setStatus(IntegrationStatus.AUTHENTICATING);
      
      ${getAuthCode(integration.auth)}
      
      this.setStatus(IntegrationStatus.CONNECTED);
      return true;
      
    } catch (error) {
      this.setStatus(IntegrationStatus.ERROR, \`Authentication failed: \${error.message}\`);
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

      const response = await fetch(\`\${this.baseUrl}/usage\`, {
        headers: {
          ${getAuthHeader(integration.auth)},
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(\`Failed to fetch data: \${response.statusText}\`);
      }

      const data = await response.json();
      this.rawData = {
        usage: data.usage || data,
        timestamp: new Date().toISOString()
      };

      return this.rawData.usage;
      
    } catch (error) {
      this.setStatus(IntegrationStatus.ERROR, \`Data fetch failed: \${error.message}\`);
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
    ${getAuthCheck(integration.auth)}
  }
}
`;

// ERP template
const erpTemplate = (integration) => `import { BaseIntegration, IntegrationType, IntegrationStatus, IntegrationConfig } from './base';

export interface ${toPascalCase(integration.id)}ExpenseData {
  expense_id: string;
  category: string;
  amount: number;
  currency: string;
  date: string;
}

export class ${toPascalCase(integration.id)}Integration extends BaseIntegration {
  protected baseUrl = '${integration.baseUrl}';
  
  constructor(config: IntegrationConfig) {
    super({
      ...config,
      type: IntegrationType.ERP,
      provider: '${integration.name}',
      requiredCredentials: ${getCredentials(integration.auth)}
    });
  }

  async authenticate(): Promise<boolean> {
    try {
      this.setStatus(IntegrationStatus.AUTHENTICATING);
      
      ${getAuthCode(integration.auth)}
      
      this.setStatus(IntegrationStatus.CONNECTED);
      return true;
      
    } catch (error) {
      this.setStatus(IntegrationStatus.ERROR, \`Authentication failed: \${error.message}\`);
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

      const response = await fetch(\`\${this.baseUrl}/expenses\`, {
        headers: {
          ${getAuthHeader(integration.auth)},
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(\`Failed to fetch data: \${response.statusText}\`);
      }

      const data = await response.json();
      this.rawData = {
        expenses: data.expenses || data,
        timestamp: new Date().toISOString()
      };

      return this.rawData.expenses;
      
    } catch (error) {
      this.setStatus(IntegrationStatus.ERROR, \`Data fetch failed: \${error.message}\`);
      throw error;
    }
  }

  async calculateEmissions(): Promise<any> {
    if (!this.rawData?.expenses) {
      throw new Error('No data available for emission calculations');
    }

    const expenses = this.rawData.expenses;
    let energyExpenses = 0;
    let travelExpenses = 0;

    expenses.forEach(expense => {
      if (expense.category === 'energy' || expense.category === 'utilities') {
        energyExpenses += expense.amount || 0;
      }
      if (expense.category === 'travel' || expense.category === 'transport') {
        travelExpenses += expense.amount || 0;
      }
    });

    // Estimate emissions from expense amounts (rough calculation)
    const energyEmissions = energyExpenses * 0.5; // kg CO2e per £
    const travelEmissions = travelExpenses * 0.3; // kg CO2e per £
    const totalEmissions = energyEmissions + travelEmissions;

    this.emissionsData = {
      total_co2e_kg: Math.round(totalEmissions * 100) / 100,
      breakdown: {
        energy: Math.round(energyEmissions * 100) / 100,
        travel: Math.round(travelEmissions * 100) / 100
      },
      expense_analysis: {
        energy_expenses: energyExpenses,
        travel_expenses: travelExpenses
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
    ${getAuthCheck(integration.auth)}
  }
}
`;

// Transport template
const transportTemplate = (integration) => `import { BaseIntegration, IntegrationType, IntegrationStatus, IntegrationConfig } from './base';

export interface ${toPascalCase(integration.id)}VehicleData {
  vehicle_id: string;
  mileage: number;
  fuel_consumption: number;
  vehicle_type: string;
}

export class ${toPascalCase(integration.id)}Integration extends BaseIntegration {
  protected baseUrl = '${integration.baseUrl}';
  
  constructor(config: IntegrationConfig) {
    super({
      ...config,
      type: IntegrationType.TRANSPORT,
      provider: '${integration.name}',
      requiredCredentials: ${getCredentials(integration.auth)}
    });
  }

  async authenticate(): Promise<boolean> {
    try {
      this.setStatus(IntegrationStatus.AUTHENTICATING);
      
      ${getAuthCode(integration.auth)}
      
      this.setStatus(IntegrationStatus.CONNECTED);
      return true;
      
    } catch (error) {
      this.setStatus(IntegrationStatus.ERROR, \`Authentication failed: \${error.message}\`);
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

      const response = await fetch(\`\${this.baseUrl}/vehicles\`, {
        headers: {
          ${getAuthHeader(integration.auth)},
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(\`Failed to fetch data: \${response.statusText}\`);
      }

      const data = await response.json();
      this.rawData = {
        vehicles: data.vehicles || data,
        timestamp: new Date().toISOString()
      };

      return this.rawData.vehicles;
      
    } catch (error) {
      this.setStatus(IntegrationStatus.ERROR, \`Data fetch failed: \${error.message}\`);
      throw error;
    }
  }

  async calculateEmissions(): Promise<any> {
    if (!this.rawData?.vehicles) {
      throw new Error('No data available for emission calculations');
    }

    const vehicles = this.rawData.vehicles;
    let totalMileage = 0;
    let totalFuelConsumption = 0;

    vehicles.forEach(vehicle => {
      totalMileage += vehicle.mileage || 0;
      totalFuelConsumption += vehicle.fuel_consumption || 0;
    });

    // Transport emission factors
    const fuelEmissions = totalFuelConsumption * 2.687; // kg CO2e per litre diesel
    const mileageEmissions = totalMileage * 0.21; // kg CO2e per km

    this.emissionsData = {
      total_co2e_kg: Math.round(fuelEmissions * 100) / 100,
      transport: {
        total_mileage: totalMileage,
        fuel_consumption: totalFuelConsumption,
        emissions_kg_co2e: Math.round(fuelEmissions * 100) / 100
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
    ${getAuthCheck(integration.auth)}
  }
}
`;

// Helper functions
function toPascalCase(str) {
  return str.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
}

function getCredentials(authType) {
  switch (authType) {
    case 'oauth':
      return "['client_id', 'client_secret']";
    case 'api-key':
      return "['api_key']";
    case 'service-account':
      return "['service_account_key']";
    case 'access-key':
      return "['access_key_id', 'secret_access_key']";
    default:
      return "['api_key']";
  }
}

function getAuthCode(authType) {
  switch (authType) {
    case 'oauth':
      return `const tokenResponse = await fetch(\`\${this.baseUrl}/oauth/token\`, {
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
        throw new Error(\`OAuth failed: \${tokenResponse.statusText}\`);
      }
      
      const tokenData = await tokenResponse.json();
      this.credentials.access_token = tokenData.access_token;
      this.credentials.expires_at = Date.now() + (tokenData.expires_in * 1000);`;

    case 'api-key':
      return `// API key authentication - no additional setup required
      if (!this.credentials.api_key) {
        throw new Error('API key required');
      }`;

    case 'service-account':
      return `// Service account authentication
      if (!this.credentials.service_account_key) {
        throw new Error('Service account key required');
      }
      // Additional service account setup would go here`;

    case 'access-key':
      return `// Access key authentication
      if (!this.credentials.access_key_id || !this.credentials.secret_access_key) {
        throw new Error('Access key credentials required');
      }`;

    default:
      return `// Default API key authentication
      if (!this.credentials.api_key) {
        throw new Error('API key required');
      }`;
  }
}

function getAuthHeader(authType) {
  switch (authType) {
    case 'oauth':
      return "'Authorization': `Bearer ${this.credentials.access_token}`";
    case 'api-key':
      return "'Authorization': `Bearer ${this.credentials.api_key}`";
    case 'service-account':
      return "'Authorization': `Bearer ${this.credentials.access_token}`";
    case 'access-key':
      return "'Authorization': `AWS4-HMAC-SHA256 ${this.credentials.access_key_id}`";
    default:
      return "'Authorization': `Bearer ${this.credentials.api_key}`";
  }
}

function getAuthCheck(authType) {
  switch (authType) {
    case 'oauth':
      return `return !!(
        this.credentials.access_token &&
        this.credentials.expires_at &&
        Date.now() < this.credentials.expires_at
      );`;
    default:
      return `return !!(this.credentials.api_key || this.credentials.access_token);`;
  }
}

// Generate all integrations
function generateAllIntegrations() {
  const integrationDir = path.join(__dirname, '..', 'packages', 'sdk', 'src', 'integrations');
  
  // Ensure directory exists
  if (!fs.existsSync(integrationDir)) {
    fs.mkdirSync(integrationDir, { recursive: true });
  }

  let generatedCount = 0;

  // Generate utilities
  integrations.utilities.forEach(integration => {
    const fileName = `${integration.id}.ts`;
    const filePath = path.join(integrationDir, fileName);
    const content = utilityTemplate(integration);
    fs.writeFileSync(filePath, content);
    console.log(`✅ Generated utility integration: ${fileName}`);
    generatedCount++;
  });

  // Generate cloud
  integrations.cloud.forEach(integration => {
    const fileName = `${integration.id}.ts`;
    const filePath = path.join(integrationDir, fileName);
    const content = cloudTemplate(integration);
    fs.writeFileSync(filePath, content);
    console.log(`✅ Generated cloud integration: ${fileName}`);
    generatedCount++;
  });

  // Generate ERP
  integrations.erp.forEach(integration => {
    const fileName = `${integration.id}.ts`;
    const filePath = path.join(integrationDir, fileName);
    const content = erpTemplate(integration);
    fs.writeFileSync(filePath, content);
    console.log(`✅ Generated ERP integration: ${fileName}`);
    generatedCount++;
  });

  // Generate transport
  integrations.transport.forEach(integration => {
    const fileName = `${integration.id}.ts`;
    const filePath = path.join(integrationDir, fileName);
    const content = transportTemplate(integration);
    fs.writeFileSync(filePath, content);
    console.log(`✅ Generated transport integration: ${fileName}`);
    generatedCount++;
  });

  console.log(`\n🎉 Generated ${generatedCount} integration classes!`);
  console.log(`📁 Location: ${integrationDir}`);
}

// Run the generator
if (require.main === module) {
  generateAllIntegrations();
}

module.exports = { generateAllIntegrations };