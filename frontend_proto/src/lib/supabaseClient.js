/**
 * supabaseClient.js
 * ──────────────────
 * Singleton Supabase JS client for the frontend.
 * Used by AuthContext for auth operations and api.js for session tokens.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env'
  );
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default supabase;
