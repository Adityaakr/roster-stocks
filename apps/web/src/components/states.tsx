/** Explicit loading, empty and error states, written as directions. */
export function Loading({ what }: { what: string }) {
  return (
    <div className="panel p-6 text-ink-2" role="status" aria-live="polite">
      Loading {what}.
    </div>
  );
}

export function Empty({ title, action }: { title: string; action?: string }) {
  return (
    <div className="panel p-6">
      <div className="text-ink">{title}</div>
      {action ? <div className="text-ink-2 mt-1 text-[14px]">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message, next }: { message: string; next?: string }) {
  return (
    <div className="panel p-6 border-danger/40" role="alert">
      <div className="text-danger">{message}</div>
      {next ? <div className="text-ink-2 mt-1 text-[14px]">{next}</div> : null}
    </div>
  );
}
