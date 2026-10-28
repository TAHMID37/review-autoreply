import { resolve } from "node:path";
import { config as readDotenvFile } from "dotenv";
import { ZodError, ZodType, ZodTypeDef } from "zod";

/**
 * The one `.env` lives at the project root, next to backend/ and frontend/.
 * `__dirname` is backend/src/config when run by tsx and backend/dist/config
 * once compiled — both are two levels under backend/, so the same path works.
 */
const ROOT_ENV_PATH = resolve(__dirname, "../../../.env");

/**
 * Reads the root `.env` into process.env, then validates it against `schema`.
 * Throws a single readable error listing every problem, so a misconfigured
 * environment fails at boot instead of surfacing later as a confusing
 * "cannot read property of undefined" deep inside a request handler.
 *
 * Typed as `ZodType<T, ZodTypeDef, any>` rather than the `ZodSchema<T>` alias
 * on purpose: `ZodSchema<T>` also pins the schema's Input type to `T`, which
 * breaks inference for any schema using `.default()` and silently widens
 * defaulted fields back to `| undefined` in the returned type.
 */
export function loadEnv<T>(schema: ZodType<T, ZodTypeDef, any>): T {
  // Values already in the real environment win over the file, so secrets
  // injected by a deployment host are never overwritten by a stray .env.
  readDotenvFile({ path: ROOT_ENV_PATH });

  try {
    return schema.parse(process.env);
  } catch (error) {
    if (error instanceof ZodError) {
      const problems = error.issues.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`).join("\n");
      throw new Error(
        `Invalid environment configuration in ${ROOT_ENV_PATH}\nCheck it against .env.example:\n${problems}`,
      );
    }
    throw error;
  }
}
