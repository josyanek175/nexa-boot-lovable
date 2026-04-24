import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useRef } from "react";
import { ConversationList } from "@/components/ConversationList";
import { ChatView } from "@/components/ChatView";
import { EmptyChatState } from "@/components/EmptyChatState";
import { NumberSelector } from "@/components/NumberSelector";
import { useActiveNumber } from "@/hooks/use-active-number";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/")({
  component: ConversationsPage,
  head: () => ({
    meta: [
      { title: "NexaBoot — Gestão de Atendimento WhatsApp" },
      { name: "description", content: "Plataforma profissional de atendimento via WhatsApp" },
    ],
  }),
});

function ConversationsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const { activeNumberId, numbers } = useActiveNumber();
  const { user } = useAuth();
  const messagesRef = useRef<any[]>([]);
  const selectedIdRef = useRef<string | null>(null);

  const dedupeMessages = useCallback((items: any[]) => {
    return items
      .filter((msg, index, self) => {
        const messageKey = msg.message_id ?? msg.id;
        return (
          index ===
          self.findIndex((candidate) => (candidate.message_id ?? candidate.id) === messageKey)
        );
      })
      .sort((a, b) => new Date(a.data_envio).getTime() - new Date(b.data_envio).getTime());
  }, []);

  const fetchConversations = useCallback(async () => {
    setLoadingConvs(true);
    let query = supabase
      .from("conversations")
      .select("*, contacts(*)")
      .order("updated_at", { ascending: false });

    if (activeNumberId && activeNumberId !== "all") {
      query = query.eq("whatsapp_number_id", activeNumberId);
    }

    const { data: convs } = await query;

    if (convs && convs.length > 0) {
      // Fetch assignee profiles in batch
      const assigneeIds = Array.from(
        new Set(convs.map((c: any) => c.assigned_to).filter(Boolean))
      );
      let profilesMap: Record<string, { nome: string }> = {};
      if (assigneeIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, nome")
          .in("user_id", assigneeIds as string[]);
        (profs ?? []).forEach((p: any) => {
          profilesMap[p.user_id] = { nome: p.nome };
        });
      }

      // SLA per number lookup
      const slaMap: Record<string, number> = {};
      numbers.forEach((n: any) => {
        slaMap[n.id] = n.sla_minutes ?? 5;
      });

      const enriched = await Promise.all(
        convs.map(async (conv: any) => {
          const { data: msgs } = await supabase
            .from("messages")
            .select("conteudo, data_envio")
            .eq("conversation_id", conv.id)
            .order("data_envio", { ascending: false })
            .limit(1);
          const lastMsg = msgs?.[0];
          return {
            ...conv,
            lastMessage: lastMsg?.conteudo ?? "",
            lastMessageTime: lastMsg?.data_envio ?? conv.updated_at,
            assigned_profile: conv.assigned_to ? profilesMap[conv.assigned_to] ?? null : null,
            sla_minutes: slaMap[conv.whatsapp_number_id] ?? 5,
          };
        })
      );
      // Deduplicação defensiva por id antes de salvar no estado
      const uniqueEnriched = Array.from(
        new Map(enriched.map((c: any) => [c.id, c])).values()
      );
      setConversations(uniqueEnriched);
    } else {
      setConversations([]);
    }
    setLoadingConvs(false);
  }, [activeNumberId, numbers]);

  const fetchMessages = useCallback(async (convId: string) => {
    setLoadingMsgs(true);
    const { data: msgs, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", convId)
      .order("data_envio", { ascending: true });

    if (error) {
      console.error("Failed to load messages:", error);
      setMessages([]);
      setLoadingMsgs(false);
      return;
    }

    // Lookup separado: buscar nomes dos atendentes (user_id → profiles)
    const userIds = Array.from(
      new Set((msgs ?? []).map((m: any) => m.user_id).filter(Boolean))
    );
    let profilesMap: Record<string, { nome: string }> = {};
    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, nome")
        .in("user_id", userIds as string[]);
      (profs ?? []).forEach((p: any) => {
        profilesMap[p.user_id] = { nome: p.nome };
      });
    }

    const enriched = (msgs ?? []).map((m: any) => ({
      ...m,
      profiles: m.user_id ? profilesMap[m.user_id] ?? null : null,
    }));
    setMessages(dedupeMessages(enriched));
    setLoadingMsgs(false);
  }, [dedupeMessages]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Limpa caches locais ao trocar de número (evita exibir conversas antigas)
  useEffect(() => {
    setConversations([]);
    setMessages([]);
    setSelectedId(null);
    messagesRef.current = [];
  }, [activeNumberId]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    if (selectedId) {
      fetchMessages(selectedId);
    } else {
      setMessages([]);
    }
  }, [selectedId, fetchMessages]);

  // Realtime: messages + conversations
  useEffect(() => {
    const channel = supabase
      .channel("chat-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          console.log("Nova mensagem recebida:", payload);
          const newMsg = payload.new as any;
          const currentSelectedId = selectedIdRef.current;

          if (currentSelectedId && newMsg.conversation_id === currentSelectedId) {
            const newMessageKey = newMsg.message_id ?? newMsg.id;

            setMessages((prev) => {
              const exists = prev.find(
                (message) => (message.message_id ?? message.id) === newMessageKey
              );

              if (exists) return prev;

              return [...prev, newMsg].sort(
                (a, b) => new Date(a.data_envio).getTime() - new Date(b.data_envio).getTime()
              );
            });
          }

          fetchConversations();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversations" },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dedupeMessages, fetchConversations]);

  const selectedConv = conversations.find((c) => c.id === selectedId);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-2.5">
        <NumberSelector />
        <span className="text-xs text-muted-foreground">
          {conversations.length} conversa{conversations.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {loadingConvs ? (
          <div className="flex w-80 items-center justify-center border-r border-border bg-card lg:w-96">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <ConversationList
            conversations={conversations}
            selectedId={selectedId}
            onSelect={setSelectedId}
            currentUserId={user?.id}
            onConversationCreated={() => fetchConversations()}
          />
        )}
        {selectedConv && selectedId ? (
          loadingMsgs ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <ChatView
              conversation={selectedConv}
              messages={messages}
              onConversationUpdate={fetchConversations}
            />
          )
        ) : (
          <EmptyChatState />
        )}
      </div>
    </div>
  );
}
