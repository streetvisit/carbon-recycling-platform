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
import { IsString, IsOptional, IsEnum, IsNumber, IsBoolean, IsEmail, Min, Max, IsArray } from 'class-validator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { GetUser } from '../decorators/get-user.decorator';
import { UsersService } from '../services/users.service';

// Enums
export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  USER = 'user',
  VIEWER = 'viewer',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
  SUSPENDED = 'suspended',
}

// DTOs
class CreateUserDto {
  @ApiProperty({ example: 'john.doe@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'SecurePassword123!' })
  @IsString()
  password: string;

  @ApiProperty({ enum: UserRole, example: UserRole.USER })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole = UserRole.USER;

  @ApiProperty({ example: 'Sustainability Manager' })
  @IsOptional()
  @IsString()
  jobTitle?: string;

  @ApiProperty({ example: '+1-555-0123' })
  @IsOptional()
  @IsString()
  phone?: string;
}

class UpdateUserDto {
  @ApiProperty({ example: 'John Smith', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: 'Senior Manager', required: false })
  @IsOptional()
  @IsString()
  jobTitle?: string;

  @ApiProperty({ example: '+1-555-0199', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ enum: UserRole, required: false })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiProperty({ enum: UserStatus, required: false })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class QueryUsersDto {
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

  @ApiProperty({ example: 'john', required: false })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ enum: UserRole, required: false })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiProperty({ enum: UserStatus, required: false })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiProperty({ example: 'name', enum: ['name', 'email', 'role', 'createdAt'], required: false })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiProperty({ example: 'desc', enum: ['asc', 'desc'], required: false })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  activeOnly?: boolean;
}

class InviteUserDto {
  @ApiProperty({ example: 'newuser@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ enum: UserRole, example: UserRole.USER })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiProperty({ example: 'Welcome to the Carbon Platform! Please complete your registration.' })
  @IsOptional()
  @IsString()
  message?: string;
}

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles('admin', 'manager')
  @ApiOperation({
    summary: 'Get all users',
    description: 'Retrieve a paginated list of users with optional filtering',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Users retrieved successfully',
  })
  async findAll(
    @Query(ValidationPipe) query: QueryUsersDto,
    @GetUser('organizationId') organizationId: string,
  ) {
    this.logger.log(`Getting users for organization: ${organizationId}`);
    return await this.usersService.findAll(organizationId, query);
  }

  @Get(':id')
  @Roles('admin', 'manager')
  @ApiOperation({
    summary: 'Get user by ID',
    description: 'Retrieve a specific user by their ID',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User retrieved successfully',
  })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    this.logger.log(`Getting user: ${id} for organization: ${organizationId}`);
    return await this.usersService.findOne(id, organizationId);
  }

  @Post()
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create new user',
    description: 'Create a new user account',
  })
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'User created successfully',
  })
  async create(
    @Body(ValidationPipe) createUserDto: CreateUserDto,
    @GetUser('organizationId') organizationId: string,
    @GetUser('id') currentUserId: string,
  ) {
    this.logger.log(`Creating user: ${createUserDto.email} for organization: ${organizationId}`);
    return await this.usersService.create(createUserDto, organizationId, currentUserId);
  }

  @Put(':id')
  @Roles('admin', 'manager')
  @ApiOperation({
    summary: 'Update user',
    description: 'Update an existing user account',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User updated successfully',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) updateUserDto: UpdateUserDto,
    @GetUser('organizationId') organizationId: string,
    @GetUser('id') currentUserId: string,
  ) {
    this.logger.log(`Updating user: ${id} for organization: ${organizationId}`);
    return await this.usersService.update(id, updateUserDto, organizationId, currentUserId);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete user',
    description: 'Delete a user account (soft delete)',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser('organizationId') organizationId: string,
    @GetUser('id') currentUserId: string,
  ) {
    this.logger.log(`Deleting user: ${id} for organization: ${organizationId}`);
    return await this.usersService.remove(id, organizationId, currentUserId);
  }

  @Post('invite')
  @Roles('admin', 'manager')
  @ApiOperation({
    summary: 'Invite new user',
    description: 'Send invitation email to a new user',
  })
  @ApiBody({ type: InviteUserDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Invitation sent successfully',
  })
  async inviteUser(
    @Body(ValidationPipe) inviteUserDto: InviteUserDto,
    @GetUser('organizationId') organizationId: string,
    @GetUser('id') currentUserId: string,
  ) {
    this.logger.log(`Inviting user: ${inviteUserDto.email} for organization: ${organizationId}`);
    return await this.usersService.inviteUser(inviteUserDto, organizationId, currentUserId);
  }

  @Put(':id/activate')
  @Roles('admin')
  @ApiOperation({
    summary: 'Activate user',
    description: 'Activate a suspended or inactive user',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  async activateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser('organizationId') organizationId: string,
    @GetUser('id') currentUserId: string,
  ) {
    this.logger.log(`Activating user: ${id} for organization: ${organizationId}`);
    return await this.usersService.activateUser(id, organizationId, currentUserId);
  }

  @Put(':id/suspend')
  @Roles('admin')
  @ApiOperation({
    summary: 'Suspend user',
    description: 'Suspend a user account',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  async suspendUser(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser('organizationId') organizationId: string,
    @GetUser('id') currentUserId: string,
  ) {
    this.logger.log(`Suspending user: ${id} for organization: ${organizationId}`);
    return await this.usersService.suspendUser(id, organizationId, currentUserId);
  }

  @Get('analytics/summary')
  @Roles('admin')
  @ApiOperation({
    summary: 'Get user analytics',
    description: 'Retrieve user analytics and statistics',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User analytics retrieved successfully',
  })
  async getAnalytics(
    @GetUser('organizationId') organizationId: string,
  ) {
    this.logger.log(`Getting user analytics for organization: ${organizationId}`);
    return await this.usersService.getAnalytics(organizationId);
  }
}