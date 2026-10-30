import { Module } from "@nestjs/common";
import { BillingController } from "./billing.controller";
import { BillingService } from "./billing.service";
import { StripeClient } from "./stripe.client";

@Module({
  controllers: [BillingController],
  providers: [BillingService, StripeClient],
  exports: [BillingService],
})
export class BillingModule {}
