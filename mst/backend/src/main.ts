import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { CorsOptions } from "@nestjs/common/interfaces/external/cors-options.interface";
import { AppModule } from "./app.module";
import { Env, envSchema } from "./config/env.schema";
import { loadEnv } from "./config/load-env";

async function bootstrap() {
  // Reads the root .env and validates it before anything else boots — a
  // missing or malformed value fails immediately with a clear message.
  const env = loadEnv(envSchema);

  const app = await NestFactory.create(AppModule.forRoot(env));

  app.enableCors({ origin: buildCorsOrigin(env), credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  try {
    await app.listen(env.PORT);
  } catch (error) {
    if (isPortInUseError(error)) {
      exitWithPortInUseMessage(env.PORT);
    }
    throw error;
  }

  console.log(`API listening on http://localhost:${env.PORT}`);
}

bootstrap();

/**
 * Production pins the browser origin to exactly WEB_APP_URL.
 *
 * Development also accepts any localhost / 127.0.0.1 port, because those are
 * the same machine and reaching the dashboard by IP instead of hostname is
 * normal. Without this, opening 127.0.0.1:3100 gets silently blocked by the
 * browser and surfaces as an unexplained "something went wrong" at login.
 */
function buildCorsOrigin(env: Env): CorsOptions["origin"] {
  if (env.NODE_ENV === "production") {
    return env.WEB_APP_URL;
  }
  return (origin, callback) => {
    const isLocal = !origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    callback(isLocal ? null : new Error(`Origin ${origin} is not allowed`), isLocal);
  };
}

function isPortInUseError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "EADDRINUSE";
}

/**
 * Node's default EADDRINUSE output is a 20-line stack trace that says nothing
 * actionable. This is the single most common local failure — a previous run
 * still holding the port — so it gets a message that names the fix.
 */
function exitWithPortInUseMessage(port: number): never {
  console.error(
    [
      "",
      `  Port ${port} is already in use.`,
      "",
      "  Another instance of the API is probably still running.",
      "",
      "  Find and stop it:",
      `    netstat -ano | findstr :${port}`,
      "    taskkill /F /PID <pid>",
      "",
      "  Or set a different PORT in your .env file.",
      "",
    ].join("\n"),
  );
  process.exit(1);
}
