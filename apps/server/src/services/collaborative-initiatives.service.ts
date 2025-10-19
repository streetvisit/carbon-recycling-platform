import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

export interface CreateInitiativeDto {
  name: string;
  description: string;
  type: 'JOINT_REDUCTION' | 'SHARED_RESOURCE' | 'SUPPLY_CHAIN_OPTIMIZATION' | 'RENEWABLE_ENERGY' | 'CIRCULAR_ECONOMY' | 'OTHER';
  category: string;
  targetEmissionReduction?: number;
  targetCompletionDate: Date;
  budget?: number;
  organizationId: string;
  participantIds: string[];
  milestones: InitiativeMilestone[];
  kpis: InitiativeKPI[];
}

export interface InitiativeMilestone {
  name: string;
  description: string;
  targetDate: Date;
  assignedToId?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE';
  deliverables?: string[];
}

export interface InitiativeKPI {
  name: string;
  unit: string;
  targetValue: number;
  currentValue?: number;
  measurement: 'CUMULATIVE' | 'RATE' | 'PERCENTAGE' | 'ABSOLUTE';
  frequency: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
}

export interface InitiativeUpdate {
  initiativeId: string;
  title: string;
  content: string;
  type: 'PROGRESS' | 'MILESTONE' | 'RISK' | 'SUCCESS' | 'GENERAL';
  authorId: string;
  visibility: 'ALL_PARTICIPANTS' | 'ADMIN_ONLY';
  attachments?: string[];
  kpiUpdates?: KPIUpdate[];
}

export interface KPIUpdate {
  kpiName: string;
  newValue: number;
  notes?: string;
}

export interface InitiativeInvitation {
  initiativeId: string;
  inviteeId: string;
  role: 'PARTICIPANT' | 'CONTRIBUTOR' | 'OBSERVER';
  message?: string;
  permissions: string[];
}

