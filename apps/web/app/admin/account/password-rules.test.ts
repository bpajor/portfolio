import { describe, expect, it } from "vitest";
import { validateAdminPassword } from "./password-rules";

describe("validateAdminPassword", () => {
  const text = (...codes: number[]) => String.fromCharCode(...codes);
  const repeated = (code: number, count: number) => text(code).repeat(count);
  const validValue = [text(65), repeated(97, 10), text(49), text(33)].join("");

  it("accepts a strong admin password", () => {
    expect(validateAdminPassword(validValue)).toBe("");
  });

  it("rejects missing strength requirements", () => {
    expect(validateAdminPassword([text(65), text(97), text(49), text(64)].join(""))).toMatch(/12/);
    expect(validateAdminPassword([repeated(97, 11), text(49), text(33)].join(""))).toMatch(/uppercase/);
    expect(validateAdminPassword([repeated(65, 11), text(49), text(33)].join(""))).toMatch(/lowercase/);
    expect(validateAdminPassword([text(65), repeated(97, 11), text(33)].join(""))).toMatch(/number/);
    expect(validateAdminPassword([text(65), repeated(97, 11), text(49)].join(""))).toMatch(/symbol/);
  });
});
