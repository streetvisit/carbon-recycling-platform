/**
 * EDF Energy Integration
 * Handles OAuth authentication and data fetching from EDF Business API
 * Specializes in nuclear-powered low-carbon electricity
 */

import { BaseIntegration } from './base';
import { IntegrationCredentials, EmissionsData } from '../index';

export interface EdfEnergyCredentials extends IntegrationCredentials {
  clientId: string;
  clientSecret: string;
  accountNumber?: string;
}

export interface EdfEnergyMeterReading {
  meter_id: string;
  meter_serial_number: string;
  reading_date: string;
  electricity_kwh: number;
  gas_kwh: number;
  cost_gbp: number;
  tariff_name: string;
  tariff_type: 'nuclear_green' | 'blue_plus' | 'fixed_price' | 'variable';
  supply_type: 'electricity' | 'gas' | 'dual-fuel';
  nuclear_percentage: number;
}

export interface EdfEnergyAccount {
  account_number: string;
  business_name: string;
  site_addresses: string[];
  contract_type: 'nuclear_green' | 'blue_plus' | 'fixed_price' | 'industrial_supply';
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
  nuclear_supply_percentage: number;
}

export interface EdfEnergySupplyData {
  fuel_mix: {
    nuclear: number; // EDF's high nuclear percentage
    renewable: number;
    wind: number;
    solar: number;
    gas: number;
    coal: number;
    other: number;
  };
  carbon_intensity: {
    electricity: number; // Lower due to nuclear focus
    gas: number;
  };
  nuclear_generation: {
    fleet_capacity_mw: number;
    current_output_mw: number;
    availability_factor: number;
  };
}

export class EdfEnergyIntegration extends BaseIntegration {
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  
  constructor(credentials: EdfEnergyCredentials) {
    super('edf-energy', credentials);
  }

  async authenticate(): Promise<boolean> {
    try {
      const credentials = this.credentials as EdfEnergyCredentials;
      
      // EDF Energy OAuth 2.0 Client Credentials Flow
      const tokenResponse = await fetch('https://api.edfenergy.com/business/v2/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString('base64')}`
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          scope: 'business:read nuclear:read generation:read'
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
      console.error('EDF Energy authentication failed:', error);
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
      console.error('EDF Energy connection validation failed:', error);
      return false;
    }
  }
  
  async fetchData(startDate: string, endDate: string): Promise<EdfEnergyMeterReading[]> {
    if (!await this.validateConnection()) {
      throw new Error('Failed to authenticate with EDF Energy API');
    }
    
    const credentials = this.credentials as EdfEnergyCredentials;
    
    try {
      // Get account details
      let accountNumber = credentials.accountNumber;
      if (!accountNumber) {
        const accounts = await this.apiCall('/business/v2/accounts');
        accountNumber = accounts.data[0]?.account_number;
        if (!accountNumber) {
          throw new Error('No account number found');
        }
      }
      
      const accountDetails: EdfEnergyAccount = await this.apiCall(`/business/v2/accounts/${accountNumber}`);
      
      // Get nuclear generation data
      const nuclearData = await this.getNuclearGenerationData();
      
      // Fetch consumption data for all meters
      const meterReadings: EdfEnergyMeterReading[] = [];
      
      // Process electricity meters
      for (const electricityMeter of accountDetails.meters.electricity) {
        const consumptionData = await this.apiCall(
          `/business/v2/accounts/${accountNumber}/meters/${electricityMeter.serial_number}/consumption`,
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
            tariff_name: reading.tariff_name || 'Nuclear Green',
            tariff_type: this.determineTariffType(electricityMeter.tariff_code),
            supply_type: 'electricity',
            nuclear_percentage: accountDetails.nuclear_supply_percentage || 68.2
          });
        });
      }
      
