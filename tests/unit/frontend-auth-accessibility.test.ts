import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");

describe("contratos acessíveis dos formulários de conta (FUX-012)", () => {
  it("não aninha botão interativo dentro de Link", () => {
    for (const file of [
      "components/forms/RegisterForm.tsx",
      "components/forms/ForgotPasswordForm.tsx",
      "components/forms/ResetPasswordForm.tsx",
    ]) {
      expect(source(file)).not.toMatch(/<Link[^>]*>\s*<button/);
    }
  });

  it("mantém política de oito caracteres e toggle de senha operável", () => {
    const reset = source("components/forms/ResetPasswordForm.tsx");
    const register = source("components/forms/RegisterForm.tsx");
    expect(reset).toContain("password.length < 8");
    expect(reset.match(/minLength=\{8\}/g)).toHaveLength(2);
    expect(reset).toContain('autoComplete="new-password"');
    expect(reset).toContain('aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}');
    expect(reset).not.toContain("tabIndex={-1}");
    expect(register).toContain("formData.password.length < 8");
  });

  it("associa erros aos campos e anuncia falhas assíncronas", () => {
    const login = source("components/forms/LoginForm.tsx");
    const forgot = source("components/forms/ForgotPasswordForm.tsx");
    const reset = source("components/forms/ResetPasswordForm.tsx");
    const register = source("components/forms/RegisterForm.tsx");

    for (const content of [login, forgot, reset, register]) {
      expect(content).toContain('role="alert"');
    }
    expect(forgot).toContain('aria-describedby={errorMessage ? "forgot-password-error" : undefined}');
    expect(reset).toContain('aria-describedby={errorMessage ? "reset-password-error" : undefined}');
    expect(register).toContain('"aria-describedby": errors[fieldName]');
    expect(register).toContain("requestAnimationFrame");
  });
});
