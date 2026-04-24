import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendTextMessage } from "./evolution-api.server";
import { normalizePhone } from "./phone-utils";

// ── Load WhatsApp numbers from DB ──
export const loadWhatsappNumbers = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("whatsapp_numbers")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) {
    console.error("Failed to load numbers:", error);
    return { numbers: [], error: error.message };
  }
  return { numbers: data ?? [], error: null };
});

// ── Load conversations with contact info ──
export const loadConversations = createServerFn({ method: "POST" })
  .inputValidator((data: { numberId?: string }) => data)
  .handler(async ({ data }) => {
    let query = supabaseAdmin
      .from("conversations")
      .select("*, contacts(*)")
      .order("updated_at", { ascending: false });

    if (data.numberId && data.numberId !== "all") {
      query = query.eq("whatsapp_number_id", data.numberId);
    }

    const { data: convs, error } = await query;
    if (error) {
      console.error("Failed to load conversations:", error);
      return { conversations: [], error: error.message };
    }

    // For each conversation, get the last message
    const enriched = await Promise.all(
      (convs ?? []).map(async (conv) => {
        const { data: msgs } = await supabaseAdmin
          .from("messages")
          .select("conteudo, data_envio, tipo")
          .eq("conversation_id", conv.id)
          .order("data_envio", { ascending: false })
          .limit(1);

        const lastMsg = msgs?.[0];
        return {
          ...conv,
          lastMessage: lastMsg?.conteudo ?? "",
          lastMessageTime: lastMsg?.data_envio ?? conv.updated_at,
        };
      })
    );

    return { conversations: enriched, error: null };
  });

// ── Load messages for a conversation ──
export const loadMessages = createServerFn({ method: "POST" })
  .inputValidator((data: { conversationId: string }) => data)
  .handler(async ({ data }) => {
    const { data: msgs, error } = await supabaseAdmin
      .from("messages")
      .select("*")
      .eq("conversation_id", data.conversationId)
      .order("data_envio", { ascending: true });

    if (error) {
      console.error("Failed to load messages:", error);
      return { messages: [], error: error.message };
    }

    // Lookup separado dos nomes dos atendentes
    const userIds = Array.from(
      new Set((msgs ?? []).map((m) => m.user_id).filter(Boolean))
    );
    let profilesMap: Record<string, { nome: string }> = {};
    if (userIds.length > 0) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("user_id, nome")
        .in("user_id", userIds as string[]);
      (profs ?? []).forEach((p: any) => {
        profilesMap[p.user_id] = { nome: p.nome };
      });
    }

    const enriched = (msgs ?? []).map((m) => ({
      ...m,
      profiles: m.user_id ? profilesMap[m.user_id] ?? null : null,
    }));

    return { messages: enriched, error: null };
  });

// ── Send message: save to DB + send via Evolution API ──
export const sendChatMessage = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      conversationId: string;
      whatsappNumberId: string;
      userId: string;
      conteudo: string;
      contactPhone: string;
      instanceName: string;
    }) => data
  )
  .handler(async ({ data }) => {
    // 1. Save message to DB
    const { data: msg, error: msgError } = await supabaseAdmin
      .from("messages")
      .insert({
        conversation_id: data.conversationId,
        whatsapp_number_id: data.whatsappNumberId,
        user_id: data.userId,
        tipo: "saida",
        conteudo: data.conteudo,
      })
      .select()
      .single();

    if (msgError) {
      console.error("Failed to save message:", msgError);
      return { message: null, error: msgError.message };
    }

    // 2. Update conversation's updated_at
    await supabaseAdmin
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", data.conversationId);

    // 3. Update contact's ultima_interacao and increment tentativas
    const { data: conv } = await supabaseAdmin
      .from("conversations")
      .select("contact_id")
      .eq("id", data.conversationId)
      .single();

    if (conv) {
      const { data: contact } = await supabaseAdmin
        .from("contacts")
        .select("total_tentativas_sem_resposta")
        .eq("id", conv.contact_id)
        .single();

      await supabaseAdmin
        .from("contacts")
        .update({
          ultima_interacao: new Date().toISOString(),
          total_tentativas_sem_resposta: (contact?.total_tentativas_sem_resposta ?? 0) + 1,
        })
        .eq("id", conv.contact_id);
    }

    // 4. Send via Evolution API
    if (!data.instanceName) {
      return {
        message: msg,
        error: "Instância WhatsApp não configurada para esta conversa.",
      };
    }

    try {
      const phoneDigits = normalizePhone(data.contactPhone);
      // Evolution aceita só o número (sem @s.whatsapp.net)
      await sendTextMessage(data.instanceName, phoneDigits, data.conteudo);
      return { message: msg, error: null };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("Evolution API send failed:", errMsg);
      return {
        message: msg,
        error: `Mensagem salva, mas envio para WhatsApp falhou: ${errMsg}`,
      };
    }
  });

