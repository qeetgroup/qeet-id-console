import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("@/platform/api/client", () => ({ api: vi.fn(async () => ({})) }));

import { backend, fillPath } from "../backend";
import { api } from "../client";

beforeEach(() => vi.mocked(api).mockClear());

describe("fillPath", () => {
  it("puts each placeholder's value in, encoded", () => {
    expect(fillPath("/v1/users/{userID}/sessions", { userID: "a b" })).toBe(
      "/v1/users/a%20b/sessions",
    );
  });

  it("refuses to send a path with a placeholder left empty", () => {
    expect(() => fillPath("/v1/users/{userID}", {})).toThrow("No value for {userID}");
    expect(() => fillPath("/v1/users/{userID}", { userID: "" })).toThrow("No value for {userID}");
  });
});

describe("backend", () => {
  it("sends a read as the plain api() call it replaces", async () => {
    await backend.get("/v1/users/{userID}/organizations/{organizationID}/permissions", {
      path: { userID: "u-1", organizationID: "o-1" },
    });
    expect(api).toHaveBeenCalledWith("/v1/users/u-1/organizations/o-1/permissions");
  });

  it("sends the method, the body and a query, with booleans as words", async () => {
    await backend.post("/v1/auth/switch-organization", { body: { organization_id: "o-2" } });
    expect(api).toHaveBeenLastCalledWith("/v1/auth/switch-organization", {
      method: "POST",
      body: { organization_id: "o-2" },
    });
    await backend.get("/v1/users", { query: { limit: 50, email_verified: true, q: undefined } });
    expect(api).toHaveBeenLastCalledWith("/v1/users", {
      query: { limit: 50, email_verified: "true" },
    });
  });

  it("sends a repeatable parameter as a list", async () => {
    await backend.get("/v1/users", { query: { id: ["u-1", "u-2"], include_deleted: true } });
    expect(api).toHaveBeenLastCalledWith("/v1/users", {
      query: { id: ["u-1", "u-2"], include_deleted: "true" },
    });
  });

  it("passes the schema and the signal on", async () => {
    const schema = z.object({ items: z.array(z.unknown()) });
    const signal = new AbortController().signal;
    await backend.get("/v1/me/organizations", { schema, signal });
    expect(api).toHaveBeenLastCalledWith("/v1/me/organizations", { signal, schema });
  });

  it("holds every call to the server's documents", () => {
    // Never run: the typecheck is the test. Each @ts-expect-error fails the build once the call
    // it marks would compile, so these show what the contract check catches.
    const typecheckOnly = async () => {
      // A path the server doesn't have.
      // @ts-expect-error renamed to /v1/organizations
      await backend.get("/v1/tenants");
      // A method the path doesn't answer.
      // @ts-expect-error /v1/me is GET and PATCH
      await backend.delete("/v1/me");
      // A path whose placeholder isn't given.
      // @ts-expect-error its id is required
      await backend.get("/v1/users/{id}");
      // A query parameter the operation doesn't read.
      // @ts-expect-error the members list pages by cursor only
      await backend.get("/v1/users", { query: { offset: 0 } });
      // A body field the server refuses.
      // @ts-expect-error tenant_id is now organization_id
      await backend.post("/v1/auth/switch-organization", { body: { tenant_id: "o-1" } });
      // A body sent to an operation that takes none.
      // @ts-expect-error the passkey challenge takes no body
      await backend.post("/v1/mfa/webauthn/challenge", { body: {} });
      const me = await backend.get("/v1/me");
      // A field the answer doesn't have.
      // @ts-expect-error /v1/me answers organization_id
      void me.tenant_id;
      const page = await backend.get("/v1/me/organizations");
      // An optional field read as always there.
      // @ts-expect-error the last page leaves next_cursor out
      const cursor: string = page.next_cursor;
      void cursor;
      await backend.get("/v1/me/organizations", {
        // @ts-expect-error the schema would refuse the last page, which has no next_cursor
        schema: z.object({ items: z.array(z.unknown()), next_cursor: z.string() }),
      });
      await backend.get("/v1/me/organizations", {
        // @ts-expect-error last_used_at is null for an organisation never opened
        schema: z.object({ items: z.array(z.object({ last_used_at: z.string() })) }),
      });
      // A narrower value is a deliberate fail-closed check, and compiles.
      await backend.post("/v1/mfa/totp/verify", {
        body: { code: "123456" },
        schema: z.object({ verified: z.literal(true) }),
      });
    };
    expect(typecheckOnly).toBeTypeOf("function");
  });
});
