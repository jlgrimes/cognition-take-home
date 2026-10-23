import { describe, expect, it } from "vitest";
import { signSession, verifySession } from "./session";

const SECRET = "test-secret";
const HOUR = 3_600_000;

describe("Signed sessions", () => {
  it("round-trips a valid token", () => {
    expect(verifySession(signSession("u_ana", SECRET, HOUR), SECRET)).toBe("u_ana");
  });

  it("rejects a token edited to impersonate another user", () => {
    const [, exp, sig] = signSession("u_ana", SECRET, HOUR).split(".");
    expect(verifySession(`u_fay.${exp}.${sig}`, SECRET)).toBeNull();
  });

  it("rejects a token with an extended expiry", () => {
    const [uid, exp, sig] = signSession("u_ana", SECRET, HOUR).split(".");
    expect(verifySession(`${uid}.${Number(exp) + HOUR}.${sig}`, SECRET)).toBeNull();
  });

  it("rejects expired tokens, wrong secrets, and the old plain user-id cookie", () => {
    const now = Date.now();
    expect(verifySession(signSession("u_ana", SECRET, HOUR, now - 2 * HOUR), SECRET, now)).toBeNull();
    expect(verifySession(signSession("u_ana", SECRET, HOUR), "other-secret")).toBeNull();
    expect(verifySession("u_ana", SECRET)).toBeNull();
    expect(verifySession(undefined, SECRET)).toBeNull();
  });
});
