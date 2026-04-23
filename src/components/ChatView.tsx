import { useState, useRef, useEffect } from "react";
import {
  Send,
  Paperclip,
  Smile,
  MoreVertical,
  Phone,
  User,
  Clock,
  CheckCheck,
  Check,
  Zap,
  Loader2,
} from "lucide-react";
import { sendChatMessage } from "@/lib/chat.functions";
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
  whatsapp_number_id: string;
  contacts: {
    id: string;
    nome: string;
    telefone: string;
  } | null;
}

interface ChatViewProps {
  conversation: ConversationData;
  messages: MessageItem[];
  onMessageSent: () => void;
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

export function ChatView({ conversation, messages, onMessageSent }: ChatViewProps) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { numbers } = useActiveNumber();

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const numberData = numbers.find((n) => n.id === conversation.whatsapp_number_id);
  const contactName = conversation.contacts?.nome ?? "Desconhecido";
  const contactPhone = conversation.contacts?.telefone ?? "";
  const initials = contactName.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();

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
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="rounded-lg p-2 text-muted-foreground hover:bg-muted">
            <Phone className="h-4 w-4" />
          </button>
          <button className="rounded-lg p-2 text-muted-foreground hover:bg-muted">
            <User className="h-4 w-4" />
          </button>
          <button className="rounded-lg p-2 text-muted-foreground hover:bg-muted">
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      </div>

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
              const dateLabel = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
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
                onClick={() => { setInput(reply); setShowQuickReplies(false); }}
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
      </div>
    </div>
  );
}
