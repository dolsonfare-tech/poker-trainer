// Supabase client — the ONLY file that creates one.
// When env vars are absent (local dev without keys, jest), `supabase` is null
// and the app runs in localStorage-only mode — same behavior as before Phase 2.
import { createClient } from '@supabase/supabase-js';

const url = process.env.REACT_APP_SUPABASE_URL;
const key = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const supabase = url && key ? createClient(url, key) : null;
export const hasSupabase = supabase !== null;
