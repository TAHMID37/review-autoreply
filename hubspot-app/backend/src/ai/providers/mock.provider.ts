import { Injectable } from "@nestjs/common";
import { AiProvider, ReplyGenerationRequest } from "./ai-provider.interface";

/**
 * Offline provider for local development and demos.
 *
 * Generates a plausible, brand-safe reply from a small set of templates
 * without calling any external service, so the whole pipeline - risk routing,
 * reply drafting, approval queue, reports - can be exercised end to end before
 * a real OPENAI_API_KEY (or the Google connection) exists. Never enable this
 * in production: it does not read the review text, only its rating and the
 * reviewer's first name.
 */
@Injectable()
export class MockProvider implements AiProvider {
  readonly name = "mock";
  readonly model = "template-v1";

  async generateReply(request: ReplyGenerationRequest): Promise<string> {
    const firstName = request.reviewerName.split(/\s+/)[0]?.replace(/[^A-Za-z'-]/g, "") || "there";

    if (request.rating >= 4) {
      return (
        `Hi ${firstName}, thank you so much for the kind words and the ${request.rating}-star rating. ` +
        `We are thrilled you had a great experience and we will pass your feedback on to the team. ` +
        `We look forward to seeing you again.`
      );
    }

    return (
      `Hi ${firstName}, thank you for taking the time to share your feedback, and we are sorry your ` +
      `experience did not meet the standard we aim for. We would like to make this right - please reach ` +
      `out to us directly so we can look into it. Thank you for helping us improve.`
    );
  }
}
