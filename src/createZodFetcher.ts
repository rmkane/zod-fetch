import type { ZodType } from "zod";

/**
 * A generic fetcher type that returns a `Promise` of unknown data.
 */
type AnyFetcher = (...args: any[]) => Promise<unknown>;

/**
 * The default fetcher that uses the native `fetch` API.
 *
 * It throws an error if the response is not OK (`res.ok === false`),
 * and returns the response body parsed as JSON.
 *
 * @example
 * ```ts
 * const data = await defaultFetcher("https://api.example.com/data");
 * ```
 */
export const defaultFetcher = async (
  ...args: Parameters<typeof fetch>
): Promise<unknown> => {
  const response = await fetch(...args);
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  // Workaround since `response.json()` would throw on empty responses
  const text = await response.text();
  return text.length ? JSON.parse(text) : undefined;
};

/**
 * A function that wraps a fetcher and parses the result using a Zod schema.
 *
 * You can use the function in two ways:
 *
 * 1. As a parser that throws if validation fails:
 *    ```ts
 *    const data = await fetchWithZod(schema, "https://api.example.com");
 *    ```
 *
 * 2. As a `safe` variant that returns the Zod result object instead:
 *    ```ts
 *    const result = await fetchWithZod.safe(schema, "https://api.example.com");
 *    ```
 */
export interface ZodFetcher<TFetcher extends AnyFetcher> {
  /**
   * Parses the result of the fetcher using the given Zod schema.
   *
   * @param schema - The Zod schema to validate against
   * @param args - The arguments to pass to the fetcher
   * @returns The parsed and validated data
   * @throws If the schema validation fails
   */
  <T>(schema: ZodType<T>, ...args: Parameters<TFetcher>): Promise<T>;

  /**
   * Parses the result of the fetcher using the given Zod schema,
   * but returns the `safeParse` result instead of throwing.
   *
   * @param schema - The Zod schema to validate against
   * @param args - The arguments to pass to the fetcher
   * @returns A `safeParse` result: `{ success: true, data }` or `{ success: false, error }`
   */
  safe<T>(
    schema: ZodType<T>,
    ...args: Parameters<TFetcher>
  ): Promise<ReturnType<ZodType<T>["safeParse"]>>;
}

/**
 * Creates a Zod-aware fetcher using the default `fetch` API.
 *
 * @returns A `ZodFetcher` bound to `fetch`.
 */
export function createZodFetcher(): ZodFetcher<typeof fetch>;

/**
 * Creates a Zod-aware fetcher using a custom fetcher function.
 *
 * @param fetcher - A custom fetcher that returns a `Promise<unknown>`
 * @returns A `ZodFetcher` that wraps the provided fetcher
 */
export function createZodFetcher<TFetcher extends AnyFetcher>(
  fetcher: TFetcher
): ZodFetcher<TFetcher>;

/**
 * Internal implementation of `createZodFetcher`.
 */
export function createZodFetcher(
  fetcher: AnyFetcher = defaultFetcher
): ZodFetcher<any> {
  const fetchWithZod = async <T>(
    schema: ZodType<T>,
    ...args: Parameters<AnyFetcher>
  ): Promise<T> => {
    const data = await fetcher(...args);
    return schema.parse(data);
  };

  fetchWithZod.safe = async <T>(
    schema: ZodType<T>,
    ...args: Parameters<AnyFetcher>
  ): Promise<ReturnType<ZodType<T>["safeParse"]>> => {
    const data = await fetcher(...args);
    return schema.safeParse(data);
  };

  return fetchWithZod;
}
