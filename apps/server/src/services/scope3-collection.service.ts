import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

export interface Scope3Template {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  fields: Scope3Field[];
  calculationMethod: 'activity_based' | 'spend_based' | 'hybrid';
  emissionFactor?: number;
  unit: string;
  description: string;
}

export interface Scope3Field {
  id: string;
  name: string;
  type: 'number' | 'text' | 'select' | 'date' | 'file';
  required: boolean;
  unit?: string;
  options?: string[];
  validationRules?: ValidationRule[];
  helpText?: string;
}

export interface ValidationRule {
  type: 'min' | 'max' | 'range' | 'pattern' | 'custom';
  value: any;
  message: string;
}

export interface Scope3Submission {
  templateId: string;
  supplierId: string;
  organizationId: string;
  reportingYear: number;
  data: Record<string, any>;
  attachments?: string[];
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  calculatedEmissions?: number;
  validationErrors?: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

@Injectable()
export class Scope3CollectionService {
  private readonly logger = new Logger(Scope3CollectionService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get all available Scope 3 templates
   */
  async getTemplates(): Promise<Scope3Template[]> {
    return [
      {
        id: 'purchased-goods-services',
        name: 'Purchased Goods and Services',
        category: 'Category 1',
        subcategory: 'Upstream',
        calculationMethod: 'spend_based',
        unit: 'tCO2e',
        description: 'Emissions from production of purchased goods and services',
        fields: [
          {
            id: 'total_spend',
            name: 'Total Annual Spend',
            type: 'number',
            required: true,
            unit: 'GBP',
            validationRules: [
              { type: 'min', value: 0, message: 'Spend must be positive' }
            ],
            helpText: 'Total annual spend on goods and services from this supplier'
          },
          {
            id: 'spend_category',
            name: 'Spend Category',
            type: 'select',
            required: true,
            options: [
              'Raw Materials',
              'Components',
              'Services',
              'Software',
              'Equipment',
              'Other'
            ],
            helpText: 'Primary category of spend'
          },
          {
            id: 'supplier_scope12_intensity',
            name: 'Supplier Scope 1+2 Intensity',
            type: 'number',
            required: false,
            unit: 'tCO2e/£M',
            helpText: 'If known, supplier-specific emissions intensity'
          }
        ]
      },
      {
        id: 'business-travel',
        name: 'Business Travel',
        category: 'Category 6',
        subcategory: 'Upstream',
        calculationMethod: 'activity_based',
        unit: 'tCO2e',
        description: 'Emissions from business travel in vehicles not owned by the company',
        fields: [
          {
            id: 'flight_distance_domestic',
            name: 'Domestic Flight Distance',
            type: 'number',
            required: false,
            unit: 'km',
            helpText: 'Total distance for domestic flights'
          },
          {
            id: 'flight_distance_international',
            name: 'International Flight Distance',
            type: 'number',
            required: false,
            unit: 'km',
            helpText: 'Total distance for international flights'
          },
          {
            id: 'rail_distance',
            name: 'Rail Travel Distance',
            type: 'number',
            required: false,
            unit: 'km',
            helpText: 'Total distance traveled by rail'
          },
          {
            id: 'car_distance',
            name: 'Car Travel Distance',
            type: 'number',
            required: false,
            unit: 'km',
            helpText: 'Total distance traveled by car (not company owned)'
          },
          {
            id: 'accommodation_nights',
            name: 'Hotel Nights',
            type: 'number',
            required: false,
            unit: 'nights',
            helpText: 'Total nights in hotels/accommodation'
          }
        ]
      },
      {
        id: 'waste-generated',
        name: 'Waste Generated in Operations',
        category: 'Category 5',
        subcategory: 'Upstream',
        calculationMethod: 'activity_based',
        unit: 'tCO2e',
        description: 'Emissions from third-party disposal and treatment of waste',
        fields: [
          {
            id: 'general_waste',
            name: 'General Waste',
            type: 'number',
            required: false,
            unit: 'tonnes',
            helpText: 'Total general waste sent to landfill'
          },
          {
            id: 'recycled_waste',
            name: 'Recycled Waste',
            type: 'number',
            required: false,
            unit: 'tonnes',
            helpText: 'Total waste sent for recycling'
          },
          {
            id: 'organic_waste',
            name: 'Organic Waste',
            type: 'number',
            required: false,
            unit: 'tonnes',
            helpText: 'Total organic waste for composting/anaerobic digestion'
          },
          {
            id: 'hazardous_waste',
            name: 'Hazardous Waste',
            type: 'number',
            required: false,
            unit: 'tonnes',
            helpText: 'Total hazardous waste for specialist treatment'
          }
        ]
      },
      {
        id: 'upstream-transport',
        name: 'Upstream Transportation',
        category: 'Category 4',
        subcategory: 'Upstream',
        calculationMethod: 'activity_based',
        unit: 'tCO2e',
        description: 'Transportation of purchased goods from suppliers',
        fields: [
          {
            id: 'road_transport_distance',
            name: 'Road Transport Distance',
            type: 'number',
            required: false,
            unit: 'tonne-km',
            helpText: 'Total tonne-kilometres by road transport'
          },
          {
            id: 'rail_transport_distance',
            name: 'Rail Transport Distance',
            type: 'number',
            required: false,
            unit: 'tonne-km',
            helpText: 'Total tonne-kilometres by rail transport'
          },
          {
            id: 'sea_transport_distance',
            name: 'Sea Transport Distance',
            type: 'number',
            required: false,
            unit: 'tonne-km',
            helpText: 'Total tonne-kilometres by sea transport'
          },
          {
            id: 'air_transport_distance',
            name: 'Air Transport Distance',
            type: 'number',
            required: false,
            unit: 'tonne-km',
            helpText: 'Total tonne-kilometres by air transport'
          }
        ]
      }
    ];
  }

  /**
   * Create Scope 3 data request for suppliers
   */
  async createDataRequest(organizationId: string, supplierIds: string[], templateIds: string[], deadline: Date) {
    const dataRequest = await this.prisma.scope3DataRequest.create({
      data: {
        organizationId,
        templateIds,
        deadline,
        status: 'SENT',
        suppliers: {
          create: supplierIds.map(supplierId => ({
            supplierId,
            status: 'PENDING'
          }))
        }
      }
    });

    this.logger.log(`Created Scope 3 data request ${dataRequest.id} for ${supplierIds.length} suppliers`);
    return dataRequest;
  }

  /**
   * Submit Scope 3 data by supplier
   */
  async submitScope3Data(submission: Scope3Submission): Promise<any> {
    // Validate submission data
    const validationErrors = await this.validateSubmission(submission);
    
    if (validationErrors.length > 0 && validationErrors.some(e => e.severity === 'error')) {
      throw new Error(`Validation failed: ${validationErrors.map(e => e.message).join(', ')}`);
    }

    // Calculate emissions
    const calculatedEmissions = await this.calculateEmissions(submission);

    // Save submission
    const savedSubmission = await this.prisma.scope3Submission.create({
      data: {
        templateId: submission.templateId,
        supplierId: submission.supplierId,
        organizationId: submission.organizationId,
        reportingYear: submission.reportingYear,
        submissionData: submission.data as any,
        calculatedEmissions: new Decimal(calculatedEmissions),
        validationErrors: validationErrors as any,
        status: submission.status,
        attachments: submission.attachments || []
      }
    });

    this.logger.log(`Scope 3 submission created: ${savedSubmission.id}`);
    return savedSubmission;
  }

  /**
   * Validate submission data against template rules
   */
  private async validateSubmission(submission: Scope3Submission): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    const templates = await this.getTemplates();
    const template = templates.find(t => t.id === submission.templateId);

    if (!template) {
      errors.push({
        field: 'template',
        message: 'Invalid template ID',
        severity: 'error'
      });
      return errors;
    }

    // Validate each field
    for (const field of template.fields) {
      const value = submission.data[field.id];

      // Check required fields
      if (field.required && (value === undefined || value === null || value === '')) {
        errors.push({
          field: field.id,
          message: `${field.name} is required`,
          severity: 'error'
        });
        continue;
      }

      // Skip validation if field is not provided and not required
      if (!field.required && (value === undefined || value === null || value === '')) {
        continue;
      }

      // Type validation
      if (field.type === 'number' && isNaN(Number(value))) {
        errors.push({
          field: field.id,
          message: `${field.name} must be a valid number`,
          severity: 'error'
        });
        continue;
      }

      // Validation rules
      if (field.validationRules) {
        for (const rule of field.validationRules) {
          const numValue = Number(value);
          
          switch (rule.type) {
            case 'min':
              if (numValue < rule.value) {
                errors.push({
                  field: field.id,
                  message: rule.message,
                  severity: 'error'
                });
              }
              break;
            case 'max':
              if (numValue > rule.value) {
                errors.push({
                  field: field.id,
                  message: rule.message,
                  severity: 'error'
                });
              }
              break;
            case 'range':
              if (numValue < rule.value.min || numValue > rule.value.max) {
                errors.push({
                  field: field.id,
                  message: rule.message,
                  severity: 'error'
                });
              }
              break;
          }
        }
      }
    }

    // Business logic validations
    this.performBusinessValidations(submission, errors);

    return errors;
  }

