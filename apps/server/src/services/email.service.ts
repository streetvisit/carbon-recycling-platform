import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

export interface EmailTemplate {
  name: string;
  subject: string;
  templatePath: string;
  defaultData?: Record<string, any>;
}

export interface EmailOptions {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  template?: string;
  templateData?: Record<string, any>;
  html?: string;
  text?: string;
  attachments?: EmailAttachment[];
  priority?: 'high' | 'normal' | 'low';
}

export interface EmailAttachment {
  filename: string;
  content?: Buffer | string;
  path?: string;
  contentType?: string;
}

export interface BulkEmailOptions {
  templateName: string;
  recipients: BulkRecipient[];
  globalData?: Record<string, any>;
  batchSize?: number;
}

export interface BulkRecipient {
  email: string;
  data: Record<string, any>;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;
  private templates: Map<string, handlebars.TemplateDelegate> = new Map();
  private templateConfigs: Map<string, EmailTemplate> = new Map();

  constructor(private configService: ConfigService) {
    this.initializeTransporter();
    this.loadEmailTemplates();
  }

  /**
   * Initialize email transporter
   */
  private async initializeTransporter() {
    const provider = this.configService.get<string>('EMAIL_PROVIDER', 'smtp');
    
    switch (provider.toLowerCase()) {
      case 'sendgrid':
        this.transporter = nodemailer.createTransporter({
          service: 'SendGrid',
          auth: {
            user: 'apikey',
            pass: this.configService.get<string>('SENDGRID_API_KEY')
          }
        });
        break;
        
      case 'aws-ses':
        this.transporter = nodemailer.createTransporter({
          host: this.configService.get<string>('AWS_SES_HOST', 'email-smtp.us-east-1.amazonaws.com'),
          port: 587,
          secure: false,
          auth: {
            user: this.configService.get<string>('AWS_SES_ACCESS_KEY'),
            pass: this.configService.get<string>('AWS_SES_SECRET_KEY')
          }
        });
        break;
        
      case 'smtp':
      default:
        this.transporter = nodemailer.createTransporter({
          host: this.configService.get<string>('SMTP_HOST', 'localhost'),
          port: this.configService.get<number>('SMTP_PORT', 587),
          secure: this.configService.get<boolean>('SMTP_SECURE', false),
          auth: {
            user: this.configService.get<string>('SMTP_USER'),
            pass: this.configService.get<string>('SMTP_PASS')
          }
        });
        break;
    }

    // Verify connection
    try {
      await this.transporter.verify();
      this.logger.log(`Email service initialized with ${provider} provider`);
    } catch (error) {
      this.logger.error('Failed to initialize email service:', error);
    }
  }

  /**
   * Load and compile email templates
   */
  private loadEmailTemplates() {
    const templateDir = path.join(__dirname, '..', 'templates', 'email');
    
    // Define template configurations
    const templates: EmailTemplate[] = [
      {
        name: 'supplier-invitation',
        subject: 'Invitation to Join {{organizationName}} Carbon Tracking Program',
        templatePath: 'supplier-invitation.hbs'
      },
      {
        name: 'data-request',
        subject: 'Carbon Data Request from {{organizationName}}',
        templatePath: 'data-request.hbs'
      },
      {
        name: 'deadline-reminder',
        subject: 'Reminder: Carbon Data Submission Due {{daysRemaining}} Days',
        templatePath: 'deadline-reminder.hbs'
      },
      {
        name: 'submission-received',
        subject: 'Carbon Data Submission Received - Thank You',
        templatePath: 'submission-received.hbs'
      },
      {
        name: 'submission-approved',
        subject: 'Carbon Data Submission Approved',
        templatePath: 'submission-approved.hbs'
      },
      {
        name: 'submission-rejected',
        subject: 'Carbon Data Submission Requires Revision',
        templatePath: 'submission-rejected.hbs'
      },
      {
        name: 'initiative-invitation',
        subject: 'Invitation to Join Collaborative Carbon Initiative: {{initiativeName}}',
        templatePath: 'initiative-invitation.hbs'
      },
      {
        name: 'milestone-reminder',
        subject: 'Initiative Milestone Due: {{milestoneName}}',
        templatePath: 'milestone-reminder.hbs'
      },
      {
        name: 'gap-analysis-complete',
        subject: 'Your Carbon Gap Analysis is Ready',
        templatePath: 'gap-analysis-complete.hbs'
      },
      {
        name: 'compliance-alert',
        subject: 'Compliance Alert: {{regulationType}} Deadline Approaching',
        templatePath: 'compliance-alert.hbs'
      }
    ];

    // Load and compile templates
    for (const template of templates) {
      try {
        const templatePath = path.join(templateDir, template.templatePath);
        
        if (fs.existsSync(templatePath)) {
          const templateSource = fs.readFileSync(templatePath, 'utf8');
          const compiledTemplate = handlebars.compile(templateSource);
          
          this.templates.set(template.name, compiledTemplate);
          this.templateConfigs.set(template.name, template);
          
          this.logger.debug(`Loaded email template: ${template.name}`);
        } else {
          this.logger.warn(`Email template not found: ${templatePath}`);
        }
      } catch (error) {
        this.logger.error(`Failed to load email template ${template.name}:`, error);
      }
    }
  }

