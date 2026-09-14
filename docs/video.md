# 90-second video script

Five scenes, in the order `pnpm demo` runs them. Record the terminal on the left and the app on the right. No music under the voice. Every number on screen comes from the run, nothing is typed in.

| Time | Scene | On screen | Voice |
|---|---|---|---|
| 0:00 to 0:12 | The problem | Landing page. The supply map draws: SPYx, 30.35% of supply in programs; AAPLx 1.88%. | Tokenized stocks are composable. They sit in Raydium pools and Kamino reserves. Shareholder records are not. A wallet scan at a record date misses everything a program holds. |
| 0:12 to 0:30 | Scene 1, resolve | Holder page as Alice. Ledger assembles: wallet 25.00, Raydium 35.00, Kamino 40.00, total counts up to 100.00. Chip: 75.00 recovered from DeFi positions. | Alice holds 100 shares of AAPLx. A wallet scanner sees 25. Lookthrough resolves all 100 across her wallet, her Raydium position and her Kamino deposit, with the evidence for each row. |
| 0:30 to 0:40 | Scene 2, register | Click "Register for corporate actions". Chip flips to "Registered at slot …". | One signature registers the wallet for corporate actions on this mint. No identity, no KYC. It is a public opt-in. |
| 0:40 to 1:00 | Scene 3, snapshot and publish | Issuer console: record slot scheduled, snapshot progress counters, supply panel settles at the attributed percentage, root and content hash, publish and fund. | The registrar, simulated here, declares a 0.25 USDC per share distribution. At the record slot every token account of the mint is attributed exactly once. Attributed plus unattributed equals supply, or the run fails. Only the root and a content hash go on-chain. |
| 1:00 to 1:15 | Scene 4, claim | Holder page: "Claim 25.00 USDC" becomes "Claimed 25.00 USDC" with the transaction link. Wallet, Raydium and Kamino rows unchanged. | Alice claims 25 USDC with a Merkle proof. Her Raydium and Kamino positions never moved. The program checked registration, inclusion and single use. A second claim is rejected. |
| 1:15 to 1:30 | Scene 5, vote | Vote action: Alice votes For with 100 votes, Bob Against, Carol Abstain. Tally shows verified weight. Proof page: verify a wallet in the browser. | The same record date opens a vote. xStocks carry no voting rights, so this vote is a simulated issuer showing the rail. Anyone can download the entitlement set, recompute the root, and verify a wallet in the browser. |

Closing card: "Lookthrough. Street-name infrastructure for tokenized stocks on Solana. Demo on a mainnet fork. Issuer role simulated."