  /**
   * Perform business logic validations
   */
  private performBusinessValidations(submission: Scope3Submission, errors: ValidationError[]) {
    // Check for suspicious values
    if (submission.templateId === 'purchased-goods-services') {
      const spend = Number(submission.data.total_spend);
      if (spend > 100000000) { // £100M
        errors.push({
          field: 'total_spend',
          message: 'Spend value appears unusually high - please verify',
          severity: 'warning'
        });
      }
    }

    // Check for consistency in travel data
    if (submission.templateId === 'business-travel') {
      const totalDistance = 
        (Number(submission.data.flight_distance_domestic) || 0) +
        (Number(submission.data.flight_distance_international) || 0) +
        (Number(submission.data.rail_distance) || 0) +
        (Number(submission.data.car_distance) || 0);

      const hotelNights = Number(submission.data.accommodation_nights) || 0;

      if (totalDistance > 100000 && hotelNights === 0) {
        errors.push({
          field: 'accommodation_nights',
          message: 'High travel distance but no accommodation - please verify',
          severity: 'warning'
        });
      }
    }
  }

  /**
   * Calculate emissions based on template and data
   */
  private async calculateEmissions(submission: Scope3Submission): Promise<number> {
    const templates = await this.getTemplates();
    const template = templates.find(t => t.id === submission.templateId);
    
    if (!template) {
      throw new Error('Template not found');
    }

    let totalEmissions = 0;

    switch (submission.templateId) {
      case 'purchased-goods-services':
        totalEmissions = await this.calculatePurchasedGoodsEmissions(submission);
        break;
      case 'business-travel':
        totalEmissions = await this.calculateBusinessTravelEmissions(submission);
        break;
      case 'waste-generated':
        totalEmissions = await this.calculateWasteEmissions(submission);
        break;
      case 'upstream-transport':
        totalEmissions = await this.calculateTransportEmissions(submission);
        break;
      default:
        this.logger.warn(`No calculation method for template: ${submission.templateId}`);
    }

    return totalEmissions;
  }

