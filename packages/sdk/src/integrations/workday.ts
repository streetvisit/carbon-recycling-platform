import { BaseIntegration, IntegrationType, IntegrationStatus, IntegrationConfig } from './base';

export interface WorkdayExpenseData {
  expense_id: string;
  category: string;
  amount: number;
  currency: string;
  date: string;
}

export class WorkdayIntegration extends BaseIntegration {
  protected baseUrl = 'https://your-tenant.workday.com/ccx/api';
  
  constructor(config: IntegrationConfig) {
    super({
      ...config,
      type: IntegrationType.ERP,
      provider: 'Workday',
      requiredCredentials: ['client_id', 'client_secret']
    });
  }

  async authenticate(): Promise<boolean> {
    try {
      this.setStatus(IntegrationStatus.AUTHENTICATING);
      
      const tokenResponse = await fetch(`${this.baseUrl}/oauth/token`, {
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
        throw new Error(`OAuth failed: ${tokenResponse.statusText}`);
      }
      
      const tokenData = await tokenResponse.json();
      this.credentials.access_token = tokenData.access_token;
      this.credentials.expires_at = Date.now() + (tokenData.expires_in * 1000);
      
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

      const response = await fetch(`${this.baseUrl}/expenses`, {
        headers: {
          'Authorization': `Bearer ${this.credentials.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.statusText}`);
      }

      const data = await response.json();
      this.rawData = {
        expenses: data.expenses || data,
        timestamp: new Date().toISOString()
      };

      return this.rawData.expenses;
      
    } catch (error) {
      this.setStatus(IntegrationStatus.ERROR, `Data fetch failed: ${error.message}`);
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
    return !!(
        this.credentials.access_token &&
        this.credentials.expires_at &&
        Date.now() < this.credentials.expires_at
      );
  }
}
