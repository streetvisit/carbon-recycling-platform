/**
 * E.ON Next Integration (includes legacy npower customers)
 * Handles OAuth authentication and data fetching from E.ON Business API
 * Covers both E.ON Next and legacy npower accounts after merger
 */

import { BaseIntegration } from './base';
import { IntegrationCredentials, EmissionsData } from '../index';

export interface EonNextCredentials extends IntegrationCredentials {
  clientId: string;
  clientSecret: string;
  accountNumber?: string;
  legacy_npower?: boolean; // Flag for legacy npower accounts
}

export interface EonNextMeterReading {
  meter_id: string;
  meter_serial_number: string;
  reading_date: string;
  electricity_kwh: number;
  gas_kwh: number;
  cost_gbp: number;
  tariff_type: string;
  supply_type: 'electricity' | 'gas' | 'dual-fuel';
  meter_type: 'smart' | 'traditional';
  time_of_use_rate?: string;
}

export interface EonNextAccount {
  account_number: string;
  business_name: string;
  site_address: string;
  contract_type: 'fixed' | 'variable' | 'green';
  supplier_brand: 'eon-next' | 'npower'; // Legacy brand identification
  meters: {
    electricity: {
      mpan: string;
      serial_number: string;
      meter_type: string;
    }[];
    gas: {
      mprn: string;
      serial_number: string;
      meter_type: string;
    }[];
  };
}

export interface EonSupplyMix {
  fuel_mix: {
    renewable: number;
    wind: number;
    solar: number;
    gas: number;
    nuclear: number;
    coal: number;
    other: number;
  };
  carbon_intensity: {
    electricity: number;
    gas: number;
  };
}

export class EonNextIntegration extends BaseIntegration {
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  
  constructor(credentials: EonNextCredentials) {
    super('eon-next', credentials);
  }
  
