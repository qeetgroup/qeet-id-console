// @vitest-environment jsdom
import { CheckIcon } from "@qeetrix/icons";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { ApiError } from "@/platform/errors/api-error";

import { applyServerErrors, FieldFrame, FormError, useAppForm } from "../app-form";

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

const settingsSchema = z.object({ enabled: z.boolean(), plan: z.string(), tags: z.string() });

function SettingsForm({ refuse }: { refuse?: unknown }) {
  const form = useAppForm({
    defaultValues: { enabled: false, plan: "free", tags: "" },
    validators: { onSubmit: settingsSchema },
    onSubmit: async ({ formApi }) => {
      if (refuse) applyServerErrors(formApi, refuse);
    },
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.AppField name="enabled">
        {(field) => <field.SwitchField label="Enabled" description="Turns it on." />}
      </form.AppField>
      <form.AppField name="plan">
        {(field) => (
          <field.SelectField
            label="Plan"
            options={[
              { value: "free", label: "Free" },
              { value: "pro", label: "Pro" },
            ]}
          />
        )}
      </form.AppField>
      <form.AppField name="tags">
        {(field) => (
          <FieldFrame label="Tags">
            <span>{field.state.value || "none"}</span>
          </FieldFrame>
        )}
      </form.AppField>
      <form.AppForm>
        <form.SubmitButton requireChanges icon={<CheckIcon />}>
          Save
        </form.SubmitButton>
      </form.AppForm>
    </form>
  );
}

describe("the field components", () => {
  it("labels a switch and a select, and keeps Save off until a value changes", () => {
    render(<SettingsForm />);
    const save = screen.getByRole("button", { name: "Save" });
    expect(save.getAttribute("aria-disabled")).toBe("true");
    expect(save.querySelector("[data-slot='button-icon']")).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Plan" }).textContent).toContain("Free");

    fireEvent.click(screen.getByRole("switch", { name: "Enabled" }));
    expect(screen.getByRole("switch", { name: "Enabled" }).getAttribute("aria-checked")).toBe(
      "true",
    );
    expect(save.getAttribute("aria-disabled")).toBe("false");
  });

  it("puts a 422 on a switch and a custom control in place of their descriptions", async () => {
    const refusal422 = new ApiError(422, "validation_failed", "x", undefined, false, undefined, {
      fields: [
        { field: "enabled", code: "too_long" },
        { field: "tags", code: "too_long" },
      ],
    });
    render(<SettingsForm refuse={refusal422} />);
    fireEvent.click(screen.getByRole("switch", { name: "Enabled" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findAllByText("This is too long.")).toHaveLength(2);
    expect(screen.queryByText("Turns it on.")).toBeNull();
    expect(screen.getByRole("switch", { name: "Enabled" }).getAttribute("aria-invalid")).toBe(
      "true",
    );
  });
});
