"use client";

import Link from "next/link";
import { Stagger } from "@/components/motion";
import { short, slotLabel } from "@/lib/format";
import type { LandingData } from "@/lib/landing-data";

/** The receipt tape: the transactions the latest record produced, with slots and signatures. */
export function Tape({ data }: { data: LandingData }) {
  const explorer = data.cluster === "devnet" ? (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet` : null;
  const rows = data.tape.length ? data.tape : [{ type: "publish_record" as const, slot: null, signature: null }];
  return (
    <div>
      <div className="tape">
        <Stagger step={0.08}>
          {rows.map((r, i) => (
            <div key={`${r.type}-${i}`} className="row">
              <span>{r.type}</span>
              <span className="s">{r.slot ? `slot ${slotLabel(r.slot)}` : "pending"}</span>
              <span>
                {r.signature ? (
                  explorer ? <a className="link" href={explorer(r.signature)} target="_blank" rel="noreferrer">{short(r.signature, 4)}</a> : data.latest ? <Link className="link" href={`/actions/${data.latest.id}`} title={r.signature}>{short(r.signature, 4)}</Link> : short(r.signature, 4)
                ) : (
                  <span className="s">pending</span>
                )}
              </span>
            </div>
          ))}
        </Stagger>
      </div>
      <p className="note" style={{ marginTop: 12 }}>{data.cluster === "devnet" ? "Signatures link to the Solana explorer on devnet." : "Signatures are from the mainnet fork, which has no public explorer; each links to the record page that lists it."}</p>
      <ul style={{ listStyle: "none", margin: "28px 0 0", padding: 0 }}>
        {["Issuers publish once and every entitled holder can act, wherever their shares sit.", "Holders never unwind a position to be counted.", "Protocols become rights-preserving by implementing one function."].map((t) => (
          <li key={t} className="body" style={{ padding: "12px 0", borderTop: "1px solid var(--line)", color: "var(--ink)" }}>{t}</li>
        ))}
      </ul>
    </div>
  );
}
