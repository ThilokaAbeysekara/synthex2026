import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { createSubmissionHandler } from "./handler.mjs";

const url = Deno.env.get("SUPABASE_URL");
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const origins = (Deno.env.get("ALLOWED_ORIGINS") || "").split(",").map(s => s.trim()).filter(Boolean);
const client = url && key ? createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false }
}) : null;
Deno.serve(createSubmissionHandler({ client, origins, rateSalt: Deno.env.get("RATE_LIMIT_SALT") || key }));
