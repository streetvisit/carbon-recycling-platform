/**
 * AWS Cloud Integration
 * Handles AWS billing data and cloud service emissions tracking
 */

import { BaseIntegration } from './base';
import { IntegrationCredentials, EmissionsData } from '../index';

export interface AWSCredentials extends IntegrationCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
}

export interface AWSUsageData {
  service: string;
  region: string;
  usageType: string;
  amount: number;
  unit: string;
  cost: number;
  startDate: string;
  endDate: string;
}

export class AWSIntegration extends BaseIntegration {
  constructor(credentials: AWSCredentials) {
    super('aws', credentials);
  }
  
  async authenticate(): Promise<boolean> {
    try {
      const credentials = this.credentials as AWSCredentials;
      
      // Validate AWS credentials by making a simple STS call
      const stsUrl = 'https://sts.amazonaws.com/';
      const headers = await this.createAWSHeaders('POST', stsUrl, {
        Action: 'GetCallerIdentity',
        Version: '2011-06-15'
      });
      
      const response = await fetch(stsUrl, {
        method: 'POST',
        headers,
        body: 'Action=GetCallerIdentity&Version=2011-06-15'
      });
      
      return response.ok;
    } catch (error) {
      this.logError('authentication', error);
      return false;
    }
  }
  
  async validateConnection(): Promise<boolean> {
    return this.authenticate();
  }
  
