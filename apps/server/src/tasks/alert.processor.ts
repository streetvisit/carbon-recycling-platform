import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

// Mock entities - replace with actual entities when available
interface Alert {
  id?: string;
  type: 'system' | 'security' | 'data-quality' | 'compliance' | 'performance';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  source: string;
  metadata?: any;
  status: 'pending' | 'processing' | 'resolved' | 'dismissed';
  createdAt: Date;
  resolvedAt?: Date;
  assignedTo?: string;
}

interface AlertRule {
  id: string;
  name: string;
  type: Alert['type'];
  severity: Alert['severity'];
  condition: string;
  threshold: number;
  isActive: boolean;
  recipients: string[];
  cooldownMinutes: number;
  lastTriggered?: Date;
}

interface NotificationChannel {
  id: string;
  type: 'email' | 'slack' | 'webhook' | 'sms';
  name: string;
  config: any;
  isActive: boolean;
}

@Injectable()
export class AlertProcessor {
  private readonly logger = new Logger(AlertProcessor.name);
  private readonly processingAlerts = new Set<string>();
  private readonly alertHistory = new Map<string, Date>();

  constructor(
    // Inject repositories when entities are available
    // @InjectRepository(Alert)
    // private alertRepository: Repository<Alert>,
    // @InjectRepository(AlertRule)
    // private alertRuleRepository: Repository<AlertRule>,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async processAlerts() {
    try {
      const pendingAlerts = await this.getPendingAlerts();
      
      for (const alert of pendingAlerts) {
        if (!this.processingAlerts.has(alert.id)) {
          // Process alerts in parallel
          this.processAlert(alert).catch(error => {
            this.logger.error(`Failed to process alert ${alert.id}`, error.stack);
          });
        }
      }
      
      if (pendingAlerts.length > 0) {
        this.logger.log(`Processing ${pendingAlerts.length} pending alerts`);
      }
    } catch (error) {
      this.logger.error('Error processing alerts', error.stack);
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkAlertRules() {
    try {
      const activeRules = await this.getActiveAlertRules();
      
      for (const rule of activeRules) {
        if (this.shouldCheckRule(rule)) {
          await this.evaluateAlertRule(rule);
        }
      }
      
      this.logger.debug(`Checked ${activeRules.length} alert rules`);
    } catch (error) {
      this.logger.error('Error checking alert rules', error.stack);
    }
  }

  async processAlert(alert: Alert): Promise<void> {
    if (this.processingAlerts.has(alert.id)) {
      return;
    }

    this.processingAlerts.add(alert.id);

    try {
      this.logger.log(`Processing alert: ${alert.title} (${alert.severity})`);
      
      await this.updateAlertStatus(alert.id, 'processing');
      
      // Send notifications based on alert severity and type
      await this.sendAlertNotifications(alert);
      
      // Auto-assign alerts based on rules
      const assignee = await this.determineAlertAssignee(alert);
      if (assignee) {
        await this.assignAlert(alert.id, assignee);
      }
      
      // Create follow-up actions for critical alerts
      if (alert.severity === 'critical') {
        await this.createCriticalAlertActions(alert);
      }
      
      // Log alert metrics
      await this.recordAlertMetrics(alert);
      
      this.logger.log(`Successfully processed alert: ${alert.id}`);
      
    } catch (error) {
      this.logger.error(`Failed to process alert ${alert.id}`, error.stack);
      await this.updateAlertStatus(alert.id, 'pending'); // Retry later
    } finally {
      this.processingAlerts.delete(alert.id);
    }
  }

  async createAlert(
    type: Alert['type'],
    severity: Alert['severity'],
    title: string,
    message: string,
    source: string,
    metadata?: any
  ): Promise<string> {
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity,
      title,
      message,
      source,
      metadata,
      status: 'pending',
      createdAt: new Date(),
    };

    // Mock save - replace with actual database save
    this.logger.log(`Created alert: ${alert.title} [${alert.severity}] from ${alert.source}`);
    
    return alert.id;
  }

  private async sendAlertNotifications(alert: Alert): Promise<void> {
    const channels = await this.getNotificationChannels(alert);
    
    const notifications = channels.map(channel => 
      this.sendNotification(channel, alert)
    );
    
    await Promise.allSettled(notifications);
  }

  private async sendNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    try {
      switch (channel.type) {
        case 'email':
          await this.sendEmailNotification(channel, alert);
          break;
        case 'slack':
          await this.sendSlackNotification(channel, alert);
          break;
        case 'webhook':
          await this.sendWebhookNotification(channel, alert);
          break;
        case 'sms':
          await this.sendSMSNotification(channel, alert);
          break;
      }
      
      this.logger.debug(`Sent ${channel.type} notification for alert: ${alert.id}`);
    } catch (error) {
      this.logger.error(`Failed to send ${channel.type} notification`, error.stack);
    }
  }

