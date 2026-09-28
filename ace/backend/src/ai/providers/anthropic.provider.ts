import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { AiProvider, ReplyGenerationRequest, requireApiKey } from "./ai-provider.interface";
import { buildReviewMessage } from "./openai.provider";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

/** Alternative provider — selected with AI_PROVIDER=anthropic. */
@Injectable()
export class AnthropicProvider implements AiProvider {
  readonly name = "anthropic";
  readonly model = "claude-sonnet-5";

  constructor(private readonly apiKey: string) {}

  async generateReply(request: ReplyGenerationRequest): Promise<string> {
    const response = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": requireApiKey(this.apiKey, "ANTHROPIC_API_KEY"),
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 300,
        system: request.systemPrompt,
        messages: [{ role: "user", content: buildReviewMessage(request) }],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new ServiceUnavailableException(`Anthropic request failed (${response.status}): ${detail}`);
    }

    const body = (await response.json()) as { content?: { text?: string }[] };
    const reply = body.content?.[0]?.text?.trim();
    if (!reply) {
      throw new ServiceUnavailableException("Anthropic returned an empty reply");
    }
    return reply;
  }
}