// ── Create or find conversation for a contact ──
export const findOrCreateConversation = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { contactPhone: string; contactName: string; whatsappNumberId: string }) => data
  )
  .handler(async ({ data }) => {
    const phone = normalizePhone(data.contactPhone);
    // Find or create contact
    let { data: contact } = await supabaseAdmin
      .from("contacts")
      .select("id")
      .eq("telefone", phone)
      .single();

    if (!contact) {
      const { data: newContact, error } = await supabaseAdmin
        .from("contacts")
        .insert({
          nome: data.contactName,
          telefone: phone,
        })
        .select("id")
        .single();
      if (error) return { conversation: null, error: error.message };
      contact = newContact;
    }

    // Find existing open conversation
    let { data: conv } = await supabaseAdmin
      .from("conversations")
      .select("*")
      .eq("contact_id", contact!.id)
      .eq("whatsapp_number_id", data.whatsappNumberId)
      .eq("status", "aberto")
      .single();

    if (!conv) {
      const { data: newConv, error } = await supabaseAdmin
        .from("conversations")
        .insert({
          contact_id: contact!.id,
          whatsapp_number_id: data.whatsappNumberId,
          status: "aberto",
        })
        .select("*")
        .single();
      if (error) return { conversation: null, error: error.message };
      conv = newConv;
    }

    return { conversation: conv, error: null };
  });

// ── Process incoming message (from webhook) ──
export const processIncomingMessage = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      contactPhone: string;
      contactName: string;
      whatsappNumberId: string;
      conteudo: string;
    }) => data
  )
  .handler(async ({ data }) => {
    const phone = data.contactPhone.replace(/\D/g, "").replace(/@.*/, "");

    // Find or create contact
    let { data: contact } = await supabaseAdmin
      .from("contacts")
      .select("id")
      .eq("telefone", phone)
      .single();

    if (!contact) {
      const { data: newContact, error } = await supabaseAdmin
        .from("contacts")
        .insert({ nome: data.contactName || phone, telefone: phone })
        .select("id")
        .single();
      if (error) return { error: error.message };
      contact = newContact;
    }

    // Update contact CRM fields: reset tentativas, update ultima_conversa
    await supabaseAdmin
      .from("contacts")
      .update({
        ultima_interacao: new Date().toISOString(),
        ultima_conversa: new Date().toISOString(),
        total_tentativas_sem_resposta: 0,
      })
      .eq("id", contact!.id);

    // Find or create conversation
    let { data: conv } = await supabaseAdmin
      .from("conversations")
      .select("id")
      .eq("contact_id", contact!.id)
      .eq("whatsapp_number_id", data.whatsappNumberId)
      .eq("status", "aberto")
      .single();

    if (!conv) {
      const { data: newConv, error } = await supabaseAdmin
        .from("conversations")
        .insert({
          contact_id: contact!.id,
          whatsapp_number_id: data.whatsappNumberId,
          status: "aberto",
        })
        .select("id")
        .single();
      if (error) return { error: error.message };
      conv = newConv;
    }

    // Save message
    const { error: msgError } = await supabaseAdmin
      .from("messages")
      .insert({
        conversation_id: conv!.id,
        whatsapp_number_id: data.whatsappNumberId,
        tipo: "entrada",
        conteudo: data.conteudo,
        user_id: null,
      });

    // Update conversation timestamp
    await supabaseAdmin
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conv!.id);

    if (msgError) return { error: msgError.message };
    return { error: null };
  });
