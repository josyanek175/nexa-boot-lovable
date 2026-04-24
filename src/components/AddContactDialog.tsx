import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface AddContactDialogProps {
  open: boolean;
  onClose: () => void;
  contactId: string;
  initialPhone: string;
  initialName?: string;
  onSaved: () => void;
}

export function AddContactDialog({
  open,
  onClose,
  contactId,
  initialPhone,
  initialName,
  onSaved,
}: AddContactDialogProps) {
  const [nome, setNome] = useState(initialName ?? "");
  const [telefone, setTelefone] = useState(initialPhone);
  const [referencia, setReferencia] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSave = async () => {
    if (!nome.trim()) {
      setError("Nome é obrigatório");
      return;
    }
    setSaving(true);
    setError(null);
    const { error: updErr } = await supabase
      .from("contacts")
      .update({
        nome: nome.trim(),
        telefone: telefone.trim(),
        referencia: referencia.trim() || null,
        observacoes: observacoes.trim() || null,
        is_temporary: false,
      })
      .eq("id", contactId);

    setSaving(false);
    if (updErr) {
      setError(updErr.message);
      return;
    }
    onSaved();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-[420px] rounded-xl border border-border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">
            Adicionar aos contatos
          </h3>
          <button onClick={onClose} className="rounded p-1 hover:bg-muted">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Nome *
            </label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="Nome do contato"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Telefone
            </label>
            <input
              type="text"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Referência / Empresa
            </label>
            <input
              type="text"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="Ex: Empresa X, Cliente VIP..."
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Observações
            </label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="Anotações adicionais"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-3 w-3 animate-spin" />}
              Salvar contato
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
