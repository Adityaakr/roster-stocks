/**
 * Small fetch wrapper shared by the tokens.xyz and Backpack clients.
 * Retries 429 and 5xx with exponential backoff and jitter, caches GET responses
 * for a configurable TTL, and surfaces the x-request-id header on failure.
 */
export interface HttpError extends Error {
  status: number;
  requestId: string | undefined;
  body: unknown;
}

export interface HttpClientOptions {
  baseUrl: string;
  headers?: Record<string, string>;
  cacheTtlMs?: number;
  maxRetries?: number;
  fetchImpl?: typeof fetch;
  logger?: (message: string) => void;
}

interface CacheEntry {
  expiresAt: number;
  value: unknown;
}

export function makeHttpError(status: number, requestId: string | undefined, body: unknown): HttpError {
  const message =
    typeof body === "object" && body !== null && "error" in body
      ? JSON.stringify((body as { error: unknown }).error)
      : `HTTP ${status}`;
  const err = new Error(`${status} ${message}${requestId ? ` (x-request-id ${requestId})` : ""}`) as HttpError;
  err.status = status;
  err.requestId = requestId;
  err.body = body;
  return err;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class HttpClient {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly opts: Required<Omit<HttpClientOptions, "headers">> & { headers: Record<string, string> };

  constructor(opts: HttpClientOptions) {
    this.opts = {
      baseUrl: opts.baseUrl.replace(/\/$/, ""),
      headers: opts.headers ?? {},
      cacheTtlMs: opts.cacheTtlMs ?? 60_000,
      maxRetries: opts.maxRetries ?? 4,
      fetchImpl: opts.fetchImpl ?? fetch,
      logger: opts.logger ?? (() => undefined)
    };
  }

  async get<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T> {
    const url = this.buildUrl(path, query);
    const cached = this.cache.get(url);
    const now = Date.now();
    if (cached && cached.expiresAt > now) return cached.value as T;
    const value = await this.request<T>(url, { method: "GET" });
    this.cache.set(url, { expiresAt: now + this.opts.cacheTtlMs, value });
    return value;
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const url = this.buildUrl(path);
    return this.request<T>(url, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" }
    });
  }

  private buildUrl(path: string, query?: Record<string, string | number | undefined>): string {
    const url = new URL(this.opts.baseUrl + path);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined) url.searchParams.set(k, String(v));
      }
    }
    return url.toString();
  }

  private async request<T>(url: string, init: RequestInit): Promise<T> {
    let attempt = 0;
    for (;;) {
      const res = await this.opts.fetchImpl(url, {
        ...init,
        headers: { ...this.opts.headers, ...(init.headers as Record<string, string> | undefined) }
      });
      const requestId = res.headers.get("x-request-id") ?? undefined;
      const text = await res.text();
      let body: unknown = text;
      try {
        body = text.length ? JSON.parse(text) : null;
      } catch {
        // keep the raw text
      }
      if (res.ok) return body as T;
      const retryable = res.status === 429 || res.status >= 500;
      if (retryable && attempt < this.opts.maxRetries) {
        const backoff = Math.min(8_000, 250 * 2 ** attempt) + Math.floor(Math.random() * 200);
        this.opts.logger(`${init.method} ${url} -> ${res.status}, retrying in ${backoff}ms (x-request-id ${requestId ?? "none"})`);
        attempt += 1;
        await sleep(backoff);
        continue;
      }
      this.opts.logger(`${init.method} ${url} -> ${res.status} (x-request-id ${requestId ?? "none"})`);
      throw makeHttpError(res.status, requestId, body);
    }
  }
}
