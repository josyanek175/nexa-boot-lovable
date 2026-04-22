// Evolution API helpers — chamadas server-side direto à Evolution API.
// Usa configurações salvas em integration_settings (Supabase) com fallback
// para variáveis de ambiente EVOLUTION_API_URL / EVOLUTION_API_KEY.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface EvolutionInstance {
  id?: string;
  name?: string;
  instanceName?: string;
  instanceId?: string;
  connectionStatus?: string;
  status?: string;
  ownerJid?: string;
  number?: string;
  profileName?: string;
  profilePicUrl?: string;
  profilePictureUrl?: string;
  integration?: string;
}

export interface EvolutionQrCode {
  base64?: string;
  code?: string;
  pairingCode?: string;
  count?: number;
}

export interface EvolutionConnectionState {
  instance: string;
  state: "open" | "close" | "connecting";
}

export interface EvolutionMessage {
  key: { remoteJid: string; fromMe: boolean; id: string };
  message: { conversation?: string; extendedTextMessage?: { text: string } };
  messageTimestamp: number;
  pushName?: string;
  status?: string;
}

export interface EvolutionConfig {
  url: string;
  apiKey: string;
  webhookUrl: string;
  webhookSecret: string;
}

// Carrega config salva no Supabase, com fallback para env vars.
export async function loadEvolutionConfig(): Promise<EvolutionConfig> {
  let url = process.env.EVOLUTION_API_URL ?? "";
  let apiKey = process.env.EVOLUTION_API_KEY ?? "";
  let webhookUrl = "";
  let webhookSecret = "";

  try {
    const { data } = await supabaseAdmin
      .from("integration_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (data) {
      if (data.evolution_api_url) url = data.evolution_api_url;
      if (data.evolution_api_key) apiKey = data.evolution_api_key;
      webhookUrl = data.webhook_url ?? "";
      webhookSecret = data.webhook_secret ?? "";
    }
  } catch (err) {
    console.error("Failed to load integration settings:", err);
  }

  // Remove trailing slash
  url = url.replace(/\/+$/, "");
  return { url, apiKey, webhookUrl, webhookSecret };
}

async function evolutionFetch(
  path: string,
  init: RequestInit = {},
  cfgOverride?: EvolutionConfig
) {
  const cfg = cfgOverride ?? (await loadEvolutionConfig());
  if (!cfg.url) {
    throw new Error(
      "Evolution API URL não configurada. Vá em Integrações e salve a URL."
    );
  }
  if (!cfg.apiKey) {
    throw new Error(
      "Evolution API Key não configurada. Vá em Integrações e salve a chave."
    );
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: cfg.apiKey,
    ...((init.headers as Record<string, string>) ?? {}),
  };

  const res = await fetch(`${cfg.url}${path}`, { ...init, headers });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Evolution API ${res.status}: ${text || res.statusText}`.slice(0, 500)
    );
  }

  // Algumas rotas retornam vazio
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return null;
  return res.json();
}

// ── Test connection ──
export async function testEvolutionConnection(cfg?: EvolutionConfig) {
  const data = await evolutionFetch("/instance/fetchInstances", {}, cfg);
  return { ok: true, data };
}

// ── Instâncias ──
export async function fetchInstances(): Promise<EvolutionInstance[]> {
  const data = await evolutionFetch("/instance/fetchInstances");
  return Array.isArray(data) ? data : [];
}

export async function createInstance(instanceName: string, number?: string) {
  const cfg = await loadEvolutionConfig();
  const body: Record<string, unknown> = {
    instanceName,
    integration: "WHATSAPP-BAILEYS",
    qrcode: true,
  };
  if (number) body.number = number;
  if (cfg.webhookUrl) {
    body.webhook = {
      url: cfg.webhookUrl,
      events: [
        "MESSAGES_UPSERT",
        "MESSAGES_UPDATE",
        "CONNECTION_UPDATE",
        "QRCODE_UPDATED",
      ],
    };
  }
  return evolutionFetch(
    "/instance/create",
    { method: "POST", body: JSON.stringify(body) },
    cfg
  );
}

export async function deleteInstance(instanceName: string) {
  return evolutionFetch(`/instance/delete/${instanceName}`, { method: "DELETE" });
}

// ── Conexão ──
export async function getConnectionState(
  instanceName: string
): Promise<EvolutionConnectionState> {
  const data = await evolutionFetch(`/instance/connectionState/${instanceName}`);
  // Evolution retorna { instance: { instanceName, state } }
  const inner = data?.instance ?? data;
  return {
    instance: inner?.instanceName ?? instanceName,
    state: (inner?.state ?? "close") as "open" | "close" | "connecting",
  };
}

export async function connectInstance(
  instanceName: string
): Promise<EvolutionQrCode> {
  const data = await evolutionFetch(`/instance/connect/${instanceName}`);
  return data ?? {};
}

export async function reconnectInstance(instanceName: string) {
  return evolutionFetch(`/instance/restart/${instanceName}`, { method: "POST" });
}

// ── Mensagens ──
export async function sendTextMessage(
  instanceName: string,
  remoteJid: string,
  text: string
) {
  return evolutionFetch(`/message/sendText/${instanceName}`, {
    method: "POST",
    body: JSON.stringify({ number: remoteJid, text }),
  });
}

export async function fetchMessages(
  instanceName: string,
  remoteJid: string,
  limit = 50
): Promise<EvolutionMessage[]> {
  try {
    const data = await evolutionFetch(
      `/chat/findMessages/${instanceName}`,
      {
        method: "POST",
        body: JSON.stringify({ where: { key: { remoteJid } }, limit }),
      }
    );
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.messages?.records)) return data.messages.records;
    return [];
  } catch {
    return [];
  }
}

export async function fetchChats(instanceName: string): Promise<unknown[]> {
  try {
    const data = await evolutionFetch(`/chat/findChats/${instanceName}`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// ── Webhook ──
export async function setWebhook(instanceName: string, webhookUrl: string) {
  return evolutionFetch(`/webhook/set/${instanceName}`, {
    method: "POST",
    body: JSON.stringify({
      enabled: true,
      url: webhookUrl,
      events: [
        "MESSAGES_UPSERT",
        "MESSAGES_UPDATE",
        "CONNECTION_UPDATE",
        "QRCODE_UPDATED",
      ],
    }),
  });
}
