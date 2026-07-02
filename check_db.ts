import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env: Record<string, string> = {};
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    env[key.trim()] = value.trim();
  }
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseAnonKey = env['VITE_SUPABASE_ANON_KEY'];

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkTables() {
  const { data: invoices, error: err1 } = await supabase.from('invoices').select('*').limit(1);
  console.log('Invoices:', invoices, err1?.message);

  const { data: expenses, error: err2 } = await supabase.from('expenses').select('*').limit(1);
  console.log('Expenses:', expenses, err2?.message);

  const { data: products, error: err3 } = await supabase.from('products').select('*').limit(1);
  console.log('Products:', products, err3?.message);
}

checkTables();
