import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { NotificationService } from './notification.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Decimal } from '@prisma/client/runtime/library';

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  organizationId: string;
  type: AlertType;
  category: AlertCategory;
  severity: AlertSeverity;
  conditions: AlertCondition[];
  actions: AlertAction[];
  isActive: boolean;
  createdBy: string;
  lastTriggered?: Date;
  triggerCount: number;
  settings: AlertSettings;
}

export type AlertType = 
  | 'THRESHOLD_EXCEEDED' 
  | 'TREND_ANOMALY' 
  | 'DATA_QUALITY' 
  | 'COMPLIANCE_ISSUE' 
  | 'TARGET_DEVIATION' 
  | 'SUPPLIER_PERFORMANCE' 
  | 'SYSTEM_HEALTH'
  | 'DEADLINE_APPROACHING';

export type AlertCategory = 
  | 'EMISSIONS' 
  | 'ENERGY' 
  | 'TARGETS' 
  | 'DATA_QUALITY' 
  | 'COMPLIANCE' 
  | 'SUPPLIERS' 
  | 'INITIATIVES'
  | 'SYSTEM';

export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export interface AlertCondition {
  field: string;
  operator: ConditionOperator;
  value: any;
  aggregation?: AggregationType;
  timeWindow?: TimeWindow;
  compareWith?: ComparisonBase;
}

export type ConditionOperator = 
  | 'GREATER_THAN' 
  | 'LESS_THAN' 
  | 'EQUALS' 
  | 'NOT_EQUALS' 
  | 'GREATER_THAN_OR_EQUAL' 
  | 'LESS_THAN_OR_EQUAL' 
  | 'CONTAINS' 
  | 'NOT_CONTAINS' 
  | 'IN_RANGE' 
  | 'OUT_OF_RANGE'
  | 'PERCENTAGE_CHANGE'
  | 'MISSING_DATA';

export type AggregationType = 'SUM' | 'AVERAGE' | 'MIN' | 'MAX' | 'COUNT' | 'LATEST';

export type TimeWindow = '1h' | '6h' | '12h' | '24h' | '7d' | '30d' | '90d' | '365d';

export type ComparisonBase = 'PREVIOUS_PERIOD' | 'BASELINE' | 'TARGET' | 'INDUSTRY_AVERAGE' | 'FIXED_VALUE';

export interface AlertAction {
  type: ActionType;
  recipients: string[];
  template?: string;
  settings: any;
}

export type ActionType = 
  | 'EMAIL_NOTIFICATION' 
  | 'SMS_ALERT' 
  | 'SLACK_MESSAGE' 
  | 'WEBHOOK' 
  | 'CREATE_TASK' 
  | 'ESCALATE'
  | 'AUTO_REMEDIATION';

export interface AlertSettings {
  cooldownPeriod: number; // minutes
  maxTriggersPerDay: number;
  enableDuringBusinessHoursOnly: boolean;
  businessHours?: {
    start: string; // HH:mm format
    end: string;
    timezone: string;
    weekdays: number[]; // 0-6, 0 = Sunday
  };
  suppressionRules?: SuppressionRule[];
  escalationChain?: EscalationRule[];
}

export interface SuppressionRule {
  condition: string;
  duration: number; // minutes
  reason: string;
}

export interface EscalationRule {
  after: number; // minutes without acknowledgment
  escalateTo: string[];
  severity: AlertSeverity;
}

export interface AlertInstance {
  id: string;
  ruleId: string;
  organizationId: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  category: AlertCategory;
  status: AlertStatus;
  triggeredAt: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  data: any;
  metadata: AlertMetadata;
}

export type AlertStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED' | 'SUPPRESSED' | 'ESCALATED';

export interface AlertMetadata {
  sourceData: any;
  conditions: AlertCondition[];
  actualValues: Record<string, any>;
  thresholds: Record<string, any>;
  trends?: TrendAnalysis;
  context?: ContextualInfo;
}

export interface TrendAnalysis {
  direction: 'INCREASING' | 'DECREASING' | 'STABLE';
  changeRate: number;
  confidence: number;
  dataPoints: number;
  timeframe: string;
}

export interface ContextualInfo {
  relatedEvents: string[];
  possibleCauses: string[];
  recommendedActions: string[];
  historicalContext: string;
}

export interface MonitoringDashboard {
  organizationId: string;
  activeAlerts: AlertSummary;
  systemHealth: SystemHealthMetrics;
  dataQuality: DataQualityMetrics;
  recentActivity: RecentActivitySummary;
  performanceMetrics: PerformanceMetrics;
}

