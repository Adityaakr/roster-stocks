/**
 * Adapters that are declared but not implemented in v1. They discover nothing and never resolve,
 * so anything held by these programs lands in the unattributed bucket with a label.
 */
import type { ContainerInfo, EntitlementPosition, PositionAdapter, SnapshotContext } from "@lookthrough/core";

class StubAdapter implements PositionAdapter {
  readonly status = "stub" as const;
  constructor(readonly id: string, readonly displayName: string) {}
  async discoverContainers(_mint: string, _ctx: SnapshotContext): Promise<ContainerInfo[]> {
    return [];
  }
  async resolve(): Promise<EntitlementPosition[]> {
    throw new Error(`${this.id} is not implemented`);
  }
}

export const meteoraDlmmStub = new StubAdapter("meteora_dlmm", "Meteora DLMM");
export const orcaWhirlpoolStub = new StubAdapter("orca_whirlpool", "Orca Whirlpool");
export const basketsStub = new StubAdapter("baskets", "Baskets and index vaults");
export const backpackOmnibusStub = new StubAdapter("backpack_omnibus", "Backpack omnibus");