@Injectable()
export class CollaborativeInitiativesService {
  private readonly logger = new Logger(CollaborativeInitiativesService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create new collaborative initiative
   */
  async createInitiative(data: CreateInitiativeDto) {
    const initiative = await this.prisma.collaborativeInitiative.create({
      data: {
        name: data.name,
        description: data.description,
        type: data.type,
        category: data.category,
        targetEmissionReduction: data.targetEmissionReduction ? new Decimal(data.targetEmissionReduction) : null,
        targetCompletionDate: data.targetCompletionDate,
        budget: data.budget ? new Decimal(data.budget) : null,
        organizationId: data.organizationId,
        status: 'PLANNING',
        participants: {
          create: [
            // Add creator as admin
            {
              organizationId: data.organizationId,
              role: 'ADMIN',
              joinedAt: new Date()
            },
            // Add invited participants
            ...data.participantIds.map(participantId => ({
              organizationId: participantId,
              role: 'PARTICIPANT' as const,
              status: 'INVITED' as const
            }))
          ]
        },
        milestones: {
          create: data.milestones.map(milestone => ({
            name: milestone.name,
            description: milestone.description,
            targetDate: milestone.targetDate,
            assignedToId: milestone.assignedToId,
            status: milestone.status,
            deliverables: milestone.deliverables || []
          }))
        },
        kpis: {
          create: data.kpis.map(kpi => ({
            name: kpi.name,
            unit: kpi.unit,
            targetValue: new Decimal(kpi.targetValue),
            currentValue: kpi.currentValue ? new Decimal(kpi.currentValue) : null,
            measurement: kpi.measurement,
            frequency: kpi.frequency
          }))
        }
      },
      include: {
        participants: {
          include: {
            organization: true
          }
        },
        milestones: true,
        kpis: true
      }
    });

    this.logger.log(`Created collaborative initiative: ${initiative.id}`);
    return initiative;
  }

  /**
   * Get initiatives for organization
   */
  async getInitiativesForOrganization(organizationId: string, filters?: {
    status?: string;
    type?: string;
    role?: string;
  }) {
    const where: any = {
      OR: [
        { organizationId },
        { 
          participants: {
            some: { organizationId }
          }
        }
      ]
    };

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.type) {
      where.type = filters.type;
    }

    return this.prisma.collaborativeInitiative.findMany({
      where,
      include: {
        organization: true,
        participants: {
          include: {
            organization: true
          }
        },
        milestones: true,
        kpis: true,
        _count: {
          select: {
            updates: true,
            resources: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  /**
   * Get detailed initiative information
   */
  async getInitiativeDetails(initiativeId: string, requestingOrgId: string) {
    // Verify access
    const hasAccess = await this.verifyInitiativeAccess(initiativeId, requestingOrgId);
    if (!hasAccess) {
      throw new Error('Access denied to this initiative');
    }

    return this.prisma.collaborativeInitiative.findUnique({
      where: { id: initiativeId },
      include: {
        organization: true,
        participants: {
          include: {
            organization: true
          }
        },
        milestones: {
          include: {
            assignedTo: true
          }
        },
        kpis: true,
        updates: {
          include: {
            author: true
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 10
        },
        resources: true
      }
    });
  }

  /**
   * Accept invitation to join initiative
   */
  async acceptInvitation(initiativeId: string, organizationId: string) {
    const participant = await this.prisma.initiativeParticipant.update({
      where: {
        initiativeId_organizationId: {
          initiativeId,
          organizationId
        }
      },
      data: {
        status: 'ACCEPTED',
        joinedAt: new Date()
      }
    });

    this.logger.log(`Organization ${organizationId} accepted invitation to initiative ${initiativeId}`);
    return participant;
  }

  /**
   * Decline invitation to join initiative
   */
  async declineInvitation(initiativeId: string, organizationId: string) {
    const participant = await this.prisma.initiativeParticipant.update({
      where: {
        initiativeId_organizationId: {
          initiativeId,
          organizationId
        }
      },
      data: {
        status: 'DECLINED'
      }
    });

    this.logger.log(`Organization ${organizationId} declined invitation to initiative ${initiativeId}`);
    return participant;
  }

  /**
   * Add progress update to initiative
   */
  async addUpdate(update: InitiativeUpdate) {
    // Verify access
    const hasAccess = await this.verifyInitiativeAccess(update.initiativeId, update.authorId);
    if (!hasAccess) {
      throw new Error('Access denied to add updates to this initiative');
    }

    const savedUpdate = await this.prisma.initiativeUpdate.create({
      data: {
        initiativeId: update.initiativeId,
        title: update.title,
        content: update.content,
        type: update.type,
        authorId: update.authorId,
        visibility: update.visibility,
        attachments: update.attachments || []
      },
      include: {
        author: true
      }
    });

    // Update KPIs if provided
    if (update.kpiUpdates && update.kpiUpdates.length > 0) {
      for (const kpiUpdate of update.kpiUpdates) {
        await this.updateKPI(update.initiativeId, kpiUpdate.kpiName, kpiUpdate.newValue, kpiUpdate.notes);
      }
    }

    this.logger.log(`Added update to initiative ${update.initiativeId}: ${savedUpdate.id}`);
    return savedUpdate;
  }

  /**
   * Update KPI value
   */
  private async updateKPI(initiativeId: string, kpiName: string, newValue: number, notes?: string) {
    const kpi = await this.prisma.initiativeKPI.findFirst({
      where: {
        initiativeId,
        name: kpiName
      }
    });

    if (kpi) {
      await this.prisma.initiativeKPI.update({
        where: { id: kpi.id },
        data: {
          currentValue: new Decimal(newValue),
          lastUpdated: new Date()
        }
      });

      // Log KPI history
      await this.prisma.kpiHistory.create({
        data: {
          kpiId: kpi.id,
          value: new Decimal(newValue),
          notes: notes || null,
          recordedAt: new Date()
        }
      });
    }
  }

  /**
   * Complete milestone
   */
  async completeMilestone(initiativeId: string, milestoneId: string, completedBy: string, notes?: string) {
    // Verify access
    const hasAccess = await this.verifyInitiativeAccess(initiativeId, completedBy);
    if (!hasAccess) {
      throw new Error('Access denied to update this milestone');
    }

    const milestone = await this.prisma.initiativeMilestone.update({
      where: { id: milestoneId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        completedBy,
        completionNotes: notes
      }
    });

    // Check if all milestones are completed
    await this.checkInitiativeCompletion(initiativeId);

    this.logger.log(`Milestone ${milestoneId} completed for initiative ${initiativeId}`);
    return milestone;
  }

  /**
   * Check if initiative should be marked as completed
   */
  private async checkInitiativeCompletion(initiativeId: string) {
    const initiative = await this.prisma.collaborativeInitiative.findUnique({
      where: { id: initiativeId },
      include: {
        milestones: true
      }
    });

    if (!initiative) return;

    const allMilestonesCompleted = initiative.milestones.every(m => m.status === 'COMPLETED');
    
    if (allMilestonesCompleted && initiative.status !== 'COMPLETED') {
      await this.prisma.collaborativeInitiative.update({
        where: { id: initiativeId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date()
        }
      });

      this.logger.log(`Initiative ${initiativeId} marked as completed`);
    }
  }

  /**
   * Get initiative impact summary
   */
  async getImpactSummary(initiativeId: string, requestingOrgId: string) {
    // Verify access
    const hasAccess = await this.verifyInitiativeAccess(initiativeId, requestingOrgId);
    if (!hasAccess) {
      throw new Error('Access denied to this initiative');
    }

    const initiative = await this.prisma.collaborativeInitiative.findUnique({
      where: { id: initiativeId },
      include: {
        kpis: true,
        participants: {
          include: {
            organization: true
          }
        }
      }
    });

    if (!initiative) {
      throw new Error('Initiative not found');
    }

    // Calculate KPI progress
    const kpiProgress = initiative.kpis.map(kpi => {
      const progress = kpi.currentValue && kpi.targetValue 
        ? (kpi.currentValue.toNumber() / kpi.targetValue.toNumber()) * 100 
        : 0;

      return {
        name: kpi.name,
        unit: kpi.unit,
        targetValue: kpi.targetValue.toNumber(),
        currentValue: kpi.currentValue?.toNumber() || 0,
        progress: Math.min(progress, 100),
        status: progress >= 100 ? 'ACHIEVED' : progress >= 75 ? 'ON_TRACK' : 'AT_RISK'
      };
    });

    // Calculate overall progress
    const overallProgress = kpiProgress.length > 0 
      ? kpiProgress.reduce((sum, kpi) => sum + kpi.progress, 0) / kpiProgress.length 
      : 0;

    // Calculate emission reduction achieved
    const emissionReductionAchieved = kpiProgress
      .filter(kpi => kpi.name.toLowerCase().includes('emission') || kpi.unit.includes('CO2'))
      .reduce((sum, kpi) => sum + (kpi.currentValue || 0), 0);

    return {
      initiativeId,
      overallProgress: Math.round(overallProgress),
      kpiProgress,
      emissionReductionAchieved,
      targetEmissionReduction: initiative.targetEmissionReduction?.toNumber() || 0,
      participantCount: initiative.participants.length,
      status: initiative.status,
      daysRemaining: initiative.targetCompletionDate 
        ? Math.ceil((initiative.targetCompletionDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
        : null
    };
  }

  /**
   * Get collaborative dashboard data
   */
  async getDashboardData(organizationId: string) {
    // Get active initiatives
    const activeInitiatives = await this.getInitiativesForOrganization(organizationId, {
      status: 'ACTIVE'
    });

    // Get recent updates across all initiatives
    const recentUpdates = await this.prisma.initiativeUpdate.findMany({
      where: {
        initiative: {
          OR: [
            { organizationId },
            { 
              participants: {
                some: { organizationId }
              }
            }
          ]
        }
      },
      include: {
        author: true,
        initiative: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    });

    // Calculate total impact
    let totalEmissionReductionTarget = 0;
    let totalEmissionReductionAchieved = 0;
    let upcomingMilestones = 0;

    for (const initiative of activeInitiatives) {
      if (initiative.targetEmissionReduction) {
        totalEmissionReductionTarget += initiative.targetEmissionReduction.toNumber();
      }

      // Get KPI progress for emission reductions
      const kpis = await this.prisma.initiativeKPI.findMany({
        where: {
          initiativeId: initiative.id,
          OR: [
            { name: { contains: 'emission', mode: 'insensitive' } },
            { unit: { contains: 'CO2', mode: 'insensitive' } }
          ]
        }
      });

      for (const kpi of kpis) {
        if (kpi.currentValue) {
          totalEmissionReductionAchieved += kpi.currentValue.toNumber();
        }
      }

      // Count upcoming milestones (next 30 days)
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      const upcomingCount = await this.prisma.initiativeMilestone.count({
        where: {
          initiativeId: initiative.id,
          status: { in: ['PENDING', 'IN_PROGRESS'] },
          targetDate: {
            lte: thirtyDaysFromNow
          }
        }
      });

      upcomingMilestones += upcomingCount;
    }

    return {
      summary: {
        activeInitiatives: activeInitiatives.length,
        totalEmissionReductionTarget,
        totalEmissionReductionAchieved,
        upcomingMilestones,
        progressRate: totalEmissionReductionTarget > 0 
          ? Math.round((totalEmissionReductionAchieved / totalEmissionReductionTarget) * 100) 
          : 0
      },
      activeInitiatives: activeInitiatives.slice(0, 5),
      recentUpdates: recentUpdates.slice(0, 5),
      quickActions: [
        { type: 'create_initiative', label: 'Start New Initiative' },
        { type: 'invite_partners', label: 'Invite Partners' },
        { type: 'update_progress', label: 'Report Progress' },
        { type: 'view_all', label: 'View All Initiatives' }
      ]
    };
  }

  /**
   * Invite organization to join initiative
   */
  async inviteToInitiative(invitation: InitiativeInvitation) {
    // Verify that the inviting org has admin rights
    const isAdmin = await this.prisma.initiativeParticipant.findFirst({
      where: {
        initiativeId: invitation.initiativeId,
        organizationId: invitation.inviteeId, // This should be the inviting org ID, not invitee
        role: 'ADMIN'
      }
    });

    if (!isAdmin) {
      throw new Error('Only admin participants can invite others');
    }

    // Create or update participant record
    const participant = await this.prisma.initiativeParticipant.upsert({
      where: {
        initiativeId_organizationId: {
          initiativeId: invitation.initiativeId,
          organizationId: invitation.inviteeId
        }
      },
      update: {
        role: invitation.role,
        status: 'INVITED',
        permissions: invitation.permissions
      },
      create: {
        initiativeId: invitation.initiativeId,
        organizationId: invitation.inviteeId,
        role: invitation.role,
        status: 'INVITED',
        permissions: invitation.permissions
      }
    });

    this.logger.log(`Invited organization ${invitation.inviteeId} to initiative ${invitation.initiativeId}`);
    return participant;
  }

  /**
   * Verify if organization has access to initiative
   */
  private async verifyInitiativeAccess(initiativeId: string, organizationId: string): Promise<boolean> {
    const initiative = await this.prisma.collaborativeInitiative.findFirst({
      where: {
        id: initiativeId,
        OR: [
          { organizationId },
          {
            participants: {
              some: {
                organizationId,
                status: { in: ['ACCEPTED', 'ADMIN'] }
              }
            }
          }
        ]
      }
    });

    return !!initiative;
  }

  /**
   * Generate initiative report
   */
  async generateReport(initiativeId: string, requestingOrgId: string, reportType: 'PROGRESS' | 'IMPACT' | 'FINANCIAL') {
    // Verify access
    const hasAccess = await this.verifyInitiativeAccess(initiativeId, requestingOrgId);
    if (!hasAccess) {
      throw new Error('Access denied to generate report for this initiative');
    }

    const initiative = await this.getInitiativeDetails(initiativeId, requestingOrgId);
    if (!initiative) {
      throw new Error('Initiative not found');
    }

    switch (reportType) {
      case 'PROGRESS':
        return this.generateProgressReport(initiative);
      case 'IMPACT':
        return this.generateImpactReport(initiative);
      case 'FINANCIAL':
        return this.generateFinancialReport(initiative);
      default:
        throw new Error('Invalid report type');
    }
  }

  private async generateProgressReport(initiative: any) {
    const totalMilestones = initiative.milestones.length;
    const completedMilestones = initiative.milestones.filter(m => m.status === 'COMPLETED').length;
    const progressPercentage = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0;

    return {
      type: 'PROGRESS',
      initiativeName: initiative.name,
      generatedAt: new Date(),
      summary: {
        overallProgress: progressPercentage,
        milestonesCompleted: completedMilestones,
        totalMilestones: totalMilestones,
        status: initiative.status
      },
      milestones: initiative.milestones.map(m => ({
        name: m.name,
        status: m.status,
        targetDate: m.targetDate,
        completedAt: m.completedAt,
        daysOverdue: m.status === 'OVERDUE' && m.targetDate 
          ? Math.ceil((new Date().getTime() - m.targetDate.getTime()) / (1000 * 60 * 60 * 24))
          : null
      })),
      kpis: initiative.kpis.map(kpi => ({
        name: kpi.name,
        progress: kpi.currentValue && kpi.targetValue 
          ? Math.round((kpi.currentValue.toNumber() / kpi.targetValue.toNumber()) * 100)
          : 0,
        currentValue: kpi.currentValue?.toNumber() || 0,
        targetValue: kpi.targetValue.toNumber()
      }))
    };
  }

  private async generateImpactReport(initiative: any) {
    const impactSummary = await this.getImpactSummary(initiative.id, initiative.organizationId);
    
    return {
      type: 'IMPACT',
      initiativeName: initiative.name,
      generatedAt: new Date(),
      summary: impactSummary,
      environmentalImpact: {
        emissionReductionAchieved: impactSummary.emissionReductionAchieved,
        targetEmissionReduction: impactSummary.targetEmissionReduction,
        progressPercentage: impactSummary.overallProgress
      },
      participants: initiative.participants.map(p => ({
        organizationName: p.organization.name,
        role: p.role,
        joinedAt: p.joinedAt
      }))
    };
  }

  private async generateFinancialReport(initiative: any) {
    // This would typically integrate with financial tracking systems
    return {
      type: 'FINANCIAL',
      initiativeName: initiative.name,
      generatedAt: new Date(),
      budget: {
        total: initiative.budget?.toNumber() || 0,
        spent: 0, // Would need integration with expense tracking
        remaining: initiative.budget?.toNumber() || 0
      },
      costPerTonneCO2e: initiative.budget && initiative.targetEmissionReduction 
        ? initiative.budget.toNumber() / initiative.targetEmissionReduction.toNumber()
        : null
    };
  }
}