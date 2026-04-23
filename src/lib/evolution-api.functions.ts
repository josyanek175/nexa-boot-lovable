import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  fetchInstances,
  createInstance,
  deleteInstance,
  getConnectionState,
  connectInstance,
  reconnectInstance,
  sendTextMessage,
  fetchMessages,
  fetchChats,
  setWebhook,
  loadEvolutionConfig,
} from "./evolution-api.server";

const NameSchema = z.object({ instanceName: z.string().min(1).max(120) });

export const listInstances = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    try {
      const instances = await fetchInstances();
      return { instances, error: null };
    } catch (error) {
      return {
        instances: [],
        error:
          error instanceof Error ? error.message : "Falha ao listar instâncias",
      };
    }
  });

export const createNewInstance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { instanceName: string; number?: string }) =>
    z
      .object({
        instanceName: z.string().min(1).max(120),
        number: z.string().max(30).optional(),
      })
      .parse(data)
  )
  .handler(async ({ data }) => {
    try {
      const result = (await createInstance(data.instanceName, data.number)) as {
        instance?: {
          instanceName?: string;
          instanceId?: string;
          status?: string;
        } | null;
        qrcode?: {
          base64?: string;
          pairingCode?: string;
          code?: string;
          count?: number;
        } | null;
      };
      return {
        instance: result?.instance ?? null,
        qrcode: result?.qrcode ?? null,
        error: null,
      };
    } catch (error) {
      return {
        instance: null,
        qrcode: null,
        error:
          error instanceof Error ? error.message : "Falha ao criar instância",
      };
    }
  });

export const removeInstance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { instanceName: string }) => NameSchema.parse(data))
  .handler(async ({ data }) => {
    try {
      await deleteInstance(data.instanceName);
      return { success: true, error: null };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Falha ao excluir instância",
      };
    }
  });

export const getInstanceState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { instanceName: string }) => NameSchema.parse(data))
  .handler(async ({ data }) => {
    try {
      const state = await getConnectionState(data.instanceName);
      return { state: state.state, error: null };
    } catch (error) {
      return {
        state: "close" as const,
        error:
          error instanceof Error ? error.message : "Falha ao obter estado",
      };
    }
  });

export const connectToInstance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { instanceName: string }) => NameSchema.parse(data))
  .handler(async ({ data }) => {
    try {
      const qrcode = await connectInstance(data.instanceName);
      return { qrcode, error: null };
    } catch (error) {
      return {
        qrcode: null,
        error: error instanceof Error ? error.message : "Falha ao conectar",
      };
    }
  });

export const disconnectInstance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { instanceName: string }) => NameSchema.parse(data))
  .handler(async ({ data }) => {
    try {
      await reconnectInstance(data.instanceName);
      return { success: true, error: null };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Falha ao desconectar",
      };
    }
  });

export const restartEvolutionInstance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { instanceName: string }) => NameSchema.parse(data))
  .handler(async ({ data }) => {
    try {
      await reconnectInstance(data.instanceName);
      return { success: true, error: null };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Falha ao reiniciar",
      };
    }
  });

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { instanceName: string; remoteJid: string; text: string }) =>
      z
        .object({
          instanceName: z.string().min(1).max(120),
          remoteJid: z.string().min(1).max(120),
          text: z.string().min(1).max(4096),
        })
        .parse(data)
  )
  .handler(async ({ data }) => {
    try {
      const result = await sendTextMessage(
        data.instanceName,
        data.remoteJid,
        data.text
      );
      return { result: JSON.stringify(result ?? {}), error: null };
    } catch (error) {
      return {
        result: null,
        error:
          error instanceof Error ? error.message : "Falha ao enviar mensagem",
      };
    }
  });

export const getMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { instanceName: string; remoteJid: string; limit?: number }) =>
      z
        .object({
          instanceName: z.string().min(1).max(120),
          remoteJid: z.string().min(1).max(120),
          limit: z.number().int().min(1).max(500).optional(),
        })
        .parse(data)
  )
  .handler(async ({ data }) => {
    try {
      const messages = await fetchMessages(
        data.instanceName,
        data.remoteJid,
        data.limit
      );
      return { messages, error: null };
    } catch (error) {
      return {
        messages: [],
        error:
          error instanceof Error ? error.message : "Falha ao buscar mensagens",
      };
    }
  });

