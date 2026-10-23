import type { AppModule } from "@/platform/types";
import { kycModule } from "./kyc/module";
import { refundsModule } from "./refunds/module";

/** Registry of internal apps. New apps: add a folder and one line here. */
export const APPS: AppModule[] = [kycModule, refundsModule];
