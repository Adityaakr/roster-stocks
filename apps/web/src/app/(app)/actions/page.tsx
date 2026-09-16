import Link from "next/link";
import { store } from "@/lib/server";
import { shares, slotLabel } from "@/lib/format";
import { Badge, Empty } from "@/components/ui";

export const dynamic = "force-dynamic";

/** The record: every action the registrar has scheduled, with its snapshot and root. */
export default function ActionsPage() {
  const actions = store().list();
  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="h3">Record dates</h1>
          <p className="body-sm">Each snapshot, its root and content hash, and the entitlement set anyone can recompute the root from. Open one for the certificate and the wallet lookup.</p>
        </div>
        <Link href="/issuer" className="btn primary sm">Schedule a record date</Link>
      </div>
      {actions.length === 0 ? (
        <Empty title="No record dates yet." action="Schedule one in the issuer console, or run pnpm demo." cta={<Link href="/issuer" className="btn primary sm">Open the issuer console</Link>} />
      ) : (
        <div className="card scroll-x">
          <table className="table">
            <thead>
              <tr><th>Action</th><th>Kind</th><th>Status</th><th className="num">Record slot</th><th className="num">Attributed</th><th className="num">Leaves</th><th className="num">Total shares</th></tr>
            </thead>
            <tbody>
              {actions.map((a) => (
                <tr key={a.id}>
                  <td>
                    <Link href={`/actions/${a.id}`} style={{ fontWeight: 500, borderBottom: "1px solid var(--line-strong)" }}>{a.title}</Link>
                    <div className="small mono">{a.id}</div>
                  </td>
                  <td><Badge tone={a.kind === "vote" ? "purple" : "blue"}>{a.kind}</Badge></td>
                  <td><Badge tone={a.status === "funded" || a.status === "open" ? "green" : a.status === "closed" ? undefined : "yellow"} dot>{a.status}</Badge></td>
                  <td className="num">{a.snapshot ? slotLabel(a.snapshot.slotActual) : slotLabel(a.recordSlot)}</td>
                  <td className="num">{a.snapshot ? `${a.snapshot.attributedPct}%` : <span className="muted">pending</span>}</td>
                  <td className="num">{a.snapshot?.leaves ?? <span className="muted">pending</span>}</td>
                  <td className="num">{a.snapshot ? shares(a.snapshot.totalEntitlement) : <span className="muted">pending</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
