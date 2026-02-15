import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const email = "admin@airs.test";
  const password = "Admin@123456";

  // Create user
  const { data: userData, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "System Admin" },
  });

  if (createError && !createError.message.includes("already been registered")) {
    return new Response(JSON.stringify({ error: createError.message }), { status: 400 });
  }

  // Get user id
  let userId = userData?.user?.id;
  if (!userId) {
    const { data: { users } } = await supabase.auth.admin.listUsers();
    const existing = users?.find((u) => u.email === email);
    userId = existing?.id;
  }

  if (!userId) {
    return new Response(JSON.stringify({ error: "Could not find user" }), { status: 400 });
  }

  // Assign admin role
  const { error: roleError } = await supabase
    .from("user_roles")
    .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });

  if (roleError) {
    return new Response(JSON.stringify({ error: roleError.message }), { status: 400 });
  }

  return new Response(
    JSON.stringify({ success: true, email, password, message: "Admin account created!" }),
    { headers: { "Content-Type": "application/json" } }
  );
});
