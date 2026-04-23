import { createFileRoute } from "@tanstack/react-router";

// Proxy alternativo via query-string: /api/evolution-proxy?path=instance/fetchInstances
// Útil para chamadas manuais/debug. O sistema usa server functions internamente.

const EVOLUTION_BASE_URL =
  process.env.EVOLUTION_API_URL?.replace(/\/+$/, "") || "";

const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || "";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, apikey, x-supabase-access-token",
};

async function forward(request: Request) {
  const incoming = new URL(request.url);
  const rawPath = incoming.searchParams.get("path") ?? "";
  const cleanPath = rawPath.replace(/^\/+/, "");
  if (!cleanPath) {
    return new Response(
      JSON.stringify({ error: "missing ?path= query parameter" }),
      { status: 400, headers: { "Content-Type": "application/json", ...CORS } }
    );
  }

  // Reaproveita query string sem `path`
  const fwdParams = new URLSearchParams(incoming.searchParams);
  fwdParams.delete("path");
  const qs = fwdParams.toString();
  const targetUrl = `${EVOLUTION_BASE_URL}/${cleanPath}${qs ? `?${qs}` : ""}`;

  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (
      lower === "authorization" ||
      lower === "host" ||
      lower === "connection" ||
      lower === "content-length" ||
      lower === "x-supabase-access-token"
    ) {
      return;
    }
    headers[key] = value;
  });
  headers["apikey"] = EVOLUTION_API_KEY;

  const hasBody = !["GET", "HEAD", "OPTIONS"].includes(request.method);
  const body = hasBody ? await request.arrayBuffer() : undefined;

  console.log(`[evolution-proxy] ${request.method} ${targetUrl}`);

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: body && body.byteLength > 0 ? body : undefined,
      signal: AbortSignal.timeout(20000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[evolution-proxy] fetch failed:", msg);
    return new Response(
      JSON.stringify({ error: "evolution_proxy_fetch_failed", message: msg, target: targetUrl }),
      { status: 502, headers: { "Content-Type": "application/json", ...CORS } }
    );
  }

  const respHeaders = new Headers(upstream.headers);
  respHeaders.delete("content-encoding");
  respHeaders.delete("content-length");
  respHeaders.delete("transfer-encoding");
  for (const [k, v] of Object.entries(CORS)) respHeaders.set(k, v);

  const buf = await upstream.arrayBuffer();
  return new Response(buf, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: respHeaders,
  });
}

export const Route = createFileRoute("/api/evolution-proxy")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => forward(request),
      POST: async ({ request }) => forward(request),
      PUT: async ({ request }) => forward(request),
      DELETE: async ({ request }) => forward(request),
      PATCH: async ({ request }) => forward(request),
    },
  },
});
