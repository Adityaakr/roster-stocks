import { RpcReader } from "@lookthrough/datasources";
import { resolveWallet } from "@lookthrough/resolver";
const r = new RpcReader({ url: "http://127.0.0.1:8899" });
const orig = { gpa: r.getProgramAccounts.bind(r), tao: r.getTokenAccountsByOwner.bind(r), gma: r.getMultipleAccounts.bind(r), ga: r.getAccount.bind(r) };
const timed = <T extends (...a: never[]) => Promise<unknown>>(name: string, fn: T) => (async (...a: Parameters<T>) => { const t = Date.now(); const v = await fn(...a); console.log(name, JSON.stringify(a[0]).slice(0, 50), `${Date.now() - t}ms`); return v; }) as T;
r.getProgramAccounts = timed("gPA", orig.gpa); r.getTokenAccountsByOwner = timed("tao", orig.tao); r.getMultipleAccounts = timed("gma", orig.gma); r.getAccount = timed("ga", orig.ga);
const t = Date.now();
const l = await resolveWallet(r, "9Uz2NxvkCDcBZeocsRQQ1Uuv5RCsWaEW3W16qFLfG5qh", "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp");
console.log("total", Date.now() - t, "ms", l.totalShares6.toString());
