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
      console.error("[create-user] Missing Authorization header");
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !caller) {
      console.error("[create-user] Failed to verify caller:", userError?.message || "User data is null");
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`[create-user] Caller verified: ${caller.id}`);

    const { data: callerRole, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .maybeSingle();

    if (roleError) {
      console.error(`[create-user] Failed to fetch caller role: ${roleError.message}`);
    }

    console.log(`[create-user] Caller role: ${callerRole?.role || "not found"}`);

    // Allow super_admin and owner to create users
    if (callerRole?.role !== "super_admin" && callerRole?.role !== "owner") {
      console.warn(`[create-user] Forbidden: caller ${caller.id} with role ${callerRole?.role} tried to create user`);
      return new Response(JSON.stringify({ error: "Forbidden: insufficient permissions" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let body;
    try {
      body = await req.json();
    } catch (e) {
      console.error(`[create-user] Invalid JSON body: ${(e as Error).message}`);
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Support both full_name and fullName for backwards compatibility
    const email = body.email;
    const password = body.password;
    const full_name = body.full_name || body.fullName;
    const role = body.role;

    console.log(`[create-user] Request: email=${email}, role=${role}, full_name=${full_name}`);

    if (!email || !password || !role) {
      console.warn(`[create-user] Missing required fields: email=${!!email}, password=${!!password}, role=${!!role}`);
      return new Response(JSON.stringify({ error: "Email, password, and role are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Owner can only create team roles, not super_admin or owner
    if (callerRole?.role === "owner") {
      const allowedRoles = ["admin", "admin_input", "lapangan", "nib"];
      if (!allowedRoles.includes(role)) {
        console.warn(`[create-user] Owner ${caller.id} tried to create role ${role} which is not allowed`);
        return new Response(JSON.stringify({ error: "Owner hanya bisa membuat role: admin, admin_input, lapangan, nib" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Create user via admin API
    console.log(`[create-user] Creating auth user with email: ${email}`);
    const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (createError || !createData?.user) {
      const errorMsg = createError?.message || "User data is null";
      console.error(`[create-user] Error creating auth user: ${errorMsg}`);
      
      // Provide more specific error messages
      let userFriendlyError = errorMsg;
      if (errorMsg.toLowerCase().includes("already exists")) {
        userFriendlyError = "Email sudah terdaftar di sistem";
      } else if (errorMsg.toLowerCase().includes("invalid email")) {
        userFriendlyError = "Format email tidak valid";
      }
      
      return new Response(JSON.stringify({ error: userFriendlyError }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const newUser = createData.user;
    console.log(`[create-user] Auth user created successfully: ${newUser.id}`);

    // Create profile explicitly
    console.log(`[create-user] Creating profile for user: ${newUser.id}`);
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({ id: newUser.id, email, full_name, updated_at: new Date().toISOString() });

    if (profileError) {
      console.error(`[create-user] Error creating profile: ${profileError.message}`);
      // We might want to delete the auth user if profile creation fails, 
      // but for now let's just return the error
      return new Response(JSON.stringify({ error: "Gagal membuat profil user: " + profileError.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`[create-user] Profile created successfully`);

    // Assign role
    console.log(`[create-user] Assigning role ${role} to user: ${newUser.id}`);
    const { error: roleAssignError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newUser.id, role });

    if (roleAssignError) {
      console.error(`[create-user] Error assigning role: ${roleAssignError.message}`);
      return new Response(JSON.stringify({ error: "Gagal memberikan role: " + roleAssignError.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`[create-user] User created successfully: ${newUser.id} with role ${role}`);

    return new Response(JSON.stringify({ user: { id: newUser.id, email } }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const errorMsg = (err as Error).message;
    console.error(`[create-user] Unexpected error: ${errorMsg}`);
    return new Response(JSON.stringify({ error: errorMsg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
