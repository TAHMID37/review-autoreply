import { Module } from "@nestjs/common";
import { BillingModule } from "../billing/billing.module";
import { PublicWidgetController, WidgetsController } from "./widgets.controller";
import { WidgetsService } from "./widgets.service";

@Module({
  imports: [BillingModule],
  controllers: [WidgetsController, PublicWidgetController],
  providers: [WidgetsService],
})
export class WidgetsModule {}
