/**
 * Base Integration Class
 * Common functionality shared by all integrations
 */

import { Integration, IntegrationCredentials, EmissionsData } from '../index';

export abstract class BaseIntegration implements Integration {
  public id: string;
  public provider: string;
  public status: 'active' | 'inactive' | 'error' | 'syncing' = 'inactive';
  public lastSync: string = '';
  public nextSync: string = '';
  protected credentials: IntegrationCredentials;
  
  constructor(provider: string, credentials: IntegrationCredentials) {
    this.provider = provider;
    this.credentials = credentials;
    this.id = this.generateId();
  }
  
  private generateId(): string {
    return `${this.provider}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
  
  // Abstract methods that must be implemented by each integration
  abstract authenticate(): Promise<boolean>;
  abstract validateConnection(): Promise<boolean>;
  abstract fetchData(startDate: string, endDate: string): Promise<any[]>;
  abstract calculateEmissions(data: any[]): Promise<EmissionsData>;
  abstract getEmissions(options: { startDate: string; endDate: string }): Promise<EmissionsData>;
  abstract startSync(): Promise<void>;
  abstract stopSync(): Promise<void>;
  
  async getLastError(): Promise<string | null> {
    // Default implementation - can be overridden
    return null;
  }
  
  protected updateStatus(status: 'active' | 'inactive' | 'error' | 'syncing'): void {
    this.status = status;
    if (status === 'active') {
      this.lastSync = new Date().toISOString();
      // Set next sync based on frequency (default daily)
      const nextSyncDate = new Date();
      nextSyncDate.setDate(nextSyncDate.getDate() + 1);
      this.nextSync = nextSyncDate.toISOString();
    }
  }
  
  protected logError(operation: string, error: any): void {
    console.error(`[${this.provider}] ${operation} failed:`, error);
    this.status = 'error';
  }
  
  protected async retryOperation<T>(
    operation: () => Promise<T>, 
    maxRetries: number = 3, 
    delay: number = 1000
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) {
          throw lastError;
        }
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt - 1)));
      }
    }
    
    throw lastError!;
  }
}