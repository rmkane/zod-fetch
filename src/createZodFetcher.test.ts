// Built-in or polyfill-style imports
import "isomorphic-fetch";

// Third-party modules
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { z, ZodError } from "zod";

// Local project modules
import { createZodFetcher } from ".";

const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

it("Should create a default fetcher", async () => {
  server.use(
    http.get("https://example.com", () => {
      return HttpResponse.json({ hello: "world" }, { status: 200 });
    })
  );

  const fetchWithZod = createZodFetcher();

  const response = await fetchWithZod(
    z.object({
      hello: z.string(),
    }),
    "https://example.com"
  );

  expect(response).toEqual({
    hello: "world",
  });
});

it("Should successfully parse empty responses with the default fetcher", async () => {
  server.use(
    http.get("https://example.com", () => {
      return new HttpResponse("", { status: 200 });
    })
  );

  const fetchWithZod = createZodFetcher();

  const response = await fetchWithZod(
    z.undefined(),
    "https://example.com",
  );

  expect(response).toBeUndefined();
});

it("Should throw an error with mis-matched schemas with a default fetcher", async () => {
  server.use(
    http.get("https://example.com", () => {
      return HttpResponse.json({ hello: "world" }, { status: 200 });
    })
  );

  const fetchWithZod = createZodFetcher();

  try {
    await fetchWithZod(
      z.object({
        hello: z.number(),
      }),
      "https://example.com"
    );
    throw new Error("Expected ZodError but none was thrown");
  } catch (err) {
    expect(err).toBeInstanceOf(ZodError);
    expect((err as ZodError).issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "invalid_type",
          expected: "number",
          message: "Invalid input: expected number, received string",
          path: ["hello"],
        }),
      ])
    );
  }
});

it("Should throw an error if response is not ok with the default fetcher", async () => {
  server.use(
    http.get("https://example.com", () => {
      return HttpResponse.json(
        { error: "Invalid permissions" },
        { status: 403 }
      );
    })
  );

  const fetchWithZod = createZodFetcher();

  await expect(
    fetchWithZod(
      z.object({
        hello: z.number(),
      }),
      "https://example.com"
    )
  ).rejects.toMatchInlineSnapshot("[Error: Request failed with status 403]");
});

it("Should handle successes with custom fetchers", async () => {
  const fetcher = createZodFetcher(async () => {
    return fetch("https://example.com").then((res) => res.json());
  });

  server.use(
    http.get("https://example.com", () => {
      return HttpResponse.json({ hello: "world" }, { status: 200 });
    })
  );

  const response = await fetcher(
    z.object({
      hello: z.string(),
    })
  );

  expect(response).toEqual({
    hello: "world",
  });
});
