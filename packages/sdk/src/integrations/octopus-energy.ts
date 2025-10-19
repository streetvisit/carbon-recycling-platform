/**
 * Octopus Energy Integration
 * Handles API key authentication and data fetching from Octopus Energy Business API
 * Known for excellent API documentation and developer-friendly approach
 */

import { BaseIntegration } from './base';
import { IntegrationCredentials, EmissionsData } from '../index';

export interface OctopusEnergyCredentials extends IntegrationCredentials {
  apiKey: string;
  accountNumber?: string;
}

export interface OctopusEnergyMeterReading {
  meter_id: string;
  meter_serial_number: string;
  reading_date: string;
  electricity_kwh: number;
  gas_kwh?: number;
  cost_gbp: number;
  tariff_code: string;
  unit_rate_pence: number;
  standing_charge_pence: number;
  consumption_period: string;
  is_estimate: boolean;
}

export interface OctopusEnergyAccount {
  number: string;
  properties: {
    id: number;
    moved_in_at: string;
    moved_out_at?: string;
    address_line_1: string;
    address_line_2?: string;
    town: string;
    county: string;
    postcode: string;
    electricity_meter_points: OctopusElectricityMeterPoint[];
    gas_meter_points: OctopusGasMeterPoint[];
  }[];
}

export interface OctopusElectricityMeterPoint {
  mpan: string;
  profile_class: number;
  consumption_standard: number;
  meters: {
    serial_number: string;
    registers: {
      identifier: string;
      rate: string;
      is_settlement_register: boolean;
    }[];
  }[];
  agreements: {
    tariff_code: string;
    valid_from: string;
    valid_to?: string;
  }[];
}

export interface OctopusGasMeterPoint {
  mprn: string;
  consumption_standard: number;
  meters: {
    serial_number: string;
  }[];
  agreements: {
    tariff_code: string;
    valid_from: string;
    valid_to?: string;
  }[];
}

export interface OctopusTariffData {
  code: string;
  full_name: string;
  display_name: string;
  description: string;
  is_variable: boolean;
  is_green: boolean;
  is_tracker: boolean;
  is_prepay: boolean;
  is_business: boolean;
  available_from: string;
  available_to?: string;
}

export class OctopusEnergyIntegration extends BaseIntegration {
  
  constructor(credentials: OctopusEnergyCredentials) {
    super('octopus-energy', credentials);
  }
  
