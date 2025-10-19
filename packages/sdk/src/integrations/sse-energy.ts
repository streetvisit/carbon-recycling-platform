/**
 * SSE Energy Services Integration
 * Handles OAuth authentication and data fetching from SSE Business API
 * Covers SSE Energy Services (formerly Scottish and Southern Energy)
 */

import { BaseIntegration } from './base';
import { IntegrationCredentials, EmissionsData } from '../index';

export interface SseEnergyCredentials extends IntegrationCredentials {
  clientId: string;
  clientSecret: string;
  accountNumber?: string;
}

export interface SseEnergyMeterReading {
  meter_id: string;
  meter_serial_number: string;
  reading_date: string;
  electricity_kwh: number;
  gas_kwh: number;
  cost_gbp: number;
  tariff_name: string;
  rate_type: 'fixed' | 'variable' | 'renewable';
  supply_type: 'electricity' | 'gas' | 'dual-fuel';
  is_renewable: boolean;
}

export interface SseEnergyAccount {
  account_number: string;
  business_name: string;
  site_addresses: string[];
  contract_type: 'business_fixed' | 'business_renewable' | 'industrial';
  meters: {
    electricity: {
      mpan: string;
      serial_number: string;
      meter_type: string;
      tariff_code: string;
    }[];
    gas: {
      mprn: string;
      serial_number: string;
      meter_type: string;
      tariff_code: string;
    }[];
  };
  renewable_percentage: number;
}

export interface SseEnergySupplyData {
  fuel_mix: {
    renewable: number; // SSE's renewable energy percentage
    wind: number;
    hydro: number;
    solar: number;
    gas: number;
    nuclear: number;
    other: number;
  };
  carbon_intensity: {
    electricity: number;
    gas: number;
  };
  renewable_certificates: {
    rego_certificates: number;
    green_gas_certificates: number;
  };
}

export class SseEnergyIntegration extends BaseIntegration {
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  
  constructor(credentials: SseEnergyCredentials) {
    super('sse-energy', credentials);
  }

