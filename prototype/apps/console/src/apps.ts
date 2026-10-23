import type { AppModule } from "@internal/platform/types";
import { kycModule } from "@internal/kyc/module";
import { refundsModule } from "@internal/refunds/module";

/** Registry of internal apps. New apps: add a folder and one line here. */
export const APPS: AppModule[] = [kycModule, refundsModule];
