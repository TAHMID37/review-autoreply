import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { AuthUserDto } from "../dto/auth-user.dto";

/**
 * @CurrentUser() in a route behind JwtAuthGuard gives you { id, brandId, email,
 * role } straight from the JWT — cheap, no DB call. `name` is NOT populated
 * here; look the user up via UsersService if you need it.
 */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUserDto => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});