  /**
   * Calculate purchased goods and services emissions
   */
  private async calculatePurchasedGoodsEmissions(submission: Scope3Submission): Promise<number> {
    const spend = Number(submission.data.total_spend) || 0;
    const customIntensity = Number(submission.data.supplier_scope12_intensity);
    
    // Use supplier-specific intensity if available, otherwise use category averages
    let emissionFactor = customIntensity;
    
    if (!emissionFactor) {
      // Default emission factors by spend category (tCO2e per £M)
      const categoryFactors = {
        'Raw Materials': 450,
        'Components': 380,
        'Services': 120,
        'Software': 85,
        'Equipment': 320,
        'Other': 250
      };
      
      const category = submission.data.spend_category || 'Other';
      emissionFactor = categoryFactors[category] || categoryFactors['Other'];
    }

    return (spend / 1000000) * emissionFactor; // Convert to £M and multiply by factor
  }

  /**
   * Calculate business travel emissions
   */
  private async calculateBusinessTravelEmissions(submission: Scope3Submission): Promise<number> {
    let totalEmissions = 0;

    // Flight emissions (kg CO2e per km)
    const domesticFlights = Number(submission.data.flight_distance_domestic) || 0;
    const internationalFlights = Number(submission.data.flight_distance_international) || 0;
    totalEmissions += domesticFlights * 0.25; // Short-haul factor
    totalEmissions += internationalFlights * 0.15; // Long-haul factor

    // Rail emissions (kg CO2e per km)
    const railDistance = Number(submission.data.rail_distance) || 0;
    totalEmissions += railDistance * 0.041;

    // Car emissions (kg CO2e per km)
    const carDistance = Number(submission.data.car_distance) || 0;
    totalEmissions += carDistance * 0.171;

    // Hotel emissions (kg CO2e per night)
    const hotelNights = Number(submission.data.accommodation_nights) || 0;
    totalEmissions += hotelNights * 26.4;

    return totalEmissions / 1000; // Convert kg to tonnes
  }

