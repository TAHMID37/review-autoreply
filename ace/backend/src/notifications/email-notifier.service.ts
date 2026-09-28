import { Inject, Injectable, Logger } from "@nestjs/common";
import { createTransport, Transporter } from "nodemailer";
import { Env } from "../config/env.schema";
import { APP_ENV } from "../config/env.token";

@Injectable()
export class EmailNotifierService {
  private readonly logger = new Logger(EmailNotifierService.name);
  private readonly transporter: Transporter | null;

  constructor(@Inject(APP_ENV) private readonly env: Env) {
    this.transporter = this.createTransporter();
  }

  /** Blank SMTP settings disable the channel rather than erroring. */
  get isEnabled(): boolean {
    return this.transporter !== null;
  }

  async send(to: string, subject: string, body: string): Promise<void> {
    if (!this.transporter) {
      return;
    }

    await this.transporter.sendMail({
      from: this.env.SMTP_FROM ?? this.env.SMTP_USER,
      to,
      subject,
      text: body,
    });
    this.logger.log(`Email alert sent to ${to}`);
  }

  private createTransporter(): Transporter | null {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = this.env;
    if (!SMTP_HOST?.trim() || !SMTP_PORT) {
      return null;
    }

    return createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      // 465 is implicit TLS; everything else upgrades via STARTTLS.
      secure: SMTP_PORT === 465,
      auth: SMTP_USER?.trim() ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    });
  }
}
