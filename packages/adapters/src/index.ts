import type { PositionAdapter } from "@lookthrough/core";
import { DirectBalanceAdapter } from "./direct";
import { RaydiumClmmAdapter } from "./raydiumClmm";
import { KaminoLendAdapter } from "./kaminoLend";
import { backpackOmnibusStub, basketsStub, meteoraDlmmStub, orcaWhirlpoolStub } from "./stubs";

export * from "./direct";
export * from "./raydiumClmm";
export * from "./kaminoLend";
export * from "./stubs";

/** The adapter registry, in the order containers are discovered. */
export function defaultAdapters(): PositionAdapter[] {
  return [new DirectBalanceAdapter(), new RaydiumClmmAdapter(), new KaminoLendAdapter(), meteoraDlmmStub, orcaWhirlpoolStub, basketsStub, backpackOmnibusStub];
}

export function adapterStatusTable(adapters: PositionAdapter[] = defaultAdapters()): { id: string; status: string }[] {
  return adapters.map((a) => ({ id: a.id, status: a.status }));
}