  private async sendEmailNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    // Mock email sending
    this.logger.debug(`Sending email notification to: ${channel.config.recipients.join(', ')}`);
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  private async sendSlackNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    // Mock Slack notification
    this.logger.debug(`Sending Slack notification to: ${channel.config.webhook}`);
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  private async sendWebhookNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    // Mock webhook notification
    this.logger.debug(`Sending webhook notification to: ${channel.config.url}`);
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  private async sendSMSNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    // Mock SMS notification
    this.logger.debug(`Sending SMS notification to: ${channel.config.phoneNumbers.join(', ')}`);
    await new Promise(resolve => setTimeout(resolve, 400));
  }

  private async evaluateAlertRule(rule: AlertRule): Promise<void> {
    try {
      const triggered = await this.checkRuleCondition(rule);
      
      if (triggered) {
        this.logger.warn(`Alert rule triggered: ${rule.name}`);
        
        await this.createAlert(
          rule.type,
          rule.severity,
          `Alert: ${rule.name}`,
          `Alert rule "${rule.name}" has been triggered based on condition: ${rule.condition}`,
          `rule:${rule.id}`,
          { ruleId: rule.id, threshold: rule.threshold }
        );
        
        await this.updateRuleLastTriggered(rule.id);
      }
    } catch (error) {
      this.logger.error(`Failed to evaluate alert rule ${rule.id}`, error.stack);
    }
  }

  private async checkRuleCondition(rule: AlertRule): Promise<boolean> {
    // Mock rule evaluation - replace with actual condition checking
    switch (rule.condition) {
      case 'high_error_rate':
        return await this.checkErrorRate(rule.threshold);
      case 'low_system_health':
        return await this.checkSystemHealth(rule.threshold);
      case 'data_sync_failure':
        return await this.checkDataSyncFailures(rule.threshold);
      case 'high_response_time':
        return await this.checkResponseTime(rule.threshold);
      case 'storage_usage':
        return await this.checkStorageUsage(rule.threshold);
      default:
        return false;
    }
  }

  private async checkErrorRate(threshold: number): Promise<boolean> {
    // Mock error rate check
    const currentErrorRate = Math.random() * 100;
    return currentErrorRate > threshold;
  }

  private async checkSystemHealth(threshold: number): Promise<boolean> {
    // Mock system health check
    const healthScore = Math.random() * 100;
    return healthScore < threshold;
  }

  private async checkDataSyncFailures(threshold: number): Promise<boolean> {
    // Mock data sync failure check
    const failedSyncs = Math.floor(Math.random() * 10);
    return failedSyncs > threshold;
  }

  private async checkResponseTime(threshold: number): Promise<boolean> {
    // Mock response time check
    const avgResponseTime = Math.random() * 5000; // milliseconds
    return avgResponseTime > threshold;
  }

  private async checkStorageUsage(threshold: number): Promise<boolean> {
    // Mock storage usage check
    const usagePercent = Math.random() * 100;
    return usagePercent > threshold;
  }

  private shouldCheckRule(rule: AlertRule): boolean {
    if (!rule.isActive) return false;
    
    if (!rule.lastTriggered) return true;
    
    const cooldownMs = rule.cooldownMinutes * 60 * 1000;
    const timeSinceLastTrigger = Date.now() - rule.lastTriggered.getTime();
    
    return timeSinceLastTrigger > cooldownMs;
  }

  private async determineAlertAssignee(alert: Alert): Promise<string | null> {
    // Mock assignee determination - replace with actual logic
    const assignmentRules = {
      'system': 'devops@company.com',
      'security': 'security@company.com',
      'data-quality': 'data-team@company.com',
      'compliance': 'compliance@company.com',
      'performance': 'devops@company.com',
    };
    
    return assignmentRules[alert.type] || null;
  }

  private async createCriticalAlertActions(alert: Alert): Promise<void> {
    // Mock critical alert actions
    this.logger.warn(`Creating escalation actions for critical alert: ${alert.id}`);
    
    // Could create incidents, escalate to on-call, etc.
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private async recordAlertMetrics(alert: Alert): Promise<void> {
    // Mock metrics recording
    this.logger.debug(`Recording metrics for alert: ${alert.type}/${alert.severity}`);
  }

  // Data access methods (mock implementations)
  private async getPendingAlerts(): Promise<Alert[]> {
    // Mock implementation - return some sample pending alerts
    return [
      {
        id: 'alert_001',
        type: 'system',
        severity: 'high',
        title: 'Database Connection Issues',
        message: 'Multiple database connection failures detected',
        source: 'monitoring-system',
        status: 'pending',
        createdAt: new Date(),
      }
    ].filter(alert => alert.status === 'pending');
  }

  private async getActiveAlertRules(): Promise<AlertRule[]> {
    return [
      {
        id: 'rule_001',
        name: 'High Error Rate',
        type: 'system',
        severity: 'high',
        condition: 'high_error_rate',
        threshold: 10, // 10% error rate
        isActive: true,
        recipients: ['devops@company.com'],
        cooldownMinutes: 15,
      },
      {
        id: 'rule_002',
        name: 'System Health Low',
        type: 'performance',
        severity: 'medium',
        condition: 'low_system_health',
        threshold: 80, // Health score below 80
        isActive: true,
        recipients: ['admin@company.com'],
        cooldownMinutes: 30,
      }
    ];
  }

  private async getNotificationChannels(alert: Alert): Promise<NotificationChannel[]> {
    // Mock implementation - return channels based on alert severity
    const channels: NotificationChannel[] = [
      {
        id: 'email_primary',
        type: 'email',
        name: 'Primary Email',
        config: { recipients: ['admin@company.com', 'devops@company.com'] },
        isActive: true,
      }
    ];

    if (alert.severity === 'critical') {
      channels.push({
        id: 'slack_critical',
        type: 'slack',
        name: 'Critical Alerts Slack',
        config: { webhook: 'https://hooks.slack.com/critical' },
        isActive: true,
      });
    }

    return channels;
  }

  private async updateAlertStatus(alertId: string, status: Alert['status']): Promise<void> {
    this.logger.debug(`Updated alert ${alertId} status to: ${status}`);
  }

  private async assignAlert(alertId: string, assignee: string): Promise<void> {
    this.logger.debug(`Assigned alert ${alertId} to: ${assignee}`);
  }

  private async updateRuleLastTriggered(ruleId: string): Promise<void> {
    this.logger.debug(`Updated last triggered time for rule: ${ruleId}`);
  }

  // Public methods for external access
  async resolveAlert(alertId: string, resolvedBy: string): Promise<void> {
    this.logger.log(`Resolving alert ${alertId} by ${resolvedBy}`);
    await this.updateAlertStatus(alertId, 'resolved');
  }

  async dismissAlert(alertId: string, dismissedBy: string): Promise<void> {
    this.logger.log(`Dismissing alert ${alertId} by ${dismissedBy}`);
    await this.updateAlertStatus(alertId, 'dismissed');
  }

  getProcessingStatus(): { processingAlerts: number; processingAlertIds: string[] } {
    return {
      processingAlerts: this.processingAlerts.size,
      processingAlertIds: Array.from(this.processingAlerts),
    };
  }
}