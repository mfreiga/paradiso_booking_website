import { describe, expect, it } from "vitest";
import { generatePassword, hashPassword, passwordProblem, verifyPassword } from "./password";

describe("password hashing", () => {
  it("verifies the right password and rejects others", async () => {
    const hash = await hashPassword("schere-2026-fade");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(hash).not.toContain("schere");
    expect(await verifyPassword("schere-2026-fade", hash)).toBe(true);
    expect(await verifyPassword("schere-2026-fadf", hash)).toBe(false);
    expect(await verifyPassword("", hash)).toBe(false);
  });

  it("salts: same password, different hashes", async () => {
    expect(await hashPassword("gleiches-passwort")).not.toBe(await hashPassword("gleiches-passwort"));
  });

  it("rejects missing or malformed stored hashes", async () => {
    expect(await verifyPassword("x", null)).toBe(false);
    expect(await verifyPassword("x", "plaintext")).toBe(false);
    expect(await verifyPassword("x", "scrypt$16384$$")).toBe(false);
  });
});

describe("generated one-time passwords", () => {
  it("are readable, long enough and pass the length rule", () => {
    for (let i = 0; i < 50; i++) {
      const pw = generatePassword();
      expect(pw).toMatch(/^[a-z]+-\d{4}-[a-z]+$/);
      expect(passwordProblem(pw)).toBeNull();
    }
  });

  it("length rule", () => {
    expect(passwordProblem("kurz")).not.toBeNull();
    expect(passwordProblem("lang-genug-123")).toBeNull();
  });
});
