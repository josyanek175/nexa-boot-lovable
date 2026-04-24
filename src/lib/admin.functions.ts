import { createServerFn } from "@tanstack/react-start";

// ── List all users with role and bound numbers (admin only) ──
export const listAgents = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: profiles, error: profErr } = await supabaseAdmin
    .from("profiles")
    .select("user_id, nome, email, status, created_at")
    .order("created_at", { ascending: true });
  if (profErr) return { agents: [], error: profErr.message };

  const userIds = (profiles ?? []).map((p) => p.user_id);
  if (userIds.length === 0) return { agents: [], error: null };

  const [rolesRes, bindingsRes] = await Promise.all([
    supabaseAdmin
      .from("user_roles")
      .select("user_id, role_id, roles(id, nome, is_admin)")
      .in("user_id", userIds),
    supabaseAdmin
      .from("user_whatsapp_numbers")
      .select("user_id, whatsapp_number_id, whatsapp_numbers(id, nome, instance_name)")
      .in("user_id", userIds),
  ]);

  const rolesMap: Record<string, { id: string; nome: string; is_admin: boolean }> = {};
  (rolesRes.data ?? []).forEach((r: any) => {
    if (r.roles) rolesMap[r.user_id] = r.roles;
  });

  const bindingsMap: Record<
    string,
    Array<{ id: string; nome: string; instance_name: string }>
  > = {};
  (bindingsRes.data ?? []).forEach((b: any) => {
    if (!bindingsMap[b.user_id]) bindingsMap[b.user_id] = [];
    if (b.whatsapp_numbers) bindingsMap[b.user_id].push(b.whatsapp_numbers);
  });

  const agents = (profiles ?? []).map((p) => ({
    user_id: p.user_id,
    nome: p.nome,
    email: p.email,
    status: p.status,
    role: rolesMap[p.user_id] ?? null,
    numbers: bindingsMap[p.user_id] ?? [],
  }));

  return { agents, error: null };
});

// ── List available roles ──
export const listRoles = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("roles")
    .select("id, nome, is_admin, descricao")
    .order("nome", { ascending: true });
  if (error) return { roles: [], error: error.message };
  return { roles: data ?? [], error: null };
});

// ── List all whatsapp numbers (admin) ──
export const listAllNumbers = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("whatsapp_numbers")
    .select("id, nome, instance_name, phone_number, status")
    .order("nome", { ascending: true });
  if (error) return { numbers: [], error: error.message };
  return { numbers: data ?? [], error: null };
});

// ── Update profile (nome) ──
export const updateAgentProfile = createServerFn({ method: "POST" })
  .inputValidator((data: { userId: string; nome: string; status?: "ativo" | "inativo" }) => data)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const update: { nome: string; status?: "ativo" | "inativo" } = { nome: data.nome };
    if (data.status) update.status = data.status;
    const { error } = await supabaseAdmin
      .from("profiles")
      .update(update)
      .eq("user_id", data.userId);
    if (error) return { error: error.message };
    return { error: null };
  });

// ── Delete user (requires service role) ──
export const deleteUser = createServerFn({ method: "POST" })
  .inputValidator((data: { userId: string }) => data)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) return { error: error.message };
    return { error: null };
  });

// ── Create user (requires service role) ──
export const createUser = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      email: string;
      password: string;
      nome: string;
      roleId: string;
      whatsappNumberIds?: string[];
    }) => data
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { nome: data.nome },
    });

    if (authError) return { error: authError.message };
    if (!authData.user) return { error: "Falha ao criar usuário" };

    // The handle_new_user trigger auto-creates a user_roles row.
    // Override it with the chosen role.
    await supabaseAdmin
      .from("user_roles")
      .update({ role_id: data.roleId })
      .eq("user_id", authData.user.id);

    // Bind whatsapp numbers
    if (data.whatsappNumberIds && data.whatsappNumberIds.length > 0) {
      await supabaseAdmin
        .from("user_whatsapp_numbers")
        .insert(
          data.whatsappNumberIds.map((nid) => ({
            user_id: authData.user!.id,
            whatsapp_number_id: nid,
          }))
        );
    }

    return { error: null, userId: authData.user.id };
  });

// ── Update user role and number bindings ──
export const updateUserAccess = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { userId: string; roleId: string; whatsappNumberIds: string[] }) => data
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Update role
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .update({ role_id: data.roleId })
      .eq("user_id", data.userId);
    if (roleError) return { error: roleError.message };

    // Replace number bindings
    await supabaseAdmin
      .from("user_whatsapp_numbers")
      .delete()
      .eq("user_id", data.userId);

    if (data.whatsappNumberIds.length > 0) {
      const { error: bindError } = await supabaseAdmin
        .from("user_whatsapp_numbers")
        .insert(
          data.whatsappNumberIds.map((nid) => ({
            user_id: data.userId,
            whatsapp_number_id: nid,
          }))
        );
      if (bindError) return { error: bindError.message };
    }

    return { error: null };
  });
