import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Headphones,
  Plus,
  Pencil,
  Trash2,
  Shield,
  Loader2,
  X,
  Check,
  Mail,
  Smartphone,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  listAgents,
  listRoles,
  listAllNumbers,
  updateUserAccess,
  updateAgentProfile,
  createUser,
  deleteUser,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/agents")({
  component: AgentsPage,
  head: () => ({
    meta: [
      { title: "Atendentes — NexaBoot" },
      { name: "description", content: "Gestão de atendentes e permissões" },
    ],
  }),
});

interface Agent {
  user_id: string;
  nome: string;
  email: string;
  status: "ativo" | "inativo";
  role: { id: string; nome: string; is_admin: boolean } | null;
  numbers: Array<{ id: string; nome: string; instance_name: string }>;
}
interface Role {
  id: string;
  nome: string;
  is_admin: boolean;
  descricao: string | null;
}
interface NumberOpt {
  id: string;
  nome: string;
  instance_name: string;
  phone_number: string | null;
  status: string;
}

function AgentsPage() {
  const { isAdmin, user: currentUser } = useAuth();
  const fetchAgents = useServerFn(listAgents);
  const fetchRoles = useServerFn(listRoles);
  const fetchNumbers = useServerFn(listAllNumbers);
  const updateAccess = useServerFn(updateUserAccess);
  const updateProfile = useServerFn(updateAgentProfile);
  const createUserFn = useServerFn(createUser);
  const deleteUserFn = useServerFn(deleteUser);

  const [agents, setAgents] = useState<Agent[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [numbers, setNumbers] = useState<NumberOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Agent | null>(null);
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [a, r, n] = await Promise.all([fetchAgents(), fetchRoles(), fetchNumbers()]);
    setAgents(a.agents as Agent[]);
    setRoles(r.roles as Role[]);
    setNumbers(n.numbers as NumberOpt[]);
    setLoading(false);
  }, [fetchAgents, fetchRoles, fetchNumbers]);

  useEffect(() => {
    if (isAdmin) refresh();
  }, [isAdmin, refresh]);

  const handleDelete = async (a: Agent) => {
    if (a.user_id === currentUser?.id) {
      toast.error("Você não pode remover sua própria conta.");
      return;
    }
    if (!confirm(`Remover ${a.nome}? Esta ação não pode ser desfeita.`)) return;
    const res = await deleteUserFn({ data: { userId: a.user_id } });
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success("Atendente removido.");
      refresh();
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <Shield className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Acesso restrito</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Apenas administradores podem gerenciar atendentes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Atendentes</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie sua equipe e os números de WhatsApp que cada um pode atender.
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Novo atendente
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : agents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <Headphones className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhum atendente cadastrado.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Atendente</th>
                <th className="px-4 py-3 font-medium">Nível de acesso</th>
                <th className="px-4 py-3 font-medium">Números vinculados</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {agents.map((a) => (
                <tr key={a.user_id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {a.nome.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">{a.nome}</p>
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          {a.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {a.role ? (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                          a.role.is_admin
                            ? "bg-primary/15 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {a.role.is_admin && <Shield className="h-3 w-3" />}
                        {a.role.nome}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {a.role?.is_admin ? (
                      <span className="text-xs italic text-muted-foreground">
                        Todos (admin)
                      </span>
                    ) : a.numbers.length === 0 ? (
                      <span className="text-xs text-muted-foreground">Nenhum</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {a.numbers.map((n) => (
                          <span
                            key={n.id}
                            className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[11px] text-foreground"
                          >
                            <Smartphone className="h-2.5 w-2.5" />
                            {n.nome}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex h-2 w-2 rounded-full ${
                        a.status === "ativo" ? "bg-status-open" : "bg-muted-foreground"
                      }`}
                    />
                    <span className="ml-2 text-xs text-muted-foreground">
                      {a.status === "ativo" ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setEditing(a)}
                      className="mr-1 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(a)}
                      disabled={a.user_id === currentUser?.id}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
                      title="Remover"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <AgentDialog
          mode="edit"
          agent={editing}
          roles={roles}
          numbers={numbers}
          onClose={() => setEditing(null)}
          onSave={async (payload) => {
            const r1 = await updateProfile({
              data: { userId: editing.user_id, nome: payload.nome, status: payload.status },
            });
            if (r1.error) {
              toast.error(r1.error);
              return;
            }
            const r2 = await updateAccess({
              data: {
                userId: editing.user_id,
                roleId: payload.roleId,
                whatsappNumberIds: payload.numberIds,
              },
            });
            if (r2.error) {
              toast.error(r2.error);
              return;
            }
            toast.success("Atendente atualizado.");
            setEditing(null);
            refresh();
          }}
        />
      )}

      {creating && (
        <AgentDialog
          mode="create"
          roles={roles}
          numbers={numbers}
          onClose={() => setCreating(false)}
          onSave={async (payload) => {
            if (!payload.password) {
              toast.error("Senha obrigatória.");
              return;
            }
            const res = await createUserFn({
              data: {
                email: payload.email,
                password: payload.password,
                nome: payload.nome,
                roleId: payload.roleId,
                whatsappNumberIds: payload.numberIds,
              },
            });
            if (res.error) {
              toast.error(res.error);
              return;
            }
            toast.success("Atendente criado.");
            setCreating(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}

interface DialogPayload {
  nome: string;
  email: string;
  password?: string;
  roleId: string;
  numberIds: string[];
  status: "ativo" | "inativo";
}

function AgentDialog({
  mode,
  agent,
  roles,
  numbers,
  onClose,
  onSave,
}: {
  mode: "create" | "edit";
  agent?: Agent;
  roles: Role[];
  numbers: NumberOpt[];
  onClose: () => void;
  onSave: (payload: DialogPayload) => Promise<void>;
}) {
  const [nome, setNome] = useState(agent?.nome ?? "");
  const [email, setEmail] = useState(agent?.email ?? "");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState(agent?.role?.id ?? roles.find((r) => !r.is_admin)?.id ?? "");
  const [status, setStatus] = useState<"ativo" | "inativo">(agent?.status ?? "ativo");
  const [numberIds, setNumberIds] = useState<string[]>(
    agent?.numbers.map((n) => n.id) ?? []
  );
  const [saving, setSaving] = useState(false);

  const selectedRole = roles.find((r) => r.id === roleId);
  const isAdminRole = selectedRole?.is_admin ?? false;

  const toggleNumber = (id: string) => {
    setNumberIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSubmit = async () => {
    if (!nome.trim()) {
      toast.error("Nome obrigatório.");
      return;
    }
    if (mode === "create" && !email.trim()) {
      toast.error("E-mail obrigatório.");
      return;
    }
    if (!roleId) {
      toast.error("Selecione um nível de acesso.");
      return;
    }
    setSaving(true);
    try {
      await onSave({ nome: nome.trim(), email: email.trim(), password, roleId, numberIds, status });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-base font-semibold text-foreground">
            {mode === "create" ? "Novo atendente" : "Editar atendente"}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Nome</label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="Ex: João Silva"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={mode === "edit"}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
              placeholder="atendente@empresa.com"
            />
          </div>

          {mode === "create" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Senha inicial
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Mínimo 6 caracteres"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Nível de acesso
              </label>
              <select
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nome}
                  </option>
                ))}
              </select>
            </div>
            {mode === "edit" && (
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as "ativo" | "inativo")}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>
            )}
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">
                Números de WhatsApp vinculados
              </label>
              {!isAdminRole && numbers.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setNumberIds(
                      numberIds.length === numbers.length ? [] : numbers.map((n) => n.id)
                    )
                  }
                  className="text-[11px] text-primary hover:underline"
                >
                  {numberIds.length === numbers.length ? "Limpar" : "Selecionar todos"}
                </button>
              )}
            </div>
            {isAdminRole ? (
              <p className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-xs italic text-muted-foreground">
                Administradores acessam todos os números automaticamente.
              </p>
            ) : numbers.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Nenhum número cadastrado. Cadastre em "Números".
              </p>
            ) : (
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border p-2 custom-scrollbar">
                {numbers.map((n) => {
                  const checked = numberIds.includes(n.id);
                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => toggleNumber(n.id)}
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                        checked ? "bg-primary/10 text-foreground" : "hover:bg-muted"
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          checked
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border"
                        }`}
                      >
                        {checked && <Check className="h-3 w-3" />}
                      </span>
                      <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="flex-1 truncate">{n.nome}</span>
                      {n.phone_number && (
                        <span className="text-[11px] text-muted-foreground">{n.phone_number}</span>
                      )}
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          n.status === "conectado" ? "bg-status-open" : "bg-muted-foreground"
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {mode === "create" ? "Criar" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
