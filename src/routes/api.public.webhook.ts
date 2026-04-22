import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const Route = createFileRoute("/api/public/webhook")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, { status: 204, headers: CORS }),

      POST: async ({ request }) => {
        let payload: Record<string, unknown> = {};
        try {
          payload = (await request.json()) as Record<string, unknown>;
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...CORS },
          });
        }

        try {
          const event = (payload.event as string) ?? "unknown";
          const instance = (payload.instance as string) ?? "";
          const data = payload.data as Record<string, unknown> | undefined;

          console.log("📩 Evolution webhook:", event, instance);

          // Trata MESSAGES_UPSERT
          if (event === "messages.upsert" && data) {
            const key = data.key as
              | { remoteJid?: string; fromMe?: boolean; id?: string }
              | undefined;
            const message = data.message as
              | {
                  conversation?: string;
                  extendedTextMessage?: { text?: string };
                }
              | undefined;

            const remoteJid = key?.remoteJid;
            const text =
              message?.conversation ??
              message?.extendedTextMessage?.text ??
              "";

            if (remoteJid && text) {
              // Encontra o número wpp por instance_name
              const { data: wpp } = await supabaseAdmin
                .from("whatsapp_numbers")
                .select("id")
                .eq("instance_name", instance)
                .maybeSingle();

              if (wpp?.id) {
                const phone = remoteJid.replace(/@.*/, "");
                // Garante contato
                let { data: contact } = await supabaseAdmin
                  .from("contacts")
                  .select("id")
                  .eq("telefone", phone)
                  .maybeSingle();

                if (!contact) {
                  const { data: created } = await supabaseAdmin
                    .from("contacts")
                    .insert({
                      nome: (data.pushName as string) ?? phone,
                      telefone: phone,
                    })
                    .select("id")
                    .single();
                  contact = created ?? null;
                }

                if (contact?.id) {
                  // Conversa
                  let { data: conv } = await supabaseAdmin
                    .from("conversations")
                    .select("id")
                    .eq("contact_id", contact.id)
                    .eq("whatsapp_number_id", wpp.id)
                    .maybeSingle();

                  if (!conv) {
                    const { data: createdConv } = await supabaseAdmin
                      .from("conversations")
                      .insert({
                        contact_id: contact.id,
                        whatsapp_number_id: wpp.id,
                      })
                      .select("id")
                      .single();
                    conv = createdConv ?? null;
                  }

                  if (conv?.id) {
                    await supabaseAdmin.from("messages").insert({
                      conversation_id: conv.id,
                      whatsapp_number_id: wpp.id,
                      conteudo: text,
                      tipo: key?.fromMe ? "saida" : "entrada",
                    });
                  }
                }
              }
            }
          }

          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "Content-Type": "application/json", ...CORS },
          });
        } catch (err) {
          console.error("Webhook error:", err);
          return new Response(
            JSON.stringify({
              error: err instanceof Error ? err.message : "Erro interno",
            }),
            {
              status: 500,
              headers: { "Content-Type": "application/json", ...CORS },
            }
          );
        }
      },
    },
  },
});
