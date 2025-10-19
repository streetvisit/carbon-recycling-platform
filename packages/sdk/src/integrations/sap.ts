/**
 * SAP ERP Integration
 * Handles SAP business data and operational emissions tracking
 */

import { BaseIntegration } from './base';
import { IntegrationCredentials, EmissionsData } from '../index';

export interface SAPCredentials extends IntegrationCredentials {
  username: string;
  password: string;
  baseUrl: string; // SAP system URL
  client: string; // SAP client number
  systemId?: string;
}

export interface SAPEnergyData {
  plant: string;
  costCenter: string;
  materialNumber: string;
  materialDescription: string;
  quantity: number;
  unit: string;
  energyType: 'electricity' | 'gas' | 'fuel' | 'steam' | 'water';
  cost: number;
  currency: string;
  postingDate: string;
  documentNumber: string;
}

export class SAPIntegration extends BaseIntegration {
  private sessionCookie?: string;
  
  constructor(credentials: SAPCredentials) {
    super('sap', credentials);
  }
  
  async authenticate(): Promise<boolean> {
    try {
      const credentials = this.credentials as SAPCredentials;
      
      // SAP authentication via login endpoint
      const loginUrl = `${credentials.baseUrl}/sap/bc/rest/login`;
      const authString = btoa(`${credentials.username}:${credentials.password}`);
      
      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authString}`,
          'Content-Type': 'application/json',
          'sap-client': credentials.client
        }
      });
      
      if (response.ok) {
        // Extract session cookie for future requests
        const cookies = response.headers.get('set-cookie');
        if (cookies) {
          const sessionMatch = cookies.match(/SAP_SESSIONID_[^=]+=([^;]+)/);
          if (sessionMatch) {
            this.sessionCookie = sessionMatch[0];
          }
        }
        return true;
      }
      
      return false;
    } catch (error) {
      this.logError('authentication', error);
      return false;
    }
  }
  
  async validateConnection(): Promise<boolean> {
    if (!this.sessionCookie) {
      return this.authenticate();
    }
    
    try {
      const credentials = this.credentials as SAPCredentials;
      
      // Test connection with a simple RFC call
      const testUrl = `${credentials.baseUrl}/sap/bc/rest/rfc/RFC_SYSTEM_INFO`;
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Cookie': this.sessionCookie,
          'sap-client': credentials.client
        }
      });
      
      return response.ok;
    } catch (error) {
      this.logError('connection validation', error);
      return false;
    }
  }
  
  async fetchData(startDate: string, endDate: string): Promise<SAPEnergyData[]> {
    if (!await this.validateConnection()) {
      throw new Error('Failed to authenticate with SAP');
    }
    
    const credentials = this.credentials as SAPCredentials;
    
    try {
      // Fetch energy consumption data from SAP CO (Controlling) module
      const energyData = await this.fetchEnergyConsumption(startDate, endDate);
      
      // Fetch utility invoices from SAP FI (Financial) module
      const invoiceData = await this.fetchUtilityInvoices(startDate, endDate);
      
      // Combine and return data
      return [...energyData, ...invoiceData];
    } catch (error) {
      this.logError('data fetch', error);
      throw error;
    }
  }
  
  private async fetchEnergyConsumption(startDate: string, endDate: string): Promise<SAPEnergyData[]> {
    const credentials = this.credentials as SAPCredentials;
    const energyData: SAPEnergyData[] = [];
    
    // Query SAP Controlling (CO) tables for energy consumption
    // This would typically use BAPI_COSTCENTER_GETDETAIL or similar
    const coUrl = `${credentials.baseUrl}/sap/opu/odata/sap/ZCO_ENERGY_SRV/EnergyConsumption`;
    
    const params = new URLSearchParams({
      '$filter': `PostingDate ge datetime'${startDate}T00:00:00' and PostingDate le datetime'${endDate}T23:59:59'`,
      '$format': 'json'
    });
    
    const response = await fetch(`${coUrl}?${params}`, {
      method: 'GET',
      headers: {
        'Cookie': this.sessionCookie!,
        'sap-client': credentials.client,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`SAP CO API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Transform SAP data to our format
    if (data.d?.results) {
      data.d.results.forEach((record: any) => {
        energyData.push({
          plant: record.Plant || '',
          costCenter: record.CostCenter || '',
          materialNumber: record.MaterialNumber || '',
          materialDescription: record.MaterialDescription || '',
          quantity: parseFloat(record.Quantity || '0'),
          unit: record.Unit || '',
          energyType: this.mapSAPEnergyType(record.MaterialGroup),
          cost: parseFloat(record.Amount || '0'),
          currency: record.Currency || 'GBP',
          postingDate: record.PostingDate,
          documentNumber: record.DocumentNumber || ''
        });
      });
    }
    
    return energyData;
  }
  
