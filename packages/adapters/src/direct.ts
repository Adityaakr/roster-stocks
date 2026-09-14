/**
 * Direct balances: a token account whose owner is an on-curve wallet. 100% to that wallet.
 */
import type { ContainerInfo, EntitlementPosition, PositionAdapter, SnapshotContext } from "@lookthrough/core";

export class DirectBalanceAdapter implements PositionAdapter {
  readonly id = "direct";
  readonly status = "implemented" as const;

  async discoverContainers(): Promise<ContainerInfo[]> {
    // Wallet-owned accounts are found by the token-account scan, not by discovery.
    return [];
  }

  async resolve(container: ContainerInfo, mint: string, _ctx: SnapshotContext): Promise<EntitlementPosition[]> {
    const owner = container.meta.owner as string;
    const amountRaw = BigInt(container.meta.amountRaw as string);
    if (amountRaw === 0n) return [];
    return [
      {
        wallet: owner,
        mint,
        source: "direct",
        container: container.address,
        rawAttributed: amountRaw,
        ruleApplied: "direct",
        evidence: { tokenAccount: container.address, owner, amountRaw: amountRaw.toString() }
      }
    ];
  }
}