  /**
   * Calculate waste emissions
   */
  private async calculateWasteEmissions(submission: Scope3Submission): Promise<number> {
    let totalEmissions = 0;

    // Emission factors (tCO2e per tonne waste)
    const generalWaste = Number(submission.data.general_waste) || 0;
    totalEmissions += generalWaste * 0.52; // Landfill factor

    const recycledWaste = Number(submission.data.recycled_waste) || 0;
    totalEmissions += recycledWaste * 0.15; // Recycling factor

    const organicWaste = Number(submission.data.organic_waste) || 0;
    totalEmissions += organicWaste * 0.08; // Composting factor

    const hazardousWaste = Number(submission.data.hazardous_waste) || 0;
    totalEmissions += hazardousWaste * 1.2; // Hazardous treatment factor

    return totalEmissions;
  }

  /**
   * Calculate transport emissions
   */
  private async calculateTransportEmissions(submission: Scope3Submission): Promise<number> {
    let totalEmissions = 0;

    // Transport emission factors (kg CO2e per tonne-km)
    const roadTransport = Number(submission.data.road_transport_distance) || 0;
    totalEmissions += roadTransport * 0.112;

    const railTransport = Number(submission.data.rail_transport_distance) || 0;
    totalEmissions += railTransport * 0.028;

    const seaTransport = Number(submission.data.sea_transport_distance) || 0;
    totalEmissions += seaTransport * 0.015;

    const airTransport = Number(submission.data.air_transport_distance) || 0;
    totalEmissions += airTransport * 1.5;

    return totalEmissions / 1000; // Convert kg to tonnes
  }

  /**
   * Get supplier submissions for organization
   */
  async getSupplierSubmissions(organizationId: string, filters?: {
    supplierId?: string;
    templateId?: string;
    status?: string;
    reportingYear?: number;
  }) {
    const where: any = { organizationId };
    
    if (filters?.supplierId) where.supplierId = filters.supplierId;
    if (filters?.templateId) where.templateId = filters.templateId;
    if (filters?.status) where.status = filters.status;
    if (filters?.reportingYear) where.reportingYear = filters.reportingYear;

    return this.prisma.scope3Submission.findMany({
      where,
      include: {
        supplier: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  /**
   * Approve supplier submission
   */
  async approveSubmission(submissionId: string, reviewNotes?: string) {
    return this.prisma.scope3Submission.update({
      where: { id: submissionId },
      data: {
        status: 'APPROVED',
        reviewNotes,
        reviewedAt: new Date()
      }
    });
  }

  /**
   * Reject supplier submission
   */
  async rejectSubmission(submissionId: string, reviewNotes: string) {
    return this.prisma.scope3Submission.update({
      where: { id: submissionId },
      data: {
        status: 'REJECTED',
        reviewNotes,
        reviewedAt: new Date()
      }
    });
  }

  /**
   * Get aggregated Scope 3 emissions for organization
   */
  async getAggregatedEmissions(organizationId: string, reportingYear: number) {
    const submissions = await this.prisma.scope3Submission.findMany({
      where: {
        organizationId,
        reportingYear,
        status: 'APPROVED'
      }
    });

    const emissionsByCategory = {};
    let totalEmissions = 0;

    for (const submission of submissions) {
      const emissions = submission.calculatedEmissions.toNumber();
      totalEmissions += emissions;

      if (!emissionsByCategory[submission.templateId]) {
        emissionsByCategory[submission.templateId] = 0;
      }
      emissionsByCategory[submission.templateId] += emissions;
    }

    return {
      totalEmissions,
      emissionsByCategory,
      submissionCount: submissions.length,
      reportingYear
    };
  }

  /**
   * Get data quality metrics
   */
  async getDataQualityMetrics(organizationId: string) {
    const submissions = await this.prisma.scope3Submission.findMany({
      where: { organizationId }
    });

    const totalSubmissions = submissions.length;
    const completeSubmissions = submissions.filter(s => !s.validationErrors || s.validationErrors.length === 0).length;
    const approvedSubmissions = submissions.filter(s => s.status === 'APPROVED').length;
    
    const qualityScore = totalSubmissions > 0 
      ? Math.round(((completeSubmissions * 0.6) + (approvedSubmissions * 0.4)) / totalSubmissions * 100)
      : 0;

    return {
      totalSubmissions,
      completeSubmissions,
      approvedSubmissions,
      qualityScore,
      completionRate: totalSubmissions > 0 ? Math.round(completeSubmissions / totalSubmissions * 100) : 0,
      approvalRate: totalSubmissions > 0 ? Math.round(approvedSubmissions / totalSubmissions * 100) : 0
    };
  }
}