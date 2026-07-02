import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envText = fs.readFileSync('.env', 'utf8');
const env = envText.split('\n').reduce((acc, line) => { 
  const parts = line.split('='); 
  if(parts[0]) acc[parts[0].trim()] = parts.slice(1).join('=').trim(); 
  return acc; 
}, {});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function checkDb() {
  const tables = [
    'customers',
    'staff',
    'services',
    'products',
    'customer_visits',
    'visit_services',
    'visit_products',
    'staff_commissions',
    'expenses'
  ];

  console.log("Checking row counts for schemas...");
  for (const table of tables) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`${table}: ERROR - ${error.message}`);
    } else {
      console.log(`${table}: ${count} rows`);
    }
  }
}

checkDb();
