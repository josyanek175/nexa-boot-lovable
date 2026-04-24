import { useState, useRef, useEffect } from "react";
import {
  Send,
  Paperclip,
  Smile,
  MoreVertical,
  Phone,
  CheckCheck,
  Zap,
  Loader2,
  UserPlus,
  UserCog,
  CheckCircle2,
  RotateCcw,
  UserPlus2,
} from "lucide-react";
import { AddContactDialog } from "@/components/AddContactDialog";
import { sendChatMessage } from "@/lib/chat.functions";
import {
  assumirConversa,
  finalizarConversa,
  reabrirConversa,
  transferirConversa,
  listAttendantsForNumber,
} from "@/lib/queue.functions";
import { useAuth } from "@/hooks/use-auth";
import { useActiveNumber } from "@/hooks/use-active-number";

interface MessageItem {
  id: string;
  conteudo: string;
  tipo: string;
  data_envio: string;
  user_id: string | null;
  whatsapp_number_id: string;
  profiles?: { nome: string } | null;
}

interface ConversationData {
  id: string;
  status: string;
  status_atendimento?: "pendente" | "em_atendimento" | "finalizado";
  assigned_to?: string | null;
  assigned_profile?: { nome: string } | null;
  whatsapp_number_id: string;
  contacts: {
    id: string;
    nome: string;
    telefone: string;
    is_temporary?: boolean;
  } | null;
}

interface ChatViewProps {
  conversation: ConversationData;
  messages: MessageItem[];
  onMessageSent: () => void;
  onConversationUpdate: () => void;
}

const quickReplies = [
  "Olá! Como posso ajudar você hoje?",
  "Vou verificar isso para você. Um momento, por favor.",
  "Seu pedido está em processamento e será enviado em breve.",
  "Obrigado por entrar em contato! Posso ajudar com mais alguma coisa?",
  "Entendo sua situação. Vou encaminhar para o setor responsável.",
];

function MessageBubble({ message }: { message: MessageItem }) {
  const isSent = message.tipo === "saida";
  const time = new Date(message.data_envio).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const agentName = message.profiles?.nome;

  return (
    <div className={`flex ${isSent ? "justify-end" : "justify-start"} mb-1.5`}>
      <div
        className={`relative max-w-[75%] rounded-lg px-3 py-1.5 text-sm shadow-sm ${
          isSent
            ? "rounded-tr-sm bg-chat-bubble-sent text-foreground"
            : "rounded-tl-sm bg-chat-bubble-received text-foreground"
        }`}
      >
        {isSent && agentName && (
          <p className="mb-0.5 text-[11px] font-semibold text-primary">{agentName}</p>
        )}
        <p className="whitespace-pre-wrap break-words pr-12">{message.conteudo}</p>
        <div className="float-right -mb-1 ml-2 mt-1 flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground">{time}</span>
          {isSent && <CheckCheck className="h-3 w-3 text-primary" />}
        </div>
        <div className="clear-both" />
      </div>
    </div>
  );
}

