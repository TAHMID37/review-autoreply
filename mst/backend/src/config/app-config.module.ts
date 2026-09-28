import { DynamicModule, Global, Module } from "@nestjs/common";
import { Env } from "./env.schema";
import { APP_ENV } from "./env.token";

/**
 * Makes the already-validated Env available for injection anywhere via
 * `@Inject(APP_ENV) env: Env`, instead of every service reading `process.env`
 * directly and re-deciding what's required.
 */
@Global()
@Module({})
export class AppConfigModule {
  static forRoot(env: Env): DynamicModule {
    return {
      module: AppConfigModule,
      providers: [{ provide: APP_ENV, useValue: env }],
      exports: [APP_ENV],
    };
  }
}
