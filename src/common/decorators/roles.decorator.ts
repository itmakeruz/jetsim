import { SetMetadata } from '@nestjs/common';

export const ROLES_DECORATOR_KEY = 'roles_decorator_key';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_DECORATOR_KEY, roles);