export interface AlertSummary {
  total: number;
  bySeverity: Record<AlertSeverity, number>;
  byCategory: Record<AlertCategory, number>;
  recentTrends: AlertTrend[];
}

export interface AlertTrend {
  date: string;
  count: number;
  severity: AlertSeverity;
  category: AlertCategory;
}

export interface SystemHealthMetrics {
  overallStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  dataIngestionRate: number;
  processingLatency: number;
  errorRate: number;
  uptime: number;
  lastDataUpdate: Date;
  componentStatus: ComponentStatus[];
}

export interface ComponentStatus {
  component: string;
  status: 'OPERATIONAL' | 'DEGRADED' | 'OUTAGE';
  responseTime: number;
  errorCount: number;
  lastChecked: Date;
}

export interface DataQualityMetrics {
  overallScore: number;
  completeness: number;
  accuracy: number;
  consistency: number;
  timeliness: number;
  recentIssues: DataQualityIssue[];
}

export interface DataQualityIssue {
  type: 'MISSING' | 'INVALID' | 'INCONSISTENT' | 'OUTDATED' | 'DUPLICATE';
  field: string;
  count: number;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  firstDetected: Date;
  lastDetected: Date;
}

export interface RecentActivitySummary {
  dataUpdates: number;
  alertsTriggered: number;
  tasksCreated: number;
  reportsGenerated: number;
  userActions: number;
  timeframe: string;
}

export interface PerformanceMetrics {
  emissionsTrends: EmissionsTrend[];
  targetProgress: TargetProgress[];
  kpiSummary: KPISummary;
}

export interface EmissionsTrend {
  scope: 'SCOPE1' | 'SCOPE2' | 'SCOPE3' | 'TOTAL';
  current: number;
  previous: number;
  change: number;
  trend: 'UP' | 'DOWN' | 'STABLE';
}

export interface TargetProgress {
  targetId: string;
  name: string;
  progress: number;
  onTrack: boolean;
  projectedCompletion: Date;
  deviation: number;
}

export interface KPISummary {
  totalEmissions: number;
  emissionIntensity: number;
  renewableEnergyPercentage: number;
  supplierEngagement: number;
  dataQualityScore: number;
  complianceScore: number;
}

