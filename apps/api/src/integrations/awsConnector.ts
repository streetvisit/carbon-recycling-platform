/**
 * AWS CloudWatch Connector
 * 
 * Fetches usage metrics from AWS services for carbon footprint calculation:
 * - EC2 instance hours
 * - S3 storage usage 
 * - RDS database hours
 * - Lambda function invocations
 * - CloudWatch metrics
 */

import { CloudWatchClient, GetMetricStatisticsCommand, Dimension } from "@aws-sdk/client-cloudwatch";
import { EC2Client, DescribeInstancesCommand } from "@aws-sdk/client-ec2";

export interface AWSCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  region: string;
}

export interface UsageRecord {
  service: string;
  instance_hours?: number;
  storage_gb_hours?: number;
  invocations?: number;
  period_start: string;
  period_end: string;
  region: string;
  instance_type?: string;
}

export class AWSCloudWatchConnector {
  private cloudWatchClient: CloudWatchClient;
  private ec2Client: EC2Client;
  private credentials: AWSCredentials;
  
  constructor(credentials: AWSCredentials) {
    this.credentials = credentials;
    
    const config = {
      region: credentials.region,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken
      }
    };
    
    this.cloudWatchClient = new CloudWatchClient(config);
    this.ec2Client = new EC2Client(config);
  }
  
  /**
   * Get EC2 instance usage hours
   */
  async getEC2Usage(fromDate: Date, toDate: Date): Promise<UsageRecord[]> {
    try {
      console.log(`Fetching EC2 metrics from ${fromDate.toISOString()} to ${toDate.toISOString()}`);
      
      // Get list of running instances
      const describeCommand = new DescribeInstancesCommand({});
      const instancesResponse = await this.ec2Client.send(describeCommand);
      
      const results: UsageRecord[] = [];
      
      for (const reservation of instancesResponse.Reservations || []) {
        for (const instance of reservation.Instances || []) {
          if (!instance.InstanceId || !instance.InstanceType) continue;
          
          try {
            // Get CPU utilization metrics as a proxy for instance hours
            const command = new GetMetricStatisticsCommand({
              Namespace: 'AWS/EC2',
              MetricName: 'CPUUtilization',
              Dimensions: [
                {
                  Name: 'InstanceId',
                  Value: instance.InstanceId
                }
              ],
              StartTime: fromDate,
              EndTime: toDate,
              Period: 3600, // 1 hour periods
              Statistics: ['Average']
            });
            
            const metricsResponse = await this.cloudWatchClient.send(command);
            
            // Calculate total instance hours (number of data points = hours)
            const instanceHours = metricsResponse.Datapoints?.length || 0;
            
            if (instanceHours > 0) {
              results.push({
                service: 'EC2',
                instance_hours: instanceHours,
                period_start: fromDate.toISOString(),
                period_end: toDate.toISOString(),
                region: this.credentials.region,
                instance_type: instance.InstanceType
              });
            }
            
          } catch (error) {
            console.error(`Failed to fetch metrics for instance ${instance.InstanceId}:`, error);
          }
        }
      }
      
      console.log(`Found ${results.length} EC2 instances with usage data`);
      return results;
      
    } catch (error) {
      console.error('Failed to fetch EC2 usage:', error);
      throw error;
    }
  }
  
  /**
   * Get S3 storage usage in GB-hours
   */
  async getS3Usage(fromDate: Date, toDate: Date): Promise<UsageRecord[]> {
    try {
      console.log(`Fetching S3 storage metrics from ${fromDate.toISOString()} to ${toDate.toISOString()}`);
      
      const command = new GetMetricStatisticsCommand({
        Namespace: 'AWS/S3',
        MetricName: 'BucketSizeBytes',
        Dimensions: [
          {
            Name: 'StorageType',
            Value: 'StandardStorage'
          }
        ],
        StartTime: fromDate,
        EndTime: toDate,
        Period: 86400, // Daily periods
        Statistics: ['Average']
      });
      
      const response = await this.cloudWatchClient.send(command);
      const results: UsageRecord[] = [];
      
      for (const datapoint of response.Datapoints || []) {
        if (datapoint.Average && datapoint.Timestamp) {
          // Convert bytes to GB and calculate GB-hours (average size * 24 hours)
          const storageGb = datapoint.Average / (1024 * 1024 * 1024);
          const storageGbHours = storageGb * 24;
          
          results.push({
            service: 'S3',
            storage_gb_hours: storageGbHours,
            period_start: new Date(datapoint.Timestamp.getTime() - 86400000).toISOString(), // 24h before
            period_end: datapoint.Timestamp.toISOString(),
            region: this.credentials.region
          });
        }
      }
      
      console.log(`Found ${results.length} S3 storage data points`);
      return results;
      
    } catch (error) {
      console.error('Failed to fetch S3 usage:', error);
      throw error;
    }
  }
  
  /**
   * Get RDS database instance hours
   */
  async getRDSUsage(fromDate: Date, toDate: Date): Promise<UsageRecord[]> {
    try {
      console.log(`Fetching RDS metrics from ${fromDate.toISOString()} to ${toDate.toISOString()}`);
      
      const command = new GetMetricStatisticsCommand({
        Namespace: 'AWS/RDS',
        MetricName: 'CPUUtilization',
        StartTime: fromDate,
        EndTime: toDate,
        Period: 3600, // 1 hour periods
        Statistics: ['Average']
      });
      
      const response = await this.cloudWatchClient.send(command);
      const results: UsageRecord[] = [];
      
      // Calculate database instance hours
      const instanceHours = response.Datapoints?.length || 0;
      
      if (instanceHours > 0) {
        results.push({
          service: 'RDS',
          instance_hours: instanceHours,
          period_start: fromDate.toISOString(),
          period_end: toDate.toISOString(),
          region: this.credentials.region
        });
      }
      
      console.log(`Found ${instanceHours} RDS instance hours`);
      return results;
      
    } catch (error) {
      console.error('Failed to fetch RDS usage:', error);
      throw error;
    }
  }
  
  /**
   * Get Lambda function invocations
   */
  async getLambdaUsage(fromDate: Date, toDate: Date): Promise<UsageRecord[]> {
    try {
      console.log(`Fetching Lambda metrics from ${fromDate.toISOString()} to ${toDate.toISOString()}`);
      
      const command = new GetMetricStatisticsCommand({
        Namespace: 'AWS/Lambda',
        MetricName: 'Invocations',
        StartTime: fromDate,
        EndTime: toDate,
        Period: 3600, // 1 hour periods
        Statistics: ['Sum']
      });
      
      const response = await this.cloudWatchClient.send(command);
      const results: UsageRecord[] = [];
      
      let totalInvocations = 0;
      for (const datapoint of response.Datapoints || []) {
        if (datapoint.Sum) {
          totalInvocations += datapoint.Sum;
        }
      }
      
      if (totalInvocations > 0) {
        results.push({
          service: 'Lambda',
          invocations: totalInvocations,
          period_start: fromDate.toISOString(),
          period_end: toDate.toISOString(),
          region: this.credentials.region
        });
      }
      
      console.log(`Found ${totalInvocations} Lambda invocations`);
      return results;
      
    } catch (error) {
      console.error('Failed to fetch Lambda usage:', error);
      throw error;
    }
  }
  
  /**
   * Get custom CloudWatch metrics
   */
  async getCustomMetrics(
    namespace: string,
    metricName: string,
    dimensions: Dimension[],
    fromDate: Date,
    toDate: Date,
    statistic: 'Average' | 'Sum' | 'Maximum' | 'Minimum' | 'SampleCount' = 'Average'
  ): Promise<UsageRecord[]> {
    try {
      console.log(`Fetching custom metrics: ${namespace}/${metricName}`);
      
      const command = new GetMetricStatisticsCommand({
        Namespace: namespace,
        MetricName: metricName,
        Dimensions: dimensions,
        StartTime: fromDate,
        EndTime: toDate,
        Period: 3600,
        Statistics: [statistic]
      });
      
      const response = await this.cloudWatchClient.send(command);
      const results: UsageRecord[] = [];
      
      for (const datapoint of response.Datapoints || []) {
        const value = datapoint[statistic];
        if (value && datapoint.Timestamp) {
          results.push({
            service: 'CustomMetric',
            instance_hours: statistic === 'Sum' ? value : undefined,
            period_start: new Date(datapoint.Timestamp.getTime() - 3600000).toISOString(),
            period_end: datapoint.Timestamp.toISOString(),
            region: this.credentials.region
          });
        }
      }
      
      console.log(`Found ${results.length} custom metric data points`);
      return results;
      
    } catch (error) {
      console.error(`Failed to fetch custom metrics ${namespace}/${metricName}:`, error);
      throw error;
    }
  }
  
  /**
   * Test the connection and permissions
   */
  async testConnection(): Promise<boolean> {
    try {
      console.log('Testing AWS connection...');
      
      // Try to list EC2 instances as a connection test
      const command = new DescribeInstancesCommand({});
      await this.ec2Client.send(command);
      
      console.log('AWS connection successful');
      return true;
      
    } catch (error) {
      console.error('AWS connection failed:', error);
      return false;
    }
  }
  
  /**
   * Get all supported usage metrics
   */
  async getAllUsage(fromDate: Date, toDate: Date): Promise<UsageRecord[]> {
    const results: UsageRecord[] = [];
    
    try {
      // Fetch all service metrics in parallel
      const [ec2Usage, s3Usage, rdsUsage, lambdaUsage] = await Promise.allSettled([
        this.getEC2Usage(fromDate, toDate),
        this.getS3Usage(fromDate, toDate),
        this.getRDSUsage(fromDate, toDate),
        this.getLambdaUsage(fromDate, toDate)
      ]);
      
      // Collect successful results
      if (ec2Usage.status === 'fulfilled') {
        results.push(...ec2Usage.value);
      } else {
        console.error('EC2 usage fetch failed:', ec2Usage.reason);
      }
      
      if (s3Usage.status === 'fulfilled') {
        results.push(...s3Usage.value);
      } else {
        console.error('S3 usage fetch failed:', s3Usage.reason);
      }
      
      if (rdsUsage.status === 'fulfilled') {
        results.push(...rdsUsage.value);
      } else {
        console.error('RDS usage fetch failed:', rdsUsage.reason);
      }
      
      if (lambdaUsage.status === 'fulfilled') {
        results.push(...lambdaUsage.value);
      } else {
        console.error('Lambda usage fetch failed:', lambdaUsage.reason);
      }
      
      console.log(`Total AWS usage records collected: ${results.length}`);
      return results;
      
    } catch (error) {
      console.error('Failed to fetch AWS usage:', error);
      throw error;
    }
  }
}