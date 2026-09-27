import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Non authentifié.");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error("Session utilisateur introuvable.");

    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: adminProfile, error: profileError } = await adminClient
      .from("profiles").select("role").eq("id", user.id).single();

    if (profileError || adminProfile?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Accès réservé aux administrateurs." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const full_name = String(body.full_name || "").trim();
    const phone = String(body.phone || "").trim();
    const login_email = String(body.login_email || "").trim().toLowerCase();
    const role = String(body.role || "employee");

    if (!full_name || !login_email) throw new Error("Nom et e-mail obligatoires.");
    if (!["employee", "manager", "admin"].includes(role)) throw new Error("Profil d’accès invalide.");

    const { data: invitation, error: inviteError } =
      await adminClient.auth.admin.inviteUserByEmail(login_email, {
        redirectTo: "https://aloismonier38-art.github.io/application/",
      });
    if (inviteError) throw inviteError;

    const { error: updateError } = await adminClient.from("profiles").update({
      full_name, phone, login_email, role, is_active: true, must_set_password: true,
    }).eq("id", invitation.user.id);
    if (updateError) throw updateError;

    return new Response(JSON.stringify({ ok: true, user_id: invitation.user.id }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error?.message || "Invitation impossible." }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
