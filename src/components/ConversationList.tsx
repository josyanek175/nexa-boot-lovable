import { Search, X, Clock, AlertTriangle, UserCheck, Inbox, CheckCircle2, MessageSquarePlus } from "lucide-react";
import { useState } from "react";
import { NewConversationDialog } from "./NewConversationDialog";

interface ConversationItem {
  id: string;
  status: string;
  status_atendimento?: "pendente" | "em_atendimento" | "finalizado";
  assigned_to?: string | null;
  assigned_profile?: { nome: string } | null;
  last_customer_message_at?: string | null;
  first_response_at?: string | null;
  sla_minutes?: number;
  updated_at: string;
  whatsapp_number_id: string;
  contacts: {
    id: string;
    nome: string;
    telefone: string;
    email?: string | null;
  } | null;
  lastMessage: string;
  lastMessageTime: string;
}

interface ConversationListProps {
  conversations: ConversationItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  currentUserId?: string;
  onConversationCreated?: (id: string) => void;
}

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diff < 1) return "agora";
  if (diff < 60) return `${diff}m`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h`;
  return `${Math.floor(diff / 1440)}d`;
}

function isOverdue(conv: ConversationItem): boolean {
  if (conv.status_atendimento === "finalizado") return false;
  if (!conv.last_customer_message_at) return false;
  const sla = conv.sla_minutes ?? 5;
  // Atrasada se cliente mandou e: não houve resposta OU resposta veio antes da última msg do cliente
  const lastCustomer = new Date(conv.last_customer_message_at).getTime();
  const lastResponse = conv.first_response_at ? new Date(conv.first_response_at).getTime() : 0;
  if (lastResponse > lastCustomer) return false;
  return Date.now() - lastCustomer > sla * 60_000;
}

const STATUS_TABS = [
  { value: "all", label: "Todas", icon: Inbox },
  { value: "pendente", label: "Fila", icon: Clock },
  { value: "em_atendimento", label: "Em atendimento", icon: UserCheck },
  { value: "finalizado", label: "Finalizadas", icon: CheckCircle2 },
] as const;

export function ConversationList({ conversations, selectedId, onSelect, currentUserId, onConversationCreated }: ConversationListProps) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<string>("all");
  const [newOpen, setNewOpen] = useState(false);

  // Deduplicação defensiva: garante 1 conversa por id, mesmo se vier duplicada do estado/cache
  const uniqueConversations = Array.from(
    new Map(conversations.map((c) => [c.id, c])).values()
  );

  const counts = {
    all: uniqueConversations.length,
    pendente: uniqueConversations.filter((c) => c.status_atendimento === "pendente").length,
    em_atendimento: uniqueConversations.filter((c) => c.status_atendimento === "em_atendimento").length,
    finalizado: uniqueConversations.filter((c) => c.status_atendimento === "finalizado").length,
  };

  const filtered = uniqueConversations.filter((c) => {
    const name = c.contacts?.nome ?? "";
    const phone = c.contacts?.telefone ?? "";
    const matchSearch =
      name.toLowerCase().includes(search.toLowerCase()) || phone.includes(search);
    const matchTab = tab === "all" || c.status_atendimento === tab;
    return matchSearch && matchTab;
  });

  return (
    <div className="flex h-full w-80 flex-col border-r border-border bg-card lg:w-96">
      <div className="border-b border-border p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">Conversas</h2>
          <button
            onClick={() => setNewOpen(true)}
            className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <MessageSquarePlus className="h-3.5 w-3.5" />
            Nova
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou telefone..."
            className="w-full rounded-full bg-muted py-2 pl-9 pr-9 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-background hover:text-foreground"
              aria-label="Limpar busca"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="mt-3 flex gap-1 overflow-x-auto custom-scrollbar">
          {STATUS_TABS.map((t) => {
            const Icon = t.icon;
            const count = counts[t.value as keyof typeof counts];
            const active = tab === t.value;
            return (
              <button
                key={t.value}
                onClick={() => setTab(t.value)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                <Icon className="h-3 w-3" />
                {t.label}
                <span className={`rounded-full px-1.5 text-[10px] ${active ? "bg-primary-foreground/20" : "bg-background"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Nenhuma conversa encontrada
          </div>
        ) : (
          filtered.map((conv) => {
            const contactName = conv.contacts?.nome ?? "Desconhecido";
            const initials = contactName
              .split(" ")
              .map((n) => n[0])
              .slice(0, 2)
              .join("")
              .toUpperCase();
            const overdue = isOverdue(conv);
            const isMine = currentUserId && conv.assigned_to === currentUserId;
            const assigneeName = conv.assigned_profile?.nome;

            return (
              <button
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                className={`flex w-full items-start gap-3 border-b border-border/50 px-4 py-3 text-left transition-colors hover:bg-muted/50 ${
                  selectedId === conv.id ? "bg-primary/5 border-l-2 border-l-primary" : ""
                }`}
              >
                <div className="relative">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {initials}
                  </div>
                  {overdue && (
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
                      <AlertTriangle className="h-2.5 w-2.5" />
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-foreground">
                      {contactName}
                    </span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {timeAgo(conv.lastMessageTime)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {conv.lastMessage || "Sem mensagens"}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    {conv.status_atendimento === "pendente" && (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                        Na fila
                      </span>
                    )}
                    {conv.status_atendimento === "em_atendimento" && (
                      <span className="rounded-full bg-status-open/15 px-2 py-0.5 text-[10px] font-medium text-status-open">
                        Em atendimento
                      </span>
                    )}
                    {conv.status_atendimento === "finalizado" && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        Finalizada
                      </span>
                    )}
                    {assigneeName && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          isMine ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {isMine ? "Você" : assigneeName.split(" ")[0]}
                      </span>
                    )}
                    {overdue && (
                      <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-medium text-destructive">
                        Atrasada
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      <NewConversationDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={(id) => {
          onConversationCreated?.(id);
          onSelect(id);
        }}
      />
    </div>
  );
}
