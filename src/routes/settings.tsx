import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Shield,
  X,
  Loader2,
  RefreshCw,
  UserCheck,
  UserX,
  Users as UsersIcon,
  ShieldCheck,
  Phone,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { createUser, deleteUser, updateUserAccess } from "@/lib/admin.functions";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
  head: () => ({
    meta: [
      { title: "Configurações — NexaBoot" },
      { name: "description", content: "Painel administrativo" },
    ],
  }),
});

interface RoleRow {
  id: string;
  nome: string;
  descricao: string | null;
  is_admin: boolean;
  is_system: boolean;
  pode_ver_dashboard: boolean;
  pode_ver_contatos: boolean;
  pode_gerenciar_contatos: boolean;
  pode_ver_automacoes: boolean;
  pode_gerenciar_automacoes: boolean;
  pode_enviar_mensagens: boolean;
  pode_gerenciar_numeros: boolean;
  pode_gerenciar_usuarios: boolean;
  pode_gerenciar_integracoes: boolean;
}

interface UserRow {
  id: string;
  user_id: string;
  nome: string;
  email: string;
  status: "ativo" | "inativo";
  role_id: string;
  role_nome: string;
  numberIds: string[];
}

interface NumberRow {
  id: string;
  nome: string;
  phone_number: string | null;
  instance_name: string;
}

const PERMISSIONS: { key: keyof RoleRow; label: string }[] = [
  { key: "pode_ver_dashboard", label: "Ver Dashboard" },
  { key: "pode_ver_contatos", label: "Ver Contatos" },
  { key: "pode_gerenciar_contatos", label: "Gerenciar Contatos" },
  { key: "pode_enviar_mensagens", label: "Enviar Mensagens" },
  { key: "pode_ver_automacoes", label: "Ver Automações" },
  { key: "pode_gerenciar_automacoes", label: "Gerenciar Automações" },
  { key: "pode_gerenciar_numeros", label: "Gerenciar Números" },
  { key: "pode_gerenciar_usuarios", label: "Gerenciar Usuários" },
  { key: "pode_gerenciar_integracoes", label: "Gerenciar Integrações" },
];

