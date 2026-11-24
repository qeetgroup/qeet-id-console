import { describe, expect, it } from "vitest";

import { assured, assuredItems } from "../assured";

type Person = { id?: string; email?: string; name?: string | null };

describe("assured", () => {
  const person = assured<Person>()("id", "email");

  it("passes a record with the fields the console relies on, keeping the rest", () => {
    expect(person.parse({ id: "u-1", email: "a@example.com", extra: 1 })).toEqual({
      id: "u-1",
      email: "a@example.com",
      extra: 1,
    });
  });

  it("refuses one without them, or with them null", () => {
    expect(person.safeParse({ id: "u-1" }).success).toBe(false);
    expect(person.safeParse({ id: null, email: "a@example.com" }).success).toBe(false);
    expect(person.safeParse(null).success).toBe(false);
  });
});

describe("assuredItems", () => {
  const page = assuredItems<{ items?: Person[]; total?: number }>()("id");

  it("passes a page whose items all carry the fields", () => {
    expect(page.parse({ items: [{ id: "u-1" }], total: 1 }).items[0]?.id).toBe("u-1");
  });

  it("refuses a page with no items list, or an item without them", () => {
    expect(page.safeParse({ total: 0 }).success).toBe(false);
    expect(page.safeParse({ items: [{ email: "a@example.com" }] }).success).toBe(false);
  });
});
