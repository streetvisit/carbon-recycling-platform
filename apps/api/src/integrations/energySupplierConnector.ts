/**
 * Energy Supplier Connector
 * 
 * Handles connections to UK energy suppliers via OAuth and API:
 * - EDF Energy
 * - British Gas (Centrica)
 * - Octopus Energy
 * - E.ON Next
 * - Shell Energy
 */

export interface EnergyUsageRecord {
  usage_kwh: number;
  cost_pence?: number;
  period_start: string;
  period_end: string;
  meter_serial?: string;
  tariff_name?: string;
}

export interface SupplierCredentials {
  accessToken: string;
  refreshToken?: string;
  accountNumber?: string;
  meterPoints?: string[];
  expiresAt?: string;
}

export class EnergySupplierConnector {
  private provider: string;
  private credentials: SupplierCredentials;
  
  constructor(provider: string, credentials: SupplierCredentials) {
    this.provider = provider;
    this.credentials = credentials;
  }
  
  /**
   * Fetch electricity usage data
   */
  async getElectricityUsage(fromDate: Date, toDate: Date): Promise<EnergyUsageRecord[]> {
    switch (this.provider) {
      case 'octopus_energy':
        return await this.fetchOctopusElectricity(fromDate, toDate);
      case 'edf_energy':
        return await this.fetchEDFElectricity(fromDate, toDate);
      case 'british_gas':
        return await this.fetchBritishGasElectricity(fromDate, toDate);
      default:
        throw new Error(`Electricity usage not supported for provider: ${this.provider}`);
    }
  }
  
  /**
   * Fetch gas usage data  
   */
  async getGasUsage(fromDate: Date, toDate: Date): Promise<EnergyUsageRecord[]> {
    switch (this.provider) {
      case 'octopus_energy':
        return await this.fetchOctopusGas(fromDate, toDate);
      case 'british_gas':
        return await this.fetchBritishGasGas(fromDate, toDate);
      default:
        throw new Error(`Gas usage not supported for provider: ${this.provider}`);
    }
  }
  
