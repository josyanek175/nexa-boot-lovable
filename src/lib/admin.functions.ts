import { createServerFn } from "@tanstack/react-start";

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
