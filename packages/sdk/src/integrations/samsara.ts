import { BaseIntegration, IntegrationType, IntegrationStatus, IntegrationConfig } from './base';

export interface SamsaraVehicleData {
  vehicle_id: string;
  mileage: number;
  fuel_consumption: number;
  vehicle_type: string;
}

export class SamsaraIntegration extends BaseIntegration {
  protected baseUrl = 'https://api.samsara.com';
  
  constructor(config: IntegrationConfig) {
    super({
      ...config,
      type: IntegrationType.TRANSPORT,
      provider: 'Samsara',
      requiredCredentials: ['api_key']
    });
  }

  async authenticate(): Promise<boolean> {
    try {
      this.setStatus(IntegrationStatus.AUTHENTICATING);
      
      // API key authentication - no additional setup required
      if (!this.credentials.api_key) {
        throw new Error('API key required');
      }
      
      this.setStatus(IntegrationStatus.CONNECTED);
      return true;
      
    } catch (error) {
      this.setStatus(IntegrationStatus.ERROR, `Authentication failed: ${error.message}`);
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

      const response = await fetch(`${this.baseUrl}/vehicles`, {
        headers: {
          'Authorization': `Bearer ${this.credentials.api_key}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.statusText}`);
      }

      const data = await response.json();
      this.rawData = {
        vehicles: data.vehicles || data,
        timestamp: new Date().toISOString()
      };

      return this.rawData.vehicles;
      
    } catch (error) {
      this.setStatus(IntegrationStatus.ERROR, `Data fetch failed: ${error.message}`);
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
    return !!(this.credentials.api_key || this.credentials.access_token);
  }
}
