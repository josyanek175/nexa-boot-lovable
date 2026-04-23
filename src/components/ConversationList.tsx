import { Search, X } from "lucide-react";
import { useState } from "react";

interface ConversationItem {
  id: string;
  status: string;
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
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    aberto: "bg-status-open/15 text-status-open",
    fechado: "bg-status-closed/15 text-status-closed",
  };
  const labels: Record<string, string> = {
    aberto: "Aberto",
    fechado: "Fechado",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${styles[status] || "bg-muted text-muted-foreground"}`}>
      {labels[status] || status}
    </span>
  );
}

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diff < 1) return "agora";
  if (diff < 60) return `${diff}m`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h`;
  return `${Math.floor(diff / 1440)}d`;
}

export function ConversationList({ conversations, selectedId, onSelect }: ConversationListProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = conversations.filter((c) => {
    const name = c.contacts?.nome ?? "";
    const phone = c.contacts?.telefone ?? "";
    const matchSearch = name.toLowerCase().includes(search.toLowerCase()) || phone.includes(search);
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="flex h-full w-80 flex-col border-r border-border bg-card lg:w-96">
      <div className="border-b border-border p-3">
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
        {search && (
          <p className="mt-2 px-1 text-[11px] text-muted-foreground">
            {filtered.length} resultado{filtered.length !== 1 ? "s" : ""} para "{search}"
          </p>
        )}
        <div className="mt-3 flex gap-1">
          {[
            { value: "all", label: "Todos" },
            { value: "aberto", label: "Abertos" },
            { value: "fechado", label: "Fechados" },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                statusFilter === f.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {f.label}
            </button>
          ))}
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
            const initials = contactName.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
            return (
              <button
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                className={`flex w-full items-start gap-3 border-b border-border/50 px-4 py-3 text-left transition-colors hover:bg-muted/50 ${
                  selectedId === conv.id ? "bg-primary/5 border-l-2 border-l-primary" : ""
                }`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground truncate">
                      {contactName}
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                      {timeAgo(conv.lastMessageTime)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {conv.lastMessage || "Sem mensagens"}
                  </p>
                  <div className="mt-1.5">
                    <StatusBadge status={conv.status} />
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
