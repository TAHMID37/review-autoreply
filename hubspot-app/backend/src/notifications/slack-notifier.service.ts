import { Injectable, Logger } from "@nestjs/common";

/** Posts to a business's own Slack incoming webhook (set in its Settings). */
@Injectable()
export class SlackNotifierService {
  private readonly logger = new Logger(SlackNotifierService.name);

  async send(webhookUrl: string, text: string): Promise<void> {
    const response = await fetch(webhookUrl, {
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
