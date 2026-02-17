import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
      if (createError.message.includes("already been registered") || createError.message.includes("already exists")) {
        // Find existing user by email using paginated search
        let existing = null;
        let page = 1;
        const perPage = 50;
        while (!existing) {
          const { data: { users } } = await supabase.auth.admin.listUsers({ page, perPage });
          if (!users || users.length === 0) break;
          existing = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
          if (users.length < perPage) break;
          page++;
        }
        if (!existing) {
          return new Response(JSON.stringify({ error: "User already registered but could not be located. Please contact support." }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        userId = existing.id;
        // Update password for existing user
        await supabase.auth.admin.updateUserById(userId, { password, user_metadata: { full_name } });
      } else {
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      userId = userData.user.id;
    }

    // Assign role using upsert to avoid duplicate key errors
    const { error: roleError } = await supabase
      .from("user_roles")
      .upsert(
        { user_id: userId, role },
        { onConflict: "user_id,role" }
      );

    if (roleError) {
      // If upsert fails due to no unique constraint, try delete + insert
      console.log("Upsert failed, trying delete+insert:", roleError.message);
      await supabase.from("user_roles").delete().eq("user_id", userId);
      const { error: insertError } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role });
      if (insertError) {
        return new Response(JSON.stringify({ error: "Role assignment failed: " + insertError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
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
  } catch (err) {
    console.error("Register user error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
