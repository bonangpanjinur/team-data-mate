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
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: callerRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .single();

    // Allow super_admin and owner to create users
    if (callerRole?.role !== "super_admin" && callerRole?.role !== "owner") {
      return new Response(JSON.stringify({ error: "Forbidden: insufficient permissions" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let body;
    try {
      body = await req.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Support both full_name and fullName for backwards compatibility
    const email = body.email;
    const password = body.password;
    const full_name = body.full_name || body.fullName;
    const role = body.role;

    if (!email || !password || !role) {
      return new Response(JSON.stringify({ error: "Email, password, and role are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Owner can only create team roles, not super_admin or owner
    if (callerRole?.role === "owner") {
      const allowedRoles = ["admin", "admin_input", "lapangan", "nib"];
      if (!allowedRoles.includes(role)) {
        return new Response(JSON.stringify({ error: "Owner hanya bisa membuat role: admin, admin_input, lapangan, nib" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Create user via admin API
    const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (createError || !createData?.user) {
      console.error("Error creating user:", createError?.message || "User data is null");
      return new Response(JSON.stringify({ error: createError?.message || "Gagal membuat user di sistem autentikasi" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const newUser = createData.user;

    // Create profile explicitly
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({ id: newUser.id, email, full_name, updated_at: new Date().toISOString() });

    if (profileError) {
      console.error("Error creating profile:", profileError.message);
      // We might want to delete the auth user if profile creation fails, 
      // but for now let's just return the error
      return new Response(JSON.stringify({ error: "Gagal membuat profil user: " + profileError.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Assign role
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newUser.id, role });

    if (roleError) {
      console.error("Error assigning role:", roleError.message);
      return new Response(JSON.stringify({ error: "Gagal memberikan role: " + roleError.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ user: { id: newUser.id, email } }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
