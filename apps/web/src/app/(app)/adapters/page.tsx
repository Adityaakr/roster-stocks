import { adapterStatusTable } from "@lookthrough/adapters";
import { Badge, KV } from "@/components/ui";

export const dynamic = "force-dynamic";

const DESCRIPTIONS: Record<string, { name: string; containers: string; rule: string }> = {
  direct: { name: "Wallet balances", containers: "token accounts owned by on-curve keys", rule: "balance × multiplier" },
  raydium_clmm: { name: "Raydium CLMM", containers: "vaults of every pool whose mintA or mintB is the mint", rule: "liquidity to amounts at the pool price plus fees owed, pro rata to the vault after protocol and fund fees" },
  kamino_lend: { name: "Kamino Lend", containers: "supply vault of every reserve whose liquidity mint is the mint", rule: "vault × cTokens ÷ cToken supply, per obligation and per on-curve cToken holder" },
  meteora_dlmm: { name: "Meteora DLMM", containers: "bin-array reserves of every pair with the mint", rule: "not implemented; balances are labelled and left unattributed" },
  orca_whirlpool: { name: "Orca Whirlpool", containers: "whirlpool vaults", rule: "not implemented; balances are labelled and left unattributed" },
  baskets: { name: "Baskets and index vaults", containers: "vault token accounts", rule: "not implemented; balances are labelled and left unattributed" },
  backpack_omnibus: { name: "Backpack omnibus", containers: "exchange custody accounts", rule: "not implemented; balances are labelled and left unattributed" }
};

/** The adapter registry as compiled into the resolver, plus the interface every adapter implements. */
export default function AdaptersPage() {
  const table = adapterStatusTable();
  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="h3">Adapters</h1>
          <p className="body-sm">Every adapter the resolver compiles in, in discovery order. Stubs discover nothing, so what they would cover stays labelled and unattributed. Programs not in this list are named from their on-chain Anchor IDL when one exists.</p>
        </div>
      </div>
      <div className="card scroll-x">
        <table className="table">
          <thead><tr><th>Adapter</th><th>Status</th><th>Containers</th><th>Rule</th></tr></thead>
          <tbody>
            {table.map((a) => {
              const d = DESCRIPTIONS[a.id] ?? { name: a.id, containers: "", rule: "" };
              return (
                <tr key={a.id}>
                  <td><div style={{ fontWeight: 500 }}>{d.name}</div><div className="small mono">{a.id}</div></td>
                  <td><Badge tone={a.status === "implemented" ? "green" : "yellow"} dot>{a.status}</Badge></td>
                  <td className="small">{d.containers}</td>
                  <td className="small">{d.rule}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="grid-2" style={{ marginTop: 16 }}>
        <div className="card pad">
          <div className="h6">The interface</div>
          <p className="small" style={{ marginTop: 6 }}>Two methods. Discovery runs first for every adapter, then resolution for the implemented ones.</p>
          <pre className="log" style={{ marginTop: 12, maxHeight: "none" }}>{`interface PositionAdapter {
  id: string;
  status: "implemented" | "stub";
  discoverContainers(mint, ctx): Promise<ContainerInfo[]>;
  resolve(container, mint, ctx): Promise<EntitlementPosition[]>;
}`}</pre>
        </div>
        <div className="card pad">
          <div className="h6">Invariants</div>
          <div style={{ marginTop: 12 }}>
            <KV items={[
              { k: "Hard", v: "attributed + unattributed == token-account balances" },
              { k: "Soft", v: "that sum vs mint supply, warned not failed" },
              { k: "Double counting", v: "each container attributed by one adapter" },
              { k: "Rounding", v: "remainder to an unattributed row, never a position" },
              { k: "Share units", v: "floor once per wallet, six decimals" }
            ]} />
          </div>
        </div>
      </div>
    </div>
  );
}
