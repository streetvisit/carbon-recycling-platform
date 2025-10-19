/**
 * British Gas Integration
 * Handles OAuth authentication and data fetching from British Gas Business API
 */

import { BaseIntegration } from './base';
import { IntegrationCredentials, EmissionsData } from '../index';

export interface BritishGasCredentials extends IntegrationCredentials {
  clientId: string;
  clientSecret: string;
  accountNumber?: string;
}

export interface BritishGasMeterReading {
  meter_id: string;
  reading_date: string;
  electricity_kwh: number;
  gas_kwh: number;
  cost_gbp: number;
  tariff_type: string;
  supply_type: 'electricity' | 'gas' | 'dual-fuel';
}

export class BritishGasIntegration extends BaseIntegration {
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  
  constructor(credentials: BritishGasCredentials) {
    super('british-gas', credentials);
  }
  
  async authenticate(): Promise<boolean> {
    try {
      const credentials = this.credentials as BritishGasCredentials;
      
      // OAuth 2.0 Client Credentials Flow
      const tokenResponse = await fetch('https://api.britishgas.co.uk/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString('base64')}`
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          scope: 'energy:read billing:read'
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
      console.error('British Gas authentication failed:', error);
      return false;
    }
  }
  
  async validateConnection(): Promise<boolean> {
    if (!this.accessToken || !this.tokenExpiry || this.tokenExpiry < new Date()) {
      const authSuccess = await this.authenticate();
      if (!authSuccess) return false;
    }
    
    try {
      // Test API call to validate connection
      const response = await this.apiCall('/business/v1/accounts');
      return response.status === 'success';
    } catch (error) {
      console.error('British Gas connection validation failed:', error);
      return false;
    }
  }
  
  async fetchData(startDate: string, endDate: string): Promise<BritishGasMeterReading[]> {
    if (!await this.validateConnection()) {
      throw new Error('Failed to authenticate with British Gas API');
    }
    
    const credentials = this.credentials as BritishGasCredentials;
    
    try {
      // Get account details if account number not provided
      let accountNumber = credentials.accountNumber;
      if (!accountNumber) {
        const accounts = await this.apiCall('/business/v1/accounts');
        accountNumber = accounts.data[0]?.account_number;
        if (!accountNumber) {
          throw new Error('No account number found');
        }
      }
      
      // Fetch meter readings
      const meterReadings = await this.apiCall(
        `/business/v1/accounts/${accountNumber}/meter-readings`,
        {
          start_date: startDate,
          end_date: endDate,
          interval: 'monthly'
        }
      );
      
      return meterReadings.data.map((reading: any) => ({
        meter_id: reading.meter_id,
        reading_date: reading.reading_date,
        electricity_kwh: reading.electricity_usage || 0,
        gas_kwh: reading.gas_usage || 0,
        cost_gbp: reading.total_cost || 0,
        tariff_type: reading.tariff_type || 'standard',
        supply_type: reading.supply_type || 'dual-fuel'
      }));
    } catch (error) {
      console.error('British Gas data fetch failed:', error);
      throw error;
    }
  }
  
  async calculateEmissions(data: BritishGasMeterReading[]): Promise<EmissionsData> {
    const emissionFactors = {
      electricity: 0.193, // kgCO2e/kWh - UK grid average 2025
      gas: 0.184, // kgCO2e/kWh
      scope3_transmission: 0.025 // kgCO2e/kWh - transmission losses
    };
    
    let totalElectricity = 0;
    let totalGas = 0;
    let totalCost = 0;
    
    // Aggregate usage data
    data.forEach(reading => {
      totalElectricity += reading.electricity_kwh;
      totalGas += reading.gas_kwh;
      totalCost += reading.cost_gbp;
    });
    
    // Calculate emissions
    const scope2Electricity = totalElectricity * emissionFactors.electricity;
    const scope1Gas = totalGas * emissionFactors.gas;
    const scope3Transmission = totalElectricity * emissionFactors.scope3_transmission;
    
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
      rawData: data
    };
  }
  
  async getEmissions(options: { startDate: string; endDate: string }): Promise<EmissionsData> {
    const data = await this.fetchData(options.startDate, options.endDate);
    return this.calculateEmissions(data);
  }
  
  private async apiCall(endpoint: string, params?: any): Promise<any> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }
    
    let url = `https://api.britishgas.co.uk${endpoint}`;
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
      throw new Error(`British Gas API error: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  }
  
  async startSync(): Promise<void> {
    // Implementation for automated sync scheduling
    console.log('Starting British Gas sync...');
  }
  
  async stopSync(): Promise<void> {
    console.log('Stopping British Gas sync...');
  }
}