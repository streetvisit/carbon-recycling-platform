import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Supplier } from '../entities/supplier.entity';
import { Organization } from '../entities/organization.entity';
import { EmailService } from './email.service';
import { FileStorageService } from './file-storage.service';
import { SupplierRiskLevel, SupplierAssessmentStatus } from '../controllers/suppliers.controller';

// Interfaces
interface CreateSupplierDto {
  name: string;
  description?: string;
  industry: string;
  size?: string;
  country: string;
  email?: string;
  website?: string;
  contacts?: any[];
  riskLevel?: SupplierRiskLevel;
  metadata?: any;
  isActive?: boolean;
}

interface UpdateSupplierDto {
  name?: string;
  description?: string;
  industry?: string;
  size?: string;
  country?: string;
  email?: string;
  website?: string;
  contacts?: any[];
  riskLevel?: SupplierRiskLevel;
  metadata?: any;
  isActive?: boolean;
}

interface QuerySuppliersDto {
  page?: number;
  limit?: number;
  search?: string;
  industry?: string;
  country?: string;
  riskLevel?: SupplierRiskLevel;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  activeOnly?: boolean;
}

interface CreateAssessmentDto {
  title: string;
  description?: string;
  dueDate: string;
  assessmentCriteria?: any;
}

interface SupplierInviteDto {
  email: string;
  contactRole?: string;
  customMessage?: string;
}

@Injectable()
export class SuppliersService {
  private readonly logger = new Logger(SuppliersService.name);

  constructor(
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    private readonly emailService: EmailService,
    private readonly fileStorageService: FileStorageService,
  ) {}

  async findAll(organizationId: string, query: QuerySuppliersDto) {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        industry,
        country,
        riskLevel,
        sortBy = 'name',
        sortOrder = 'asc',
        activeOnly = false
      } = query;

      const queryBuilder = this.supplierRepository
        .createQueryBuilder('supplier')
        .where('supplier.organizationId = :organizationId', { organizationId })
        .andWhere('supplier.deletedAt IS NULL');

      // Apply active filter
      if (activeOnly) {
        queryBuilder.andWhere('supplier.isActive = true');
      }

      // Apply search filter
      if (search) {
        queryBuilder.andWhere(
          '(supplier.name ILIKE :search OR supplier.description ILIKE :search OR supplier.industry ILIKE :search)',
          { search: `%${search}%` }
        );
      }

      // Apply industry filter
      if (industry) {
        queryBuilder.andWhere('supplier.industry = :industry', { industry });
      }

      // Apply country filter
      if (country) {
        queryBuilder.andWhere('supplier.country = :country', { country });
      }

      // Apply risk level filter
      if (riskLevel) {
        queryBuilder.andWhere('supplier.riskLevel = :riskLevel', { riskLevel });
      }

      // Apply sorting
      const validSortFields = ['name', 'industry', 'country', 'riskLevel', 'createdAt'];
      const sortField = validSortFields.includes(sortBy) ? sortBy : 'name';
      queryBuilder.orderBy(`supplier.${sortField}`, sortOrder.toUpperCase() as 'ASC' | 'DESC');

      // Apply pagination
      const skip = (page - 1) * limit;
      queryBuilder.skip(skip).take(limit);

      const [suppliers, total] = await queryBuilder.getManyAndCount();

