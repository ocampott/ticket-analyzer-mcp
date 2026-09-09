import { describe, expect, it, jest } from "@jest/globals";
import { downloadBytes, mapWithConcurrency, validateDownloadUrl } from "./download.js";

function response(status: number, body: Uint8Array, headers = new Headers()): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers,
    body: new ReadableStream({ start(controller) { controller.enqueue(body); controller.close(); } }),
  } as unknown as Response;
}

describe("safe attachment downloads", () => {
  it("rejects private destinations and sends no request", async () => {
    const fetcher = jest.fn<typeof fetch>();
    await expect(downloadBytes("http://127.0.0.1/file", { fetcher, maxBytes: 10 })).resolves.toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("caps streaming bodies before collecting oversized content", async () => {
    const fetcher = jest.fn<typeof fetch>().mockResolvedValue(response(200, new Uint8Array([1, 2, 3, 4])));
    await expect(downloadBytes("https://cdn.example.com/file", { fetcher, maxBytes: 3 })).resolves.toBeNull();
  });

  it("rejects private IPv4, IPv6, mapped, and trailing-dot loopback hosts", () => {
    for (const url of [
      "http://127.0.0.1/file",
      "http://127.0.0.1./file",
      "http://[::1]/file",
      "http://[::ffff:127.0.0.1]/file",
      "http://[fe80::1]/file",
      "http://[fc00::1]/file",
    ]) {
      expect(validateDownloadUrl(url)).toBeNull();
    }
  });

  it("does not allocate a body when a response has no stream", async () => {
    const text = jest.fn(async () => "too much");
    const arrayBuffer = jest.fn(async () => new ArrayBuffer(8));
    const fetcher = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      body: null,
      text,
      arrayBuffer,
    } as unknown as Response);

    await expect(downloadBytes("https://cdn.example.com/file", { fetcher, maxBytes: 10 })).resolves.toBeNull();
    expect(text).not.toHaveBeenCalled();
    expect(arrayBuffer).not.toHaveBeenCalled();
  });

  it("rejects an initial attachment origin outside the configured trust boundary", async () => {
    const fetcher = jest.fn<typeof fetch>();
    await expect(downloadBytes("https://evil.example/file", {
      fetcher,
      maxBytes: 10,
      allowedOrigins: ["https://jira.example.com"],
    })).resolves.toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("does not forward credentials to a redirected origin", async () => {
    const fetcher = jest.fn<typeof fetch>()
      .mockResolvedValueOnce({ ok: false, status: 302, headers: new Headers({ location: "https://cdn.example.com/file" }) } as unknown as Response)
      .mockResolvedValueOnce(response(200, new Uint8Array([1])));
    await expect(downloadBytes("https://jira.example.com/file", {
      fetcher,
      maxBytes: 10,
      headers: { Authorization: "secret" },
      credentialOrigins: ["https://jira.example.com"],
    })).resolves.toEqual(new Uint8Array([1]));
    expect((fetcher.mock.calls[1][1]?.headers as Record<string, string> | undefined)?.Authorization).toBeUndefined();
  });

  it("bounds concurrent mapping", async () => {
    let active = 0;
    let peak = 0;
    const result = await mapWithConcurrency([1, 2, 3], 2, async (value) => {
      active++;
      peak = Math.max(peak, active);
      await Promise.resolve();
      active--;
      return value * 2;
    });
    expect(result).toEqual([2, 4, 6]);
    expect(peak).toBeLessThanOrEqual(2);
  });
});
