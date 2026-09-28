import { DynamicModule, Module } from "@nestjs/common";
import { AppConfigModule } from "./config/app-config.module";
import { Env } from "./config/env.schema";
import { PrismaModule } from "./common/prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { BrandsModule } from "./brands/brands.module";
import { LocationsModule } from "./locations/locations.module";
import { ReviewsModule } from "./reviews/reviews.module";
import { RepliesModule } from "./replies/replies.module";
import { ReportsModule } from "./reports/reports.module";
import { PlatformAccountsModule } from "./platform-accounts/platform-accounts.module";
import { ReplyConfigModule } from "./reply-config/reply-config.module";

@Module({})
export class AppModule {
  static forRoot(env: Env): DynamicModule {
    return {
      module: AppModule,
      imports: [
        AppConfigModule.forRoot(env),
        PrismaModule,
        UsersModule,
        AuthModule,
        BrandsModule,
        LocationsModule,
        ReviewsModule,
        RepliesModule,
        ReportsModule,
        PlatformAccountsModule,
        ReplyConfigModule,
      ],
    };
  }
}
