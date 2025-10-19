import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
  ApiQuery,
  ApiProperty,
} from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { Public } from '../decorators/public.decorator';
import { GetUser } from '../decorators/get-user.decorator';
import {
  AuthService,
  LoginDto,
  RegisterDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
} from '../services/auth.service';

// DTOs with validation
class LoginRequestDto implements LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Password123!' })
  @IsString()
  @MinLength(8)
  password: string;
}

class RegisterRequestDto implements RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Password123!' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'org-uuid', required: false })
  @IsOptional()
  @IsString()
  organizationId?: string;

  @ApiProperty({ example: 'Acme Corp', required: false })
  @IsOptional()
  @IsString()
  organizationName?: string;
}

class ForgotPasswordRequestDto implements ForgotPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;
}

class ResetPasswordRequestDto implements ResetPasswordDto {
  @ApiProperty({ example: 'reset-token-hex-string' })
  @IsString()
  token: string;

  @ApiProperty({ example: 'NewPassword123!' })
  @IsString()
  @MinLength(8)
  password: string;
}

class ChangePasswordRequestDto implements ChangePasswordDto {
  @ApiProperty({ example: 'CurrentPassword123!' })
  @IsString()
  currentPassword: string;

  @ApiProperty({ example: 'NewPassword123!' })
  @IsString()
  @MinLength(8)
  newPassword: string;
}

class RefreshTokenDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  @IsString()
  refreshToken: string;
}

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'User login',
    description: 'Authenticate user with email and password, returns JWT tokens',
  })
  @ApiBody({ type: LoginRequestDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Login successful',
    schema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
        refreshToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'user-uuid' },
            email: { type: 'string', example: 'user@example.com' },
            name: { type: 'string', example: 'John Doe' },
            organizationId: { type: 'string', example: 'org-uuid' },
            roles: { type: 'array', items: { type: 'string' }, example: ['user'] },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid credentials or account deactivated',
  })
  async login(@Body() loginDto: LoginRequestDto) {
    this.logger.log(`Login request for email: ${loginDto.email}`);
    return await this.authService.login(loginDto);
  }

  @Post('register')
  @Public()
  @ApiOperation({
    summary: 'User registration',
    description: 'Register a new user account, returns JWT tokens',
  })
  @ApiBody({ type: RegisterRequestDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Registration successful',
    schema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            name: { type: 'string' },
            organizationId: { type: 'string' },
            roles: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'User with this email already exists',
  })
  async register(@Body() registerDto: RegisterRequestDto) {
    this.logger.log(`Registration request for email: ${registerDto.email}`);
    return await this.authService.register(registerDto);
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh access token',
    description: 'Get new access and refresh tokens using a valid refresh token',
  })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Token refresh successful',
    schema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid or expired refresh token',
  })
  async refresh(@Body() refreshDto: RefreshTokenDto) {
    this.logger.log('Token refresh request');
    return await this.authService.refreshTokens(refreshDto.refreshToken);
  }

  @Post('forgot-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Initiate password reset',
    description: 'Send password reset email to user (if email exists)',
  })
  @ApiBody({ type: ForgotPasswordRequestDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Password reset email sent (if email exists)',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'If the email exists, a password reset link has been sent' },
      },
    },
  })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordRequestDto) {
    this.logger.log(`Password reset request for email: ${forgotPasswordDto.email}`);
    return await this.authService.forgotPassword(forgotPasswordDto);
  }

  @Post('reset-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset password with token',
    description: 'Reset user password using the token from email',
  })
  @ApiBody({ type: ResetPasswordRequestDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Password reset successful',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Password reset successfully' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid or expired reset token',
  })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordRequestDto) {
    this.logger.log('Password reset with token');
    return await this.authService.resetPassword(resetPasswordDto);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Change password',
    description: 'Change password for authenticated user',
  })
  @ApiBody({ type: ChangePasswordRequestDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Password changed successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Password changed successfully' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Current password is incorrect',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required',
  })
  async changePassword(
    @Body() changePasswordDto: ChangePasswordRequestDto,
    @GetUser('id') userId: string,
  ) {
    this.logger.log(`Password change request for user: ${userId}`);
    return await this.authService.changePassword(userId, changePasswordDto);
  }

  @Get('verify-email')
  @Public()
  @ApiOperation({
    summary: 'Verify email address',
    description: 'Verify user email address using token from email',
  })
  @ApiQuery({
    name: 'token',
    description: 'Email verification token',
    example: 'verification-token-hex-string',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Email verified successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Email verified successfully' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid verification token',
  })
  async verifyEmail(@Query('token') token: string) {
    this.logger.log(`Email verification request with token: ${token.substring(0, 8)}...`);
    return await this.authService.verifyEmail(token);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'User logout',
    description: 'Logout user and invalidate session',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Logout successful',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Logged out successfully' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required',
  })
  async logout(@GetUser('id') userId: string) {
    this.logger.log(`Logout request for user: ${userId}`);
    return await this.authService.logout(userId);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get user profile',
    description: 'Get current user profile information',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User profile retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'user-uuid' },
        email: { type: 'string', example: 'user@example.com' },
        name: { type: 'string', example: 'John Doe' },
        organizationId: { type: 'string', example: 'org-uuid' },
        roles: { type: 'array', items: { type: 'string' }, example: ['user'] },
        isActive: { type: 'boolean', example: true },
        emailVerified: { type: 'boolean', example: true },
        createdAt: { type: 'string', format: 'date-time' },
        lastLogin: { type: 'string', format: 'date-time' },
        organization: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            sector: { type: 'string' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User not found',
  })
  async getProfile(@GetUser('id') userId: string) {
    this.logger.log(`Profile request for user: ${userId}`);
    return await this.authService.getProfile(userId);
  }

  @Get('health')
  @Public()
  @ApiOperation({
    summary: 'Auth service health check',
    description: 'Check if authentication service is running',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Authentication service is healthy',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        service: { type: 'string', example: 'auth' },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  })
  getHealth() {
    return {
      status: 'ok',
      service: 'auth',
      timestamp: new Date().toISOString(),
    };
  }
}