export const getChats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { instanceName: string }) => NameSchema.parse(data))
  .handler(async ({ data }) => {
    try {
      const chats = await fetchChats(data.instanceName);
      return { chats: JSON.stringify(chats ?? []), error: null };
    } catch (error) {
      return {
        chats: "[]",
        error: error instanceof Error ? error.message : "Falha ao buscar chats",
      };
    }
  });

export const configureWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { instanceName: string; webhookUrl?: string }) =>
      z
        .object({
          instanceName: z.string().min(1).max(120),
          webhookUrl: z.string().url().max(500).optional(),
        })
        .parse(data)
  )
  .handler(async ({ data }) => {
    try {
      let url = data.webhookUrl;
      if (!url) {
        const cfg = await loadEvolutionConfig();
        url = cfg.webhookUrl;
      }
      if (!url) {
        return {
          success: false,
          error: "Nenhuma URL de webhook configurada",
        };
      }
      await setWebhook(data.instanceName, url);
      return { success: true, error: null };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Falha ao configurar webhook",
      };
    }
  });

// ── Sincroniza instâncias da Evolution → tabela whatsapp_numbers ──
// Busca todas as instâncias na Evolution, faz upsert no banco e
// remove do banco números que não existem mais na Evolution.
export const syncWhatsappNumbers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    try {
      const instances = await fetchInstances();

      const synced: { id: string; instance_name: string }[] = [];

      for (const inst of instances) {
        const instanceName = inst.name ?? inst.instanceName;
        if (!instanceName) continue;

        // Estado real
        let state: "open" | "close" | "connecting" = "close";
        try {
          const s = await getConnectionState(instanceName);
          state = s.state;
        } catch {
          // mantém close
        }
        const status =
          state === "open" || inst.connectionStatus === "open"
            ? "conectado"
            : "desconectado";

        // Telefone (ownerJid vem como "5511...@s.whatsapp.net")
        const phoneRaw = inst.number ?? inst.ownerJid ?? null;
        const phone_number = phoneRaw
          ? phoneRaw.toString().replace(/@.*/, "").replace(/\D/g, "") || null
          : null;

        const nome = inst.profileName ?? instanceName;

        // Upsert por instance_name
        const { data: existing } = await supabaseAdmin
          .from("whatsapp_numbers")
          .select("id")
          .eq("instance_name", instanceName)
          .maybeSingle();

        if (existing) {
          await supabaseAdmin
            .from("whatsapp_numbers")
            .update({ nome, phone_number, status })
            .eq("id", existing.id);
          synced.push({ id: existing.id, instance_name: instanceName });
        } else {
          const { data: created } = await supabaseAdmin
            .from("whatsapp_numbers")
            .insert({ instance_name: instanceName, nome, phone_number, status })
            .select("id")
            .single();
          if (created) synced.push({ id: created.id, instance_name: instanceName });
        }
      }

      // Remove do banco os que não existem mais na Evolution
      const liveNames = synced.map((s) => s.instance_name);
      const { data: stale } = await supabaseAdmin
        .from("whatsapp_numbers")
        .select("id, instance_name");

      const toDelete = (stale ?? [])
        .filter((s) => !liveNames.includes(s.instance_name))
        .map((s) => s.id);

      if (toDelete.length > 0) {
        // Só remove se não houver conversas vinculadas (preserva histórico)
        const { data: usedNumbers } = await supabaseAdmin
          .from("conversations")
          .select("whatsapp_number_id")
          .in("whatsapp_number_id", toDelete);
        const usedIds = new Set((usedNumbers ?? []).map((u) => u.whatsapp_number_id));
        const safeToDelete = toDelete.filter((id) => !usedIds.has(id));
        if (safeToDelete.length > 0) {
          await supabaseAdmin
            .from("user_whatsapp_numbers")
            .delete()
            .in("whatsapp_number_id", safeToDelete);
          await supabaseAdmin
            .from("whatsapp_numbers")
            .delete()
            .in("id", safeToDelete);
        }
      }

      return { synced: synced.length, error: null };
    } catch (error) {
      return {
        synced: 0,
        error:
          error instanceof Error ? error.message : "Falha ao sincronizar números",
      };
    }
  });