      return {
        data: suppliers,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error(`Failed to retrieve suppliers for organization ${organizationId}:`, error);
      throw new BadRequestException('Failed to retrieve suppliers');
    }
  }

  async findOne(id: string, organizationId: string): Promise<Supplier> {
    const supplier = await this.supplierRepository.findOne({
      where: {
        id,
        organizationId,
        deletedAt: null,
      },
      relations: ['organization'],
    });

    if (!supplier) {
      throw new NotFoundException(`Supplier with ID ${id} not found`);
    }

    return supplier;
  }

  async create(
    createSupplierDto: CreateSupplierDto,
    organizationId: string,
    userId: string,
  ): Promise<Supplier> {
    try {
      // Verify organization exists
      const organization = await this.organizationRepository.findOne({
        where: { id: organizationId },
      });

      if (!organization) {
        throw new NotFoundException(`Organization with ID ${organizationId} not found`);
      }

      // Check for duplicate supplier name in organization
      const existingSupplier = await this.supplierRepository.findOne({
        where: {
          name: createSupplierDto.name,
          organizationId,
          deletedAt: null,
        },
      });

      if (existingSupplier) {
        throw new BadRequestException(`Supplier with name "${createSupplierDto.name}" already exists`);
      }

      // Create supplier
      const supplier = this.supplierRepository.create({
        ...createSupplierDto,
        organizationId,
        createdBy: userId,
        riskLevel: createSupplierDto.riskLevel || SupplierRiskLevel.MEDIUM,
        isActive: createSupplierDto.isActive !== undefined ? createSupplierDto.isActive : true,
      });

      const savedSupplier = await this.supplierRepository.save(supplier);

      this.logger.log(`Supplier created: ${savedSupplier.id} by user: ${userId}`);

      return savedSupplier;
    } catch (error) {
      this.logger.error(`Failed to create supplier:`, error);
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to create supplier');
    }
  }

  async update(
    id: string,
    updateSupplierDto: UpdateSupplierDto,
    organizationId: string,
    userId: string,
  ): Promise<Supplier> {
    const supplier = await this.findOne(id, organizationId);

    try {
      // Check for duplicate name if name is being updated
      if (updateSupplierDto.name && updateSupplierDto.name !== supplier.name) {
        const existingSupplier = await this.supplierRepository.findOne({
          where: {
            name: updateSupplierDto.name,
            organizationId,
            deletedAt: null,
          },
        });

        if (existingSupplier && existingSupplier.id !== id) {
          throw new BadRequestException(`Supplier with name "${updateSupplierDto.name}" already exists`);
        }
      }

      // Update fields
      Object.assign(supplier, {
        ...updateSupplierDto,
        updatedBy: userId,
      });

      const savedSupplier = await this.supplierRepository.save(supplier);

      this.logger.log(`Supplier updated: ${id} by user: ${userId}`);

      return savedSupplier;
    } catch (error) {
      this.logger.error(`Failed to update supplier ${id}:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to update supplier');
    }
  }

  async remove(id: string, organizationId: string, userId: string): Promise<void> {
    const supplier = await this.findOne(id, organizationId);

    try {
      // Soft delete
      supplier.deletedAt = new Date();
      supplier.deletedBy = userId;
      supplier.isActive = false;

      await this.supplierRepository.save(supplier);

      this.logger.log(`Supplier soft deleted: ${id} by user: ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to delete supplier ${id}:`, error);
      throw new BadRequestException('Failed to delete supplier');
    }
  }

  async getAssessments(id: string, organizationId: string) {
    const supplier = await this.findOne(id, organizationId);

    try {
      // Mock implementation - replace with actual assessment data
      const assessments = [
        {
          id: '1',
          title: 'Annual Carbon Assessment 2024',
          description: 'Comprehensive carbon footprint assessment',
          status: SupplierAssessmentStatus.COMPLETED,
          dueDate: '2024-12-31',
          completedDate: '2024-11-15',
          score: 85,
          createdAt: new Date('2024-01-01'),
        },
        {
          id: '2',
          title: 'Sustainability Practices Review',
          description: 'Review of current sustainability practices',
          status: SupplierAssessmentStatus.IN_PROGRESS,
          dueDate: '2024-12-15',
          completedDate: null,
          score: null,
          createdAt: new Date('2024-10-01'),
        },
      ];

      return {
        supplierId: id,
        supplierName: supplier.name,
        assessments,
        summary: {
          total: assessments.length,
          completed: assessments.filter(a => a.status === SupplierAssessmentStatus.COMPLETED).length,
          inProgress: assessments.filter(a => a.status === SupplierAssessmentStatus.IN_PROGRESS).length,
          pending: assessments.filter(a => a.status === SupplierAssessmentStatus.PENDING).length,
          overdue: assessments.filter(a => a.status === SupplierAssessmentStatus.OVERDUE).length,
          averageScore: assessments.filter(a => a.score).reduce((sum, a) => sum + a.score, 0) / assessments.filter(a => a.score).length || 0,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get assessments for supplier ${id}:`, error);
      throw new BadRequestException('Failed to retrieve supplier assessments');
    }
  }

  async createAssessment(
    id: string,
    createAssessmentDto: CreateAssessmentDto,
    organizationId: string,
    userId: string,
  ) {
    const supplier = await this.findOne(id, organizationId);

    try {
      // Mock implementation - replace with actual assessment creation
      const assessment = {
        id: Date.now().toString(),
        supplierId: id,
        supplierName: supplier.name,
        title: createAssessmentDto.title,
        description: createAssessmentDto.description,
        dueDate: createAssessmentDto.dueDate,
        status: SupplierAssessmentStatus.PENDING,
        assessmentCriteria: createAssessmentDto.assessmentCriteria || {
          categories: ['emissions', 'energy', 'waste', 'water'],
          weights: {
            emissions: 0.4,
            energy: 0.3,
            waste: 0.2,
            water: 0.1,
          },
        },
        createdAt: new Date(),
        createdBy: userId,
      };

      this.logger.log(`Assessment created for supplier: ${id} by user: ${userId}`);

      // Send notification to supplier if email is available
      if (supplier.email) {
        try {
          await this.emailService.sendEmail({
            to: supplier.email,
            subject: `New Assessment: ${assessment.title}`,
            template: 'supplier-assessment-notification',
            context: {
              supplierName: supplier.name,
              assessmentTitle: assessment.title,
              dueDate: assessment.dueDate,
              organizationName: 'Carbon Platform', // You might want to get this from organization
            },
          });
        } catch (emailError) {
          this.logger.warn(`Failed to send assessment notification email:`, emailError);
          // Don't fail the assessment creation if email fails
        }
      }

      return assessment;
    } catch (error) {
      this.logger.error(`Failed to create assessment for supplier ${id}:`, error);
      throw new BadRequestException('Failed to create supplier assessment');
    }
  }

  async inviteSupplier(
    id: string,
    inviteDto: SupplierInviteDto,
    organizationId: string,
    userId: string,
  ) {
    const supplier = await this.findOne(id, organizationId);

    try {
      const invitationId = `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30 days expiration

      // Send invitation email
      await this.emailService.sendEmail({
        to: inviteDto.email,
        subject: 'Invitation to Join Carbon Recycling Platform',
        template: 'supplier-invitation',
        context: {
          supplierName: supplier.name,
          invitationId,
          expiresAt: expiresAt.toISOString(),
          contactRole: inviteDto.contactRole,
          customMessage: inviteDto.customMessage,
          platformUrl: process.env.FRONTEND_URL || 'https://platform.example.com',
        },
      });

      // Store invitation record (mock implementation)
      const invitation = {
        id: invitationId,
        supplierId: id,
        email: inviteDto.email,
        contactRole: inviteDto.contactRole,
        customMessage: inviteDto.customMessage,
        status: 'sent',
        sentAt: new Date(),
        expiresAt,
        createdBy: userId,
      };

      this.logger.log(`Supplier invitation sent: ${invitationId} to ${inviteDto.email} for supplier: ${id}`);

      return {
        message: 'Invitation sent successfully',
        invitationId,
        expiresAt,
      };
    } catch (error) {
      this.logger.error(`Failed to invite supplier ${id}:`, error);
      throw new BadRequestException('Failed to send supplier invitation');
    }
  }

  async getRiskAnalysis(id: string, organizationId: string) {
    const supplier = await this.findOne(id, organizationId);

    try {
      // Mock risk analysis implementation
      const riskAnalysis = {
        supplierId: id,
        riskLevel: supplier.riskLevel || SupplierRiskLevel.MEDIUM,
        riskScore: this.calculateRiskScore(supplier),
        riskFactors: {
          geographic: this.assessGeographicRisk(supplier.country),
          industry: this.assessIndustryRisk(supplier.industry),
          compliance: 0.7, // Mock compliance score
          financial: 0.6, // Mock financial risk
          environmental: 0.8, // Mock environmental risk
        },
        recommendations: this.generateRiskRecommendations(supplier),
        lastAnalyzed: new Date(),
      };

      return riskAnalysis;
    } catch (error) {
      this.logger.error(`Failed to get risk analysis for supplier ${id}:`, error);
      throw new BadRequestException('Failed to retrieve risk analysis');
    }
  }

  async getCarbonFootprint(id: string, organizationId: string, year?: number) {
    const supplier = await this.findOne(id, organizationId);

    try {
      const targetYear = year || new Date().getFullYear();

      // Mock carbon footprint data
      const carbonFootprint = {
        supplierId: id,
        supplierName: supplier.name,
        year: targetYear,
        data: {
          scope1: {
            total: 1250.5,
            unit: 'tCO2e',
            breakdown: {
              naturalGas: 850.2,
              dieselFuel: 400.3,
            },
          },
          scope2: {
            total: 2100.8,
            unit: 'tCO2e',
            breakdown: {
              electricity: 1800.5,
              steam: 300.3,
            },
          },
          scope3: {
            total: 5600.2,
            unit: 'tCO2e',
            breakdown: {
              transportation: 2100.5,
              materials: 2800.7,
              waste: 699.0,
            },
          },
        },
        total: 8951.5,
        trends: {
          previousYear: {
            total: 9200.3,
            change: -2.7, // percentage change
          },
          baseline: {
            year: 2020,
            total: 10500.0,
            change: -14.7,
          },
        },
        certifications: [
          'ISO 14001',
          'Carbon Neutral Certified',
        ],
        lastUpdated: new Date(),
      };

      return carbonFootprint;
    } catch (error) {
      this.logger.error(`Failed to get carbon footprint for supplier ${id}:`, error);
      throw new BadRequestException('Failed to retrieve carbon footprint data');
    }
  }

  async getAnalyticsOverview(organizationId: string) {
    try {
      // Get suppliers count and statistics
      const totalSuppliers = await this.supplierRepository.count({
        where: { organizationId, deletedAt: null },
      });

      const suppliersByRisk = await this.supplierRepository
        .createQueryBuilder('supplier')
        .select('supplier.riskLevel', 'riskLevel')
        .addSelect('COUNT(*)', 'count')
        .where('supplier.organizationId = :organizationId', { organizationId })
        .andWhere('supplier.deletedAt IS NULL')
        .groupBy('supplier.riskLevel')
        .getRawMany();

      const suppliersByIndustry = await this.supplierRepository
        .createQueryBuilder('supplier')
        .select('supplier.industry', 'industry')
        .addSelect('COUNT(*)', 'count')
        .where('supplier.organizationId = :organizationId', { organizationId })
        .andWhere('supplier.deletedAt IS NULL')
        .groupBy('supplier.industry')
        .getRawMany();

      const suppliersByCountry = await this.supplierRepository
        .createQueryBuilder('supplier')
        .select('supplier.country', 'country')
        .addSelect('COUNT(*)', 'count')
        .where('supplier.organizationId = :organizationId', { organizationId })
        .andWhere('supplier.deletedAt IS NULL')
        .groupBy('supplier.country')
        .getRawMany();

      // Convert arrays to objects
      const riskStats = suppliersByRisk.reduce((acc, item) => {
        acc[item.riskLevel] = parseInt(item.count);
        return acc;
      }, {});

      const industryStats = suppliersByIndustry.reduce((acc, item) => {
        acc[item.industry] = parseInt(item.count);
        return acc;
      }, {});

      const countryStats = suppliersByCountry.reduce((acc, item) => {
        acc[item.country] = parseInt(item.count);
        return acc;
      }, {});

      // Mock assessment stats and trends
      const assessmentStats = {
        pending: Math.floor(totalSuppliers * 0.2),
        inProgress: Math.floor(totalSuppliers * 0.3),
        completed: Math.floor(totalSuppliers * 0.4),
        overdue: Math.floor(totalSuppliers * 0.1),
      };

      const trends = [
        { month: 'Jan', suppliers: totalSuppliers - 50 },
        { month: 'Feb', suppliers: totalSuppliers - 40 },
        { month: 'Mar', suppliers: totalSuppliers - 30 },
        { month: 'Apr', suppliers: totalSuppliers - 20 },
        { month: 'May', suppliers: totalSuppliers - 10 },
        { month: 'Jun', suppliers: totalSuppliers },
      ];

      return {
        totalSuppliers,
        suppliersByRisk: riskStats,
        suppliersByIndustry: industryStats,
        suppliersByCountry: countryStats,
        assessmentStats,
        trends,
      };
    } catch (error) {
      this.logger.error(`Failed to get analytics overview for organization ${organizationId}:`, error);
      throw new BadRequestException('Failed to retrieve analytics overview');
    }
  }

  async exportSuppliers(organizationId: string, format: string, includeAssessments: boolean) {
    try {
      const suppliers = await this.supplierRepository.find({
        where: { organizationId, deletedAt: null },
        order: { name: 'ASC' },
      });

      const filename = `suppliers-${organizationId}-${Date.now()}.${format}`;
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours expiration

      // Mock file generation (replace with actual file generation logic)
      const downloadUrl = await this.fileStorageService.generatePresignedUrl(`exports/${filename}`);

      this.logger.log(`Export file generated: ${filename} for organization: ${organizationId}`);

      return {
        downloadUrl,
        filename,
        expiresAt,
      };
    } catch (error) {
      this.logger.error(`Failed to export suppliers for organization ${organizationId}:`, error);
      throw new BadRequestException('Failed to export suppliers');
    }
  }

  // Private helper methods
  private calculateRiskScore(supplier: Supplier): number {
    // Mock risk score calculation
    const factors = {
      geographic: this.assessGeographicRisk(supplier.country),
      industry: this.assessIndustryRisk(supplier.industry),
      compliance: 0.7,
      financial: 0.6,
      environmental: 0.8,
    };

    const weights = {
      geographic: 0.2,
      industry: 0.3,
      compliance: 0.2,
      financial: 0.15,
      environmental: 0.15,
    };

    const score = Object.keys(factors).reduce((sum, key) => {
      return sum + factors[key] * weights[key];
    }, 0);

    return Math.round(score * 100) / 100;
  }

  private assessGeographicRisk(country: string): number {
    // Mock geographic risk assessment
    const riskScores = {
      'USA': 0.3,
      'Canada': 0.2,
      'UK': 0.3,
      'Germany': 0.2,
      'France': 0.3,
      'China': 0.7,
      'India': 0.6,
      'Brazil': 0.5,
      'Russia': 0.8,
      'Mexico': 0.5,
    };

    return riskScores[country] || 0.5; // Default medium risk
  }

  private assessIndustryRisk(industry: string): number {
    // Mock industry risk assessment
    const riskScores = {
      'Manufacturing': 0.7,
      'Energy': 0.8,
      'Mining': 0.9,
      'Transportation': 0.6,
      'Technology': 0.3,
      'Agriculture': 0.5,
      'Construction': 0.6,
      'Chemicals': 0.8,
      'Textiles': 0.7,
    };

    return riskScores[industry] || 0.5; // Default medium risk
  }

  private generateRiskRecommendations(supplier: Supplier): string[] {
    const recommendations = [];

    // Generate recommendations based on risk factors
    if (this.assessGeographicRisk(supplier.country) > 0.6) {
      recommendations.push('Consider additional compliance monitoring due to geographic risk factors');
    }

    if (this.assessIndustryRisk(supplier.industry) > 0.7) {
      recommendations.push('Implement enhanced environmental monitoring for high-risk industry');
    }

    recommendations.push('Regular assessment updates recommended');
    recommendations.push('Consider sustainability certification programs');

    if (supplier.riskLevel === SupplierRiskLevel.HIGH || supplier.riskLevel === SupplierRiskLevel.CRITICAL) {
      recommendations.push('Priority supplier for enhanced monitoring and support');
    }

    return recommendations;
  }
}