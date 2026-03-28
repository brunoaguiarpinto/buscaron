import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Configure SUPABASE_URL e SUPABASE_ANON_KEY no arquivo .env');
  process.exit(1);
}

export const supabase = createClient(supabaseUrl, supabaseKey);
