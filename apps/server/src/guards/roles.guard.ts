import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

export type Role = 'admin' | 'manager' | 'analyst' | 'user' | 'viewer';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no roles are specified, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      this.logger.warn('No user found in request for role check');
      throw new ForbiddenException('User authentication required for role-based access');
    }

    const userRoles: Role[] = user.roles || [];

    // Admin role has access to everything
    if (userRoles.includes('admin')) {
      return true;
    }

    // Check if user has any of the required roles
    const hasRequiredRole = requiredRoles.some((role) => userRoles.includes(role));

    if (!hasRequiredRole) {
      this.logger.warn(
        `User ${user.id} with roles [${userRoles.join(', ')}] attempted to access resource requiring [${requiredRoles.join(', ')}]`
      );
      throw new ForbiddenException(
        `Insufficient permissions. Required roles: ${requiredRoles.join(', ')}`
      );
    }

    return true;
  }
}