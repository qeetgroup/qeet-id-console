import {
  Button,
  Card,
  CardContent,
  cn,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  PasswordInput,
  PasswordStrengthMeter,
  scorePassword,
} from "@qeetrix/ui";
import { Link } from "@tanstack/react-router";
import { Loader2Icon } from "lucide-react";
import type * as React from "react";
import { useState } from "react";

import { BrandHero } from "./brand-hero";
import { SocialButtons } from "./social-buttons";

export type SignupFormValues = {
  email: string;
  password: string;
  display_name: string;
};

type SignupFormProps = React.ComponentProps<"div"> & {
  isLoading?: boolean;
  errorMessage?: string;
  onSignup?: (values: SignupFormValues) => void;
};

export function SignupForm({
  className,
  isLoading = false,
  errorMessage,
  onSignup,
  ...props
}: SignupFormProps) {
  const [mismatch, setMismatch] = useState(false);
  const [password, setPassword] = useState("");
  const passwordScore = scorePassword(password);

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden p-0">
        <CardContent className="grid p-0 md:min-h-160 md:grid-cols-2">
          <form
            className="flex flex-col justify-center p-6 md:p-8"
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              const password = String(data.get("password") ?? "");
              const confirm = String(data.get("confirm_password") ?? "");
              if (password !== confirm) {
                setMismatch(true);
                return;
              }
              setMismatch(false);
              onSignup?.({
                email: String(data.get("email") ?? "").trim(),
                password,
                display_name: String(data.get("display_name") ?? "").trim(),
              });
            }}
          >
            <FieldGroup>
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-2xl font-bold">Create your account</h1>
                <p className="text-sm text-balance text-muted-foreground">
                  You&apos;ll set up your first organization right after verifying your email.
                </p>
              </div>

              <Field>
                <FieldLabel htmlFor="display_name">Your name</FieldLabel>
                <Input
                  id="display_name"
                  name="display_name"
                  type="text"
                  placeholder="Jane Doe"
                  required
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input id="email" name="email" type="email" placeholder="jane@acme.test" required />
              </Field>

              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <PasswordInput
                  id="password"
                  name="password"
                  placeholder="At least 8 characters"
                  minLength={8}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-describedby="password-strength"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="confirm_password">Confirm password</FieldLabel>
                <PasswordInput
                  id="confirm_password"
                  name="confirm_password"
                  placeholder="Re-enter your password"
                  minLength={8}
                  required
                />
              </Field>
              {password.length > 0 && (
                <PasswordStrengthMeter
                  value={password}
                  className="mt-1"
                  feedback={
                    passwordScore < 3
                      ? ["Use 12+ characters mixing upper/lower case, digits, and symbols."]
                      : undefined
                  }
                />
              )}

              {mismatch && (
                <Field>
                  <FieldError>Passwords don&apos;t match.</FieldError>
                </Field>
              )}
              {errorMessage && !mismatch && (
                <Field>
                  <FieldError>{errorMessage}</FieldError>
                </Field>
              )}

              <Field>
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2Icon className="animate-spin" />}
                  {isLoading ? "Creating account…" : "Create account"}
                </Button>
              </Field>

              <SocialButtons verb="Sign up" intent="signup" />

              <FieldDescription className="text-center">
                Already have an account? <Link to="/sign-in">Sign in</Link>
              </FieldDescription>
            </FieldGroup>
          </form>
          <BrandHero />
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        By clicking continue, you agree to our{" "}
        <a href="/terms" target="_blank" rel="noopener noreferrer">
          Terms of Service
        </a>{" "}
        and{" "}
        <a href="/privacy" target="_blank" rel="noopener noreferrer">
          Privacy Policy
        </a>
        .
      </FieldDescription>
    </div>
  );
}
