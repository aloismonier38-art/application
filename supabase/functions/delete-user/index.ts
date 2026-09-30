import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

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

    const { data: adminProfile, error: profileError } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", requester.id)
      .single();

    if (profileError || adminProfile?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Accès réservé aux administrateurs." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const userId = String(body.user_id || "").trim();

    if (!userId) throw new Error("Utilisateur à supprimer non renseigné.");
    if (userId === requester.id) {
      throw new Error("Vous ne pouvez pas supprimer votre propre compte administrateur.");
    }

    const { data: target, error: targetError } = await adminClient
      .from("profiles")
      .select("id,full_name,role")
      .eq("id", userId)
      .single();

    if (targetError || !target) throw new Error("Utilisateur introuvable.");

    if (target.role === "admin") {
      const { count, error: countError } = await adminClient
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin");

      if (countError) throw countError;
      if ((count || 0) <= 1) {
        throw new Error("Impossible de supprimer le dernier administrateur.");
      }
    }

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) throw deleteError;

    return new Response(JSON.stringify({ ok: true, user_id: userId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error?.message || "Suppression impossible." }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
