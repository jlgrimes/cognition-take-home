import { NextResponse, type NextRequest } from "next/server";
import { PolicyError } from "@internal/platform/types";
import { evaluateFlags } from "@internal/flags/evaluate";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET /api/flags/evaluate?env=prod&merchant=acct_...&key=optional — what product services would call. */
export function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  try {
    const results = evaluateFlags(getDb(), { env: q.get("env") ?? "", merchantId: q.get("merchant") ?? "", key: q.get("key") ?? undefined });
    return NextResponse.json({ results });
  } catch (e) {
    if (e instanceof PolicyError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
