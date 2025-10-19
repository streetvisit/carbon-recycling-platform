import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { User } from '../entities/user.entity';
import { EmailService } from './email.service';

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  email: string;
  password: string;
  name: string;
  organizationId?: string;
  organizationName?: string;
}

export interface ForgotPasswordDto {
  email: string;
}

export interface ResetPasswordDto {
  token: string;
  password: string;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    organizationId: string;
    roles: string[];
  };
}

export interface JwtPayload {
  sub: string;
  email: string;
  organizationId: string;
  roles: string[];
  type: 'access' | 'refresh';
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * User login with email and password
   */
  async login(loginDto: LoginDto): Promise<AuthResult> {
    this.logger.log(`Login attempt for email: ${loginDto.email}`);

    const user = await this.userRepository.findOne({
      where: { email: loginDto.email },
      relations: ['organization'],
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.passwordHash);
    if (!isPasswordValid) {
      // Log failed login attempt
      user.lastFailedLogin = new Date();
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      await this.userRepository.save(user);
      
      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset failed login attempts on successful login
    user.lastLogin = new Date();
    user.failedLoginAttempts = 0;
    await this.userRepository.save(user);

    const tokens = await this.generateTokens(user);

    this.logger.log(`Successful login for user: ${user.id}`);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        organizationId: user.organizationId,
        roles: user.roles || ['user'],
      },
    };
  }

  /**
   * User registration
   */
  async register(registerDto: RegisterDto): Promise<AuthResult> {
    this.logger.log(`Registration attempt for email: ${registerDto.email}`);

    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(registerDto.password, saltRounds);

    // Create new user
    const user = this.userRepository.create({
      email: registerDto.email,
      name: registerDto.name,
      passwordHash,
      organizationId: registerDto.organizationId,
      roles: ['user'], // Default role
      isActive: true,
      emailVerified: false,
      emailVerificationToken: crypto.randomBytes(32).toString('hex'),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const savedUser = await this.userRepository.save(user);

    // Send verification email
    try {
      await this.emailService.sendVerificationEmail(savedUser.email, savedUser.emailVerificationToken);
    } catch (error) {
      this.logger.warn(`Failed to send verification email to ${savedUser.email}:`, error.message);
    }

    const tokens = await this.generateTokens(savedUser);

    this.logger.log(`Successful registration for user: ${savedUser.id}`);

    return {
      ...tokens,
      user: {
        id: savedUser.id,
        email: savedUser.email,
        name: savedUser.name,
        organizationId: savedUser.organizationId,
        roles: savedUser.roles || ['user'],
      },
    };
  }

  /**
   * Refresh access token
   */
  async refreshTokens(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET || 'refresh-secret-key',
      });

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found or inactive');
      }

      return await this.generateTokens(user);
    } catch (error) {
      this.logger.error('Token refresh failed:', error.message);
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Initiate password reset
   */
  async forgotPassword(forgotPasswordDto: ForgotPasswordDto): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({
      where: { email: forgotPasswordDto.email },
    });

    if (!user) {
      // Don't reveal if user exists for security
      return { message: 'If the email exists, a password reset link has been sent' };
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour

    user.passwordResetToken = resetToken;
    user.passwordResetExpires = resetTokenExpires;
    await this.userRepository.save(user);

    // Send reset email
    try {
      await this.emailService.sendPasswordResetEmail(user.email, resetToken);
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${user.email}:`, error.message);
    }

    return { message: 'If the email exists, a password reset link has been sent' };
  }

  /**
   * Reset password with token
   */
  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({
      where: { 
        passwordResetToken: resetPasswordDto.token,
        passwordResetExpires: new Date() // TypeORM will handle the greater than comparison
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Hash new password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(resetPasswordDto.password, saltRounds);

    // Update user
    user.passwordHash = passwordHash;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    user.updatedAt = new Date();
    await this.userRepository.save(user);

    this.logger.log(`Password reset successful for user: ${user.id}`);

    return { message: 'Password reset successfully' };
  }

  /**
   * Change password for authenticated user
   */
  async changePassword(userId: string, changePasswordDto: ChangePasswordDto): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(changePasswordDto.currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Hash new password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(changePasswordDto.newPassword, saltRounds);

    // Update password
    user.passwordHash = passwordHash;
    user.updatedAt = new Date();
    await this.userRepository.save(user);

    this.logger.log(`Password changed for user: ${user.id}`);

    return { message: 'Password changed successfully' };
  }

  /**
   * Verify email address
   */
  async verifyEmail(token: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({
      where: { emailVerificationToken: token },
    });

    if (!user) {
      throw new BadRequestException('Invalid verification token');
    }

    user.emailVerified = true;
    user.emailVerificationToken = null;
    user.updatedAt = new Date();
    await this.userRepository.save(user);

    this.logger.log(`Email verified for user: ${user.id}`);

    return { message: 'Email verified successfully' };
  }

  /**
   * Logout user (invalidate tokens - in a full implementation, you'd maintain a blacklist)
   */
  async logout(userId: string): Promise<{ message: string }> {
    // In a production system, you might want to:
    // 1. Maintain a token blacklist
    // 2. Store refresh tokens in database and delete them
    // 3. Update user's lastLogout timestamp
    
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (user) {
      user.lastLogout = new Date();
      await this.userRepository.save(user);
    }

    this.logger.log(`User logged out: ${userId}`);
    return { message: 'Logged out successfully' };
  }

  /**
   * Get user profile information
   */
  async getProfile(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['organization'],
      select: [
        'id',
        'email',
        'name',
        'organizationId',
        'roles',
        'isActive',
        'emailVerified',
        'createdAt',
        'lastLogin',
      ],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Generate JWT tokens
   */
  private async generateTokens(user: User): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: Omit<JwtPayload, 'type'> = {
      sub: user.id,
      email: user.email,
      organizationId: user.organizationId,
      roles: user.roles || ['user'],
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { ...payload, type: 'access' },
        {
          secret: process.env.JWT_SECRET || 'default-secret-key',
          expiresIn: process.env.JWT_EXPIRES_IN || '15m',
        },
      ),
      this.jwtService.signAsync(
        { ...payload, type: 'refresh' },
        {
          secret: process.env.JWT_REFRESH_SECRET || 'refresh-secret-key',
          expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
        },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  /**
   * Validate password strength
   */
  private validatePasswordStrength(password: string): boolean {
    // At least 8 characters, one uppercase, one lowercase, one number, one special character
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(password);
  }
}