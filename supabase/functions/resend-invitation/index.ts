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
    const { data: { user: requester } } = await userClient.auth.getUser();
    if (!requester) throw new Error("Session utilisateur introuvable.");

    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: requesterProfile, error: requesterError } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", requester.id)
      .single();

    if (requesterError || requesterProfile?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Accès réservé aux administrateurs." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const userId = String(body.user_id || "").trim();
    if (!userId) throw new Error("Utilisateur manquant.");

    const { data: target, error: targetError } = await adminClient.auth.admin.getUserById(userId);
    if (targetError) throw targetError;
    if (!target?.user?.email) throw new Error("Adresse e-mail introuvable.");

    if (target.user.email_confirmed_at) {
      throw new Error("Ce compte a déjà été activé. Il n’y a plus d’invitation à renvoyer.");
    }

    const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(target.user.email, {
      redirectTo: "https://aloismonier38-art.github.io/application/",
    });
    if (inviteError) throw inviteError;

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error?.message || "Impossible de renvoyer l’invitation." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
