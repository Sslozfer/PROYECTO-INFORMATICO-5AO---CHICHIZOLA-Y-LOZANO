import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';

// ─── Guard de autenticación ───────────────────────────────────────────────────
// Usar con @UseGuards(JwtAuthGuard) en cualquier endpoint que requiera login

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

// ─── Guard de roles ───────────────────────────────────────────────────────────
// Usar con @UseGuards(JwtAuthGuard, RolesGuard) + @Roles('admin')

export const ROLES_KEY = 'roles';

export function Roles(...roles: string[]): MethodDecorator & ClassDecorator {
  return (target: any, key?: string | symbol, descriptor?: any) => {
    const metadataKey = ROLES_KEY;
    if (descriptor) {
      Reflect.defineMetadata(metadataKey, roles, descriptor.value);
      return descriptor;
    }
    Reflect.defineMetadata(metadataKey, roles, target);
    return target;
  };
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>(ROLES_KEY, context.getHandler());
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) return false;

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException('No tenés permisos para esta acción');
    }

    return true;
  }
}