  async fetchData(startDate: string, endDate: string): Promise<AWSUsageData[]> {
    if (!await this.validateConnection()) {
      throw new Error('Failed to authenticate with AWS');
    }
    
    const credentials = this.credentials as AWSCredentials;
    const region = credentials.region || 'us-east-1';
    
    try {
      // Use AWS Cost Explorer API to get usage data
      const costExplorerUrl = `https://ce.${region}.amazonaws.com/`;
      const body = JSON.stringify({
        TimePeriod: {
          Start: startDate,
          End: endDate
        },
        Granularity: 'MONTHLY',
        Metrics: ['UsageQuantity', 'BlendedCost'],
        GroupBy: [
          {
            Type: 'DIMENSION',
            Key: 'SERVICE'
          },
          {
            Type: 'DIMENSION', 
            Key: 'USAGE_TYPE'
          }
        ]
      });
      
      const headers = await this.createAWSHeaders('POST', costExplorerUrl, body);
      headers['Content-Type'] = 'application/x-amz-json-1.1';
      headers['X-Amz-Target'] = 'AWSInsightsIndexService.GetDimensionValues';
      
      const response = await fetch(costExplorerUrl, {
        method: 'POST',
        headers,
        body
      });
      
      if (!response.ok) {
        throw new Error(`AWS API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Transform AWS data to our format
      return this.transformAWSData(data, startDate, endDate);
    } catch (error) {
      this.logError('data fetch', error);
      throw error;
    }
  }
  
  private transformAWSData(awsData: any, startDate: string, endDate: string): AWSUsageData[] {
    const usageData: AWSUsageData[] = [];
    
    // Transform AWS Cost Explorer response to our format
    if (awsData.ResultsByTime) {
      awsData.ResultsByTime.forEach((timeResult: any) => {
        timeResult.Groups.forEach((group: any) => {
          const [service, usageType] = group.Keys;
          const metrics = group.Metrics;
          
          usageData.push({
            service: service,
            region: this.credentials.region || 'us-east-1',
            usageType: usageType,
            amount: parseFloat(metrics.UsageQuantity?.Amount || '0'),
            unit: metrics.UsageQuantity?.Unit || '',
            cost: parseFloat(metrics.BlendedCost?.Amount || '0'),
            startDate: startDate,
            endDate: endDate
          });
        });
      });
    }
    
    return usageData;
  }
  
  async calculateEmissions(data: AWSUsageData[]): Promise<EmissionsData> {
    // AWS emission factors (kgCO2e) - regional averages
    const emissionFactors = {
      'us-east-1': { compute: 0.000074, storage: 0.0000036, transfer: 0.000012 },
      'us-west-2': { compute: 0.000048, storage: 0.0000024, transfer: 0.000008 },
      'eu-west-1': { compute: 0.000052, storage: 0.0000026, transfer: 0.000009 },
      'eu-central-1': { compute: 0.000056, storage: 0.0000028, transfer: 0.000010 },
      'ap-southeast-1': { compute: 0.000078, storage: 0.0000039, transfer: 0.000013 }
    };
    
    let totalComputeEmissions = 0;
    let totalStorageEmissions = 0;
    let totalTransferEmissions = 0;
    let totalCost = 0;
    
    data.forEach(usage => {
      const regionFactors = emissionFactors[usage.region] || emissionFactors['us-east-1'];
      totalCost += usage.cost;
      
      // Categorize AWS services and calculate emissions
      if (this.isComputeService(usage.service, usage.usageType)) {
        totalComputeEmissions += usage.amount * regionFactors.compute;
      } else if (this.isStorageService(usage.service, usage.usageType)) {
        totalStorageEmissions += usage.amount * regionFactors.storage;
      } else if (this.isTransferService(usage.service, usage.usageType)) {
        totalTransferEmissions += usage.amount * regionFactors.transfer;
      }
    });
    
    const totalEmissions = totalComputeEmissions + totalStorageEmissions + totalTransferEmissions;
    
    return {
      totalCO2e: totalEmissions,
      scope1: 0, // AWS is Scope 3 for customers
      scope2: 0, // AWS is Scope 3 for customers  
      scope3: totalEmissions, // All cloud emissions are Scope 3
      breakdown: {
        electricity: 0,
        gas: 0,
        transport: 0,
        travel: 0,
        waste: 0
      },
      period: {
        startDate: data[0]?.startDate || '',
        endDate: data[0]?.endDate || ''
      },
      rawData: data
    };
  }
  
  async getEmissions(options: { startDate: string; endDate: string }): Promise<EmissionsData> {
    const data = await this.fetchData(options.startDate, options.endDate);
    return this.calculateEmissions(data);
  }
  
  private isComputeService(service: string, usageType: string): boolean {
    const computeServices = ['Amazon Elastic Compute Cloud - Compute', 'AWS Lambda', 'Amazon ECS'];
    const computeUsageTypes = ['BoxUsage', 'Lambda-GB-Second', 'Fargate-GB-Hours'];
    
    return computeServices.some(s => service.includes(s)) ||
           computeUsageTypes.some(t => usageType.includes(t));
  }
  
  private isStorageService(service: string, usageType: string): boolean {
    const storageServices = ['Amazon Simple Storage Service', 'Amazon Elastic Block Store'];
    const storageUsageTypes = ['StorageUsage', 'VolumeUsage', 'SnapshotUsage'];
    
    return storageServices.some(s => service.includes(s)) ||
           storageUsageTypes.some(t => usageType.includes(t));
  }
  
  private isTransferService(service: string, usageType: string): boolean {
    const transferUsageTypes = ['DataTransfer', 'CloudFront', 'NatGateway'];
    return transferUsageTypes.some(t => usageType.includes(t));
  }
  
  private async createAWSHeaders(method: string, url: string, body?: any): Promise<Record<string, string>> {
    const credentials = this.credentials as AWSCredentials;
    const now = new Date();
    const dateString = now.toISOString().substring(0, 10).replace(/-/g, '');
    const timeString = now.toISOString().substring(0, 19).replace(/[-:]/g, '') + 'Z';
    
    // AWS Signature Version 4 implementation (simplified)
    const headers: Record<string, string> = {
      'Authorization': `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${dateString}/us-east-1/ce/aws4_request`,
      'X-Amz-Date': timeString,
      'Host': new URL(url).host
    };
    
    return headers;
  }
  
  async startSync(): Promise<void> {
    this.updateStatus('syncing');
    console.log('Starting AWS sync...');
    // Implementation for automated sync
    this.updateStatus('active');
  }
  
  async stopSync(): Promise<void> {
    console.log('Stopping AWS sync...');
    this.updateStatus('inactive');
  }
}