function SettingsPage() {
  const [tab, setTab] = useState<"users" | "roles">("users");

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Painel Administrativo</h1>
        <p className="text-sm text-muted-foreground">Gerencie usuários, perfis e permissões</p>
      </div>

      <div className="mb-4 flex gap-1 border-b border-border">
        <button
          onClick={() => setTab("users")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            tab === "users"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <UsersIcon className="h-4 w-4" />
          Usuários
        </button>
        <button
          onClick={() => setTab("roles")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            tab === "roles"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
          Perfis
        </button>
      </div>

      {tab === "users" ? <UsersTab /> : <RolesTab />}
    </div>
  );
}

// ────────────────────────────────────────────────────────
// USERS TAB
// ────────────────────────────────────────────────────────
function UsersTab() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [numbers, setNumbers] = useState<NumberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserRow | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [profilesRes, userRolesRes, rolesRes, numbersRes, bindingsRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: true }),
      supabase.from("user_roles").select("*"),
      supabase.from("roles").select("*").order("nome"),
      supabase.from("whatsapp_numbers").select("id,nome,phone_number,instance_name").order("nome"),
      supabase.from("user_whatsapp_numbers").select("user_id,whatsapp_number_id"),
    ]);

    if (profilesRes.error) {
      toast.error(profilesRes.error.message);
      setLoading(false);
      return;
    }

    const rolesById = new Map((rolesRes.data ?? []).map((r) => [r.id, r]));
    const userRoleMap = new Map(
      (userRolesRes.data ?? []).map((ur) => [ur.user_id, ur.role_id])
    );
    const bindingMap = new Map<string, string[]>();
    for (const b of bindingsRes.data ?? []) {
      const arr = bindingMap.get(b.user_id) ?? [];
      arr.push(b.whatsapp_number_id);
      bindingMap.set(b.user_id, arr);
    }

    setUsers(
      (profilesRes.data ?? []).map((p) => {
        const roleId = userRoleMap.get(p.user_id) ?? "";
        const r = rolesById.get(roleId);
        return {
          id: p.id,
          user_id: p.user_id,
          nome: p.nome,
          email: p.email,
          status: p.status as "ativo" | "inativo",
          role_id: roleId,
          role_nome: r?.nome ?? "—",
          numberIds: bindingMap.get(p.user_id) ?? [],
        };
      })
    );
    setRoles((rolesRes.data ?? []) as RoleRow[]);
    setNumbers((numbersRes.data ?? []) as NumberRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleDelete = async () => {
    if (!deletingUser) return;
    setActionLoading(true);
    const result = await deleteUser({ data: { userId: deletingUser.user_id } });
    setActionLoading(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`Usuário "${deletingUser.nome}" excluído`);
      setDeletingUser(null);
      fetchAll();
    }
  };

  const handleToggleStatus = async (u: UserRow) => {
    const newStatus = u.status === "ativo" ? "inativo" : "ativo";
    const { error } = await supabase
      .from("profiles")
      .update({ status: newStatus })
      .eq("user_id", u.user_id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`${u.nome} agora está ${newStatus}`);
      fetchAll();
    }
  };

  return (
    <div>
      <div className="mb-4 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" />
          Novo Usuário
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">Nenhum usuário encontrado</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Usuário</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">Perfil</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">Números</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isSelf = u.user_id === currentUser?.id;
                  return (
                    <tr key={u.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                            {u.nome.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                          </div>
                          <span className="font-medium text-foreground">{u.nome}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary border border-primary/20 px-2.5 py-0.5 text-xs font-medium">
                          <Shield className="h-3 w-3" />
                          {u.role_nome}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground border border-border px-2.5 py-0.5 text-xs font-medium">
                          <Phone className="h-3 w-3" />
                          {u.numberIds.length}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => !isSelf && handleToggleStatus(u)}
                          disabled={isSelf}
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                            u.status === "ativo"
                              ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                              : "bg-destructive/10 text-destructive border border-destructive/20"
                          } ${isSelf ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:opacity-80"}`}
                        >
                          {u.status === "ativo" ? <UserCheck className="h-3 w-3" /> : <UserX className="h-3 w-3" />}
                          {u.status === "ativo" ? "Ativo" : "Inativo"}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setEditingUser(u)}
                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                            title="Editar"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          {!isSelf && (
                            <button
                              onClick={() => setDeletingUser(u)}
                              className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                              title="Excluir"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateUserModal
          roles={roles}
          numbers={numbers}
          onClose={() => setShowCreate(false)}
          onCreated={fetchAll}
        />
      )}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          roles={roles}
          numbers={numbers}
          onClose={() => setEditingUser(null)}
          onUpdated={fetchAll}
        />
      )}
      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDeletingUser(null)}>
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-foreground">Excluir usuário</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Tem certeza que deseja excluir <strong className="text-foreground">{deletingUser.nome}</strong>? Esta ação é irreversível.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeletingUser(null)}>Cancelar</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={actionLoading}>
                {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Excluir
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CreateUserModal({
  roles,
  numbers,
  onClose,
  onCreated,
}: {
  roles: RoleRow[];
  numbers: NumberRow[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState(roles.find((r) => !r.is_admin)?.id ?? roles[0]?.id ?? "");
  const [numberIds, setNumberIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const selectedRole = roles.find((r) => r.id === roleId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !email.trim() || !password.trim() || !roleId) {
      toast.error("Preencha todos os campos");
      return;
    }
    setLoading(true);
    const result = await createUser({
      data: {
        email,
        password,
        nome,
        roleId,
        whatsappNumberIds: selectedRole?.is_admin ? [] : numberIds,
      },
    });
    setLoading(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Usuário criado com sucesso!");
      onCreated();
      onClose();
    }
  };

  const toggleNumber = (id: string) => {
    setNumberIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Novo Usuário</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" required />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" required />
          </div>
          <div className="space-y-2">
            <Label>Senha</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" required minLength={6} />
          </div>
          <div className="space-y-2">
            <Label>Perfil</Label>
            <select
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              required
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome}
                </option>
              ))}
            </select>
          </div>
          {!selectedRole?.is_admin && numbers.length > 0 && (
            <div className="space-y-2">
              <Label>Números vinculados</Label>
              <div className="max-h-40 overflow-y-auto rounded-lg border border-border p-2 space-y-1">
                {numbers.map((n) => (
                  <label key={n.id} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted cursor-pointer">
                    <Checkbox checked={numberIds.includes(n.id)} onCheckedChange={() => toggleNumber(n.id)} />
                    <span className="text-sm">{n.nome}</span>
                    <span className="text-xs text-muted-foreground">{n.phone_number || n.instance_name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Criar Usuário
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditUserModal({
  user,
  roles,
  numbers,
  onClose,
  onUpdated,
}: {
  user: UserRow;
  roles: RoleRow[];
  numbers: NumberRow[];
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [nome, setNome] = useState(user.nome);
  const [email, setEmail] = useState(user.email);
  const [roleId, setRoleId] = useState(user.role_id);
  const [numberIds, setNumberIds] = useState<string[]>(user.numberIds);
  const [loading, setLoading] = useState(false);

  const selectedRole = roles.find((r) => r.id === roleId);

  const toggleNumber = (id: string) => {
    setNumberIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error: profErr } = await supabase
      .from("profiles")
      .update({ nome, email })
      .eq("user_id", user.user_id);

    if (profErr) {
      toast.error(profErr.message);
      setLoading(false);
      return;
    }

    const result = await updateUserAccess({
      data: {
        userId: user.user_id,
        roleId,
        whatsappNumberIds: selectedRole?.is_admin ? [] : numberIds,
      },
    });

    setLoading(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Usuário atualizado!");
      onUpdated();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Editar Usuário</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Perfil</Label>
            <select
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome}
                </option>
              ))}
            </select>
          </div>
          {!selectedRole?.is_admin && (
            <div className="space-y-2">
              <Label>Números vinculados</Label>
              {numbers.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum número cadastrado</p>
              ) : (
                <div className="max-h-40 overflow-y-auto rounded-lg border border-border p-2 space-y-1">
                  {numbers.map((n) => (
                    <label key={n.id} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted cursor-pointer">
                      <Checkbox checked={numberIds.includes(n.id)} onCheckedChange={() => toggleNumber(n.id)} />
                      <span className="text-sm">{n.nome}</span>
                      <span className="text-xs text-muted-foreground">{n.phone_number || n.instance_name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────
// ROLES TAB
// ────────────────────────────────────────────────────────
function RolesTab() {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<RoleRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<RoleRow | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("roles").select("*").order("nome");
    if (error) toast.error(error.message);
    else setRoles((data ?? []) as RoleRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const handleDelete = async () => {
    if (!deleting) return;
    setActionLoading(true);
    const { error } = await supabase.from("roles").delete().eq("id", deleting.id);
    setActionLoading(false);
    if (error) toast.error(error.message);
    else {
      toast.success(`Perfil "${deleting.nome}" excluído`);
      setDeleting(null);
      fetchRoles();
    }
  };

  return (
    <div>
      <div className="mb-4 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={fetchRoles} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          Novo Perfil
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          roles.map((r) => {
            const grantedCount = PERMISSIONS.filter((p) => r[p.key]).length;
            return (
              <div key={r.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${r.is_admin ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                      <Shield className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{r.nome}</h3>
                      <p className="text-xs text-muted-foreground">{r.descricao || "—"}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setEditing(r)}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {!r.is_system && (
                      <button
                        onClick={() => setDeleting(r)}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        title="Excluir"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {r.is_admin ? (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                      Acesso total
                    </span>
                  ) : (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {grantedCount} permissão(ões)
                    </span>
                  )}
                  {r.is_system && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      Sistema
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {(editing || creating) && (
        <RoleModal
          role={editing}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSaved={fetchRoles}
        />
      )}
      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDeleting(null)}>
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-foreground">Excluir perfil</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Excluir <strong className="text-foreground">{deleting.nome}</strong>? Usuários atribuídos a ele perderão acesso.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleting(null)}>Cancelar</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={actionLoading}>
                {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Excluir
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RoleModal({
  role,
  onClose,
  onSaved,
}: {
  role: RoleRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!role;
  const [nome, setNome] = useState(role?.nome ?? "");
  const [descricao, setDescricao] = useState(role?.descricao ?? "");
  const [perms, setPerms] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const p of PERMISSIONS) {
      init[p.key] = role ? Boolean(role[p.key]) : false;
    }
    return init;
  });
  const [loading, setLoading] = useState(false);

  const isSystem = role?.is_system ?? false;
  const isAdmin = role?.is_admin ?? false;

  const togglePerm = (key: string) => {
    setPerms((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      toast.error("Informe o nome do perfil");
      return;
    }
    setLoading(true);

    const payload = {
      nome: nome.trim(),
      descricao: descricao.trim() || null,
      ...perms,
    };

    if (isEdit && role) {
      const { error } = await supabase.from("roles").update(payload).eq("id", role.id);
      setLoading(false);
      if (error) toast.error(error.message);
      else {
        toast.success("Perfil atualizado!");
        onSaved();
        onClose();
      }
    } else {
      const { error } = await supabase.from("roles").insert(payload);
      setLoading(false);
      if (error) toast.error(error.message);
      else {
        toast.success("Perfil criado!");
        onSaved();
        onClose();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">{isEdit ? "Editar Perfil" : "Novo Perfil"}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome do perfil</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Financeiro, Supervisor, Vendas"
              required
              disabled={isSystem}
            />
            {isSystem && <p className="text-[10px] text-muted-foreground">Perfis do sistema não podem ter o nome alterado</p>}
          </div>
          <div className="space-y-2">
            <Label>Descrição (opcional)</Label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva o que esse perfil faz"
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label>Permissões</Label>
            {isAdmin ? (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-primary">
                Administrador tem acesso total automaticamente
              </div>
            ) : (
              <div className="rounded-lg border border-border p-3 space-y-1.5">
                {PERMISSIONS.map((p) => (
                  <label key={p.key} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted cursor-pointer">
                    <Checkbox checked={perms[p.key] ?? false} onCheckedChange={() => togglePerm(p.key)} />
                    <span className="text-sm">{p.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Salvar" : "Criar"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