  /**
   * Send single email
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      let html = options.html;
      let subject = options.subject;

      // Use template if specified
      if (options.template) {
        const template = this.templates.get(options.template);
        const templateConfig = this.templateConfigs.get(options.template);
        
        if (template && templateConfig) {
          const templateData = {
            ...templateConfig.defaultData,
            ...options.templateData,
            currentYear: new Date().getFullYear(),
            platformUrl: this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000')
          };
          
          html = template(templateData);
          
          // Compile subject template
          const subjectTemplate = handlebars.compile(templateConfig.subject);
          subject = subjectTemplate(templateData);
        }
      }

      const mailOptions: nodemailer.SendMailOptions = {
        from: {
          name: this.configService.get<string>('EMAIL_FROM_NAME', 'Carbon Recycling Platform'),
          address: this.configService.get<string>('EMAIL_FROM_ADDRESS', 'noreply@carbonrecycling.co.uk')
        },
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        cc: options.cc ? (Array.isArray(options.cc) ? options.cc.join(', ') : options.cc) : undefined,
        bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc) : undefined,
        subject,
        html,
        text: options.text,
        attachments: options.attachments,
        priority: options.priority || 'normal'
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      this.logger.log(`Email sent successfully to ${options.to}: ${result.messageId}`);
      return true;
      
    } catch (error) {
      this.logger.error('Failed to send email:', error);
      return false;
    }
  }

  /**
   * Send bulk emails with rate limiting
   */
  async sendBulkEmails(options: BulkEmailOptions): Promise<BulkEmailResult> {
    const batchSize = options.batchSize || 50;
    const results: BulkEmailResult = {
      total: options.recipients.length,
      sent: 0,
      failed: 0,
      errors: []
    };

    // Process in batches
    for (let i = 0; i < options.recipients.length; i += batchSize) {
      const batch = options.recipients.slice(i, i + batchSize);
      
      // Send batch concurrently
      const batchPromises = batch.map(async (recipient) => {
        const templateData = {
          ...options.globalData,
          ...recipient.data
        };

        try {
          const sent = await this.sendEmail({
            to: recipient.email,
            template: options.templateName,
            templateData
          });

          if (sent) {
            results.sent++;
          } else {
            results.failed++;
            results.errors.push({
              email: recipient.email,
              error: 'Failed to send email'
            });
          }
        } catch (error) {
          results.failed++;
          results.errors.push({
            email: recipient.email,
            error: error.message
          });
        }
      });

      await Promise.allSettled(batchPromises);
      
      // Add delay between batches to respect rate limits
      if (i + batchSize < options.recipients.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    this.logger.log(`Bulk email completed: ${results.sent}/${results.total} sent successfully`);
    return results;
  }

  /**
   * Send supplier invitation email
   */
  async sendSupplierInvitation(
    supplierEmail: string,
    organizationName: string,
    inviteCode: string,
    customMessage?: string
  ): Promise<boolean> {
    return this.sendEmail({
      to: supplierEmail,
      template: 'supplier-invitation',
      templateData: {
        organizationName,
        inviteCode,
        customMessage,
        inviteUrl: `${this.configService.get('FRONTEND_URL')}/supplier/register?code=${inviteCode}`
      }
    });
  }

  /**
   * Send data request notification
   */
  async sendDataRequest(
    supplierEmail: string,
    organizationName: string,
    requestDetails: {
      templates: string[];
      deadline: Date;
      customMessage?: string;
    }
  ): Promise<boolean> {
    return this.sendEmail({
      to: supplierEmail,
      template: 'data-request',
      templateData: {
        organizationName,
        templates: requestDetails.templates,
        deadline: requestDetails.deadline.toLocaleDateString(),
        customMessage: requestDetails.customMessage,
        loginUrl: `${this.configService.get('FRONTEND_URL')}/supplier/login`
      }
    });
  }

  /**
   * Send deadline reminder
   */
  async sendDeadlineReminder(
    supplierEmail: string,
    organizationName: string,
    daysRemaining: number,
    pendingSubmissions: string[]
  ): Promise<boolean> {
    return this.sendEmail({
      to: supplierEmail,
      template: 'deadline-reminder',
      templateData: {
        organizationName,
        daysRemaining,
        pendingSubmissions,
        urgency: daysRemaining <= 3 ? 'urgent' : daysRemaining <= 7 ? 'high' : 'normal',
        loginUrl: `${this.configService.get('FRONTEND_URL')}/supplier/login`
      }
    });
  }

  /**
   * Send submission confirmation
   */
  async sendSubmissionConfirmation(
    supplierEmail: string,
    organizationName: string,
    submissionDetails: {
      templateName: string;
      submittedAt: Date;
      referenceNumber: string;
    }
  ): Promise<boolean> {
    return this.sendEmail({
      to: supplierEmail,
      template: 'submission-received',
      templateData: {
        organizationName,
        templateName: submissionDetails.templateName,
        submittedAt: submissionDetails.submittedAt.toLocaleString(),
        referenceNumber: submissionDetails.referenceNumber
      }
    });
  }

  /**
   * Send approval notification
   */
  async sendApprovalNotification(
    supplierEmail: string,
    organizationName: string,
    submissionDetails: {
      templateName: string;
      approvedAt: Date;
      reviewNotes?: string;
    }
  ): Promise<boolean> {
    return this.sendEmail({
      to: supplierEmail,
      template: 'submission-approved',
      templateData: {
        organizationName,
        templateName: submissionDetails.templateName,
        approvedAt: submissionDetails.approvedAt.toLocaleString(),
        reviewNotes: submissionDetails.reviewNotes
      }
    });
  }

  /**
   * Send rejection notification
   */
  async sendRejectionNotification(
    supplierEmail: string,
    organizationName: string,
    submissionDetails: {
      templateName: string;
      rejectedAt: Date;
      reviewNotes: string;
    }
  ): Promise<boolean> {
    return this.sendEmail({
      to: supplierEmail,
      template: 'submission-rejected',
      templateData: {
        organizationName,
        templateName: submissionDetails.templateName,
        rejectedAt: submissionDetails.rejectedAt.toLocaleString(),
        reviewNotes: submissionDetails.reviewNotes,
        resubmitUrl: `${this.configService.get('FRONTEND_URL')}/supplier/submissions`
      }
    });
  }

  /**
   * Send initiative invitation
   */
  async sendInitiativeInvitation(
    organizationEmail: string,
    initiatorName: string,
    initiativeDetails: {
      name: string;
      description: string;
      targetEmissionReduction: number;
      targetCompletionDate: Date;
      inviteCode: string;
    }
  ): Promise<boolean> {
    return this.sendEmail({
      to: organizationEmail,
      template: 'initiative-invitation',
      templateData: {
        initiatorName,
        initiativeName: initiativeDetails.name,
        description: initiativeDetails.description,
        targetEmissionReduction: initiativeDetails.targetEmissionReduction,
        targetCompletionDate: initiativeDetails.targetCompletionDate.toLocaleDateString(),
        inviteUrl: `${this.configService.get('FRONTEND_URL')}/initiatives/invite?code=${initiativeDetails.inviteCode}`
      }
    });
  }

  /**
   * Send gap analysis completion notification
   */
  async sendGapAnalysisComplete(
    organizationEmail: string,
    analysisResults: {
      overallScore: string;
      totalRecommendations: number;
      highPriorityActions: number;
      complianceGaps: number;
    }
  ): Promise<boolean> {
    return this.sendEmail({
      to: organizationEmail,
      template: 'gap-analysis-complete',
      templateData: {
        overallScore: analysisResults.overallScore,
        totalRecommendations: analysisResults.totalRecommendations,
        highPriorityActions: analysisResults.highPriorityActions,
        complianceGaps: analysisResults.complianceGaps,
        dashboardUrl: `${this.configService.get('FRONTEND_URL')}/gap-analysis`
      }
    });
  }

  /**
   * Send compliance alert
   */
  async sendComplianceAlert(
    organizationEmail: string,
    alertDetails: {
      regulationType: string;
      deadline: Date;
      daysRemaining: number;
      actions: string[];
    }
  ): Promise<boolean> {
    return this.sendEmail({
      to: organizationEmail,
      template: 'compliance-alert',
      templateData: {
        regulationType: alertDetails.regulationType,
        deadline: alertDetails.deadline.toLocaleDateString(),
        daysRemaining: alertDetails.daysRemaining,
        actions: alertDetails.actions,
        severity: alertDetails.daysRemaining <= 30 ? 'urgent' : 'important',
        complianceUrl: `${this.configService.get('FRONTEND_URL')}/compliance`
      },
      priority: alertDetails.daysRemaining <= 30 ? 'high' : 'normal'
    });
  }

  /**
   * Schedule email to be sent later
   */
  async scheduleEmail(options: EmailOptions, sendAt: Date): Promise<string> {
    // This would integrate with a job queue like Bull or Agenda
    // For now, we'll store in database and process with cron
    // Return a schedule ID for tracking
    const scheduleId = `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store in database (would need to add email_schedule table)
    this.logger.log(`Email scheduled with ID ${scheduleId} for ${sendAt.toISOString()}`);
    
    return scheduleId;
  }

  /**
   * Get email sending statistics
   */
  async getEmailStats(organizationId?: string): Promise<EmailStats> {
    // This would query email logs from database
    // Mock implementation for now
    return {
      totalSent: 1250,
      totalFailed: 23,
      successRate: 98.2,
      lastSent: new Date(),
      bounceRate: 1.1,
      openRate: 68.5,
      clickRate: 12.3
    };
  }

  /**
   * Validate email template
   */
  async validateTemplate(templateName: string, testData: Record<string, any>): Promise<ValidationResult> {
    try {
      const template = this.templates.get(templateName);
      const templateConfig = this.templateConfigs.get(templateName);
      
      if (!template || !templateConfig) {
        return {
          isValid: false,
          error: 'Template not found'
        };
      }

      // Test compilation
      const html = template(testData);
      const subjectTemplate = handlebars.compile(templateConfig.subject);
      const subject = subjectTemplate(testData);

      return {
        isValid: true,
        previewHtml: html,
        previewSubject: subject
      };
      
    } catch (error) {
      return {
        isValid: false,
        error: error.message
      };
    }
  }
}

// Supporting interfaces
interface BulkEmailResult {
  total: number;
  sent: number;
  failed: number;
  errors: Array<{ email: string; error: string }>;
}

interface EmailStats {
  totalSent: number;
  totalFailed: number;
  successRate: number;
  lastSent: Date;
  bounceRate: number;
  openRate: number;
  clickRate: number;
}

interface ValidationResult {
  isValid: boolean;
  error?: string;
  previewHtml?: string;
  previewSubject?: string;
}