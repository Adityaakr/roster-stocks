# PreStocks API

`GET https://prestocks.com/api/prestocks`, no auth, no pagination (`?page=2` and `?offset=10&limit=10` return the same array). Fetched 2026-09-16; raw response in `sample.json`.

Response: a JSON array with one object per token. Every object has exactly these keys:

| Field | Type | Example (ANDURIL) | Meaning |
|---|---|---|---|
| `name` | str | Anduril PreStocks | display name |
| `symbol` | str | ANDURIL | ticker used on chain (tokenMetadata.symbol) |
| `description` | str | Anduril builds AI-driven defense systems, including autonomo... | company blurb; ends with the backing sentence |
| `image` | str | https://www.prestocks.com/logos/anduril.png | logo URL |
| `external_url` | str | https://www.prestocks.com/anduril | product page |
| `contract_address` | str | PresTj4Yc2bAR197Er7wz4UUKSfqt6FryBEdAriBoQB | Solana mint address (base58), Token-2022 |
| `markPrice` | float | 151.92728019 | offchain reference price per share, USD |
| `markValuation` | int | 123485197756 | markPrice times company share count, USD |
| `tokenPrice` | float | 153.86042698439178 | onchain token price, USD |
| `impliedValuation` | int | 125056442985 | tokenPrice times share count, USD |
| `supply` | float | 11805.980166317 | UI-scaled supply: raw supply / 1e9 times the effective scaled UI multiplier (SPACEX 5, OPENAI 1.4861347, others 1) |

No status, NAV, holder, decimals or program fields. Token program and extensions come from the mint account (see `docs/BOUNTIES.md`, section 2). Token metadata JSON at `https://prestocks.com/metadata/<slug>.json` adds `terms`.

Tokens on 2026-09-16: ANDURIL, ANTHROPIC, FIGUREAI, KALSHI, NEURALINK, OPENAI, POLYMARKET, SPACEX.
