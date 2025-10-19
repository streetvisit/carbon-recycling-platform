import { BaseIntegration, IntegrationType, IntegrationStatus, IntegrationConfig } from './base';
import { IntegrationCredentials, EmissionsData } from '../index';

export interface ScottishPowerCredentials extends IntegrationCredentials {
  clientId: string;
  clientSecret: string;
  accountNumber?: string;
}

export interface ScottishPowerMeterReading {
  meter_id: string;
  meter_serial_number: string;
  reading_date: string;
  electricity_kwh: number;
  gas_kwh?: number;
  cost_gbp: number;
  tariff_name: string;
  rate_type: 'fixed' | 'variable' | 'green';
  supply_type: 'electricity' | 'gas' | 'dual-fuel';
}

export interface ScottishPowerAccount {
  account_number: string;
  business_name: string;
  site_addresses: string[];
  contract_type: 'business_fixed' | 'business_green' | 'industrial';
  meters: {
    electricity: string[];
    gas: string[];
  };
  green_tariff_percentage: number;
}

export interface ScottishPowerSupplyData {
  fuel_mix: {
    renewable: number; // ScottishPower's focus on renewables
    wind: number;
    hydro: number;
    solar: number;
    gas: number;
    nuclear: number;
    other: number;
  };
  carbon_intensity: {
    electricity: number; // Lower for green tariffs
    gas: number;
  };
  renewable_certificates: {
    rego_certificates: number;
    green_gas_certificates: number;
  };
}

export class ScottishPowerIntegration extends BaseIntegration {
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  
  constructor(credentials: ScottishPowerCredentials) {
    super('scottish-power', credentials);
  }
  
