import { Controller, Get, Headers, HttpCode, HttpStatus, Post, Req, UseGuards } from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import type { Request } from "express";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthUserDto } from "../auth/dto/auth-user.dto";
import { AdminGuard } from "../auth/guards/admin.guard";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { BillingService } from "./billing.service";

@Controller("billing")
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  status(@CurrentUser() user: AuthUserDto) {
    return this.billing.getStatus(user.brandId);
  }

  @Post("checkout")
  @UseGuards(JwtAuthGuard, AdminGuard)
  checkout(@CurrentUser() user: AuthUserDto) {
    return this.billing.createCheckout(user.brandId, user.email);
  }

  @Post("portal")
  @UseGuards(JwtAuthGuard, AdminGuard)
  portal(@CurrentUser() user: AuthUserDto) {
    return this.billing.createPortal(user.brandId);
  }

  /** Stripe's webhook target. Authenticated by the Stripe-Signature header. */
  @Post("webhook")
  @HttpCode(HttpStatus.OK)
  async webhook(@Req() req: RawBodyRequest<Request>, @Headers("stripe-signature") signature: string | undefined) {
    await this.billing.handleWebhook(req.rawBody, signature);
    return { received: true };
  }
}
