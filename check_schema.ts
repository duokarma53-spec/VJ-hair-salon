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

const supabase = createClient(env['VITE_SUPABASE_URL'], env['VITE_SUPABASE_ANON_KEY']);

async function checkSchema() {
  const { data: bills } = await supabase.from('bills').select('*').limit(1);
  console.log('Bills schema:', bills && bills.length > 0 ? Object.keys(bills[0]) : 'Empty table');
  
  const { data: expenses } = await supabase.from('expenses').select('*').limit(1);
  console.log('Expenses schema:', expenses && expenses.length > 0 ? Object.keys(expenses[0]) : 'Empty table');
}

checkSchema();
