import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = 'https://fqdrgsbljplhfgjzvaoq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxZHJnc2JsanBsaGZnanp2YW9xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTg4MDQzNiwiZXhwIjoyMDk3NDU2NDM2fQ.QhX0v4Qc7AO2IzNwarBcbW3HjFELrL45ldB2WcFaK_Q';

const supabase = createClient(supabaseUrl, supabaseKey);

function parseDate(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.split('/');
    if (parts.length >= 3) {
        let day = parts[0].padStart(2, '0');
        let month = parts[1].padStart(2, '0');
        let year = parts[2];
        if (year.length === 2) year = `20${year}`;
        return `${year}-${month}-${day}T12:00:00Z`;
    }
    return null;
}

async function migrate() {
    console.log("Starting Migration...");

    // Cache maps
    const customersMap = new Map();
    const staffMap = new Map();
    const servicesMap = new Map();
    const productsMap = new Map();

    // 1. Fetch Existing Data
    const { data: dbCust } = await supabase.from('customers').select('*');
    dbCust?.forEach(c => customersMap.set(c.phone, c.id));

    const { data: dbStaff } = await supabase.from('staff').select('*');
    dbStaff?.forEach(s => staffMap.set(s.name?.toUpperCase() || '', s.id));

    const { data: dbServ } = await supabase.from('services').select('*');
    dbServ?.forEach(s => servicesMap.set(s.name?.toUpperCase() || '', s.id));

    const { data: dbProd } = await supabase.from('products').select('*');
    dbProd?.forEach(p => productsMap.set(p.name?.toUpperCase() || '', p.id));

    // Helper Functions
    async function getOrCreateCustomer(name, phone) {
        let cleanPhone = (phone || '').replace(/\D/g, '');
        if (!cleanPhone || cleanPhone === '-') {
            cleanPhone = '0000000000'; // Generic Walk-in phone
        }
        
        if (customersMap.has(cleanPhone)) {
            return customersMap.get(cleanPhone);
        }
        
        const { data, error } = await supabase.from('customers').insert({
            name: name || 'Retail Walk-in',
            phone: cleanPhone
        }).select().single();
        
        if (data) {
            customersMap.set(cleanPhone, data.id);
            return data.id;
        }
        console.error("Failed to create customer:", error);
        return null;
    }

    async function getOrCreateStaff(rawName) {
        if (!rawName || rawName === '-') return null;
        const name = rawName.split(/[|,&]/)[0].trim().toUpperCase(); // Take first name
        
        if (staffMap.has(name)) return staffMap.get(name);
        
        const { data, error } = await supabase.from('staff').insert({
            name: name,
            status: 'Active',
            commission_rate: 0
        }).select().single();
        
        if (data) {
            staffMap.set(name, data.id);
            return data.id;
        }
        return null;
    }

    async function getOrCreateService(rawName, price) {
        const name = (rawName || 'Historical Service').trim().toUpperCase();
        if (servicesMap.has(name)) return servicesMap.get(name);
        
        const { data, error } = await supabase.from('services').insert({
            name: name,
            category: 'Historical Data',
            price: price || 0,
            duration: 30
        }).select().single();
        
        if (data) {
            servicesMap.set(name, data.id);
            return data.id;
        }
        return null;
    }

    async function getOrCreateProduct(rawName, price) {
        const name = (rawName || 'Historical Product').trim().toUpperCase();
        if (productsMap.has(name)) return productsMap.get(name);
        
        const { data, error } = await supabase.from('products').insert({
            name: name,
            purchase_price: 0,
            selling_price: price || 0,
            purchased_quantity: 0,
            current_stock: 0,
            salon_consumption: 0,
            sold_quantity: 0
        }).select().single();
        
        if (data) {
            productsMap.set(name, data.id);
            return data.id;
        }
        return null;
    }

    // 2. Process Visits
    const visits = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'clean_visits.json'), 'utf8'));
    console.log(`Processing ${visits.length} visits...`);
    
    for (const v of visits) {
        const isoDate = parseDate(v.date);
        if (!isoDate) continue;

        const customerId = await getOrCreateCustomer(v.customer_name, v.customer_phone);
        const staffId = await getOrCreateStaff(v.staff);
        const serviceId = await getOrCreateService(v.services, v.amount);

        // Create customer_visit
        const { data: visitData, error: visitErr } = await supabase.from('customer_visits').insert({
            customer_id: customerId,
            staff_id: staffId,
            grand_total: v.amount,
            visit_date: isoDate
        }).select().single();

        if (visitErr) {
            console.error("Visit Error:", visitErr);
            continue;
        }

        // Create visit_services
        if (serviceId && visitData) {
            await supabase.from('visit_services').insert({
                visit_id: visitData.id,
                service_id: serviceId,
                service_name: v.services,
                price: v.amount
            });
        }
    }

    // 3. Process Products
    const products = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'clean_products.json'), 'utf8'));
    console.log(`Processing ${products.length} product sales...`);

    for (const p of products) {
        const isoDate = parseDate(p.date);
        if (!isoDate) continue;

        const customerId = await getOrCreateCustomer(p.customer_name, p.customer_phone);
        const staffId = await getOrCreateStaff(p.staff);
        const productId = await getOrCreateProduct(p.product, p.amount);

        // Update product sold_quantity
        const { data: existingProd } = await supabase.from('products').select('sold_quantity').eq('id', productId).single();
        const currentSold = existingProd ? existingProd.sold_quantity : 0;
        await supabase.from('products').update({ sold_quantity: currentSold + 1 }).eq('id', productId);

        // Create customer_visit for the sale
        const { data: visitData, error: visitErr } = await supabase.from('customer_visits').insert({
            customer_id: customerId,
            staff_id: staffId,
            grand_total: p.amount,
            visit_date: isoDate
        }).select().single();

        // Create visit_products
        if (productId && visitData) {
            await supabase.from('visit_products').insert({
                visit_id: visitData.id,
                product_id: productId,
                product_name: p.product,
                quantity: 1,
                price: p.amount
            });
        }
    }

    console.log("Migration Completed!");
}

migrate().catch(console.error);