      // Process gas meters
      for (const gasMeter of accountDetails.meters.gas) {
        const consumptionData = await this.apiCall(
          `/business/v2/accounts/${accountNumber}/meters/${gasMeter.serial_number}/consumption`,
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
            tariff_type: 'variable',
            supply_type: 'gas',
            nuclear_percentage: 0
          });
        });
      }
      
      return meterReadings;
    } catch (error) {
      console.error('EDF Energy data fetch failed:', error);
      throw error;
    }
  }
  
  async calculateEmissions(data: EdfEnergyMeterReading[]): Promise<EmissionsData> {
    // Get EDF Energy supply mix data
    const supplyData = await this.getSupplyData();
    
    let totalElectricity = 0;
    let totalGas = 0;
    let totalCost = 0;
    let nuclearUsage = 0;
    
    // Aggregate usage data
    data.forEach(reading => {
      totalElectricity += reading.electricity_kwh;
      totalGas += reading.gas_kwh;
      totalCost += reading.cost_gbp;
      
      // Track nuclear-powered usage
      if (reading.supply_type === 'electricity') {
        nuclearUsage += reading.electricity_kwh * (reading.nuclear_percentage / 100);
      }
    });
    
    // Calculate emissions using EDF-specific factors
    const scope2Electricity = totalElectricity * supplyData.carbon_intensity.electricity;
    const scope1Gas = totalGas * supplyData.carbon_intensity.gas;
    const scope3Transmission = totalElectricity * 0.025;
    
    // Calculate nuclear generation benefits
    const gridAverageEmissions = totalElectricity * 0.193;
    const carbonSavings = gridAverageEmissions - scope2Electricity;
    
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
      edfSpecific: {
        nuclear_percentage: supplyData.fuel_mix.nuclear,
        nuclear_usage_kwh: nuclearUsage,
        nuclear_generation: supplyData.nuclear_generation,
        carbon_savings_kg_co2e: carbonSavings,
        low_carbon_electricity_percentage: supplyData.fuel_mix.nuclear + supplyData.fuel_mix.renewable,
        fuel_mix: supplyData.fuel_mix,
        fleet_capacity_mw: supplyData.nuclear_generation?.fleet_capacity_mw || 0,
        current_nuclear_output_mw: supplyData.nuclear_generation?.current_output_mw || 0
      },
      rawData: data
    };
  }
  
  async getEmissions(options: { startDate: string; endDate: string }): Promise<EmissionsData> {
    const data = await this.fetchData(options.startDate, options.endDate);
    return this.calculateEmissions(data);
  }
  
  private async getSupplyData(): Promise<EdfEnergySupplyData> {
    try {
      const response = await this.apiCall('/business/v2/supply-data');
      if (response.data) {
        return response.data;
      }
    } catch (error) {
      console.warn('Using default EDF supply data:', error.message);
    }
    
    // Default EDF fuel mix (nuclear-focused)
    return {
      fuel_mix: {
        nuclear: 68.2, // EDF's high nuclear percentage
        renewable: 18.5,
        wind: 12.3,
        solar: 6.2,
        gas: 11.8,
        coal: 0.8,
        other: 0.7
      },
      carbon_intensity: {
        electricity: 0.156, // Lower due to nuclear focus
        gas: 0.184 // Standard UK gas factor
      },
      nuclear_generation: {
        fleet_capacity_mw: 8918, // EDF UK nuclear capacity
        current_output_mw: 6534, // Typical output
        availability_factor: 73.2
      }
    };
  }
  
  private determineTariffType(tariffCode: string): 'nuclear_green' | 'blue_plus' | 'fixed_price' | 'variable' {
    const code = tariffCode.toLowerCase();
    if (code.includes('nuclear') || code.includes('green')) {
      return 'nuclear_green';
    }
    if (code.includes('blue') || code.includes('plus')) {
      return 'blue_plus';
    }
    if (code.includes('fixed')) {
      return 'fixed_price';
    }
    return 'variable';
  }
  
  private async apiCall(endpoint: string, params?: any): Promise<any> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }
    
    let url = `https://api.edfenergy.com${endpoint}`;
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
      throw new Error(`EDF Energy API error: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  }
  
  // EDF Energy specific methods
  async getNuclearGenerationData(): Promise<any> {
    try {
      const response = await this.apiCall('/business/v2/generation/nuclear');
      if (response.data) {
        return response.data;
      }
      return null;
    } catch (error) {
      console.warn('Nuclear generation data not available:', error.message);
      return null;
    }
  }
  
  async getTariffDetails(): Promise<any> {
    try {
      const credentials = this.credentials as EdfEnergyCredentials;
      const response = await this.apiCall(`/business/v2/tariffs/${credentials.accountNumber}`);
      if (response.data) {
        return response.data;
      }
      return null;
    } catch (error) {
      console.warn('Tariff details not available:', error.message);
      return null;
    }
  }
  
  async startSync(): Promise<void> {
    console.log('Starting EDF Energy sync...');
    // Implementation for automated sync scheduling
  }
  
  async stopSync(): Promise<void> {
    console.log('Stopping EDF Energy sync...');
  }
}
