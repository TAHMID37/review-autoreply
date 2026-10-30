import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { AiProvider, ReplyGenerationRequest, requireApiKey } from "./ai-provider.interface";
import { buildReviewMessage } from "./openai.provider";

/** Alternative provider — selected with AI_PROVIDER=gemini. */
@Injectable()
export class GeminiProvider implements AiProvider {
  readonly name = "gemini";
  readonly model = "gemini-1.5-flash";

  constructor(private readonly apiKey: string) {}

  async generateReply(request: ReplyGenerationRequest): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${requireApiKey(this.apiKey, "GEMINI_API_KEY")}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: request.systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: buildReviewMessage(request) }] }],
        generationConfig: { maxOutputTokens: 300 },
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new ServiceUnavailableException(`Gemini request failed (${response.status}): ${detail}`);
    }

    const body = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const reply = body.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!reply) {
      throw new ServiceUnavailableException("Gemini returned an empty reply");
    }
    return reply;
  }
}
