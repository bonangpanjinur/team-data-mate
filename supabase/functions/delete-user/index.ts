import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("[delete-user] Missing Authorization header");
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: caller }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !caller) {
      console.error(`[delete-user] Failed to verify caller: ${userError?.message || "User data is null"}`);
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    console.log(`[delete-user] Caller verified: ${caller.id}`);

    const callerId = caller.id;
    const { data: callerRole, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .maybeSingle();

    if (roleError) {
      console.error(`[delete-user] Failed to fetch caller role: ${roleError.message}`);
    }

    console.log(`[delete-user] Caller role: ${callerRole?.role || "not found"}`);

    if (callerRole?.role !== "super_admin") {
      console.warn(`[delete-user] Forbidden: caller ${callerId} with role ${callerRole?.role} tried to delete user`);
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    let body;
    try {
      body = await req.json();
    } catch (e) {
      console.error(`[delete-user] Invalid JSON body: ${(e as Error).message}`);
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { user_id } = body;

    if (!user_id) {
      console.warn(`[delete-user] Missing user_id in request body`);
      return new Response(JSON.stringify({ error: "Missing user_id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`[delete-user] Starting deletion process for user: ${user_id}`);

    // Nullify references in data_entries to avoid FK constraint errors
    console.log(`[delete-user] Nullifying data_entries references for user: ${user_id}`);
    const { error: dataEntriesError1 } = await supabaseAdmin.from("data_entries").update({ created_by: null }).eq("created_by", user_id);
    if (dataEntriesError1) {
      console.warn(`[delete-user] Warning while nullifying created_by: ${dataEntriesError1.message}`);
    }

    const { error: dataEntriesError2 } = await supabaseAdmin.from("data_entries").update({ pic_user_id: null }).eq("pic_user_id", user_id);
    if (dataEntriesError2) {
      console.warn(`[delete-user] Warning while nullifying pic_user_id: ${dataEntriesError2.message}`);
    }

    const { error: dataEntriesError3 } = await supabaseAdmin.from("data_entries").update({ umkm_user_id: null }).eq("umkm_user_id", user_id);
    if (dataEntriesError3) {
      console.warn(`[delete-user] Warning while nullifying umkm_user_id: ${dataEntriesError3.message}`);
    }

    // Nullify references in audit_logs
    console.log(`[delete-user] Nullifying audit_logs references for user: ${user_id}`);
    const { error: auditLogsError } = await supabaseAdmin.from("audit_logs").update({ changed_by: null }).eq("changed_by", user_id);
    if (auditLogsError) {
      console.warn(`[delete-user] Warning while nullifying audit_logs: ${auditLogsError.message}`);
    }

    // Delete related records
    console.log(`[delete-user] Deleting related records for user: ${user_id}`);
    
    const { error: commissionsError } = await supabaseAdmin.from("commissions").delete().eq("user_id", user_id);
    if (commissionsError) {
      console.warn(`[delete-user] Warning while deleting commissions: ${commissionsError.message}`);
    }

    const { error: disbursementsError } = await supabaseAdmin.from("disbursements").delete().eq("user_id", user_id);
    if (disbursementsError) {
      console.warn(`[delete-user] Warning while deleting disbursements: ${disbursementsError.message}`);
    }

    const { error: notificationsError } = await supabaseAdmin.from("notifications").delete().eq("user_id", user_id);
    if (notificationsError) {
      console.warn(`[delete-user] Warning while deleting notifications: ${notificationsError.message}`);
    }

    const { error: groupMembersError } = await supabaseAdmin.from("group_members").delete().eq("user_id", user_id);
    if (groupMembersError) {
      console.warn(`[delete-user] Warning while deleting group_members: ${groupMembersError.message}`);
    }

    const { error: sharedLinksError } = await supabaseAdmin.from("shared_links").delete().eq("user_id", user_id);
    if (sharedLinksError) {
      console.warn(`[delete-user] Warning while deleting shared_links: ${sharedLinksError.message}`);
    }

    const { error: userRolesError } = await supabaseAdmin.from("user_roles").delete().eq("user_id", user_id);
    if (userRolesError) {
      console.warn(`[delete-user] Warning while deleting user_roles: ${userRolesError.message}`);
    }

    const { error: ownerTeamsError } = await supabaseAdmin.from("owner_teams").delete().eq("user_id", user_id);
    if (ownerTeamsError) {
      console.warn(`[delete-user] Warning while deleting owner_teams: ${ownerTeamsError.message}`);
    }

    const { error: profilesError } = await supabaseAdmin.from("profiles").delete().eq("id", user_id);
    if (profilesError) {
      console.warn(`[delete-user] Warning while deleting profiles: ${profilesError.message}`);
    }

    console.log(`[delete-user] Deleting auth user: ${user_id}`);
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(user_id);
    if (deleteAuthError) {
      console.error(`[delete-user] Error deleting auth user: ${deleteAuthError.message}`);
      return new Response(JSON.stringify({ error: deleteAuthError.message }), { status: 400, headers: corsHeaders });
    }

    console.log(`[delete-user] User deleted successfully: ${user_id}`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const errorMsg = (err as Error).message;
    console.error(`[delete-user] Unexpected error: ${errorMsg}`);
    return new Response(JSON.stringify({ error: errorMsg }), { status: 500, headers: corsHeaders });
  }
});
