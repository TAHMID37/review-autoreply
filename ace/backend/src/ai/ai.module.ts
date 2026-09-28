import { Logger, Module } from "@nestjs/common";
import { Env } from "../config/env.schema";
import { APP_ENV } from "../config/env.token";
import { BrandPromptBuilder } from "./prompts/brand-prompt.builder";
import { AI_PROVIDER, AiProvider } from "./providers/ai-provider.interface";
import { AnthropicProvider } from "./providers/anthropic.provider";
import { GeminiProvider } from "./providers/gemini.provider";
import { MockProvider } from "./providers/mock.provider";
import { OpenAiProvider } from "./providers/openai.provider";

const KEY_BY_PROVIDER = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  gemini: "GEMINI_API_KEY",
} as const;

/**
 * Builds the one AI provider named by AI_PROVIDER and publishes it under a
 * single token, so everything downstream injects `AI_PROVIDER` and never
 * learns which vendor is behind it.
 *
 * A missing API key warns here but does not stop the app booting: the key is
 * only needed to draft a reply, and refusing to start would also take down
 * login, the review inbox and reports. The provider itself raises a clear
 * error if generation is actually attempted without it.
 */
function createAiProvider(env: Env): AiProvider {
  // Offline template provider - needs no API key. Local dev / demo only.
  if (env.AI_PROVIDER === "mock") {
    new Logger("AiModule").warn(
      'AI_PROVIDER is "mock" - replies are generated from local templates, not a real model. Do not use in production.',
    );
    return new MockProvider();
  }

  const key = (env[KEY_BY_PROVIDER[env.AI_PROVIDER]] ?? "").trim();

  if (!key) {
    new Logger("AiModule").warn(
      `AI_PROVIDER is "${env.AI_PROVIDER}" but ${KEY_BY_PROVIDER[env.AI_PROVIDER]} is not set in .env - ` +
        "reply generation will fail until it is. Everything else works.",
    );
  }

  switch (env.AI_PROVIDER) {
    case "anthropic":
      return new AnthropicProvider(key);
    case "gemini":
      return new GeminiProvider(key);
    case "openai":
      return new OpenAiProvider(key);
  }
}

@Module({
  providers: [
    BrandPromptBuilder,
    {
      provide: AI_PROVIDER,
      inject: [APP_ENV],
      useFactory: createAiProvider,
    },
  ],
  exports: [AI_PROVIDER, BrandPromptBuilder],
})
export class AiModule {}
