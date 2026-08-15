import { createClient } from "@supabase/supabase-js";

// The project URL is public by design; only the publishable key is environment-driven.
const supabaseUrl = "https://sjstuvixonakpjezkmpk.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(supabaseUrl && supabaseKey);

export const supabase = supabaseConfigured
  ? createClient(supabaseUrl!, supabaseKey!, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;
