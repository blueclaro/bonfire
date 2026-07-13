import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("A variável NEXT_PUBLIC_SUPABASE_URL não foi encontrada.");
}

if (!supabaseAnonKey) {
  throw new Error("A variável NEXT_PUBLIC_SUPABASE_ANON_KEY não foi encontrada.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);