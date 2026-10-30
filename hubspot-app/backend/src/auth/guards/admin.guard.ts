import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { UserRole } from "@prisma/client";

/** Use after JwtAuthGuard on routes that change billing, consent or app access. */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const user = ctx.switchToHttp().getRequest().user;
    if (user?.role !== UserRole.ADMIN) {
      throw new ForbiddenException("Only an admin of this business can do that.");
    }
    return true;
  }
}