@Injectable()
export class MonitoringAlertsService {
  private readonly logger = new Logger(MonitoringAlertsService.name);
  private alertRules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, AlertInstance> = new Map();

  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService
  ) {
    this.initializeDefaultAlertRules();
  }

  /**
   * Initialize default alert rules for common scenarios
   */
  private async initializeDefaultAlertRules() {
    const defaultRules: Partial<AlertRule>[] = [
      {
        name: 'High Emissions Spike',
        description: 'Alert when emissions increase by more than 20% compared to previous month',
        type: 'THRESHOLD_EXCEEDED',
        category: 'EMISSIONS',
        severity: 'HIGH',
        conditions: [
          {
            field: 'totalEmissions',
            operator: 'PERCENTAGE_CHANGE',
            value: 20,
            aggregation: 'SUM',
            timeWindow: '30d',
            compareWith: 'PREVIOUS_PERIOD'
          }
        ],
        actions: [
          {
            type: 'EMAIL_NOTIFICATION',
            recipients: ['sustainability_team', 'management'],
            template: 'emissions_spike_alert'
          }
        ],
        settings: {
          cooldownPeriod: 60,
          maxTriggersPerDay: 3,
          enableDuringBusinessHoursOnly: false
        }
      },
      {
        name: 'Data Quality Degradation',
        description: 'Alert when data completeness drops below 80%',
        type: 'DATA_QUALITY',
        category: 'DATA_QUALITY',
        severity: 'MEDIUM',
        conditions: [
          {
            field: 'dataCompleteness',
            operator: 'LESS_THAN',
            value: 80,
            aggregation: 'LATEST'
          }
        ],
        actions: [
          {
            type: 'EMAIL_NOTIFICATION',
            recipients: ['data_team'],
            template: 'data_quality_alert'
          }
        ],
        settings: {
          cooldownPeriod: 120,
          maxTriggersPerDay: 5,
          enableDuringBusinessHoursOnly: true,
          businessHours: {
            start: '09:00',
            end: '17:00',
            timezone: 'UTC',
            weekdays: [1, 2, 3, 4, 5]
          }
        }
      },
      {
        name: 'Target Deviation Warning',
        description: 'Alert when off-track to meet annual emission reduction targets',
        type: 'TARGET_DEVIATION',
        category: 'TARGETS',
        severity: 'HIGH',
        conditions: [
          {
            field: 'targetProgress',
            operator: 'LESS_THAN',
            value: -10, // 10% behind target trajectory
            aggregation: 'LATEST',
            compareWith: 'TARGET'
          }
        ],
        actions: [
          {
            type: 'EMAIL_NOTIFICATION',
            recipients: ['sustainability_team', 'management'],
            template: 'target_deviation_alert'
          },
          {
            type: 'CREATE_TASK',
            recipients: ['sustainability_team'],
            settings: {
              title: 'Review Target Achievement Strategy',
              priority: 'HIGH'
            }
          }
        ],
        settings: {
          cooldownPeriod: 1440, // 24 hours
          maxTriggersPerDay: 1,
          enableDuringBusinessHoursOnly: false
        }
      },
      {
        name: 'Supplier Non-Response',
        description: 'Alert when suppliers miss data submission deadlines',
        type: 'DEADLINE_APPROACHING',
        category: 'SUPPLIERS',
        severity: 'MEDIUM',
        conditions: [
          {
            field: 'supplierResponseRate',
            operator: 'LESS_THAN',
            value: 70,
            aggregation: 'LATEST'
          }
        ],
        actions: [
          {
            type: 'EMAIL_NOTIFICATION',
            recipients: ['supplier_engagement_team'],
            template: 'supplier_response_alert'
          }
        ],
        settings: {
          cooldownPeriod: 360, // 6 hours
          maxTriggersPerDay: 2,
          enableDuringBusinessHoursOnly: true
        }
      }
    ];

    this.logger.log(`Initialized ${defaultRules.length} default alert rules`);
  }

  /**
   * Create a new alert rule
   */
  async createAlertRule(rule: Omit<AlertRule, 'id' | 'triggerCount' | 'lastTriggered'>): Promise<AlertRule> {
    const alertRule: AlertRule = {
      ...rule,
      id: this.generateId(),
      triggerCount: 0
    };

    // Validate rule conditions
    this.validateAlertRule(alertRule);

    this.alertRules.set(alertRule.id, alertRule);

    // Save to database
    await this.prisma.alertRule.create({
      data: {
        id: alertRule.id,
        organizationId: alertRule.organizationId,
        name: alertRule.name,
        description: alertRule.description,
        type: alertRule.type,
        category: alertRule.category,
        severity: alertRule.severity,
        conditions: alertRule.conditions as any,
        actions: alertRule.actions as any,
        isActive: alertRule.isActive,
        createdBy: alertRule.createdBy,
        settings: alertRule.settings as any
      }
    });

    this.logger.log(`Created alert rule: ${alertRule.name} (${alertRule.id})`);
    return alertRule;
  }

  /**
   * Update existing alert rule
   */
  async updateAlertRule(ruleId: string, updates: Partial<AlertRule>): Promise<AlertRule> {
    const existingRule = this.alertRules.get(ruleId);
    if (!existingRule) {
      throw new Error(`Alert rule not found: ${ruleId}`);
    }

    const updatedRule = { ...existingRule, ...updates };
    this.validateAlertRule(updatedRule);

    this.alertRules.set(ruleId, updatedRule);

    // Update in database
    await this.prisma.alertRule.update({
      where: { id: ruleId },
      data: {
        name: updatedRule.name,
        description: updatedRule.description,
        type: updatedRule.type,
        category: updatedRule.category,
        severity: updatedRule.severity,
        conditions: updatedRule.conditions as any,
        actions: updatedRule.actions as any,
        isActive: updatedRule.isActive,
        settings: updatedRule.settings as any
      }
    });

    this.logger.log(`Updated alert rule: ${ruleId}`);
    return updatedRule;
  }

  /**
   * Delete alert rule
   */
  async deleteAlertRule(ruleId: string): Promise<void> {
    const rule = this.alertRules.get(ruleId);
    if (!rule) {
      throw new Error(`Alert rule not found: ${ruleId}`);
    }

    this.alertRules.delete(ruleId);
    await this.prisma.alertRule.delete({ where: { id: ruleId } });

    this.logger.log(`Deleted alert rule: ${ruleId}`);
  }

  /**
   * Get alert rules for organization
   */
  async getAlertRules(organizationId: string): Promise<AlertRule[]> {
    const rules = Array.from(this.alertRules.values())
      .filter(rule => rule.organizationId === organizationId);

    // Load from database if not in memory
    if (rules.length === 0) {
      const dbRules = await this.prisma.alertRule.findMany({
        where: { organizationId }
      });

      dbRules.forEach(rule => {
        const alertRule: AlertRule = {
          id: rule.id,
          name: rule.name,
          description: rule.description,
          organizationId: rule.organizationId,
          type: rule.type as AlertType,
          category: rule.category as AlertCategory,
          severity: rule.severity as AlertSeverity,
          conditions: rule.conditions as AlertCondition[],
          actions: rule.actions as AlertAction[],
          isActive: rule.isActive,
          createdBy: rule.createdBy,
          lastTriggered: rule.lastTriggered,
          triggerCount: rule.triggerCount,
          settings: rule.settings as AlertSettings
        };
        this.alertRules.set(rule.id, alertRule);
      });

      return Array.from(this.alertRules.values())
        .filter(rule => rule.organizationId === organizationId);
    }

    return rules;
  }

  /**
   * Monitor and evaluate alert conditions - runs every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async evaluateAlertConditions() {
    this.logger.debug('Starting alert condition evaluation');

    try {
      const activeRules = Array.from(this.alertRules.values())
        .filter(rule => rule.isActive);

      for (const rule of activeRules) {
        await this.evaluateRule(rule);
      }

      this.logger.debug(`Evaluated ${activeRules.length} alert rules`);
    } catch (error) {
      this.logger.error('Error evaluating alert conditions:', error);
    }
  }

  /**
   * Evaluate a specific alert rule
   */
  private async evaluateRule(rule: AlertRule): Promise<void> {
    try {
      // Check cooldown period
      if (this.isInCooldownPeriod(rule)) {
        return;
      }

      // Check business hours constraint
      if (!this.isWithinBusinessHours(rule)) {
        return;
      }

      // Check max triggers per day
      if (this.hasExceededMaxTriggers(rule)) {
        return;
      }

      // Evaluate conditions
      const conditionResults = await Promise.all(
        rule.conditions.map(condition => this.evaluateCondition(condition, rule.organizationId))
      );

      // Check if all conditions are met
      const allConditionsMet = conditionResults.every(result => result.met);

      if (allConditionsMet) {
        await this.triggerAlert(rule, conditionResults);
      }
    } catch (error) {
      this.logger.error(`Error evaluating rule ${rule.id}:`, error);
    }
  }

  /**
   * Evaluate a single condition
   */
  private async evaluateCondition(
    condition: AlertCondition, 
    organizationId: string
  ): Promise<{ met: boolean; actualValue: any; context: any }> {
    // Get the data for evaluation
    const data = await this.getConditionData(condition, organizationId);

    let actualValue: any;
    let met = false;

    // Apply aggregation if specified
    if (condition.aggregation && Array.isArray(data)) {
      actualValue = this.applyAggregation(data, condition.aggregation, condition.field);
    } else {
      actualValue = this.extractFieldValue(data, condition.field);
    }

    // Apply comparison logic
    switch (condition.operator) {
      case 'GREATER_THAN':
        met = actualValue > condition.value;
        break;
      case 'LESS_THAN':
        met = actualValue < condition.value;
        break;
      case 'EQUALS':
        met = actualValue === condition.value;
        break;
      case 'NOT_EQUALS':
        met = actualValue !== condition.value;
        break;
      case 'GREATER_THAN_OR_EQUAL':
        met = actualValue >= condition.value;
        break;
      case 'LESS_THAN_OR_EQUAL':
        met = actualValue <= condition.value;
        break;
      case 'PERCENTAGE_CHANGE':
        const referenceValue = await this.getReferenceValue(condition, organizationId);
        const percentageChange = ((actualValue - referenceValue) / referenceValue) * 100;
        met = Math.abs(percentageChange) >= condition.value;
        actualValue = percentageChange;
        break;
      case 'MISSING_DATA':
        met = actualValue === null || actualValue === undefined;
        break;
      case 'IN_RANGE':
        const [min, max] = condition.value;
        met = actualValue >= min && actualValue <= max;
        break;
      case 'OUT_OF_RANGE':
        const [rangeMin, rangeMax] = condition.value;
        met = actualValue < rangeMin || actualValue > rangeMax;
        break;
    }

    return {
      met,
      actualValue,
      context: {
        field: condition.field,
        operator: condition.operator,
        threshold: condition.value,
        dataPoints: Array.isArray(data) ? data.length : 1
      }
    };
  }

  /**
   * Get data for condition evaluation
   */
  private async getConditionData(condition: AlertCondition, organizationId: string): Promise<any> {
    const timeWindow = condition.timeWindow || '24h';
    const timeWindowMs = this.parseTimeWindow(timeWindow);
    const since = new Date(Date.now() - timeWindowMs);

    // Route to appropriate data source based on field
    switch (true) {
      case condition.field.includes('emissions'):
        return this.getEmissionsData(organizationId, since);
      case condition.field.includes('energy'):
        return this.getEnergyData(organizationId, since);
      case condition.field.includes('target'):
        return this.getTargetData(organizationId, since);
      case condition.field.includes('supplier'):
        return this.getSupplierData(organizationId, since);
      case condition.field.includes('dataQuality') || condition.field.includes('completeness'):
        return this.getDataQualityMetrics(organizationId);
      default:
        return this.getGenericMetricData(organizationId, condition.field, since);
    }
  }

  /**
   * Trigger an alert when conditions are met
   */
  private async triggerAlert(rule: AlertRule, conditionResults: any[]): Promise<void> {
    const alertInstance: AlertInstance = {
      id: this.generateId(),
      ruleId: rule.id,
      organizationId: rule.organizationId,
      title: this.generateAlertTitle(rule, conditionResults),
      message: this.generateAlertMessage(rule, conditionResults),
      severity: rule.severity,
      category: rule.category,
      status: 'ACTIVE',
      triggeredAt: new Date(),
      data: conditionResults,
      metadata: {
        sourceData: conditionResults.map(r => r.context),
        conditions: rule.conditions,
        actualValues: conditionResults.reduce((acc, result, index) => {
          acc[rule.conditions[index].field] = result.actualValue;
          return acc;
        }, {}),
        thresholds: rule.conditions.reduce((acc, condition, index) => {
          acc[condition.field] = condition.value;
          return acc;
        }, {}),
        trends: await this.analyzeTrends(rule, conditionResults),
        context: await this.generateContextualInfo(rule, conditionResults)
      }
    };

    // Store alert instance
    this.activeAlerts.set(alertInstance.id, alertInstance);

    // Save to database
    await this.prisma.alertInstance.create({
      data: {
        id: alertInstance.id,
        ruleId: alertInstance.ruleId,
        organizationId: alertInstance.organizationId,
        title: alertInstance.title,
        message: alertInstance.message,
        severity: alertInstance.severity,
        category: alertInstance.category,
        status: alertInstance.status,
        triggeredAt: alertInstance.triggeredAt,
        data: alertInstance.data as any,
        metadata: alertInstance.metadata as any
      }
    });

    // Update rule trigger count and last triggered
    rule.triggerCount++;
    rule.lastTriggered = new Date();
    await this.prisma.alertRule.update({
      where: { id: rule.id },
      data: {
        triggerCount: rule.triggerCount,
        lastTriggered: rule.lastTriggered
      }
    });

    // Execute alert actions
    await this.executeAlertActions(rule, alertInstance);

    this.logger.warn(`Alert triggered: ${alertInstance.title} (${alertInstance.id})`);
  }

  /**
   * Execute alert actions
   */
  private async executeAlertActions(rule: AlertRule, alert: AlertInstance): Promise<void> {
    for (const action of rule.actions) {
      try {
        switch (action.type) {
          case 'EMAIL_NOTIFICATION':
            await this.sendEmailNotification(action, alert);
            break;
          case 'SMS_ALERT':
            await this.sendSMSAlert(action, alert);
            break;
          case 'SLACK_MESSAGE':
            await this.sendSlackMessage(action, alert);
            break;
          case 'WEBHOOK':
            await this.callWebhook(action, alert);
            break;
          case 'CREATE_TASK':
            await this.createTask(action, alert);
            break;
          case 'ESCALATE':
            await this.escalateAlert(action, alert);
            break;
          case 'AUTO_REMEDIATION':
            await this.executeAutoRemediation(action, alert);
            break;
        }
      } catch (error) {
        this.logger.error(`Failed to execute action ${action.type} for alert ${alert.id}:`, error);
      }
    }
  }

  /**
   * Get monitoring dashboard data
   */
  async getMonitoringDashboard(organizationId: string): Promise<MonitoringDashboard> {
    const [alertSummary, systemHealth, dataQuality, recentActivity, performanceMetrics] = await Promise.all([
      this.getAlertSummary(organizationId),
      this.getSystemHealthMetrics(organizationId),
      this.getDataQualityMetrics(organizationId),
      this.getRecentActivitySummary(organizationId),
      this.getPerformanceMetrics(organizationId)
    ]);

    return {
      organizationId,
      activeAlerts: alertSummary,
      systemHealth,
      dataQuality,
      recentActivity,
      performanceMetrics
    };
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    alert.status = 'ACKNOWLEDGED';
    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = userId;

    await this.prisma.alertInstance.update({
      where: { id: alertId },
      data: {
        status: alert.status,
        acknowledgedAt: alert.acknowledgedAt,
        acknowledgedBy: alert.acknowledgedBy
      }
    });

    this.logger.log(`Alert acknowledged: ${alertId} by ${userId}`);
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string, userId: string, resolution?: string): Promise<void> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    alert.status = 'RESOLVED';
    alert.resolvedAt = new Date();
    alert.resolvedBy = userId;

    await this.prisma.alertInstance.update({
      where: { id: alertId },
      data: {
        status: alert.status,
        resolvedAt: alert.resolvedAt,
        resolvedBy: alert.resolvedBy,
        resolution: resolution
      }
    });

    // Remove from active alerts
    this.activeAlerts.delete(alertId);

    this.logger.log(`Alert resolved: ${alertId} by ${userId}`);
  }

  /**
   * Get active alerts for organization
   */
  async getActiveAlerts(organizationId: string): Promise<AlertInstance[]> {
    return Array.from(this.activeAlerts.values())
      .filter(alert => 
        alert.organizationId === organizationId && 
        alert.status === 'ACTIVE'
      );
  }

  /**
   * Helper methods for data retrieval and analysis
   */
  private async getEmissionsData(organizationId: string, since: Date): Promise<any[]> {
    return this.prisma.emissions.findMany({
      where: {
        organizationId,
        createdAt: { gte: since }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  private async getEnergyData(organizationId: string, since: Date): Promise<any[]> {
    // Mock implementation - would integrate with actual energy data
    return [
      { totalEnergyConsumption: 1250.5, renewablePercentage: 45.2, createdAt: new Date() }
    ];
  }

  private async getTargetData(organizationId: string, since: Date): Promise<any[]> {
    // Mock implementation - would integrate with actual target tracking
    return [
      { targetProgress: -12.5, onTrack: false, createdAt: new Date() }
    ];
  }

  private async getSupplierData(organizationId: string, since: Date): Promise<any[]> {
    // Mock implementation - would integrate with supplier engagement data
    return [
      { supplierResponseRate: 68, dataQualityScore: 75, createdAt: new Date() }
    ];
  }

  private async getDataQualityMetrics(organizationId: string): Promise<DataQualityMetrics> {
    // Mock implementation - would calculate from actual data
    return {
      overallScore: 78,
      completeness: 82,
      accuracy: 75,
      consistency: 80,
      timeliness: 88,
      recentIssues: []
    };
  }

  private async getGenericMetricData(organizationId: string, field: string, since: Date): Promise<any[]> {
    // Generic data retrieval based on field name
    return [];
  }

  private async getAlertSummary(organizationId: string): Promise<AlertSummary> {
    const activeAlerts = await this.getActiveAlerts(organizationId);
    
    const bySeverity = activeAlerts.reduce((acc, alert) => {
      acc[alert.severity] = (acc[alert.severity] || 0) + 1;
      return acc;
    }, {} as Record<AlertSeverity, number>);

    const byCategory = activeAlerts.reduce((acc, alert) => {
      acc[alert.category] = (acc[alert.category] || 0) + 1;
      return acc;
    }, {} as Record<AlertCategory, number>);

    return {
      total: activeAlerts.length,
      bySeverity,
      byCategory,
      recentTrends: []
    };
  }

  private async getSystemHealthMetrics(organizationId: string): Promise<SystemHealthMetrics> {
    // Mock implementation - would integrate with actual system monitoring
    return {
      overallStatus: 'HEALTHY',
      dataIngestionRate: 125.5,
      processingLatency: 450,
      errorRate: 0.02,
      uptime: 99.95,
      lastDataUpdate: new Date(),
      componentStatus: [
        {
          component: 'Data Ingestion',
          status: 'OPERATIONAL',
          responseTime: 200,
          errorCount: 0,
          lastChecked: new Date()
        }
      ]
    };
  }

  private async getRecentActivitySummary(organizationId: string): Promise<RecentActivitySummary> {
    // Mock implementation - would aggregate from actual activity logs
    return {
      dataUpdates: 45,
      alertsTriggered: 12,
      tasksCreated: 8,
      reportsGenerated: 3,
      userActions: 156,
      timeframe: '24h'
    };
  }

  private async getPerformanceMetrics(organizationId: string): Promise<PerformanceMetrics> {
    // Mock implementation - would calculate from actual emissions and target data
    return {
      emissionsTrends: [
        { scope: 'SCOPE1', current: 1250, previous: 1320, change: -70, trend: 'DOWN' },
        { scope: 'SCOPE2', current: 890, previous: 850, change: 40, trend: 'UP' },
        { scope: 'SCOPE3', current: 2450, previous: 2380, change: 70, trend: 'UP' },
        { scope: 'TOTAL', current: 4590, previous: 4550, change: 40, trend: 'UP' }
      ],
      targetProgress: [
        {
          targetId: 'target-1',
          name: '50% Emission Reduction by 2030',
          progress: 35.2,
          onTrack: true,
          projectedCompletion: new Date('2029-12-31'),
          deviation: 2.1
        }
      ],
      kpiSummary: {
        totalEmissions: 4590,
        emissionIntensity: 125.5,
        renewableEnergyPercentage: 45.2,
        supplierEngagement: 78.5,
        dataQualityScore: 82.1,
        complianceScore: 88.7
      }
    };
  }

  // Utility methods
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private validateAlertRule(rule: AlertRule): void {
    if (!rule.name || !rule.organizationId || !rule.conditions.length) {
      throw new Error('Invalid alert rule: missing required fields');
    }

    for (const condition of rule.conditions) {
      if (!condition.field || !condition.operator) {
        throw new Error('Invalid condition: missing field or operator');
      }
    }
  }

  private isInCooldownPeriod(rule: AlertRule): boolean {
    if (!rule.lastTriggered || !rule.settings.cooldownPeriod) {
      return false;
    }

    const cooldownMs = rule.settings.cooldownPeriod * 60 * 1000;
    return Date.now() - rule.lastTriggered.getTime() < cooldownMs;
  }

  private isWithinBusinessHours(rule: AlertRule): boolean {
    if (!rule.settings.enableDuringBusinessHoursOnly || !rule.settings.businessHours) {
      return true;
    }

    const now = new Date();
    const businessHours = rule.settings.businessHours;
    
    // Check if current day is a business day
    if (!businessHours.weekdays.includes(now.getDay())) {
      return false;
    }

    // Check if current time is within business hours
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;

    const [startHour, startMinute] = businessHours.start.split(':').map(Number);
    const [endHour, endMinute] = businessHours.end.split(':').map(Number);
    const startTime = startHour * 60 + startMinute;
    const endTime = endHour * 60 + endMinute;

    return currentTime >= startTime && currentTime <= endTime;
  }

  private hasExceededMaxTriggers(rule: AlertRule): boolean {
    if (!rule.settings.maxTriggersPerDay) {
      return false;
    }

    // Count triggers in the last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentTriggers = Array.from(this.activeAlerts.values())
      .filter(alert => 
        alert.ruleId === rule.id && 
        alert.triggeredAt >= oneDayAgo
      ).length;

    return recentTriggers >= rule.settings.maxTriggersPerDay;
  }

  private parseTimeWindow(timeWindow: TimeWindow): number {
    const unit = timeWindow.slice(-1);
    const value = parseInt(timeWindow.slice(0, -1));

    switch (unit) {
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 24 * 60 * 60 * 1000;
    }
  }

  private applyAggregation(data: any[], aggregation: AggregationType, field: string): any {
    const values = data.map(item => this.extractFieldValue(item, field)).filter(v => v != null);

    switch (aggregation) {
      case 'SUM': return values.reduce((sum, val) => sum + val, 0);
      case 'AVERAGE': return values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
      case 'MIN': return Math.min(...values);
      case 'MAX': return Math.max(...values);
      case 'COUNT': return values.length;
      case 'LATEST': return values[0]; // Assumes data is ordered by date desc
      default: return values[0];
    }
  }

  private extractFieldValue(data: any, field: string): any {
    return field.split('.').reduce((obj, key) => obj?.[key], data);
  }

  private async getReferenceValue(condition: AlertCondition, organizationId: string): Promise<number> {
    // Get reference value based on comparison base
    switch (condition.compareWith) {
      case 'PREVIOUS_PERIOD':
        // Get data from previous time window
        const timeWindowMs = this.parseTimeWindow(condition.timeWindow || '30d');
        const previousPeriodStart = new Date(Date.now() - 2 * timeWindowMs);
        const previousPeriodEnd = new Date(Date.now() - timeWindowMs);
        const previousData = await this.getConditionDataForPeriod(condition, organizationId, previousPeriodStart, previousPeriodEnd);
        return this.applyAggregation(previousData as any[], condition.aggregation || 'AVERAGE', condition.field);
      case 'BASELINE':
        // Get baseline value from organization settings or targets
        return 1000; // Mock baseline
      case 'TARGET':
        // Get target value
        return 1200; // Mock target
      case 'INDUSTRY_AVERAGE':
        // Get industry average
        return 1150; // Mock industry average
      default:
        return 0;
    }
  }

  private async getConditionDataForPeriod(
    condition: AlertCondition, 
    organizationId: string, 
    start: Date, 
    end: Date
  ): Promise<any> {
    // Similar to getConditionData but for a specific period
    switch (true) {
      case condition.field.includes('emissions'):
        return this.prisma.emissions.findMany({
          where: {
            organizationId,
            createdAt: { gte: start, lte: end }
          }
        });
      default:
        return [];
    }
  }

  private generateAlertTitle(rule: AlertRule, conditionResults: any[]): string {
    const firstResult = conditionResults[0];
    return `${rule.name} - ${firstResult.context.field}: ${firstResult.actualValue}`;
  }

  private generateAlertMessage(rule: AlertRule, conditionResults: any[]): string {
    let message = `${rule.description}\n\nConditions met:\n`;
    
    conditionResults.forEach((result, index) => {
      const condition = rule.conditions[index];
      message += `• ${condition.field} ${condition.operator.toLowerCase().replace('_', ' ')} ${condition.value} (actual: ${result.actualValue})\n`;
    });

    return message;
  }

  private async analyzeTrends(rule: AlertRule, conditionResults: any[]): Promise<TrendAnalysis> {
    // Mock trend analysis - would implement actual trend calculation
    return {
      direction: 'INCREASING',
      changeRate: 15.2,
      confidence: 0.85,
      dataPoints: 30,
      timeframe: '30d'
    };
  }

  private async generateContextualInfo(rule: AlertRule, conditionResults: any[]): Promise<ContextualInfo> {
    // Mock contextual information - would generate based on actual context
    return {
      relatedEvents: ['Monthly data update', 'Supplier submission deadline'],
      possibleCauses: ['Increased production', 'Equipment malfunction', 'Data collection error'],
      recommendedActions: ['Review recent activities', 'Contact operations team', 'Verify data accuracy'],
      historicalContext: 'Similar spike occurred in Q3 2023 due to production ramp-up'
    };
  }

  // Action execution methods
  private async sendEmailNotification(action: AlertAction, alert: AlertInstance): Promise<void> {
    await this.notificationService.sendEmail({
      to: action.recipients,
      subject: `Alert: ${alert.title}`,
      template: action.template || 'default_alert',
      data: { alert }
    });
  }

  private async sendSMSAlert(action: AlertAction, alert: AlertInstance): Promise<void> {
    await this.notificationService.sendSMS({
      to: action.recipients,
      message: `Alert: ${alert.title} - ${alert.message.substring(0, 100)}...`
    });
  }

  private async sendSlackMessage(action: AlertAction, alert: AlertInstance): Promise<void> {
    // Implementation would integrate with Slack API
    this.logger.log(`Slack message would be sent for alert: ${alert.id}`);
  }

  private async callWebhook(action: AlertAction, alert: AlertInstance): Promise<void> {
    // Implementation would make HTTP request to webhook URL
    this.logger.log(`Webhook would be called for alert: ${alert.id}`);
  }

  private async createTask(action: AlertAction, alert: AlertInstance): Promise<void> {
    // Implementation would create task in task management system
    this.logger.log(`Task would be created for alert: ${alert.id}`);
  }

  private async escalateAlert(action: AlertAction, alert: AlertInstance): Promise<void> {
    // Implementation would escalate to higher-level team or system
    alert.status = 'ESCALATED';
    this.logger.warn(`Alert escalated: ${alert.id}`);
  }

  private async executeAutoRemediation(action: AlertAction, alert: AlertInstance): Promise<void> {
    // Implementation would execute automated remediation actions
    this.logger.log(`Auto-remediation would be executed for alert: ${alert.id}`);
  }
}