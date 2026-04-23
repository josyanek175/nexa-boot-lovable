import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Atendente assume conversa pendente da fila
export const assumirConversa = createServerFn({ method: "POST" })
  .inputValidator((data: { conversationId: string; userId: string }) => data)
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("conversations")
      .update({
        assigned_to: data.userId,
        assigned_at: new Date().toISOString(),
        status_atendimento: "em_atendimento",
      })
      .eq("id", data.conversationId);
    return { error: error?.message ?? null };
  });

// Transferir conversa para outro atendente (admin/gerente)
export const transferirConversa = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { conversationId: string; toUserId: string; requestedBy: string }) => data
  )
  .handler(async ({ data }) => {
    // Verificar permissão
    const { data: canReassign } = await supabaseAdmin.rpc("can_reassign_conversations", {
      _user_id: data.requestedBy,
    });
    if (!canReassign) {
      return { error: "Sem permissão para reatribuir conversas" };
    }
    const { error } = await supabaseAdmin
      .from("conversations")
      .update({
        assigned_to: data.toUserId,
        assigned_at: new Date().toISOString(),
        status_atendimento: "em_atendimento",
      })
      .eq("id", data.conversationId);
    return { error: error?.message ?? null };
  });

// Finalizar conversa
export const finalizarConversa = createServerFn({ method: "POST" })
  .inputValidator((data: { conversationId: string; userId: string }) => data)
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("conversations")
      .update({
        status_atendimento: "finalizado",
        closed_at: new Date().toISOString(),
        closed_by: data.userId,
      })
      .eq("id", data.conversationId);
    return { error: error?.message ?? null };
  });

// Reabrir conversa finalizada
export const reabrirConversa = createServerFn({ method: "POST" })
  .inputValidator((data: { conversationId: string }) => data)
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("conversations")
      .update({
        status_atendimento: "em_atendimento",
        closed_at: null,
        closed_by: null,
      })
      .eq("id", data.conversationId);
    return { error: error?.message ?? null };
  });

// Listar atendentes vinculados a um número (para transferência)
export const listAttendantsForNumber = createServerFn({ method: "POST" })
  .inputValidator((data: { whatsappNumberId: string }) => data)
  .handler(async ({ data }) => {
    const { data: links } = await supabaseAdmin
      .from("user_whatsapp_numbers")
      .select("user_id")
      .eq("whatsapp_number_id", data.whatsappNumberId);

    const userIds = (links ?? []).map((l) => l.user_id);
    if (userIds.length === 0) return { attendants: [] };

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("user_id, nome, email")
      .in("user_id", userIds)
      .eq("status", "ativo");

    return { attendants: profiles ?? [] };
  });
