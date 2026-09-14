import { describe, expect, it } from "vitest";
import { HttpClient } from "./http.js";

describe("HttpClient", () => {
  it("retries 429 then succeeds, and caches GET", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      if (calls === 1) return new Response(JSON.stringify({ error: { _tag: "RateLimitedError", message: "slow down" } }), { status: 429, headers: { "x-request-id": "req-1" } });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as typeof fetch;
    const logs: string[] = [];
    const client = new HttpClient({ baseUrl: "https://example.test", fetchImpl, logger: (m) => logs.push(m), maxRetries: 2 });
    expect(await client.get("/x")).toEqual({ ok: true });
    expect(await client.get("/x")).toEqual({ ok: true });
    expect(calls).toBe(2);
    expect(logs[0]).toContain("req-1");
  });

  it("surfaces the tokens.xyz error envelope and request id on 401", async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ error: { _tag: "UnauthorizedError", message: "Missing API key" } }), { status: 401, headers: { "x-request-id": "abc" } })) as typeof fetch;
    const client = new HttpClient({ baseUrl: "https://example.test", fetchImpl });
    await expect(client.get("/y")).rejects.toMatchObject({ status: 401, requestId: "abc" });
  });
});
