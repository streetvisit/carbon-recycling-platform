import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
  Logger,
  ParseUUIDPipe,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiProperty,
} from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsNumber, IsBoolean, IsEmail, Min, Max, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { GetUser } from '../decorators/get-user.decorator';
import { SuppliersService } from '../services/suppliers.service';

// Enums
export enum SupplierRiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum SupplierAssessmentStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  OVERDUE = 'overdue',
}

export enum SupplierCertificationStatus {
  NONE = 'none',
  PENDING = 'pending',
  CERTIFIED = 'certified',
  EXPIRED = 'expired',
}

// DTOs
class SupplierContactDto {
  @ApiProperty({ example: 'John Smith' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'john.smith@supplier.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '+1-555-0123' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'Sustainability Manager' })
  @IsOptional()
  @IsString()
  role?: string;
}

class CreateSupplierDto {
  @ApiProperty({ example: 'Acme Manufacturing Inc.' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Leading manufacturing company specializing in sustainable products' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'Manufacturing' })
  @IsString()
  industry: string;

  @ApiProperty({ example: 'Large' })
  @IsOptional()
  @IsString()
  size?: string;

  @ApiProperty({ example: 'USA' })
  @IsString()
  country: string;

  @ApiProperty({ example: 'info@acmemanufacturing.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: 'https://www.acmemanufacturing.com' })
  @IsOptional()
  @IsString()
  website?: string;

  @ApiProperty({ type: [SupplierContactDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SupplierContactDto)
  contacts?: SupplierContactDto[];

  @ApiProperty({ enum: SupplierRiskLevel, example: SupplierRiskLevel.MEDIUM })
  @IsOptional()
  @IsEnum(SupplierRiskLevel)
  riskLevel?: SupplierRiskLevel = SupplierRiskLevel.MEDIUM;

  @ApiProperty({ example: { annualRevenue: '10M-50M', employeeCount: '500-1000' } })
  @IsOptional()
  metadata?: any;

  @ApiProperty({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}

class UpdateSupplierDto {
  @ApiProperty({ example: 'Updated Supplier Name', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: 'Updated description', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'Technology', required: false })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiProperty({ example: 'Medium', required: false })
  @IsOptional()
  @IsString()
  size?: string;

  @ApiProperty({ example: 'Canada', required: false })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiProperty({ example: 'contact@supplier.com', required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: 'https://www.supplier.com', required: false })
  @IsOptional()
  @IsString()
  website?: string;

  @ApiProperty({ type: [SupplierContactDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SupplierContactDto)
  contacts?: SupplierContactDto[];

  @ApiProperty({ enum: SupplierRiskLevel, required: false })
  @IsOptional()
  @IsEnum(SupplierRiskLevel)
  riskLevel?: SupplierRiskLevel;

  @ApiProperty({ required: false })
  @IsOptional()
  metadata?: any;

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class QuerySuppliersDto {
  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ example: 10, required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiProperty({ example: 'manufacturing', required: false })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ example: 'Manufacturing', required: false })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiProperty({ example: 'USA', required: false })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiProperty({ enum: SupplierRiskLevel, required: false })
  @IsOptional()
  @IsEnum(SupplierRiskLevel)
  riskLevel?: SupplierRiskLevel;

  @ApiProperty({ example: 'name', enum: ['name', 'industry', 'country', 'riskLevel', 'createdAt'], required: false })
  @IsOptional()
  @IsString()
  sortBy?: string = 'name';

  @ApiProperty({ example: 'asc', enum: ['asc', 'desc'], required: false })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'asc';

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  activeOnly?: boolean;
}

class CreateAssessmentDto {
  @ApiProperty({ example: 'Annual Carbon Assessment 2024' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'Annual assessment of carbon footprint and sustainability practices' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: '2024-12-31' })
  @IsString()
  dueDate: string;

  @ApiProperty({ example: { categories: ['emissions', 'energy', 'waste'], weights: { emissions: 0.5, energy: 0.3, waste: 0.2 } } })
  @IsOptional()
  assessmentCriteria?: any;
}

class SupplierInviteDto {
  @ApiProperty({ example: 'invitation@supplier.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Sustainability Manager' })
  @IsOptional()
  @IsString()
  contactRole?: string;

  @ApiProperty({ example: 'Please complete our supplier assessment by filling out the attached forms.' })
  @IsOptional()
  @IsString()
  customMessage?: string;
}

@ApiTags('Suppliers')
@Controller('suppliers')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SuppliersController {
  private readonly logger = new Logger(SuppliersController.name);

  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  @Roles('admin', 'manager', 'user')
  @ApiOperation({
    summary: 'Get all suppliers',
    description: 'Retrieve a paginated list of suppliers with optional filtering',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiQuery({ name: 'search', required: false, example: 'manufacturing' })
  @ApiQuery({ name: 'industry', required: false, example: 'Manufacturing' })
  @ApiQuery({ name: 'country', required: false, example: 'USA' })
  @ApiQuery({ name: 'riskLevel', required: false, enum: SupplierRiskLevel })
  @ApiQuery({ name: 'sortBy', required: false, example: 'name' })
  @ApiQuery({ name: 'sortOrder', required: false, example: 'asc' })
  @ApiQuery({ name: 'activeOnly', required: false, example: true })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Suppliers retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
              description: { type: 'string' },
              industry: { type: 'string' },
              size: { type: 'string' },
              country: { type: 'string' },
              email: { type: 'string' },
              website: { type: 'string' },
              riskLevel: { type: 'string', enum: Object.values(SupplierRiskLevel) },
              isActive: { type: 'boolean' },
              contacts: { type: 'array' },
              metadata: { type: 'object' },
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
        },
        pagination: {
          type: 'object',
          properties: {
            page: { type: 'number' },
            limit: { type: 'number' },
            total: { type: 'number' },
            totalPages: { type: 'number' },
          },
        },
      },
    },
  })
  async findAll(
    @Query(ValidationPipe) query: QuerySuppliersDto,
    @GetUser('organizationId') organizationId: string,
  ) {
    this.logger.log(`Getting suppliers for organization: ${organizationId}`);
    return await this.suppliersService.findAll(organizationId, query);
  }

  @Get(':id')
  @Roles('admin', 'manager', 'user')
  @ApiOperation({
    summary: 'Get supplier by ID',
    description: 'Retrieve a specific supplier by its ID',
  })
  @ApiParam({ name: 'id', description: 'Supplier UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Supplier retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Supplier not found',
  })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    this.logger.log(`Getting supplier: ${id} for organization: ${organizationId}`);
    return await this.suppliersService.findOne(id, organizationId);
  }

  @Post()
  @Roles('admin', 'manager')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create new supplier',
    description: 'Create a new supplier record',
  })
  @ApiBody({ type: CreateSupplierDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Supplier created successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid supplier data',
  })
  async create(
    @Body(ValidationPipe) createSupplierDto: CreateSupplierDto,
    @GetUser('organizationId') organizationId: string,
    @GetUser('id') userId: string,
  ) {
    this.logger.log(`Creating supplier: ${createSupplierDto.name} for organization: ${organizationId}`);
    return await this.suppliersService.create(createSupplierDto, organizationId, userId);
  }

  @Put(':id')
  @Roles('admin', 'manager')
  @ApiOperation({
    summary: 'Update supplier',
    description: 'Update an existing supplier record',
  })
  @ApiParam({ name: 'id', description: 'Supplier UUID' })
  @ApiBody({ type: UpdateSupplierDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Supplier updated successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Supplier not found',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) updateSupplierDto: UpdateSupplierDto,
    @GetUser('organizationId') organizationId: string,
    @GetUser('id') userId: string,
  ) {
    this.logger.log(`Updating supplier: ${id} for organization: ${organizationId}`);
    return await this.suppliersService.update(id, updateSupplierDto, organizationId, userId);
  }

  @Delete(':id')
  @Roles('admin', 'manager')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete supplier',
    description: 'Delete a supplier record (soft delete)',
  })
  @ApiParam({ name: 'id', description: 'Supplier UUID' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Supplier deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Supplier not found',
  })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser('organizationId') organizationId: string,
    @GetUser('id') userId: string,
  ) {
    this.logger.log(`Deleting supplier: ${id} for organization: ${organizationId}`);
    return await this.suppliersService.remove(id, organizationId, userId);
  }

  // Assessment endpoints
  @Get(':id/assessments')
  @Roles('admin', 'manager', 'user')
  @ApiOperation({
    summary: 'Get supplier assessments',
    description: 'Retrieve all assessments for a specific supplier',
  })
  @ApiParam({ name: 'id', description: 'Supplier UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Supplier assessments retrieved successfully',
  })
  async getAssessments(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    this.logger.log(`Getting assessments for supplier: ${id} for organization: ${organizationId}`);
    return await this.suppliersService.getAssessments(id, organizationId);
  }

  @Post(':id/assessments')
  @Roles('admin', 'manager')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create supplier assessment',
    description: 'Create a new assessment for a supplier',
  })
  @ApiParam({ name: 'id', description: 'Supplier UUID' })
  @ApiBody({ type: CreateAssessmentDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Assessment created successfully',
  })
  async createAssessment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) createAssessmentDto: CreateAssessmentDto,
    @GetUser('organizationId') organizationId: string,
    @GetUser('id') userId: string,
  ) {
    this.logger.log(`Creating assessment for supplier: ${id} for organization: ${organizationId}`);
    return await this.suppliersService.createAssessment(id, createAssessmentDto, organizationId, userId);
  }

  @Post(':id/invite')
  @Roles('admin', 'manager')
  @ApiOperation({
    summary: 'Invite supplier to platform',
    description: 'Send an invitation to supplier to join the platform and complete assessments',
  })
  @ApiParam({ name: 'id', description: 'Supplier UUID' })
  @ApiBody({ type: SupplierInviteDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Invitation sent successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        invitationId: { type: 'string' },
        expiresAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  async inviteSupplier(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) inviteDto: SupplierInviteDto,
    @GetUser('organizationId') organizationId: string,
    @GetUser('id') userId: string,
  ) {
    this.logger.log(`Inviting supplier: ${id} for organization: ${organizationId}`);
    return await this.suppliersService.inviteSupplier(id, inviteDto, organizationId, userId);
  }

  @Get(':id/risk-analysis')
  @Roles('admin', 'manager', 'user')
  @ApiOperation({
    summary: 'Get supplier risk analysis',
    description: 'Retrieve comprehensive risk analysis for a supplier',
  })
  @ApiParam({ name: 'id', description: 'Supplier UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Risk analysis retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        supplierId: { type: 'string' },
        riskLevel: { type: 'string', enum: Object.values(SupplierRiskLevel) },
        riskScore: { type: 'number' },
        riskFactors: {
          type: 'object',
          properties: {
            geographic: { type: 'number' },
            industry: { type: 'number' },
            compliance: { type: 'number' },
            financial: { type: 'number' },
            environmental: { type: 'number' },
          },
        },
        recommendations: { type: 'array', items: { type: 'string' } },
        lastAnalyzed: { type: 'string', format: 'date-time' },
      },
    },
  })
  async getRiskAnalysis(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    this.logger.log(`Getting risk analysis for supplier: ${id} for organization: ${organizationId}`);
    return await this.suppliersService.getRiskAnalysis(id, organizationId);
  }

  @Get(':id/carbon-footprint')
  @Roles('admin', 'manager', 'user')
  @ApiOperation({
    summary: 'Get supplier carbon footprint',
    description: 'Retrieve carbon footprint data for a supplier',
  })
  @ApiParam({ name: 'id', description: 'Supplier UUID' })
  @ApiQuery({ name: 'year', required: false, example: 2024 })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Carbon footprint data retrieved successfully',
  })
  async getCarbonFootprint(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('year') year?: number,
    @GetUser('organizationId') organizationId?: string,
  ) {
    this.logger.log(`Getting carbon footprint for supplier: ${id} for organization: ${organizationId}`);
    return await this.suppliersService.getCarbonFootprint(id, organizationId, year);
  }

  @Get('analytics/overview')
  @Roles('admin', 'manager', 'user')
  @ApiOperation({
    summary: 'Get supplier analytics overview',
    description: 'Retrieve analytics overview for all suppliers',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Analytics overview retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        totalSuppliers: { type: 'number' },
        suppliersByRisk: {
          type: 'object',
          properties: {
            low: { type: 'number' },
            medium: { type: 'number' },
            high: { type: 'number' },
            critical: { type: 'number' },
          },
        },
        suppliersByIndustry: { type: 'object' },
        suppliersByCountry: { type: 'object' },
        assessmentStats: {
          type: 'object',
          properties: {
            pending: { type: 'number' },
            inProgress: { type: 'number' },
            completed: { type: 'number' },
            overdue: { type: 'number' },
          },
        },
        trends: { type: 'array' },
      },
    },
  })
  async getAnalyticsOverview(
    @GetUser('organizationId') organizationId: string,
  ) {
    this.logger.log(`Getting supplier analytics for organization: ${organizationId}`);
    return await this.suppliersService.getAnalyticsOverview(organizationId);
  }

  @Get('export')
  @Roles('admin', 'manager')
  @ApiOperation({
    summary: 'Export suppliers data',
    description: 'Export suppliers data to CSV/Excel format',
  })
  @ApiQuery({ name: 'format', required: false, enum: ['csv', 'xlsx'], example: 'csv' })
  @ApiQuery({ name: 'includeAssessments', required: false, example: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Export file generated successfully',
    schema: {
      type: 'object',
      properties: {
        downloadUrl: { type: 'string' },
        filename: { type: 'string' },
        expiresAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  async exportSuppliers(
    @Query('format') format: string = 'csv',
    @Query('includeAssessments') includeAssessments: boolean = false,
    @GetUser('organizationId') organizationId: string,
  ) {
    this.logger.log(`Exporting suppliers for organization: ${organizationId}, format: ${format}`);
    return await this.suppliersService.exportSuppliers(organizationId, format, includeAssessments);
  }
}