  async authenticate(): Promise<boolean> {
    try {
      const credentials = this.credentials as ScottishPowerCredentials;
      
      // Scottish Power OAuth 2.0 Client Credentials Flow
      const tokenResponse = await fetch('https://api.scottishpower.co.uk/business/v2/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString('base64')}`
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          scope: 'business:read energy:read green:read'
        })
      });
      
      if (!tokenResponse.ok) {
        throw new Error(`Authentication failed: ${tokenResponse.statusText}`);
      }
      
      const tokenData = await tokenResponse.json();
      this.accessToken = tokenData.access_token;
      this.tokenExpiry = new Date(Date.now() + tokenData.expires_in * 1000);
      
      return true;
    } catch (error) {
      console.error('Scottish Power authentication failed:', error);
      return false;
    }
  }
  
  async validateConnection(): Promise<boolean> {
    if (!this.accessToken || !this.tokenExpiry || this.tokenExpiry < new Date()) {
      const authSuccess = await this.authenticate();
      if (!authSuccess) return false;
    }
    
    try {
      const response = await this.apiCall('/business/v2/accounts');
      return response.status === 'success';
    } catch (error) {
      console.error('Scottish Power connection validation failed:', error);
      return false;
    }
  }
  
  async fetchData(startDate: string, endDate: string): Promise<ScottishPowerMeterReading[]> {
    if (!await this.validateConnection()) {
      throw new Error('Failed to authenticate with Scottish Power API');
    }
    
    const credentials = this.credentials as ScottishPowerCredentials;
    
    try {
      // Get account details if account number not provided
      let accountNumber = credentials.accountNumber;
      if (!accountNumber) {
        const accounts = await this.apiCall('/business/v2/accounts');
        accountNumber = accounts.data[0]?.account_number;
        if (!accountNumber) {
          throw new Error('No account number found');
        }
      }
      
      // Get account details for green tariff info
      const accountDetails = await this.apiCall(`/business/v2/accounts/${accountNumber}`);
      
      // Fetch meter readings
      const meterReadings = await this.apiCall(
        `/business/v2/accounts/${accountNumber}/consumption`,
        {
          from_date: startDate,
          to_date: endDate,
          granularity: 'monthly'
        }
      );
      
      return meterReadings.data.map((reading: any) => ({
        meter_id: reading.meter_id,
        meter_serial_number: reading.meter_serial,
        reading_date: reading.period_start,
        electricity_kwh: reading.electricity_consumption || 0,
        gas_kwh: reading.gas_consumption || 0,
        cost_gbp: reading.total_charges || 0,
        tariff_name: reading.tariff_name || 'Business Standard',
        rate_type: reading.rate_type || 'variable',
        supply_type: reading.fuel_type || 'dual-fuel'
      }));
    } catch (error) {
      console.error('Scottish Power data fetch failed:', error);
      throw error;
    }
  }
  
  async calculateEmissions(data: ScottishPowerMeterReading[]): Promise<EmissionsData> {
    // Get Scottish Power's current fuel mix and green credentials
    const supplyData = await this.getSupplyData();
    
    let totalElectricity = 0;
    let totalGas = 0;
    let totalCost = 0;
    let greenTariffUsage = 0;
    
    // Aggregate usage data
    data.forEach(reading => {
      totalElectricity += reading.electricity_kwh;
      totalGas += reading.gas_kwh;
      totalCost += reading.cost_gbp;
      
      // Track green tariff usage
      if (reading.rate_type === 'green') {
        greenTariffUsage += reading.electricity_kwh;
      }
    });
    
    // Calculate emissions using Scottish Power-specific factors
    const electricityEmissionFactor = greenTariffUsage > 0 
      ? supplyData.carbon_intensity.electricity * (1 - (greenTariffUsage / totalElectricity) * 0.8) // 80% reduction for green tariff
      : supplyData.carbon_intensity.electricity;
    
    const scope2Electricity = totalElectricity * electricityEmissionFactor;
    const scope1Gas = totalGas * supplyData.carbon_intensity.gas;
    const scope3Transmission = totalElectricity * 0.025; // Transmission losses
    
    return {
      totalCO2e: scope1Gas + scope2Electricity + scope3Transmission,
      scope1: scope1Gas, // Direct combustion of gas
      scope2: scope2Electricity, // Purchased electricity
      scope3: scope3Transmission, // Transmission losses
      breakdown: {
        electricity: scope2Electricity,
        gas: scope1Gas,
        transport: 0,
        travel: 0,
        waste: 0
      },
      period: {
        startDate: data[0]?.reading_date || '',
        endDate: data[data.length - 1]?.reading_date || ''
      },
      scottishPowerSpecific: {
        renewable_percentage: supplyData.fuel_mix.renewable,
        green_tariff_savings: greenTariffUsage * 0.193 * 0.8, // CO2e saved vs grid average
        wind_generation_kwh: totalElectricity * (supplyData.fuel_mix.wind / 100),
        hydro_generation_kwh: totalElectricity * (supplyData.fuel_mix.hydro / 100),
        rego_certificates: supplyData.renewable_certificates.rego_certificates
      },
      rawData: data
    };
  }
  
  async getEmissions(options: { startDate: string; endDate: string }): Promise<EmissionsData> {
    const data = await this.fetchData(options.startDate, options.endDate);
    return this.calculateEmissions(data);
  }
  
  private async getSupplyData(): Promise<ScottishPowerSupplyData> {
    try {
      const response = await this.apiCall('/business/v2/supply-mix');
      if (response.data) {
        return response.data;
      }
    } catch (error) {
      console.warn('Using default Scottish Power supply data:', error.message);
    }
    
    // Default Scottish Power fuel mix (heavy renewable focus)
    return {
      fuel_mix: {
        renewable: 72.3, // Scottish Power's high renewable percentage
        wind: 45.2,
        hydro: 18.1,
        solar: 9.0,
        gas: 22.4,
        nuclear: 3.8,
        other: 1.5
      },
      carbon_intensity: {
        electricity: 0.142, // Lower due to high renewable mix
        gas: 0.184 // Standard UK gas factor
      },
      renewable_certificates: {
        rego_certificates: 95.2, // High REGO certification
        green_gas_certificates: 12.5
      }
    };
  }
  
  private async apiCall(endpoint: string, params?: any): Promise<any> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }
    
    let url = `https://api.scottishpower.co.uk${endpoint}`;
    if (params) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Scottish Power API error: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  }
  
  async startSync(): Promise<void> {
    console.log('Starting Scottish Power sync...');
    // Implementation for automated sync scheduling
  }
}