  /**
   * Octopus Energy API - has excellent developer API
   */
  private async fetchOctopusElectricity(fromDate: Date, toDate: Date): Promise<EnergyUsageRecord[]> {
    const baseUrl = 'https://api.octopus.energy/v1';
    const results: EnergyUsageRecord[] = [];
    
    // Octopus requires MPAN (Meter Point Administration Number)
    for (const meterPoint of this.credentials.meterPoints || []) {
      try {
        const response = await fetch(
          `${baseUrl}/electricity-meter-points/${meterPoint}/meters/consumption/`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${this.credentials.accessToken}`,
              'Content-Type': 'application/json'
            },
            params: {
              period_from: fromDate.toISOString(),
              period_to: toDate.toISOString(),
              page_size: 25000 // Max page size
            }
          }
        );
        
        if (!response.ok) {
          throw new Error(`Octopus API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        for (const reading of data.results || []) {
          results.push({
            usage_kwh: reading.consumption,
            period_start: reading.interval_start,
            period_end: reading.interval_end,
            meter_serial: reading.meter_serial
          });
        }
        
      } catch (error) {
        console.error(`Failed to fetch Octopus electricity for ${meterPoint}:`, error);
        throw error;
      }
    }
    
    return results;
  }
  
  private async fetchOctopusGas(fromDate: Date, toDate: Date): Promise<EnergyUsageRecord[]> {
    const baseUrl = 'https://api.octopus.energy/v1';
    const results: EnergyUsageRecord[] = [];
    
    // Similar to electricity but for gas meters (MPRN - Meter Point Reference Number)  
    for (const meterPoint of this.credentials.meterPoints || []) {
      try {
        const response = await fetch(
          `${baseUrl}/gas-meter-points/${meterPoint}/meters/consumption/`,
          {
            method: 'GET', 
            headers: {
              'Authorization': `Bearer ${this.credentials.accessToken}`,
              'Content-Type': 'application/json'
            },
            params: {
              period_from: fromDate.toISOString(),
              period_to: toDate.toISOString(),
              page_size: 25000
            }
          }
        );
        
        if (!response.ok) {
          throw new Error(`Octopus Gas API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        for (const reading of data.results || []) {
          // Convert gas cubic meters to kWh (approximate conversion factor 11.1)
          const usage_kwh = reading.consumption * 11.1;
          
          results.push({
            usage_kwh,
            period_start: reading.interval_start,
            period_end: reading.interval_end,
            meter_serial: reading.meter_serial
          });
        }
        
      } catch (error) {
        console.error(`Failed to fetch Octopus gas for ${meterPoint}:`, error);
        throw error;
      }
    }
    
    return results;
  }
  
  /**
   * EDF Energy API integration
   */
  private async fetchEDFElectricity(fromDate: Date, toDate: Date): Promise<EnergyUsageRecord[]> {
    const baseUrl = 'https://api.edfenergy.com/v2';
    
    try {
      const response = await fetch(`${baseUrl}/customers/me/consumption/electricity`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.credentials.accessToken}`,
          'Content-Type': 'application/json'
        },
        params: {
          from: fromDate.toISOString().split('T')[0], // YYYY-MM-DD format
          to: toDate.toISOString().split('T')[0],
          granularity: 'DAILY'
        }
      });
      
      if (!response.ok) {
        throw new Error(`EDF API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      const results: EnergyUsageRecord[] = [];
      
      for (const reading of data.consumptions || []) {
        results.push({
          usage_kwh: reading.value,
          cost_pence: reading.cost,
          period_start: reading.date + 'T00:00:00Z',
          period_end: reading.date + 'T23:59:59Z',
          tariff_name: reading.tariffName
        });
      }
      
      return results;
      
    } catch (error) {
      console.error('Failed to fetch EDF electricity:', error);
      throw error;
    }
  }
  
  /**
   * British Gas (Centrica) API integration
   */
  private async fetchBritishGasElectricity(fromDate: Date, toDate: Date): Promise<EnergyUsageRecord[]> {
    const baseUrl = 'https://api.britishgas.co.uk/v1';
    
    try {
      const response = await fetch(`${baseUrl}/accounts/${this.credentials.accountNumber}/meters/electricity/readings`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.credentials.accessToken}`,
          'Content-Type': 'application/json'
        },
        params: {
          from: fromDate.toISOString(),
          to: toDate.toISOString()
        }
      });
      
      if (!response.ok) {
        throw new Error(`British Gas API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      const results: EnergyUsageRecord[] = [];
      
      for (const reading of data.readings || []) {
        results.push({
          usage_kwh: reading.consumption,
          cost_pence: reading.cost,
          period_start: reading.readingDate,
          period_end: reading.readingDate,
          meter_serial: reading.meterSerial
        });
      }
      
      return results;
      
    } catch (error) {
      console.error('Failed to fetch British Gas electricity:', error);
      throw error;
    }
  }
  
  private async fetchBritishGasGas(fromDate: Date, toDate: Date): Promise<EnergyUsageRecord[]> {
    const baseUrl = 'https://api.britishgas.co.uk/v1';
    
    try {
      const response = await fetch(`${baseUrl}/accounts/${this.credentials.accountNumber}/meters/gas/readings`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.credentials.accessToken}`,
          'Content-Type': 'application/json'
        },
        params: {
          from: fromDate.toISOString(),
          to: toDate.toISOString()
        }
      });
      
      if (!response.ok) {
        throw new Error(`British Gas Gas API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      const results: EnergyUsageRecord[] = [];
      
      for (const reading of data.readings || []) {
        // Convert gas units to kWh
        const usage_kwh = reading.consumption * (reading.conversionFactor || 11.1);
        
        results.push({
          usage_kwh,
          cost_pence: reading.cost,
          period_start: reading.readingDate,
          period_end: reading.readingDate,
          meter_serial: reading.meterSerial
        });
      }
      
      return results;
      
    } catch (error) {
      console.error('Failed to fetch British Gas gas:', error);
      throw error;
    }
  }
  
  /**
   * Refresh access token if expired
   */
  async refreshAccessToken(): Promise<SupplierCredentials> {
    if (!this.credentials.refreshToken) {
      throw new Error('No refresh token available for token refresh');
    }
    
    let refreshUrl: string;
    let clientId: string;
    
    switch (this.provider) {
      case 'octopus_energy':
        refreshUrl = 'https://api.octopus.energy/v1/oauth2/token/';
        clientId = process.env.OCTOPUS_CLIENT_ID || '';
        break;
      case 'edf_energy':
        refreshUrl = 'https://api.edfenergy.com/oauth/token';
        clientId = process.env.EDF_CLIENT_ID || '';
        break;
      case 'british_gas':
        refreshUrl = 'https://api.britishgas.co.uk/oauth/token';
        clientId = process.env.BG_CLIENT_ID || '';
        break;
      default:
        throw new Error(`Token refresh not supported for provider: ${this.provider}`);
    }
    
    try {
      const response = await fetch(refreshUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.credentials.refreshToken,
          client_id: clientId
        })
      });
      
      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.status} ${response.statusText}`);
      }
      
      const tokenData = await response.json();
      
      this.credentials = {
        ...this.credentials,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || this.credentials.refreshToken,
        expiresAt: new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString()
      };
      
      return this.credentials;
      
    } catch (error) {
      console.error(`Failed to refresh ${this.provider} token:`, error);
      throw error;
    }
  }
}