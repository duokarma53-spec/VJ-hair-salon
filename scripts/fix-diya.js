import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkProducts() {
  const { data: products, error } = await supabase.from('products').select('*');
  console.log("Products:");
  console.log(JSON.stringify(products, null, 2));
}

checkProducts();