  async authenticate(): Promise<boolean> {
    try {
      const credentials = this.credentials as SseEnergyCredentials;
      
      // SSE Energy OAuth 2.0 Client Credentials Flow
      const tokenResponse = await fetch('https://api.sse.co.uk/business/v3/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString('base64')}`
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          scope: 'business:read energy:read renewable:read'
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
      console.error('SSE Energy authentication failed:', error);
      return false;
    }
  }

  async validateConnection(): Promise<boolean> {
    if (!this.accessToken || !this.tokenExpiry || this.tokenExpiry < new Date()) {
      const authSuccess = await this.authenticate();
      if (!authSuccess) return false;
    }
    
    try {
      const response = await this.apiCall('/business/v3/accounts');
      return response.status === 'success';
    } catch (error) {
      console.error('SSE Energy connection validation failed:', error);
      return false;
    }
  }
  
  async fetchData(startDate: string, endDate: string): Promise<SseEnergyMeterReading[]> {
    if (!await this.validateConnection()) {
      throw new Error('Failed to authenticate with SSE Energy API');
    }
    
    const credentials = this.credentials as SseEnergyCredentials;
    
    try {
      // Get account details
      let accountNumber = credentials.accountNumber;
      if (!accountNumber) {
        const accounts = await this.apiCall('/business/v3/accounts');
        accountNumber = accounts.data[0]?.account_number;
        if (!accountNumber) {
          throw new Error('No account number found');
        }
      }
      
      const accountDetails: SseEnergyAccount = await this.apiCall(`/business/v3/accounts/${accountNumber}`);
      
      // Fetch consumption data for all meters
      const meterReadings: SseEnergyMeterReading[] = [];
      
      // Process electricity meters
      for (const electricityMeter of accountDetails.meters.electricity) {
        const consumptionData = await this.apiCall(
          `/business/v3/accounts/${accountNumber}/meters/${electricityMeter.serial_number}/consumption`,
          {
            from_date: startDate,
            to_date: endDate,
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
            tariff_name: reading.tariff_name || 'Business Standard',
            rate_type: this.determineRateType(electricityMeter.tariff_code),
            supply_type: 'electricity',
            is_renewable: this.isRenewableTariff(electricityMeter.tariff_code)
          });
        });
      }
      
      // Process gas meters
      for (const gasMeter of accountDetails.meters.gas) {
        const consumptionData = await this.apiCall(
          `/business/v3/accounts/${accountNumber}/meters/${gasMeter.serial_number}/consumption`,
          {
            from_date: startDate,
            to_date: endDate,
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
            tariff_name: reading.tariff_name || 'Business Standard',
            rate_type: this.determineRateType(gasMeter.tariff_code),
            supply_type: 'gas',
            is_renewable: false // SSE gas is not renewable currently
          });
        });
      }
      
      return meterReadings;
    } catch (error) {
      console.error('SSE Energy data fetch failed:', error);
      throw error;
    }
  }
  
  async calculateEmissions(data: SseEnergyMeterReading[]): Promise<EmissionsData> {
    // Get SSE Energy supply mix data
    const supplyData = await this.getSupplyData();
    
    let totalElectricity = 0;
    let totalGas = 0;
    let totalCost = 0;
    let renewableUsage = 0;
    
    // Aggregate usage data
    data.forEach(reading => {
      totalElectricity += reading.electricity_kwh;
      totalGas += reading.gas_kwh;
      totalCost += reading.cost_gbp;
      
      // Track renewable usage
      if (reading.is_renewable && reading.electricity_kwh > 0) {
        renewableUsage += reading.electricity_kwh;
      }
    });
    
    // Calculate emissions using SSE-specific factors
    const renewablePercentage = renewableUsage / totalElectricity;
    const electricityEmissionFactor = supplyData.carbon_intensity.electricity * (1 - renewablePercentage * 0.9); // 90% reduction for renewable
    
    const scope2Electricity = totalElectricity * electricityEmissionFactor;
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
      sseSpecific: {
        renewable_percentage: supplyData.fuel_mix.renewable,
        renewable_usage_kwh: renewableUsage,
        renewable_savings_kg_co2e: renewableUsage * 0.193 * 0.9, // CO2e saved vs grid average
        wind_generation_kwh: totalElectricity * (supplyData.fuel_mix.wind / 100),
        hydro_generation_kwh: totalElectricity * (supplyData.fuel_mix.hydro / 100),
        rego_certificates: supplyData.renewable_certificates.rego_certificates,
        fuel_mix: supplyData.fuel_mix
      },
      rawData: data
    };
  }
  
  async getEmissions(options: { startDate: string; endDate: string }): Promise<EmissionsData> {
    const data = await this.fetchData(options.startDate, options.endDate);
    return this.calculateEmissions(data);
  }
  
  private async getSupplyData(): Promise<SseEnergySupplyData> {
    try {
      const response = await this.apiCall('/business/v3/supply-mix');
      if (response.data) {
        return response.data;
      }
    } catch (error) {
      console.warn('Using default SSE supply data:', error.message);
    }
    
    // Default SSE fuel mix (strong renewable focus)
    return {
      fuel_mix: {
        renewable: 58.7, // SSE's renewable percentage
        wind: 38.9,
        hydro: 15.2,
        solar: 4.6,
        gas: 28.5,
        nuclear: 10.3,
        other: 2.5
      },
      carbon_intensity: {
        electricity: 0.168, // Lower due to high renewable mix
        gas: 0.184 // Standard UK gas factor
      },
      renewable_certificates: {
        rego_certificates: 89.3,
        green_gas_certificates: 8.2
      }
    };
  }
  
  private determineRateType(tariffCode: string): 'fixed' | 'variable' | 'renewable' {
    const code = tariffCode.toLowerCase();
    if (code.includes('renewable') || code.includes('green') || code.includes('eco')) {
      return 'renewable';
    }
    if (code.includes('fixed')) {
      return 'fixed';
    }
    return 'variable';
  }
  
  private isRenewableTariff(tariffCode: string): boolean {
    const code = tariffCode.toLowerCase();
    return code.includes('renewable') || code.includes('green') || code.includes('eco');
  }
  
  private async apiCall(endpoint: string, params?: any): Promise<any> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }
    
    let url = `https://api.sse.co.uk${endpoint}`;
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
      throw new Error(`SSE Energy API error: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  }
  
  async startSync(): Promise<void> {
    console.log('Starting SSE Energy sync...');
    // Implementation for automated sync scheduling
  }
  
  async stopSync(): Promise<void> {
    console.log('Stopping SSE Energy sync...');
  }
}
