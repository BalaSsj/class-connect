import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Verify caller is admin
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const token = authHeader.replace("Bearer ", "");
  const { data: { user: caller } } = await supabase.auth.getUser(token);
  if (!caller) {
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Check admin role
  const { data: isAdmin } = await supabase.rpc("has_role", {
    _user_id: caller.id,
    _role: "admin",
  });

  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Admin access required" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { email, password, full_name, role, faculty_id } = await req.json();

  if (!email || !password || !full_name || !role) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Create auth user or find existing
  let userId: string;
  const { data: userData, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });

  if (createError) {
    if (createError.message.includes("already been registered")) {
      // Find existing user
      const { data: { users } } = await supabase.auth.admin.listUsers();
      const existing = users?.find((u) => u.email === email);
      if (!existing) {
        return new Response(JSON.stringify({ error: "User exists but could not be found" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = existing.id;
      // Update password for existing user
      await supabase.auth.admin.updateUserById(userId, { password });
    } else {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } else {
    userId = userData.user.id;
  }

  // Assign role
  const { error: roleError } = await supabase
    .from("user_roles")
    .insert({ user_id: userId, role });

  if (roleError) {
    return new Response(JSON.stringify({ error: roleError.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Link to faculty record if provided
  if (faculty_id) {
    await supabase
      .from("faculty")
      .update({ user_id: userId })
      .eq("id", faculty_id);
  }

  return new Response(
    JSON.stringify({
      success: true,
      user_id: userId,
      message: `User ${email} created with role ${role}`,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
