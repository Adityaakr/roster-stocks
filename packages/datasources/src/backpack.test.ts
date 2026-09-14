import { describe, expect, it } from "vitest";
import { BackpackClient, BackpackSecuritiesRail } from "./backpack.js";

// Fixture captured from GET https://api.backpack.exchange/api/v1/securities on 2026-09-14 (first entry).
const securitiesFixture = [
  {
    asset: "AAPL.US",
    cusip: "037833100",
    name: "Apple Inc.",
    sessions: [
      { maxQuantity: "1000", minQuantity: "1", name: "US_EQUITIES_PRE_MARKET", stepSize: "1" },
      { maxQuantity: "10000", minQuantity: "0.01", name: "US_EQUITIES_REGULAR", stepSize: "0.00001" }
    ]
  }
];

const sessionsFixture = [
  {
    description: "US Equities Regular Hours (9:30 AM - 4:00 PM ET)",
    endTime: "16:00:00",
    endWeekday: 5,
    name: "US_EQUITIES_REGULAR",
    startTime: "09:30:00",
    startWeekday: 1,
    timezone: "America/New_York"
  }
];

function fakeFetch(routes: Record<string, unknown>): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
    const body = routes[url.pathname];
    if (body === undefined) return new Response(JSON.stringify({ code: "NOT_FOUND" }), { status: 404 });
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}

describe("BackpackClient", () => {
  it("parses securities and sessions", async () => {
    const client = new BackpackClient({ fetchImpl: fakeFetch({ "/api/v1/securities": securitiesFixture, "/api/v1/market-sessions": sessionsFixture }) });
    const secs = await client.securities();
    expect(secs[0]?.asset).toBe("AAPL.US");
    expect(secs[0]?.cusip).toBe("037833100");
    const sessions = await client.marketSessions();
    expect(sessions[0]?.timezone).toBe("America/New_York");
  });

  it("rail finds AAPL by ticker or CUSIP and reports mint/redeem as unavailable", async () => {
    const rail = new BackpackSecuritiesRail(new BackpackClient({ fetchImpl: fakeFetch({ "/api/v1/securities": securitiesFixture }) }));
    expect((await rail.findSecurity({ ticker: "AAPL" }))?.cusip).toBe("037833100");
    expect((await rail.findSecurity({ cusip: "037833100" }))?.asset).toBe("AAPL.US");
    expect(await rail.findSecurity({ ticker: "ZZZZ" })).toBeNull();
    expect(rail.mintRedeemStatus().available).toBe(false);
  });
});
