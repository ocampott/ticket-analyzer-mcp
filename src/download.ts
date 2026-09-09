export const DEFAULT_DOWNLOAD_TIMEOUT_MS = 10_000;
export const MAX_REDIRECTS = 5;

export interface DownloadOptions {
  maxBytes: number;
  timeoutMs?: number;
  headers?: Record<string, string>;
  credentialOrigins?: string[];
  /** Origins accepted for the initial provider attachment URL. Redirects remain unauthenticated. */
  allowedOrigins?: string[];
  fetcher?: typeof fetch;
  allowTruncated?: boolean;
}

function isPrivateIpv4(host: string): boolean {
  const parts = host.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168)) ||
    (a === 198 && b >= 18 && b <= 19) ||
    a >= 224;
}

function ipv6Words(host: string): number[] | null {
  const value = host.toLowerCase().split("%", 1)[0];
  const halves = value.split("::");
  if (halves.length > 2) return null;
  const parse = (part: string): number[] => part ? part.split(":").map((word) => parseInt(word, 16)) : [];
  const left = parse(halves[0]);
  const right = halves.length === 2 ? parse(halves[1]) : [];
  if (left.some((word) => !Number.isInteger(word) || word < 0 || word > 0xffff) ||
      right.some((word) => !Number.isInteger(word) || word < 0 || word > 0xffff)) return null;
  if (halves.length === 1 && left.length !== 8) return null;
  if (halves.length === 2 && left.length + right.length >= 8) return null;
  return halves.length === 2 ? [...left, ...Array(8 - left.length - right.length).fill(0), ...right] : left;
}

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (isPrivateIpv4(host)) return true;
  const words = ipv6Words(host);
  if (!words) return false;
  const isMapped = words.slice(0, 5).every((word) => word === 0) && words[5] === 0xffff;
  if (isMapped) {
    const mapped = `${words[6] >>> 8}.${words[6] & 0xff}.${words[7] >>> 8}.${words[7] & 0xff}`;
    return isPrivateIpv4(mapped);
  }
  const first = words[0];
  return words.every((word) => word === 0) ||
    (words[0] === 0 && words.slice(1, 7).every((word) => word === 0) && words[7] === 1) ||
    (first & 0xfe00) === 0xfc00 ||
    (first & 0xffc0) === 0xfe80 ||
    (first & 0xff00) === 0xff00;
}

function originSet(origins: string[] | undefined): Set<string> {
  const result = new Set<string>();
  for (const origin of origins ?? []) {
    try {
      result.add(new URL(origin).origin);
    } catch {
      // Invalid configuration cannot authorize an origin.
    }
  }
  return result;
}

export function validateDownloadUrl(raw: string): URL | null {
  try {
    const url = new URL(raw);
    if ((url.protocol !== "https:" && url.protocol !== "http:") || isPrivateHost(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

async function readCapped(response: Response, maxBytes: number, allowTruncated = false): Promise<Uint8Array | null> {
  const contentLength = response.headers.get("content-length");
  if (!allowTruncated && contentLength && Number.isFinite(Number(contentLength)) && Number(contentLength) > maxBytes) return null;

  // A Response without a stream cannot be capped before allocation. Reject it rather
  // than falling back to text()/arrayBuffer(), both of which buffer the whole body.
  if (!response.body) return null;

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        if (!allowTruncated) {
          await reader.cancel();
          return null;
        }
        const remaining = maxBytes - (total - value.byteLength);
        if (remaining > 0) chunks.push(value.slice(0, remaining));
        await reader.cancel();
        total = maxBytes;
        break;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

export async function downloadBytes(rawUrl: string, options: DownloadOptions): Promise<Uint8Array | null> {
  if (!Number.isSafeInteger(options.maxBytes) || options.maxBytes <= 0) return null;
  if (options.timeoutMs !== undefined && (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs <= 0)) return null;
  const fetcher = options.fetcher ?? fetch;
  let current = validateDownloadUrl(rawUrl);
  if (!current) return null;
  const allowedOrigins = originSet(options.allowedOrigins);
  if (allowedOrigins.size > 0 && !allowedOrigins.has(current.origin)) return null;
  const credentialOrigins = originSet(options.credentialOrigins);
  const timeoutMs = options.timeoutMs ?? DEFAULT_DOWNLOAD_TIMEOUT_MS;

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const headers = credentialOrigins.has(current.origin) ? options.headers : undefined;
    try {
      const response = await fetcher(current.toString(), { headers, redirect: "manual", signal: controller.signal });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location || redirect === MAX_REDIRECTS) return null;
        current = validateDownloadUrl(new URL(location, current).toString());
        if (!current) return null;
        continue;
      }
      if (!response.ok) return null;
      return await readCapped(response, options.maxBytes, options.allowTruncated);
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

export async function mapWithConcurrency<T, R>(items: T[], limit: number, mapper: (item: T, index: number) => Promise<R>): Promise<R[]> {
  if (!Number.isSafeInteger(limit) || limit < 1) throw new RangeError("concurrency limit must be a positive integer");
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}
