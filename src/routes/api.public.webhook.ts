import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-webhook-secret",
  "Access-Control-Max-Age": "86400",
};

const JSON_HEADERS = { "Content-Type": "application/json", ...CORS };

function ok(payload: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ ok: true, ...payload }), {
    status: 200,
    headers: JSON_HEADERS,
  });
}

function fail(status: number, error: string, extra: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ ok: false, error, ...extra }), {
    status,
    headers: JSON_HEADERS,
  });
}

interface EvolutionKey {
  remoteJid?: string;
  fromMe?: boolean;
  id?: string;
}

interface EvolutionMessageContent {
  conversation?: string;
  extendedTextMessage?: { text?: string };
  imageMessage?: { caption?: string };
  videoMessage?: { caption?: string };
  audioMessage?: unknown;
  documentMessage?: { fileName?: string; caption?: string };
}

interface EvolutionMessageData {
  key?: EvolutionKey;
  message?: EvolutionMessageContent;
  pushName?: string;
  messageTimestamp?: number;
}

function extractText(message?: EvolutionMessageContent): string {
  if (!message) return "";
  if (message.conversation) return message.conversation;
  if (message.extendedTextMessage?.text) return message.extendedTextMessage.text;
  if (message.imageMessage?.caption) return message.imageMessage.caption;
  if (message.videoMessage?.caption) return message.videoMessage.caption;
  if (message.documentMessage?.caption) return message.documentMessage.caption;
  if (message.documentMessage)
    return `[documento: ${message.documentMessage.fileName ?? "arquivo"}]`;
  if (message.audioMessage) return "[áudio]";
  return "";
}

async function processMessageUpsert(
  instanceName: string,
  data: EvolutionMessageData
): Promise<{ persisted: boolean; reason?: string }> {
  const remoteJid = data.key?.remoteJid;
  const text = extractText(data.message);

  if (!remoteJid) return { persisted: false, reason: "missing remoteJid" };
  if (!text) return { persisted: false, reason: "no text content" };
  if (remoteJid.endsWith("@g.us")) return { persisted: false, reason: "group message ignored" };

  // 1. Resolver instância
  const { data: wpp, error: wppErr } = await supabaseAdmin
    .from("whatsapp_numbers")
    .select("id")
    .eq("instance_name", instanceName)
    .maybeSingle();

  if (wppErr) {
    console.error("[webhook] whatsapp_numbers lookup error:", wppErr);
    return { persisted: false, reason: `db error: ${wppErr.message}` };
  }

  // Auto-cria registro de número se não existir (suporte multi-instância)
  let wppId = wpp?.id;
  if (!wppId) {
    const { data: created, error: createErr } = await supabaseAdmin
      .from("whatsapp_numbers")
      .insert({
        instance_name: instanceName,
        nome: instanceName,
        status: "conectado",
      })
      .select("id")
      .single();
    if (createErr || !created) {
      console.error("[webhook] failed to auto-create whatsapp_number:", createErr);
      return { persisted: false, reason: "could not create whatsapp_number" };
    }
    wppId = created.id;
    console.log("[webhook] auto-created whatsapp_number for instance:", instanceName);
  }

  // 2. Resolver contato (telefone limpo)
  const phone = remoteJid.replace(/@.*/, "").replace(/\D/g, "");
  if (!phone) return { persisted: false, reason: "invalid phone" };

  let { data: contact } = await supabaseAdmin
    .from("contacts")
    .select("id")
    .eq("telefone", phone)
    .maybeSingle();

  if (!contact) {
    const { data: created, error: contactErr } = await supabaseAdmin
      .from("contacts")
      .insert({
        nome: data.pushName ?? phone,
        telefone: phone,
        ultima_interacao: new Date().toISOString(),
        is_temporary: !data.pushName,
      })
      .select("id")
      .single();
    if (contactErr || !created) {
      console.error("[webhook] contact insert error:", contactErr);
      return { persisted: false, reason: "contact insert failed" };
    }
    contact = created;
  } else {
    await supabaseAdmin
      .from("contacts")
      .update({ ultima_interacao: new Date().toISOString() })
      .eq("id", contact.id);
  }

  // 3. Conversa
  let { data: conv } = await supabaseAdmin
    .from("conversations")
    .select("id")
    .eq("contact_id", contact.id)
    .eq("whatsapp_number_id", wppId)
    .maybeSingle();

  if (!conv) {
    const { data: createdConv, error: convErr } = await supabaseAdmin
      .from("conversations")
      .insert({
        contact_id: contact.id,
        whatsapp_number_id: wppId,
      })
      .select("id")
      .single();
    if (convErr || !createdConv) {
      console.error("[webhook] conversation insert error:", convErr);
      return { persisted: false, reason: "conversation insert failed" };
    }
    conv = createdConv;
  }

  // 4. Mensagem
  const { error: msgErr } = await supabaseAdmin.from("messages").insert({
    conversation_id: conv.id,
    whatsapp_number_id: wppId,
    conteudo: text,
    tipo: data.key?.fromMe ? "saida" : "entrada",
  });

  if (msgErr) {
    console.error("[webhook] message insert error:", msgErr);
    return { persisted: false, reason: `message insert failed: ${msgErr.message}` };
  }

  return { persisted: true };
}

export const Route = createFileRoute("/api/public/webhook")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),

      // GET para health-check / verificação manual
      GET: async () =>
        new Response(
          JSON.stringify({
            ok: true,
            message: "Webhook endpoint ativo. Envie POST com payload da Evolution API.",
            timestamp: new Date().toISOString(),
          }),
          { status: 200, headers: JSON_HEADERS }
        ),

      POST: async ({ request }) => {
        const startedAt = Date.now();

        // Validação opcional do secret
        try {
          const { data: settings } = await supabaseAdmin
            .from("integration_settings")
            .select("webhook_secret")
            .limit(1)
            .maybeSingle();

          const expectedSecret = settings?.webhook_secret;
          if (expectedSecret) {
            const provided =
              request.headers.get("x-webhook-secret") ??
              request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
            if (provided !== expectedSecret) {
              console.warn("[webhook] invalid secret");
              return fail(401, "Invalid webhook secret");
            }
          }
        } catch (err) {
          console.error("[webhook] secret check error:", err);
        }

        let payload: Record<string, unknown> = {};
        try {
          payload = (await request.json()) as Record<string, unknown>;
        } catch {
          return fail(400, "Invalid JSON");
        }

        const event = (payload.event as string) ?? "unknown";
        const instance =
          (payload.instance as string) ??
          (payload.instanceName as string) ??
          "";
        const data = payload.data as EvolutionMessageData | undefined;

        console.log(
          `[webhook] event=${event} instance=${instance} hasData=${!!data}`
        );

        try {
          if ((event === "messages.upsert" || event === "MESSAGES_UPSERT") && data && instance) {
            const result = await processMessageUpsert(instance, data);
            console.log(`[webhook] processed in ${Date.now() - startedAt}ms`, result);
            return ok({ event, instance, ...result });
          }

          // Eventos não tratados ainda — responde OK para evitar retry
          console.log(`[webhook] event ignored: ${event}`);
          return ok({ event, instance, ignored: true });
        } catch (err) {
          console.error("[webhook] handler error:", err);
          return fail(500, err instanceof Error ? err.message : "Erro interno");
        }
      },
    },
  },
});
