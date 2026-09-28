import { Inject, Injectable, Logger } from "@nestjs/common";
import { Env } from "../config/env.schema";
import { APP_ENV } from "../config/env.token";

@Injectable()
export class SlackNotifierService {
  private readonly logger = new Logger(SlackNotifierService.name);

  constructor(@Inject(APP_ENV) private readonly env: Env) {}

  /** Blank SLACK_WEBHOOK_URL disables the channel rather than erroring. */
  get isEnabled(): boolean {
    return Boolean(this.env.SLACK_WEBHOOK_URL);
  }

  async send(text: string): Promise<void> {
    if (!this.env.SLACK_WEBHOOK_URL) {
      return;
    }

    const response = await fetch(this.env.SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      throw new Error(`Slack webhook failed (${response.status}): ${await response.text()}`);
    }
    this.logger.log("Slack alert sent");
  }
}
