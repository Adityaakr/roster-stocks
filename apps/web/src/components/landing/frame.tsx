"use client";

import type { ReactNode } from "react";
import { ScrollColorText } from "@/components/motion";

/** A page section inside the frame: corner ticks, mono marker `03  The false choice`, a scroll-colouring headline. */
export function Section({ id, index, label, title, children, lead, wide }: { id: string; index?: string; label?: string; title?: string; lead?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <section id={id} className="sec">
      <span className="tick tl" aria-hidden />
      <span className="tick tr" aria-hidden />
      {index && label ? (
        <div className="marker">
          <b>{index}</b>
          <span>{label}</span>
        </div>
      ) : null}
      {title ? <ScrollColorText as="h2" text={title} className="h-section" style={{ maxWidth: wide ? 900 : 720 }} /> : null}
      {lead ? <div className="body" style={{ marginTop: 16, maxWidth: 640 }}>{lead}</div> : null}
      <div style={{ marginTop: title ? 40 : 0 }}>{children}</div>
    </section>
  );
}
