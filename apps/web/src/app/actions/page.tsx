import Link from "next/link";
import { store } from "@/lib/server";
import { shares, slotLabel } from "@/lib/format";
import { Empty } from "@/components/states";

export const dynamic = "force-dynamic";

/** Proof explorer: every action the registrar has scheduled, with its snapshot and root. */
export default function ActionsPage() {
  const actions = store().list();
  return (
    <div className="pt-12">
      <h1 className="text-[28px]">Actions</h1>
      <p className="text-ink-2 mt-1 max-w-[720px]">Every record-date snapshot, its root and content hash, and a download of the entitlement set anyone can recompute the root from.</p>
      {actions.length === 0 ? (
        <div className="mt-6">
          <Empty title="No actions yet." action="Schedule one in the issuer console, or run pnpm demo." />
        </div>
      ) : (
        <div className="mt-6 panel overflow-x-auto">
          <table className="ledger w-full text-[14px]">
            <thead>
              <tr><th>Action</th><th>Kind</th><th>Status</th><th className="num">Record slot</th><th className="num">Attributed</th><th className="num">Leaves</th><th className="num">Total shares</th></tr>
            </thead>
            <tbody>
              {actions.map((a) => (
                <tr key={a.id}>
                  <td><Link className="text-accent" href={`/actions/${a.id}`}>{a.id}</Link></td>
                  <td>{a.kind}</td>
                  <td>{a.status}</td>
                  <td className="num">{a.snapshot ? slotLabel(a.snapshot.slotActual) : slotLabel(a.recordSlot)}</td>
                  <td className="num">{a.snapshot ? `${a.snapshot.attributedPct}%` : "…"}</td>
                  <td className="num">{a.snapshot?.leaves ?? "…"}</td>
                  <td className="num">{a.snapshot ? shares(a.snapshot.totalEntitlement) : "…"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
