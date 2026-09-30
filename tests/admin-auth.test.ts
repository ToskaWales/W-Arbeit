import { describe, expect, it } from "vitest";
import {
  adminEnabled,
  createSessionToken,
  passwordMatches,
  readCookie,
  SESSION_SECONDS,
  verifySessionToken,
} from "../src/lib/admin-auth";

const PW = "ein-sehr-langes-passwort-123";

describe("Admin-Anmeldung", () => {
  it("ist nur mit gesetztem, langem Passwort aktiv", () => {
    expect(adminEnabled(undefined)).toBe(false);
    expect(adminEnabled("")).toBe(false);
    expect(adminEnabled("kurz")).toBe(false);
    expect(adminEnabled(PW)).toBe(true);
  });
  it("vergleicht das Passwort korrekt", () => {
    expect(passwordMatches(PW, PW)).toBe(true);
    expect(passwordMatches("falsch", PW)).toBe(false);
    expect(passwordMatches(undefined, PW)).toBe(false);
    expect(passwordMatches(123, PW)).toBe(false);
  });
  it("akzeptiert ein frisches Token", () => {
    expect(verifySessionToken(createSessionToken(PW), PW)).toBe(true);
  });
  it("lehnt Token ohne Passwort, manipulierte und fremde Token ab", () => {
    const t = createSessionToken(PW);
    expect(verifySessionToken(undefined, PW)).toBe(false);
    expect(verifySessionToken("", PW)).toBe(false);
    expect(verifySessionToken(t, undefined)).toBe(false);
    expect(verifySessionToken(t + "0", PW)).toBe(false);
    expect(verifySessionToken("9999999999.abc", PW)).toBe(false);
    expect(verifySessionToken(t, "anderes-langes-passwort-456")).toBe(false);
  });
  it("lehnt abgelaufene Token ab", () => {
    const now = Date.now();
    const t = createSessionToken(PW, now);
    expect(verifySessionToken(t, PW, now + (SESSION_SECONDS - 5) * 1000)).toBe(true);
    expect(verifySessionToken(t, PW, now + (SESSION_SECONDS + 5) * 1000)).toBe(false);
  });
  it("liest Cookies", () => {
    expect(readCookie("a=1; admin_session=xyz; b=2", "admin_session")).toBe("xyz");
    expect(readCookie(null, "admin_session")).toBeUndefined();
    expect(readCookie("a=1", "admin_session")).toBeUndefined();
  });
});
