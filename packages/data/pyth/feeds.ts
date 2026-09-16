/**
 * Pyth price feed ids, read live from https://hermes.pyth.network/v2/price_feeds on 2026-09-16 (public endpoint).
 * Price endpoints (Hermes latest, Benchmarks historical) require `Authorization: Bearer <PYTH_API_KEY>` since 2026-08-26
 * (https://docs.pyth.network/price-feeds/core/use-historical-price-data). Feed metadata and market hours stay public.
 * Not wired into the app yet: section 12.4 is gated on a key.
 */
export const PYTH_FEEDS = {
  "Equity.US.AAPL/USD": { id: "49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688", assetType: "Equity", schedule: "America/New_York;0930-1600 weekdays plus holidays" },
  "Equity.Index.AAPL/USD": { id: "aaba35e6f33fb973bb2201d48a79ae24795affa6ba8bd50a93dcaf7da0030f36", assetType: "Equity", schedule: "described as 24/7; schedule attribute still 0930-1600" },
  "Equity.US.SPY/USD": { id: "19e09bb805456ada3979a7d1cbb4b6d63babc3a0f8e8a9509f68afa5c4c11cd5", assetType: "Equity", schedule: "0930-1600 ET weekdays" },
  "Equity.US.TSLA/USD": { id: "16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1", assetType: "Equity", schedule: "0930-1600 ET weekdays" },
  "Equity.US.NVDA/USD": { id: "b1073854ed24cbc755dc527418f52b7d271f6cc967bbf8d8129112b18860a593", assetType: "Equity", schedule: "0930-1600 ET weekdays" },
  "Crypto.AAPLX/USD": { id: "978e6cc68a119ce066aa830017318563a9ed04ec3a0a6439010fc11296a58675", assetType: "Crypto", schedule: "always open" },
  "Crypto.SPYX/USD": { id: "2817b78438c769357182c04346fddaad1178c82f4048828fe0997c3c64624e14", assetType: "Crypto", schedule: "always open" },
  "Crypto.AAPLON/USD": { id: "e6734de88a83d9d2fb33072adab319004700aefd069653aba30ba9e3cac056f2", assetType: "Crypto", schedule: "always open" },
  "Crypto.AAPLX/AAPL.RR": { id: "25babb83691a056fd65f879bfd7197eabd840aae741f69c87ccb31e204a979b2", assetType: "Crypto Redemption Rate", schedule: "always open" },
  "Crypto.SPYX/SPY.RR": { id: "9e916cc00d292da2367646ffd6537d6b8d0c3f15e2d5891ac44aed31291811a9", assetType: "Crypto Redemption Rate", schedule: "always open" }
} as const;

export const PYTH_ENDPOINTS = {
  feedsPublic: "https://hermes.pyth.network/v2/price_feeds?asset_type=equity",
  latest: "https://hermes.pyth.network/v2/updates/price/latest?ids[]=<id>&parsed=true",
  historical: "https://benchmarks.pyth.network/v1/updates/price/<unixSeconds>?ids=<id>&parsed=true",
  docsHistorical: "https://docs.pyth.network/price-feeds/core/use-historical-price-data",
  docsMarketHours: "https://docs.pyth.network/price-feeds/pro/market-hours"
} as const;
