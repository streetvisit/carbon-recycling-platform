import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../entities/user.entity';
import { Organization } from '../entities/organization.entity';
import { EmailService } from './email.service';
import { UserRole, UserStatus } from '../controllers/users.controller';

// Interfaces
interface CreateUserDto {
  email: string;
  name: string;
  password: string;
  role?: UserRole;
  jobTitle?: string;
  phone?: string;
}

interface UpdateUserDto {
  name?: string;
  jobTitle?: string;
  phone?: string;
  role?: UserRole;
  status?: UserStatus;
  isActive?: boolean;
}

interface QueryUsersDto {
  page?: number;
  limit?: number;
  search?: string;
  role?: UserRole;
  status?: UserStatus;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  activeOnly?: boolean;
}

interface InviteUserDto {
  email: string;
  role: UserRole;
  message?: string;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    private readonly emailService: EmailService,
  ) {}

  async findAll(organizationId: string, query: QueryUsersDto) {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        role,
        status,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        activeOnly = false
      } = query;

      const queryBuilder = this.userRepository
        .createQueryBuilder('user')
        .where('user.organizationId = :organizationId', { organizationId })
        .andWhere('user.deletedAt IS NULL');

      // Apply active filter
      if (activeOnly) {
        queryBuilder.andWhere('user.isActive = true');
      }

      // Apply search filter
      if (search) {
        queryBuilder.andWhere(
          '(user.name ILIKE :search OR user.email ILIKE :search)',
          { search: `%${search}%` }
        );
      }

      // Apply role filter
      if (role) {
        queryBuilder.andWhere('user.role = :role', { role });
      }

      // Apply status filter
      if (status) {
        queryBuilder.andWhere('user.status = :status', { status });
      }

      // Apply sorting
      const validSortFields = ['name', 'email', 'role', 'createdAt', 'lastLogin'];
      const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
      queryBuilder.orderBy(`user.${sortField}`, sortOrder.toUpperCase() as 'ASC' | 'DESC');

      // Apply pagination
      const skip = (page - 1) * limit;
      queryBuilder.skip(skip).take(limit);

      const [users, total] = await queryBuilder.getManyAndCount();

      // Remove sensitive data
      const sanitizedUsers = users.map(user => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });

      return {
        data: sanitizedUsers,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error(`Failed to retrieve users for organization ${organizationId}:`, error);
      throw new BadRequestException('Failed to retrieve users');
    }
  }

  async findOne(id: string, organizationId: string): Promise<Partial<User>> {
    const user = await this.userRepository.findOne({
      where: {
        id,
        organizationId,
        deletedAt: null,
      },
      relations: ['organization'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Remove sensitive data
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async create(
    createUserDto: CreateUserDto,
    organizationId: string,
    currentUserId: string,
  ): Promise<Partial<User>> {
    try {
      // Verify organization exists
      const organization = await this.organizationRepository.findOne({
        where: { id: organizationId },
      });

      if (!organization) {
        throw new NotFoundException(`Organization with ID ${organizationId} not found`);
      }

      // Check if user already exists
      const existingUser = await this.userRepository.findOne({
        where: { email: createUserDto.email },
      });

      if (existingUser) {
        throw new BadRequestException(`User with email "${createUserDto.email}" already exists`);
      }

      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(createUserDto.password, saltRounds);

      // Create user
      const user = this.userRepository.create({
        ...createUserDto,
        password: hashedPassword,
        organizationId,
        role: createUserDto.role || UserRole.USER,
        status: UserStatus.ACTIVE,
        isActive: true,
        createdBy: currentUserId,
        emailVerified: false,
        roles: [createUserDto.role || UserRole.USER],
      });

      const savedUser = await this.userRepository.save(user);

      // Send welcome email
      try {
        await this.emailService.sendEmail({
          to: user.email,
          subject: 'Welcome to Carbon Recycling Platform',
          template: 'user-welcome',
          context: {
            userName: user.name,
            organizationName: organization.name,
            role: user.role,
            loginUrl: `${process.env.FRONTEND_URL || 'https://platform.example.com'}/login`,
          },
        });
      } catch (emailError) {
        this.logger.warn(`Failed to send welcome email to ${user.email}:`, emailError);
        // Don't fail user creation if email fails
      }

      this.logger.log(`User created: ${savedUser.id} by user: ${currentUserId}`);

      // Remove sensitive data before returning
      const { password, ...userWithoutPassword } = savedUser;
      return userWithoutPassword;
    } catch (error) {
      this.logger.error(`Failed to create user:`, error);
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to create user');
    }
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    organizationId: string,
    currentUserId: string,
  ): Promise<Partial<User>> {
    const userToUpdate = await this.userRepository.findOne({
      where: { id, organizationId, deletedAt: null },
    });

    if (!userToUpdate) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Prevent users from modifying their own role unless they are admin
    const currentUser = await this.userRepository.findOne({
      where: { id: currentUserId },
    });

    if (id === currentUserId && updateUserDto.role && currentUser?.role !== UserRole.ADMIN) {
      throw new BadRequestException('Cannot modify your own role');
    }

    try {
      // Update fields
      Object.assign(userToUpdate, {
        ...updateUserDto,
        updatedBy: currentUserId,
      });

      // Update roles array if role is changed
      if (updateUserDto.role) {
        userToUpdate.roles = [updateUserDto.role];
      }

      const savedUser = await this.userRepository.save(userToUpdate);

      this.logger.log(`User updated: ${id} by user: ${currentUserId}`);

      // Remove sensitive data before returning
      const { password, ...userWithoutPassword } = savedUser;
      return userWithoutPassword;
    } catch (error) {
      this.logger.error(`Failed to update user ${id}:`, error);
      throw new BadRequestException('Failed to update user');
    }
  }

  async remove(id: string, organizationId: string, currentUserId: string): Promise<void> {
    if (id === currentUserId) {
      throw new BadRequestException('Cannot delete your own account');
    }

    const user = await this.userRepository.findOne({
      where: { id, organizationId, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    try {
      // Soft delete
      user.deletedAt = new Date();
      user.deletedBy = currentUserId;
      user.isActive = false;

      await this.userRepository.save(user);

      this.logger.log(`User soft deleted: ${id} by user: ${currentUserId}`);
    } catch (error) {
      this.logger.error(`Failed to delete user ${id}:`, error);
      throw new BadRequestException('Failed to delete user');
    }
  }

  async inviteUser(
    inviteUserDto: InviteUserDto,
    organizationId: string,
    currentUserId: string,
  ) {
    try {
      // Check if user already exists
      const existingUser = await this.userRepository.findOne({
        where: { email: inviteUserDto.email },
      });

      if (existingUser) {
        throw new BadRequestException(`User with email "${inviteUserDto.email}" already exists`);
      }

      // Get organization details
      const organization = await this.organizationRepository.findOne({
        where: { id: organizationId },
      });

      if (!organization) {
        throw new NotFoundException(`Organization with ID ${organizationId} not found`);
      }

      // Generate invitation token
      const invitationToken = `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

      // Store invitation (in a real implementation, you'd have an invitations table)
      const invitation = {
        id: invitationToken,
        email: inviteUserDto.email,
        role: inviteUserDto.role,
        organizationId,
        invitedBy: currentUserId,
        expiresAt,
        status: 'sent',
      };

      // Send invitation email
      await this.emailService.sendEmail({
        to: inviteUserDto.email,
        subject: `Invitation to join ${organization.name} on Carbon Recycling Platform`,
        template: 'user-invitation',
        context: {
          organizationName: organization.name,
          role: inviteUserDto.role,
          message: inviteUserDto.message,
          invitationUrl: `${process.env.FRONTEND_URL || 'https://platform.example.com'}/accept-invitation?token=${invitationToken}`,
          expiresAt: expiresAt.toISOString(),
        },
      });

      this.logger.log(`User invitation sent: ${invitationToken} to ${inviteUserDto.email} by user: ${currentUserId}`);

      return {
        message: 'Invitation sent successfully',
        invitationToken,
        expiresAt,
      };
    } catch (error) {
      this.logger.error(`Failed to invite user:`, error);
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to send user invitation');
    }
  }

  async activateUser(id: string, organizationId: string, currentUserId: string) {
    const user = await this.userRepository.findOne({
      where: { id, organizationId, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    try {
      user.status = UserStatus.ACTIVE;
      user.isActive = true;
      user.updatedBy = currentUserId;

      await this.userRepository.save(user);

      this.logger.log(`User activated: ${id} by user: ${currentUserId}`);

      return {
        message: 'User activated successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to activate user ${id}:`, error);
      throw new BadRequestException('Failed to activate user');
    }
  }

  async suspendUser(id: string, organizationId: string, currentUserId: string) {
    if (id === currentUserId) {
      throw new BadRequestException('Cannot suspend your own account');
    }

    const user = await this.userRepository.findOne({
      where: { id, organizationId, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    try {
      user.status = UserStatus.SUSPENDED;
      user.isActive = false;
      user.updatedBy = currentUserId;

      await this.userRepository.save(user);

      this.logger.log(`User suspended: ${id} by user: ${currentUserId}`);

      return {
        message: 'User suspended successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to suspend user ${id}:`, error);
      throw new BadRequestException('Failed to suspend user');
    }
  }

  async getAnalytics(organizationId: string) {
    try {
      const totalUsers = await this.userRepository.count({
        where: { organizationId, deletedAt: null },
      });

      const activeUsers = await this.userRepository.count({
        where: { organizationId, deletedAt: null, isActive: true },
      });

      const usersByRole = await this.userRepository
        .createQueryBuilder('user')
        .select('user.role', 'role')
        .addSelect('COUNT(*)', 'count')
        .where('user.organizationId = :organizationId', { organizationId })
        .andWhere('user.deletedAt IS NULL')
        .groupBy('user.role')
        .getRawMany();

      const usersByStatus = await this.userRepository
        .createQueryBuilder('user')
        .select('user.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .where('user.organizationId = :organizationId', { organizationId })
        .andWhere('user.deletedAt IS NULL')
        .groupBy('user.status')
        .getRawMany();

      const recentlyCreated = await this.userRepository.count({
        where: {
          organizationId,
          deletedAt: null,
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      });

      const recentlyActive = await this.userRepository.count({
        where: {
          organizationId,
          deletedAt: null,
          lastLogin: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      });

      // Convert arrays to objects
      const roleStats = usersByRole.reduce((acc, item) => {
        acc[item.role] = parseInt(item.count);
        return acc;
      }, {});

      const statusStats = usersByStatus.reduce((acc, item) => {
        acc[item.status] = parseInt(item.count);
        return acc;
      }, {});

      // Mock growth trends
      const growthTrends = [
        { month: 'Jan', users: Math.max(0, totalUsers - 50) },
        { month: 'Feb', users: Math.max(0, totalUsers - 40) },
        { month: 'Mar', users: Math.max(0, totalUsers - 30) },
        { month: 'Apr', users: Math.max(0, totalUsers - 20) },
        { month: 'May', users: Math.max(0, totalUsers - 10) },
        { month: 'Jun', users: totalUsers },
      ];

      return {
        totalUsers,
        activeUsers,
        inactiveUsers: totalUsers - activeUsers,
        usersByRole: roleStats,
        usersByStatus: statusStats,
        recentlyCreated,
        recentlyActive,
        activityRate: totalUsers > 0 ? (recentlyActive / totalUsers) * 100 : 0,
        growthTrends,
      };
    } catch (error) {
      this.logger.error(`Failed to get user analytics for organization ${organizationId}:`, error);
      throw new BadRequestException('Failed to retrieve user analytics');
    }
  }
}