  async authenticate(): Promise<boolean> {
    try {
      const credentials = this.credentials as OctopusEnergyCredentials;
      
      // Octopus Energy uses simple API key authentication
      if (!credentials.apiKey) {
        throw new Error('API key required');
      }
      
      // Test API key by making a simple account request
      const testResponse = await fetch('https://api.octopus.energy/v1/accounts/', {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${credentials.apiKey}:`).toString('base64')}`,
          'Content-Type': 'application/json'
        }
      });
      
      return testResponse.ok;
    } catch (error) {
      console.error('Octopus Energy authentication failed:', error);
      return false;
    }
  }
  
  async validateConnection(): Promise<boolean> {
    return this.authenticate();
  }
  
  async fetchData(startDate: string, endDate: string): Promise<OctopusEnergyMeterReading[]> {
    if (!await this.validateConnection()) {
      throw new Error('Failed to authenticate with Octopus Energy API');
    }
    
    const credentials = this.credentials as OctopusEnergyCredentials;
    
    try {
      // Get account details if account number not provided
      let accountNumber = credentials.accountNumber;
      if (!accountNumber) {
        const accounts = await this.apiCall('/accounts/');
        accountNumber = accounts.results[0]?.number;
        if (!accountNumber) {
          throw new Error('No account number found');
        }
      }
      
      // Get detailed account information
      const accountDetails: OctopusEnergyAccount = await this.apiCall(`/accounts/${accountNumber}/`);
      
      const meterReadings: OctopusEnergyMeterReading[] = [];
      
      // Process each property in the account
      for (const property of accountDetails.properties) {
        // Process electricity meters
        for (const electricityPoint of property.electricity_meter_points) {
          for (const meter of electricityPoint.meters) {
            const consumption = await this.apiCall(
              `/electricity-meter-points/${electricityPoint.mpan}/meters/${meter.serial_number}/consumption/`,
              {
                period_from: startDate,
                period_to: endDate,
                group_by: 'month'
              }
            );
            
            // Get tariff information
            const currentAgreement = electricityPoint.agreements
              .find(a => !a.valid_to || new Date(a.valid_to) > new Date());
            const tariffCode = currentAgreement?.tariff_code || '';
            
            // Get tariff details for cost calculation
            const tariffDetails = await this.getTariffDetails(tariffCode);
            
            consumption.results.forEach((reading: any) => {
              meterReadings.push({
                meter_id: electricityPoint.mpan,
                meter_serial_number: meter.serial_number,
                reading_date: reading.interval_start,
                electricity_kwh: reading.consumption,
                gas_kwh: 0,
                cost_gbp: this.calculateElectricityCost(reading.consumption, tariffDetails),
                tariff_code: tariffCode,
                unit_rate_pence: tariffDetails?.unit_rate_inc_vat || 0,
                standing_charge_pence: tariffDetails?.standing_charge_inc_vat || 0,
                consumption_period: 'monthly',
                is_estimate: reading.is_estimated || false
              });
            });
          }
        }
        
        // Process gas meters
        for (const gasPoint of property.gas_meter_points) {
          for (const meter of gasPoint.meters) {
            const consumption = await this.apiCall(
              `/gas-meter-points/${gasPoint.mprn}/meters/${meter.serial_number}/consumption/`,
              {
                period_from: startDate,
                period_to: endDate,
                group_by: 'month'
              }
            );
            
            const currentAgreement = gasPoint.agreements
              .find(a => !a.valid_to || new Date(a.valid_to) > new Date());
            const tariffCode = currentAgreement?.tariff_code || '';
            const tariffDetails = await this.getTariffDetails(tariffCode);
            
            consumption.results.forEach((reading: any) => {
              meterReadings.push({
                meter_id: gasPoint.mprn,
                meter_serial_number: meter.serial_number,
                reading_date: reading.interval_start,
                electricity_kwh: 0,
                gas_kwh: reading.consumption,
                cost_gbp: this.calculateGasCost(reading.consumption, tariffDetails),
                tariff_code: tariffCode,
                unit_rate_pence: tariffDetails?.unit_rate_inc_vat || 0,
                standing_charge_pence: tariffDetails?.standing_charge_inc_vat || 0,
                consumption_period: 'monthly',
                is_estimate: reading.is_estimated || false
              });
            });
          }
        }
      }
      
      return meterReadings;
    } catch (error) {
      console.error('Octopus Energy data fetch failed:', error);
      throw error;
    }
  }
  
  async calculateEmissions(data: OctopusEnergyMeterReading[]): Promise<EmissionsData> {
    let totalElectricity = 0;
    let totalGas = 0;
    let totalCost = 0;
    let greenTariffUsage = 0;
    
    // Check for green tariffs and aggregate usage
    data.forEach(reading => {
      totalElectricity += reading.electricity_kwh;
      totalGas += reading.gas_kwh;
      totalCost += reading.cost_gbp;
      
      // Octopus Energy green tariffs (100% renewable electricity)
      if (reading.tariff_code.includes('GREEN') || reading.tariff_code.includes('AGILE')) {
        greenTariffUsage += reading.electricity_kwh;
      }
    });
    
    // Calculate emissions with green tariff benefits
    const electricityEmissionFactor = greenTariffUsage > 0 ? 0.0 : 0.193; // Green = 0 emissions
    const scope2Electricity = (totalElectricity - greenTariffUsage) * 0.193; // Only non-green usage
    const scope1Gas = totalGas * 0.184;
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
      octopusSpecific: {
        green_tariff_usage_kwh: greenTariffUsage,
        renewable_electricity_percentage: greenTariffUsage > 0 ? (greenTariffUsage / totalElectricity) * 100 : 0,
        carbon_savings_kg_co2e: greenTariffUsage * 0.193, // Savings vs grid average
        innovative_tariffs: {
          agile_usage: data.filter(r => r.tariff_code.includes('AGILE')).reduce((sum, r) => sum + r.electricity_kwh, 0),
          go_usage: data.filter(r => r.tariff_code.includes('GO')).reduce((sum, r) => sum + r.electricity_kwh, 0)
        },
        average_unit_rate_pence: totalElectricity > 0 ? data.reduce((sum, r) => sum + r.unit_rate_pence * r.electricity_kwh, 0) / totalElectricity : 0
      },
      rawData: data
    };
  }
  
  async getEmissions(options: { startDate: string; endDate: string }): Promise<EmissionsData> {
    const data = await this.fetchData(options.startDate, options.endDate);
    return this.calculateEmissions(data);
  }
  
  private async getTariffDetails(tariffCode: string): Promise<any> {
    if (!tariffCode) return null;
    
    try {
      const response = await this.apiCall(`/products/`);
      const product = response.results.find((p: any) => 
        p.tariffs_active_at && 
        Object.keys(p.tariffs_active_at).some(key => key.includes(tariffCode.split('-')[0]))
      );
      
      if (product) {
        const tariffKey = Object.keys(product.tariffs_active_at)[0];
        return product.tariffs_active_at[tariffKey];
      }
    } catch (error) {
      console.warn('Could not fetch tariff details:', error.message);
    }
    
    return null;
  }
  
  private calculateElectricityCost(consumption: number, tariffDetails: any): number {
    if (!tariffDetails) return 0;
    
    const unitCost = consumption * (tariffDetails.unit_rate_inc_vat || 0) / 100; // Convert pence to pounds
    const standingCharge = (tariffDetails.standing_charge_inc_vat || 0) / 100; // Per day, convert to pounds
    
    return Math.round((unitCost + standingCharge) * 100) / 100;
  }
  
  private calculateGasCost(consumption: number, tariffDetails: any): number {
    if (!tariffDetails) return 0;
    
    const unitCost = consumption * (tariffDetails.unit_rate_inc_vat || 0) / 100;
    const standingCharge = (tariffDetails.standing_charge_inc_vat || 0) / 100;
    
    return Math.round((unitCost + standingCharge) * 100) / 100;
  }
  
  private async apiCall(endpoint: string, params?: any): Promise<any> {
    const credentials = this.credentials as OctopusEnergyCredentials;
    
    let url = `https://api.octopus.energy/v1${endpoint}`;
    if (params) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`${credentials.apiKey}:`).toString('base64')}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Octopus Energy API error: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  }
  
  async startSync(): Promise<void> {
    console.log('Starting Octopus Energy sync...');
    // Implementation for automated sync scheduling
  }
}
