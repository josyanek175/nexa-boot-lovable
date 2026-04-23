import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveNumber } from "@/hooks/use-active-number";
import { useServerFn } from "@tanstack/react-start";
import { findOrCreateConversation } from "@/lib/chat.functions";
import { Search, X, Phone, MessageSquarePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type ContactRow = Tables<"contacts">;

interface NewConversationDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (conversationId: string) => void;
}

export function NewConversationDialog({ open, onClose, onCreated }: NewConversationDialogProps) {
  const { activeNumberId, numbers, activeNumber } = useActiveNumber();
  const findOrCreate = useServerFn(findOrCreateConversation);

  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [selectedNumberId, setSelectedNumberId] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    setSearch("");
    // Default selected origin number
    if (activeNumberId && activeNumberId !== "all") {
      setSelectedNumberId(activeNumberId);
    } else if (numbers.length > 0) {
      setSelectedNumberId(numbers[0].id);
    }
    setLoading(true);
    supabase
      .from("contacts")
      .select("*")
      .order("nome", { ascending: true })
      .then(({ data }) => {
        setContacts(data ?? []);
        setLoading(false);
      });
  }, [open, activeNumberId, numbers]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        c.nome.toLowerCase().includes(q) ||
        c.telefone.includes(q) ||
        (c.referencia?.toLowerCase().includes(q) ?? false)
    );
  }, [contacts, search]);

  const selectedNumber = numbers.find((n) => n.id === selectedNumberId) ?? activeNumber;

  const handleStart = async (contact: ContactRow) => {
    if (!selectedNumberId) {
      toast.error("Selecione um número de WhatsApp de origem.");
      return;
    }
    if (selectedNumber?.status !== "conectado") {
      toast.warning("Atenção: número de origem está desconectado. A conversa será criada mas mensagens podem não ser enviadas.");
    }
    setCreating(true);
    try {
      const result = await findOrCreate({
        data: {
          contactPhone: contact.telefone,
          contactName: contact.nome,
          whatsappNumberId: selectedNumberId,
        },
      });
      if (result.error || !result.conversation) {
        toast.error("Erro ao criar conversa: " + (result.error ?? "desconhecido"));
        return;
      }
      toast.success(`Conversa iniciada com ${contact.nome}`);
      onCreated(result.conversation.id);
      onClose();
    } catch (err: any) {
      toast.error("Erro: " + (err.message ?? "desconhecido"));
    } finally {
      setCreating(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-2">
            <MessageSquarePlus className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold text-foreground">Nova conversa</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-border p-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Número de origem (WhatsApp)</label>
            <select
              value={selectedNumberId}
              onChange={(e) => setSelectedNumberId(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {numbers.length === 0 && <option value="">Nenhum número disponível</option>}
              {numbers.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.nome} — {n.phone_number || n.instance_name} {n.status === "conectado" ? "🟢" : "🔴"}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar contato por nome, telefone ou referência..."
              className="w-full rounded-full bg-muted py-2 pl-9 pr-9 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-background hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando contatos...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {contacts.length === 0
                ? "Nenhum contato cadastrado. Vá em Contatos para importar."
                : "Nenhum contato encontrado."}
            </div>
          ) : (
            filtered.map((c) => {
              const initials = c.nome
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")
                .toUpperCase();
              return (
                <button
                  key={c.id}
                  onClick={() => handleStart(c)}
                  disabled={creating}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted disabled:opacity-50"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{c.nome}</p>
                    <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                      <Phone className="h-3 w-3" /> {c.telefone}
                      {c.referencia && <span className="ml-1 truncate">• {c.referencia}</span>}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
