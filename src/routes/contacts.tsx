import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Phone, Mail, Search, Upload, X, RefreshCw, Pencil, Check, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  type ContactRow,
  type ClientStatus,
  computeClientStatus,
  statusLabels,
  statusColors,
  parseCSVContacts,
} from "@/lib/crm-utils";
import { normalizePhone } from "@/lib/phone-utils";

export const Route = createFileRoute("/contacts")({
  component: ContactsPage,
  head: () => ({
    meta: [
      { title: "Contatos — NexaBoot" },
      { name: "description", content: "CRM de contatos" },
    ],
  }),
});

type EditDraft = { nome: string; telefone: string; referencia: string };

function ContactsPage() {
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ClientStatus | "ALL">("ALL");
  const [importing, setImporting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditDraft>({ nome: "", telefone: "", referencia: "" });
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newDraft, setNewDraft] = useState<EditDraft>({ nome: "", telefone: "", referencia: "" });
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("contacts")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar contatos");
    } else {
      setContacts((data as ContactRow[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const filtered = contacts.filter((c) => {
    const status = computeClientStatus(c);
    if (statusFilter !== "ALL" && status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        c.nome.toLowerCase().includes(q) ||
        c.telefone.includes(q) ||
        (c.email?.toLowerCase().includes(q) ?? false) ||
        (c.referencia?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  const startEdit = (c: ContactRow) => {
    setEditingId(c.id);
    setDraft({ nome: c.nome, telefone: c.telefone, referencia: c.referencia ?? "" });
  };
  const cancelEdit = () => {
    setEditingId(null);
  };
  const saveEdit = async (id: string) => {
    const nome = draft.nome.trim();
    const telefone = normalizePhone(draft.telefone);
    if (!nome || telefone.length < 8) {
      toast.error("Nome e telefone válido são obrigatórios.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("contacts")
      .update({ nome, telefone, referencia: draft.referencia.trim() || null })
      .eq("id", id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    toast.success("Contato atualizado");
    setEditingId(null);
    fetchContacts();
  };

  const createContact = async () => {
    const nome = newDraft.nome.trim();
    const telefone = newDraft.telefone.replace(/\D/g, "");
    if (!nome || telefone.length < 8) {
      toast.error("Nome e telefone válido são obrigatórios.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("contacts").upsert(
      {
        nome,
        telefone,
        referencia: newDraft.referencia.trim() || null,
        is_temporary: false,
      },
      { onConflict: "telefone" }
    );
    setSaving(false);
    if (error) {
      toast.error("Erro: " + error.message);
      return;
    }
    toast.success("Contato salvo (criado ou atualizado)");
    setCreating(false);
    setNewDraft({ nome: "", telefone: "", referencia: "" });
    fetchContacts();
  };

  const deleteContact = async (contact: ContactRow) => {
    if (!window.confirm(`Excluir o contato "${contact.nome}"? Essa ação não pode ser desfeita.`)) return;
    setSaving(true);
    const { error } = await supabase.from("contacts").delete().eq("id", contact.id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao excluir: " + error.message);
      return;
    }
    toast.success("Contato excluído");
    setContacts((prev) => prev.filter((c) => c.id !== contact.id));
  };

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const parsed = parseCSVContacts(text);

      if (parsed.length === 0) {
        toast.error("CSV inválido. Certifique-se de ter colunas 'nome' e 'telefone'.");
        return;
      }

      const { data: existing } = await supabase.from("contacts").select("telefone");
      const existingPhones = new Set(existing?.map((c) => c.telefone) ?? []);

      const newContacts = parsed.filter((c) => !existingPhones.has(c.telefone));

      if (newContacts.length === 0) {
        toast.info("Todos os contatos já existem no sistema.");
        return;
      }

      const { error } = await supabase.from("contacts").upsert(newContacts, { onConflict: "telefone" });
      if (error) throw error;

      toast.success(`${newContacts.length} contato(s) importado(s). ${parsed.length - newContacts.length} duplicado(s) ignorado(s).`);
      fetchContacts();
    } catch (err: any) {
      toast.error("Erro na importação: " + (err.message ?? "Desconhecido"));
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
  };

  const statusOptions: (ClientStatus | "ALL")[] = ["ALL", "CLIENTE", "ATIVO", "LEAD_FRIO", "INATIVO"];

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contatos</h1>
          <p className="text-sm text-muted-foreground">{contacts.length} contatos no CRM</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchContacts} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCreating((v) => !v)}>
            <Plus className="h-4 w-4" />
            Novo contato
          </Button>
          <Button size="sm" onClick={() => fileRef.current?.click()} disabled={importing}>
            <Upload className="h-4 w-4" />
            {importing ? "Importando..." : "Importar CSV"}
          </Button>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCSVImport} />
        </div>
      </div>

      {creating && (
        <div className="mb-4 rounded-xl border border-border bg-card p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Novo contato</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <Input
              placeholder="Nome *"
              value={newDraft.nome}
              onChange={(e) => setNewDraft({ ...newDraft, nome: e.target.value })}
            />
            <Input
              placeholder="Telefone (somente números) *"
              value={newDraft.telefone}
              onChange={(e) => setNewDraft({ ...newDraft, telefone: e.target.value })}
            />
            <Input
              placeholder="Referência (opcional)"
              value={newDraft.referencia}
              onChange={(e) => setNewDraft({ ...newDraft, referencia: e.target.value })}
            />
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>Cancelar</Button>
            <Button size="sm" onClick={createContact} disabled={saving}>Salvar</Button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone, email ou referência..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {statusOptions.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                statusFilter === s
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:bg-muted/40"
              }`}
            >
              {s === "ALL" ? "Todos" : statusLabels[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> Carregando...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            {contacts.length === 0 ? "Nenhum contato cadastrado. Importe via CSV ou crie um novo!" : "Nenhum contato encontrado com os filtros atuais."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nome</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Telefone</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Referência</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Última Conversa</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground hidden lg:table-cell">Tentativas</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((contact) => {
                  const status = computeClientStatus(contact);
                  const isEditing = editingId === contact.id;
                  return (
                    <tr key={contact.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <Input
                            value={draft.nome}
                            onChange={(e) => setDraft({ ...draft, nome: e.target.value })}
                            className="h-8"
                          />
                        ) : (
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                              {contact.nome.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <span className="block font-medium text-foreground truncate">{contact.nome}</span>
                              {contact.email && (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Mail className="h-3 w-3" /> {contact.email}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <Input
                            value={draft.telefone}
                            onChange={(e) => setDraft({ ...draft, telefone: e.target.value })}
                            className="h-8"
                          />
                        ) : (
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <Phone className="h-3 w-3" /> {contact.telefone}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <Input
                            value={draft.referencia}
                            onChange={(e) => setDraft({ ...draft, referencia: e.target.value })}
                            className="h-8"
                            placeholder="Ex: empresa, indicação"
                          />
                        ) : (
                          <span className="text-muted-foreground">{contact.referencia || "—"}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusColors[status]}`}>
                          {statusLabels[status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{formatDate(contact.ultima_conversa)}</td>
                      <td className="px-4 py-3 text-center hidden lg:table-cell">
                        <span className={`font-mono text-xs ${contact.total_tentativas_sem_resposta > 3 ? "text-amber-400 font-bold" : "text-muted-foreground"}`}>
                          {contact.total_tentativas_sem_resposta}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isEditing ? (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={saving}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" onClick={() => saveEdit(contact.id)} disabled={saving}>
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => startEdit(contact)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => deleteContact(contact)}
                              disabled={saving}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
