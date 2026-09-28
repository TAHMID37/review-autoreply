import { Module } from "@nestjs/common";
import { SentimentRiskService } from "./sentiment-risk.service";

@Module({
  providers: [SentimentRiskService],
  exports: [SentimentRiskService],
})
export class SafetyModule {}