  private async fetchUtilityInvoices(startDate: string, endDate: string): Promise<SAPEnergyData[]> {
    const credentials = this.credentials as SAPCredentials;
    const invoiceData: SAPEnergyData[] = [];
    
    // Query SAP Financial (FI) tables for utility invoices
    // This would typically use BAPI_AP_INVOICE_GETDETAIL or similar
    const fiUrl = `${credentials.baseUrl}/sap/opu/odata/sap/ZFI_INVOICE_SRV/UtilityInvoices`;
    
    const params = new URLSearchParams({
      '$filter': `DocumentDate ge datetime'${startDate}T00:00:00' and DocumentDate le datetime'${endDate}T23:59:59' and VendorGroup eq 'UTIL'`,
      '$format': 'json'
    });
    
    const response = await fetch(`${fiUrl}?${params}`, {
      method: 'GET',
      headers: {
        'Cookie': this.sessionCookie!,
        'sap-client': credentials.client,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`SAP FI API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Transform SAP invoice data to our format
    if (data.d?.results) {
      data.d.results.forEach((invoice: any) => {
        invoiceData.push({
          plant: invoice.Plant || '',
          costCenter: invoice.CostCenter || '',
          materialNumber: invoice.MaterialNumber || '',
          materialDescription: invoice.InvoiceDescription || '',
          quantity: this.extractQuantityFromInvoice(invoice.InvoiceText),
          unit: this.extractUnitFromInvoice(invoice.InvoiceText),
          energyType: this.mapVendorToEnergyType(invoice.VendorName),
          cost: parseFloat(invoice.Amount || '0'),
          currency: invoice.Currency || 'GBP',
          postingDate: invoice.DocumentDate,
          documentNumber: invoice.DocumentNumber || ''
        });
      });
    }
    
    return invoiceData;
  }
  
  private mapSAPEnergyType(materialGroup: string): 'electricity' | 'gas' | 'fuel' | 'steam' | 'water' {
    const materialGroup_upper = (materialGroup || '').toUpperCase();
    
    if (materialGroup_upper.includes('ELEC') || materialGroup_upper.includes('POWER')) return 'electricity';
    if (materialGroup_upper.includes('GAS') || materialGroup_upper.includes('NATURAL')) return 'gas';
    if (materialGroup_upper.includes('FUEL') || materialGroup_upper.includes('DIESEL') || materialGroup_upper.includes('PETROL')) return 'fuel';
    if (materialGroup_upper.includes('STEAM') || materialGroup_upper.includes('HEAT')) return 'steam';
    if (materialGroup_upper.includes('WATER')) return 'water';
    
    return 'electricity'; // default
  }
  
  private mapVendorToEnergyType(vendorName: string): 'electricity' | 'gas' | 'fuel' | 'steam' | 'water' {
    const vendor_upper = (vendorName || '').toUpperCase();
    
    if (vendor_upper.includes('ELECTRIC') || vendor_upper.includes('POWER') || vendor_upper.includes('ENERGY')) return 'electricity';
    if (vendor_upper.includes('GAS') || vendor_upper.includes('BRITISH GAS') || vendor_upper.includes('CENTRICA')) return 'gas';
    if (vendor_upper.includes('SHELL') || vendor_upper.includes('BP') || vendor_upper.includes('FUEL')) return 'fuel';
    if (vendor_upper.includes('STEAM') || vendor_upper.includes('HEAT')) return 'steam';
    if (vendor_upper.includes('WATER') || vendor_upper.includes('THAMES') || vendor_upper.includes('SEVERN')) return 'water';
    
    return 'electricity'; // default
  }
  
  private extractQuantityFromInvoice(invoiceText: string): number {
    // Extract quantity from invoice text using regex
    const quantityMatch = invoiceText?.match(/(\d+(?:\.\d+)?)\s*(kWh|MWh|m3|litres|gallons)/i);
    return quantityMatch ? parseFloat(quantityMatch[1]) : 0;
  }
  
  private extractUnitFromInvoice(invoiceText: string): string {
    // Extract unit from invoice text using regex
    const unitMatch = invoiceText?.match(/\d+(?:\.\d+)?\s*(kWh|MWh|m3|litres|gallons)/i);
    return unitMatch ? unitMatch[1] : 'units';
  }
  
  async calculateEmissions(data: SAPEnergyData[]): Promise<EmissionsData> {
    // UK DEFRA 2025 emission factors (kgCO2e per unit)
    const emissionFactors = {
      electricity: 0.193, // kgCO2e per kWh (UK grid average 2025)
      gas: 0.184, // kgCO2e per kWh (natural gas)
      fuel: {
        diesel: 2.687, // kgCO2e per litre
        petrol: 2.315, // kgCO2e per litre
        lpg: 1.493 // kgCO2e per litre
      },
      steam: 0.210, // kgCO2e per kWh (steam/heat)
      water: 0.149 // kgCO2e per m3 (water supply & treatment)
    };
    
    let electricityEmissions = 0;
    let gasEmissions = 0;
    let fuelEmissions = 0;
    let steamEmissions = 0;
    let waterEmissions = 0;
    let totalCost = 0;
    
    data.forEach(record => {
      totalCost += record.cost;
      let quantity = record.quantity;
      
      // Convert units to standard
      if (record.unit.toLowerCase().includes('mwh')) {
        quantity *= 1000; // Convert MWh to kWh
      }
      
      switch (record.energyType) {
        case 'electricity':
          electricityEmissions += quantity * emissionFactors.electricity;
          break;
        case 'gas':
          gasEmissions += quantity * emissionFactors.gas;
          break;
        case 'fuel':
          // Assume diesel if not specified
          fuelEmissions += quantity * emissionFactors.fuel.diesel;
          break;
        case 'steam':
          steamEmissions += quantity * emissionFactors.steam;
          break;
        case 'water':
          waterEmissions += quantity * emissionFactors.water;
          break;
      }
    });
    
    const totalEmissions = electricityEmissions + gasEmissions + fuelEmissions + steamEmissions + waterEmissions;
    
    return {
      totalCO2e: totalEmissions,
      scope1: gasEmissions + fuelEmissions, // Direct emissions from owned sources
      scope2: electricityEmissions + steamEmissions, // Indirect emissions from purchased energy
      scope3: waterEmissions, // Other indirect emissions
      breakdown: {
        electricity: electricityEmissions,
        gas: gasEmissions,
        transport: fuelEmissions,
        travel: 0,
        waste: waterEmissions // Using waste category for water
      },
      period: {
        startDate: data[0]?.postingDate || '',
        endDate: data[data.length - 1]?.postingDate || ''
      },
      rawData: data
    };
  }
  
  async getEmissions(options: { startDate: string; endDate: string }): Promise<EmissionsData> {
    const data = await this.fetchData(options.startDate, options.endDate);
    return this.calculateEmissions(data);
  }
  
  async startSync(): Promise<void> {
    this.updateStatus('syncing');
    console.log('Starting SAP sync...');
    // Implementation for automated sync
    this.updateStatus('active');
  }
  
  async stopSync(): Promise<void> {
    console.log('Stopping SAP sync...');
    this.updateStatus('inactive');
  }
  
  // SAP-specific utility methods
  async getPlants(): Promise<string[]> {
    if (!await this.validateConnection()) {
      throw new Error('Not authenticated with SAP');
    }
    
    const credentials = this.credentials as SAPCredentials;
    const url = `${credentials.baseUrl}/sap/opu/odata/sap/ZMD_PLANT_SRV/Plants`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Cookie': this.sessionCookie!,
        'sap-client': credentials.client,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch plants: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.d?.results?.map((plant: any) => plant.PlantCode) || [];
  }
  
  async getCostCenters(): Promise<string[]> {
    if (!await this.validateConnection()) {
      throw new Error('Not authenticated with SAP');
    }
    
    const credentials = this.credentials as SAPCredentials;
    const url = `${credentials.baseUrl}/sap/opu/odata/sap/ZCO_COSTCENTER_SRV/CostCenters`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Cookie': this.sessionCookie!,
        'sap-client': credentials.client,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch cost centers: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.d?.results?.map((cc: any) => cc.CostCenter) || [];
  }
}