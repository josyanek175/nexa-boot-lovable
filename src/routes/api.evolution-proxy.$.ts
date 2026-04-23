import { createFileRoute } from "@tanstack/react-router";

// Proxy interno para a Evolution API.
// - Remove o header Authorization (Bearer) que o frontend envia
// - Adiciona o header `apikey` exigido pela Evolution
// - Encaminha para EVOLUTION_API_URL (default: http://72.61.133.41:8080)
//
// Uso no frontend: chame `/api/evolution-proxy/<path-da-evolution>`
// Ex.: GET /api/evolution-proxy/instance/fetchInstances

const EVOLUTION_BASE_URL =
  process.env.EVOLUTION_API_URL?.replace(/\/+$/, "") ||
  "http://72.61.133.41:8080";

const EVOLUTION_API_KEY =
  process.env.EVOLUTION_API_KEY || "429683C4C977415CAAFFCE10F7D57E11";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, apikey, x-supabase-access-token",
};

async function forward(request: Request, splat: string | undefined) {
  const path = splat ? `/${splat}` : "";
  const incomingUrl = new URL(request.url);
  const targetUrl = `${EVOLUTION_BASE_URL}${path}${incomingUrl.search}`;

  // Copia headers, removendo Authorization e hop-by-hop / hosts
  const forwardedHeaders: Record<string, string> = {};
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
    forwardedHeaders[key] = value;
  });
  forwardedHeaders["apikey"] = EVOLUTION_API_KEY;

  const hasBody = !["GET", "HEAD", "OPTIONS"].includes(request.method);
  const body = hasBody ? await request.arrayBuffer() : undefined;

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, {
      method: request.method,
      headers: forwardedHeaders,
      body: body && body.byteLength > 0 ? body : undefined,
      signal: AbortSignal.timeout(20000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({
        error: "evolution_proxy_fetch_failed",
        message: msg,
        target: targetUrl,
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      }
    );
  }

  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("content-length");
  responseHeaders.delete("transfer-encoding");
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    responseHeaders.set(k, v);
  }

  const buf = await upstream.arrayBuffer();
  return new Response(buf, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export const Route = createFileRoute("/api/evolution-proxy/$")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, { status: 204, headers: CORS_HEADERS }),
      GET: async ({ request, params }) => forward(request, params._splat),
      POST: async ({ request, params }) => forward(request, params._splat),
      PUT: async ({ request, params }) => forward(request, params._splat),
      DELETE: async ({ request, params }) => forward(request, params._splat),
      PATCH: async ({ request, params }) => forward(request, params._splat),
    },
  },
});