export function ChatView({ conversation, messages, onMessageSent, onConversationUpdate }: ChatViewProps) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [attendants, setAttendants] = useState<Array<{ user_id: string; nome: string; email: string }>>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const { user, hasPermission, isAdmin } = useAuth();
  const { numbers } = useActiveNumber();

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const numberData = numbers.find((n) => n.id === conversation.whatsapp_number_id);
  const contactName = conversation.contacts?.nome ?? "Desconhecido";
  const contactPhone = conversation.contacts?.telefone ?? "";
  const initials = contactName.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();

  const status = conversation.status_atendimento ?? "pendente";
  const isMine = user && conversation.assigned_to === user.id;
  const assigneeName = conversation.assigned_profile?.nome;
  const canReassign = isAdmin || hasPermission("pode_reatribuir_conversas" as never);
  const isFinalized = status === "finalizado";
  const isTemporaryContact = !!conversation.contacts?.is_temporary;

  const handleSend = async () => {
    if (!input.trim() || sending || !user || !numberData) return;
    setSending(true);
    try {
      await sendChatMessage({
        data: {
          conversationId: conversation.id,
          whatsappNumberId: conversation.whatsapp_number_id,
          userId: user.id,
          conteudo: input.trim(),
          contactPhone,
          instanceName: numberData.instance_name,
        },
      });
      setInput("");
      onMessageSent();
    } catch (err) {
      console.error("Failed to send:", err);
    } finally {
      setSending(false);
    }
  };

  const handleAssumir = async () => {
    if (!user) return;
    await assumirConversa({ data: { conversationId: conversation.id, userId: user.id } });
    onConversationUpdate();
  };

  const handleFinalizar = async () => {
    if (!user) return;
    await finalizarConversa({ data: { conversationId: conversation.id, userId: user.id } });
    onConversationUpdate();
  };

  const handleReabrir = async () => {
    await reabrirConversa({ data: { conversationId: conversation.id } });
    onConversationUpdate();
  };

  const openTransfer = async () => {
    setShowTransfer(true);
    const res = await listAttendantsForNumber({
      data: { whatsappNumberId: conversation.whatsapp_number_id },
    });
    setAttendants(res.attendants ?? []);
  };

  const handleTransfer = async (toUserId: string) => {
    if (!user) return;
    await transferirConversa({
      data: { conversationId: conversation.id, toUserId, requestedBy: user.id },
    });
    setShowTransfer(false);
    onConversationUpdate();
  };

  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
            {initials}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{contactName}</h3>
            <p className="text-xs text-muted-foreground">
              {contactPhone}
              {numberData && (
                <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                  {numberData.nome}
                </span>
              )}
              {assigneeName && (
                <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {isMine ? "Você atende" : `Atendente: ${assigneeName}`}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {!isFinalized && !isMine && (
            <button
              onClick={handleAssumir}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              title="Assumir esta conversa"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Assumir
            </button>
          )}
          {!isFinalized && canReassign && (
            <button
              onClick={openTransfer}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
              title="Transferir para outro atendente"
            >
              <UserCog className="h-3.5 w-3.5" />
              Transferir
            </button>
          )}
          {!isFinalized && (isMine || canReassign) && (
            <button
              onClick={handleFinalizar}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
              title="Finalizar atendimento"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Finalizar
            </button>
          )}
          {isFinalized && (
            <button
              onClick={handleReabrir}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reabrir
            </button>
          )}
          <button className="rounded-lg p-2 text-muted-foreground hover:bg-muted">
            <Phone className="h-4 w-4" />
          </button>
          <button className="rounded-lg p-2 text-muted-foreground hover:bg-muted">
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Banner para contatos temporários */}
      {isTemporaryContact && conversation.contacts && (
        <div className="flex items-center justify-between gap-3 border-b border-border bg-muted px-4 py-2">
          <p className="text-xs text-foreground">
            <span className="font-medium">Este número não está na sua lista de contatos.</span>{" "}
            <span className="text-muted-foreground">Adicione-o para organizar seu atendimento.</span>
          </p>
          <button
            onClick={() => setShowAddContact(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            <UserPlus2 className="h-3.5 w-3.5" />
            Adicionar aos contatos
          </button>
        </div>
      )}

      {/* Modal adicionar contato */}
      {conversation.contacts && (
        <AddContactDialog
          open={showAddContact}
          onClose={() => setShowAddContact(false)}
          contactId={conversation.contacts.id}
          initialPhone={conversation.contacts.telefone}
          initialName={isTemporaryContact ? "" : conversation.contacts.nome}
          onSaved={onConversationUpdate}
        />
      )}

      {showTransfer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowTransfer(false)}
        >
          <div
            className="w-80 rounded-xl border border-border bg-card p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 text-sm font-semibold text-foreground">
              Transferir conversa para
            </h3>
            <div className="max-h-72 space-y-1 overflow-y-auto custom-scrollbar">
              {attendants.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  Nenhum atendente vinculado a este número.
                </p>
              ) : (
                attendants.map((a) => (
                  <button
                    key={a.user_id}
                    onClick={() => handleTransfer(a.user_id)}
                    disabled={a.user_id === conversation.assigned_to}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted disabled:opacity-40"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {a.nome.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{a.nome}</p>
                      <p className="truncate text-xs text-muted-foreground">{a.email}</p>
                    </div>
                    {a.user_id === conversation.assigned_to && (
                      <span className="text-[10px] text-muted-foreground">atual</span>
                    )}
                  </button>
                ))
              )}
            </div>
            <button
              onClick={() => setShowTransfer(false)}
              className="mt-3 w-full rounded-lg border border-border py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto chat-pattern custom-scrollbar px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="rounded-lg bg-card/80 px-4 py-2 text-xs text-muted-foreground shadow-sm">
              Nenhuma mensagem ainda. Envie a primeira!
            </div>
          </div>
        ) : (
          (() => {
            let lastDate = "";
            return messages.map((msg) => {
              const d = new Date(msg.data_envio);
              const dateLabel = d.toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              });
              const showDivider = dateLabel !== lastDate;
              lastDate = dateLabel;
              return (
                <div key={msg.id}>
                  {showDivider && (
                    <div className="my-3 flex justify-center">
                      <span className="rounded-md bg-card/90 px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm">
                        {dateLabel}
                      </span>
                    </div>
                  )}
                  <MessageBubble message={msg} />
                </div>
              );
            });
          })()
        )}
        <div ref={endRef} />
      </div>

      {/* Quick replies */}
      {showQuickReplies && (
        <div className="border-t border-border bg-card px-4 py-2">
          <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1">
            {quickReplies.map((reply, i) => (
              <button
                key={i}
                onClick={() => {
                  setInput(reply);
                  setShowQuickReplies(false);
                }}
                className="shrink-0 rounded-full border border-border bg-muted px-3 py-1.5 text-xs text-foreground hover:bg-primary/10 hover:border-primary/30 transition-colors"
              >
                {reply.length > 40 ? reply.slice(0, 40) + "…" : reply}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border bg-card px-4 py-3">
        {isFinalized ? (
          <div className="rounded-lg bg-muted px-4 py-3 text-center text-xs text-muted-foreground">
            Conversa finalizada. Reabra para enviar novas mensagens.
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button className="rounded-lg p-2 text-muted-foreground hover:bg-muted">
              <Paperclip className="h-5 w-5" />
            </button>
            <button
              onClick={() => setShowQuickReplies(!showQuickReplies)}
              className={`rounded-lg p-2 transition-colors ${
                showQuickReplies ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Zap className="h-5 w-5" />
            </button>
            <div className="relative flex-1">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Digite uma mensagem..."
                className="w-full rounded-full bg-muted py-2.5 pl-4 pr-10 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                disabled={sending}
              />
              <button className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-foreground">
                <Smile className="h-5 w-5" />
              </button>
            </div>
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground transition-all hover:bg-whatsapp-dark disabled:opacity-40"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
