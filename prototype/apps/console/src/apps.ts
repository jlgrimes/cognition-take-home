import type { AppModule } from "@internal/platform/types";
import { kycModule } from "@internal/kyc/module";
import { refundsModule } from "@internal/refunds/module";
import { flagsModule } from "@internal/flags/module";

/** Registry of internal apps. New apps: add a package under packages/ and one line here. */
export const APPS: AppModule[] = [kycModule, refundsModule, flagsModule];
