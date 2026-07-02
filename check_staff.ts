import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env: Record<string, string> = {};

envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    env[key.trim()] = valueParts.join('=').trim();
  }
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseAnonKey = env['VITE_SUPABASE_ANON_KEY'];

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const { error: e1 } = await supabase.from('customers').insert([{ name: 'Test' }]);
  console.log('Insert Customer Error:', e1);
  
  const { error: e2 } = await supabase.from('bills').insert([{ grand_total: 100 }]);
  console.log('Insert Bill Error:', e2);
}

check();
