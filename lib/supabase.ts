import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types for DB tables
export interface DBBracket {
  id: string;
  user_id: string | null;
  name: string;
  bracket_data: string; // JSON stringified Bracket
  created_at: string;
  updated_at: string;
  completed: boolean;
  mode: string;
  size: number;
}
