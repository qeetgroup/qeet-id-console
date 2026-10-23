// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { ApiError } from "@/platform/errors/api-error";

import { applyServerErrors, FormError, useAppForm } from "../app-form";

afterEach(cleanup);

const schema = z.object({
  email: z.email("Enter an email."),
  display_name: z.string(),
});

function ProfileForm({ submit, error }: { submit: () => Promise<void>; error?: unknown }) {
  const form = useAppForm({
    defaultValues: { email: "", display_name: "" },
    validators: { onSubmit: schema },
    onSubmit: async ({ formApi }) => {
      try {
        await submit();
      } catch (err) {
        applyServerErrors(formApi, err, { name: "display_name" });
      }
    },
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.AppField name="email">
        {(field) => <field.TextField label="Email" required />}
      </form.AppField>
      <form.AppField name="display_name">
        {(field) => <field.TextField label="Name" description="Shown to others." />}
      </form.AppField>
      <FormError error={error} />
      <form.AppForm>
        <form.SubmitButton>Save</form.SubmitButton>
      </form.AppForm>
    </form>
  );
}

const refusal = new ApiError(
  422,
  "validation_failed",
  "backend text",
  undefined,
  false,
  undefined,
  {
    requestId: "req-42",
    fields: [
      { field: "email", code: "invalid_email" },
      { field: "name", code: "too_long" },
    ],
  },
);

describe("useAppForm", () => {
  it("labels each field and shows the schema's message on submit", async () => {
    const submit = vi.fn(async () => undefined);
    render(<ProfileForm submit={submit} />);

    expect(screen.getByRole("textbox", { name: /Email/ }).getAttribute("aria-required")).toBe(
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Enter an email.")).toBeTruthy();
    expect(screen.getByRole("textbox", { name: /Email/ }).getAttribute("aria-invalid")).toBe(
      "true",
    );
    expect(submit).not.toHaveBeenCalled();
  });

  it("marks the fields a 422 names, mapping body keys, and clears one once edited", async () => {
    render(<ProfileForm submit={vi.fn(async () => Promise.reject(refusal))} />);
    fireEvent.change(screen.getByRole("textbox", { name: /Email/ }), {
      target: { value: "asha@example.test" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Enter a valid email address.")).toBeTruthy();
    expect(screen.getByText("This is too long.")).toBeTruthy();
    expect(screen.queryByText("backend text")).toBeNull();

    act(() => {
      fireEvent.change(screen.getByRole("textbox", { name: /Email/ }), {
        target: { value: "asha@example.org" },
      });
    });
    await waitFor(() => expect(screen.queryByText("Enter a valid email address.")).toBeNull());
    expect(screen.getByText("This is too long.")).toBeTruthy();
  });

  it("shows a refusal's safe message with its support reference", () => {
    render(<ProfileForm submit={vi.fn()} error={refusal} />);
    expect(
      screen.getByText("Some of the details entered aren't valid. Please review and try again.", {
        exact: false,
      }),
    ).toBeTruthy();
    expect(screen.getByText("req-42")).toBeTruthy();
  });
});