  async authenticate(): Promise<boolean> {
    try {
      const credentials = this.credentials as EonNextCredentials;
      
      // E.ON Next OAuth 2.0 Client Credentials Flow
      const baseUrl = credentials.legacy_npower 
        ? 'https://api.npower.com/business/v1' // Legacy npower API
        : 'https://api.eon.co.uk/business/v2'; // New E.ON Next API
      
      const tokenResponse = await fetch(`${baseUrl}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString('base64')}`
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          scope: 'business:read energy:read billing:read'
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
      console.error('E.ON Next authentication failed:', error);
      return false;
    }
  }
  
  async validateConnection(): Promise<boolean> {
    if (!this.accessToken || !this.tokenExpiry || this.tokenExpiry < new Date()) {
      const authSuccess = await this.authenticate();
      if (!authSuccess) return false;
    }
    
    try {
      const response = await this.apiCall('/accounts');
      return response.status === 'success';
    } catch (error) {
      console.error('E.ON Next connection validation failed:', error);
      return false;
    }
  }
  
  async fetchData(startDate: string, endDate: string): Promise<EonNextMeterReading[]> {
    if (!await this.validateConnection()) {
      throw new Error('Failed to authenticate with E.ON Next API');
    }
    
    const credentials = this.credentials as EonNextCredentials;
    
    try {
      // Get account details
      let accountNumber = credentials.accountNumber;
      if (!accountNumber) {
        const accounts = await this.apiCall('/accounts');
        accountNumber = accounts.data[0]?.account_number;
        if (!accountNumber) {
          throw new Error('No account number found');
        }
      }
      
      const accountDetails: EonNextAccount = await this.apiCall(`/accounts/${accountNumber}`);
      
      // Fetch consumption data for electricity meters
      const meterReadings: EonNextMeterReading[] = [];
      
      for (const electricityMeter of accountDetails.meters.electricity) {
        const consumptionData = await this.apiCall(
          `/accounts/${accountNumber}/meters/${electricityMeter.serial_number}/consumption`,
          {
            from: startDate,
            to: endDate,
            granularity: 'monthly'
          }
        );
        
        consumptionData.data.forEach((reading: any) => {
          meterReadings.push({
            meter_id: electricityMeter.mpan,
            meter_serial_number: electricityMeter.serial_number,
            reading_date: reading.date,
            electricity_kwh: reading.consumption || 0,
            gas_kwh: 0,
            cost_gbp: reading.cost || 0,
            tariff_type: reading.tariff_name || 'Standard',
            supply_type: 'electricity',
            meter_type: electricityMeter.meter_type as 'smart' | 'traditional',
            time_of_use_rate: reading.time_of_use_rate
          });
        });
      }
      
      // Fetch consumption data for gas meters
      for (const gasMeter of accountDetails.meters.gas) {
        const consumptionData = await this.apiCall(
          `/accounts/${accountNumber}/meters/${gasMeter.serial_number}/consumption`,
          {
            from: startDate,
            to: endDate,
            granularity: 'monthly'
          }
        );
        
        consumptionData.data.forEach((reading: any) => {
          meterReadings.push({
            meter_id: gasMeter.mprn,
            meter_serial_number: gasMeter.serial_number,
            reading_date: reading.date,
            electricity_kwh: 0,
            gas_kwh: reading.consumption || 0,
            cost_gbp: reading.cost || 0,
            tariff_type: reading.tariff_name || 'Standard',
            supply_type: 'gas',
            meter_type: gasMeter.meter_type as 'smart' | 'traditional'
          });
        });
      }
      
      return meterReadings;
    } catch (error) {
      console.error('E.ON Next data fetch failed:', error);
      throw error;
    }
  }
  
  async calculateEmissions(data: EonNextMeterReading[]): Promise<EmissionsData> {
    // Get E.ON Next supply mix data
    const supplyData = await this.getSupplyMix();
    
    let totalElectricity = 0;
    let totalGas = 0;
    let totalCost = 0;
    let smartMeterUsage = 0;
    let timeOfUseUsage = 0;
    
    // Aggregate usage data
    data.forEach(reading => {
      totalElectricity += reading.electricity_kwh;
      totalGas += reading.gas_kwh;
      totalCost += reading.cost_gbp;
      
      // Track smart meter and time-of-use usage
      if (reading.meter_type === 'smart') {
        smartMeterUsage += reading.electricity_kwh + reading.gas_kwh;
      }
      if (reading.time_of_use_rate) {
        timeOfUseUsage += reading.electricity_kwh;
      }
    });
    
    // Calculate emissions using E.ON specific factors
    const scope2Electricity = totalElectricity * supplyData.carbon_intensity.electricity;
    const scope1Gas = totalGas * supplyData.carbon_intensity.gas;
    const scope3Transmission = totalElectricity * 0.025;
    
    return {
      totalCO2e: scope1Gas + scope2Electricity + scope3Transmission,
      scope1: scope1Gas,
      scope2: scope2Electricity,
      scope3: scope3Transmission,
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
      eonSpecific: {
        renewable_percentage: supplyData.fuel_mix.renewable,
        smart_meter_usage_kwh: smartMeterUsage,
        time_of_use_usage_kwh: timeOfUseUsage,
        smart_meter_percentage: totalElectricity > 0 ? (smartMeterUsage / (totalElectricity + totalGas)) * 100 : 0,
        legacy_npower_account: (this.credentials as EonNextCredentials).legacy_npower || false,
        fuel_mix: supplyData.fuel_mix
      },
      rawData: data
    };
  }
  
  async getEmissions(options: { startDate: string; endDate: string }): Promise<EmissionsData> {
    const data = await this.fetchData(options.startDate, options.endDate);
    return this.calculateEmissions(data);
  }
  
  private async getSupplyMix(): Promise<EonSupplyMix> {
    try {
      const response = await this.apiCall('/supply-mix');
      if (response.data) {
        return response.data;
      }
    } catch (error) {
      console.warn('Using default E.ON supply data:', error.message);
    }
    
    // Default E.ON fuel mix
    return {
      fuel_mix: {
        renewable: 35.4, // E.ON's renewable percentage
        wind: 22.8,
        solar: 8.2,
        gas: 42.1,
        nuclear: 18.3,
        coal: 2.8,
        other: 1.4
      },
      carbon_intensity: {
        electricity: 0.178, // E.ON specific factor
        gas: 0.184 // Standard UK gas factor
      }
    };
  }
  
  private async apiCall(endpoint: string, params?: any): Promise<any> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }
    
    const credentials = this.credentials as EonNextCredentials;
    const baseUrl = credentials.legacy_npower 
      ? 'https://api.npower.com/business/v1'
      : 'https://api.eon.co.uk/business/v2';
    
    let url = `${baseUrl}${endpoint}`;
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
      throw new Error(`E.ON Next API error: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  }
  
  async startSync(): Promise<void> {
    console.log('Starting E.ON Next sync...');
    // Implementation for automated sync scheduling
  }
}
