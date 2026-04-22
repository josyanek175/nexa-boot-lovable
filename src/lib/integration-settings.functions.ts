import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  loadEvolutionConfig,
  testEvolutionConnection,
} from "./evolution-api.server";

const SettingsSchema = z.object({
  evolution_api_url: z.string().trim().max(500),
  evolution_api_key: z.string().trim().max(500),
  webhook_url: z.string().trim().max(500),
  webhook_secret: z.string().trim().max(500),
});

export const getIntegrationSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from("integration_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (error) {
      return { settings: null, error: error.message };
    }
    return {
      settings: data ?? {
        id: null,
        evolution_api_url: "",
        evolution_api_key: "",
        webhook_url: "",
        webhook_secret: "",
      },
      error: null,
    };
  });

export const saveIntegrationSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SettingsSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // Upsert singleton row
    const { data: existing } = await supabaseAdmin
      .from("integration_settings")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      const { error } = await supabaseAdmin
        .from("integration_settings")
        .update({ ...data, updated_by: userId })
        .eq("id", existing.id);
      if (error) return { success: false, error: error.message };
    } else {
      const { error } = await supabaseAdmin
        .from("integration_settings")
        .insert({ ...data, updated_by: userId });
      if (error) return { success: false, error: error.message };
    }

    return { success: true, error: null };
  });

export const testEvolutionApi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    try {
      const cfg = await loadEvolutionConfig();
      if (!cfg.url || !cfg.apiKey) {
        return {
          success: false,
          error: "URL ou API Key não configuradas",
          instanceCount: 0,
        };
      }
      const result = await testEvolutionConnection(cfg);
      const instanceCount = Array.isArray(result.data) ? result.data.length : 0;
      return { success: true, error: null, instanceCount };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Falha ao conectar",
        instanceCount: 0,
      };
    }
  });
