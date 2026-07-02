import { supabase } from './supabase';
import type { Customer } from '../types';

export type CustomerInsert = Omit<Customer, 'id' | 'createdAt'>;
export type CustomerUpdate = Partial<CustomerInsert>;

export const customerService = {
  /**
   * Fetch customers with pagination and search
   */
  async getCustomers({ page = 1, limit = 50, search = '' }: { page?: number, limit?: number, search?: string } = {}) {
    let query = supabase
      .from('customers')
      .select('*', { count: 'exact' })
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (search) {
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const start = (page - 1) * limit;
    const end = start + limit - 1;
    query = query.range(start, end);

    const { data, count, error } = await query;

    if (error) {
      console.error('Error fetching customers:', error);
      throw error;
    }

    // Map snake_case to camelCase
    const mappedCustomers: Customer[] = (data || []).map((d: any) => ({
      id: Number(d.id),
      name: String(d.name || 'Unknown'),
      phone: String(d.phone || ''),
      dob: d.dob ? String(d.dob) : undefined,
      services_taken: d.services_taken || [],
      staff_served: d.staff_served || [],
      amountPaid: Number(d.amount_paid || 0),
      notes: d.notes ? String(d.notes) : undefined,
      createdAt: String(d.created_at || new Date().toISOString())
    }));

    return { data: mappedCustomers, count: count || 0 };
  },

  /**
   * Get Customer Aggregated Stats
   */
  async getCustomerStats() {
    try {
      // 1. Total Customers
      const { count: totalCustomers } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('is_deleted', false);

      // 2. New This Month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { count: newThisMonth } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('is_deleted', false)
        .gte('created_at', startOfMonth.toISOString());

      // 3. Lifetime Revenue & Avg Spend
      // For highly scaled apps, we would use an RPC here. For now, fetching grand_totals
      const { data: visitsRaw } = await supabase
        .from('customer_visits')
        .select('grand_total, customer:customer_id(is_deleted)')
        .eq('is_deleted', false);
        
      const visits = (visitsRaw || []).filter((v: any) => !v.customer || !v.customer.is_deleted);
        
      const totalRevenue = visits.reduce((sum, v) => sum + Number(v.grand_total || 0), 0);
      const avgSpend = (totalCustomers || 0) > 0 ? totalRevenue / totalCustomers! : 0;

      return {
        totalCustomers: totalCustomers || 0,
        newThisMonth: newThisMonth || 0,
        totalRevenue,
        avgSpend
      };
    } catch (e) {
      console.error('Error fetching customer stats:', e);
      return { totalCustomers: 0, newThisMonth: 0, totalRevenue: 0, avgSpend: 0 };
    }
  },

  /**
   * Add a new customer
   */
  async addCustomer(customerData: CustomerInsert) {
    const { data: existing } = await supabase
      .from('customers')
      .select('id')
      .eq('phone', customerData.phone)
      .eq('is_deleted', false)
      .maybeSingle();

    if (existing) {
      throw new Error('A customer with this phone number already exists.');
    }

    const { data, error } = await supabase
      .from('customers')
      .insert({
        name: customerData.name,
        phone: customerData.phone,
        dob: customerData.dob || null,
        services_taken: customerData.services_taken || [],
        staff_served: customerData.staff_served || [],
        amount_paid: customerData.amountPaid || 0,
        notes: customerData.notes || null
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding customer:', error);
      throw error;
    }

    return {
      id: Number(data.id),
      name: String(data.name || 'Unknown'),
      phone: String(data.phone || ''),
      dob: data.dob ? String(data.dob) : undefined,
      services_taken: data.services_taken || [],
      staff_served: data.staff_served || [],
      amountPaid: Number(data.amount_paid || 0),
      notes: data.notes ? String(data.notes) : undefined,
      createdAt: String(data.created_at || new Date().toISOString())
    } as Customer;
  },

  /**
   * Update an existing customer
   */
  async updateCustomer(id: number, updates: CustomerUpdate) {
    const payload: any = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.phone !== undefined) payload.phone = updates.phone;
    if (updates.dob !== undefined) payload.dob = updates.dob || null;
    if (updates.services_taken !== undefined) payload.services_taken = updates.services_taken;
    if (updates.products_bought !== undefined) payload.products_bought = updates.products_bought;
    if (updates.staff_served !== undefined) payload.staff_served = updates.staff_served;
    if (updates.amountPaid !== undefined) payload.amount_paid = updates.amountPaid;
    if (updates.notes !== undefined) payload.notes = updates.notes || null;

    const { data, error } = await supabase
      .from('customers')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating customer:', error);
      throw error;
    }

    return {
      id: Number(data.id),
      name: String(data.name || 'Unknown'),
      phone: String(data.phone || ''),
      dob: data.dob ? String(data.dob) : undefined,
      services_taken: data.services_taken || [],
      staff_served: data.staff_served || [],
      amountPaid: Number(data.amount_paid || 0),
      notes: data.notes ? String(data.notes) : undefined,
      createdAt: String(data.created_at || new Date().toISOString())
    } as Customer;
  },

  /**
   * Delete a customer (Soft Delete)
   */
  async deleteCustomer(id: number) {
    const { error } = await supabase
      .from('customers')
      .update({ is_deleted: true })
      .eq('id', id);

    if (error) {
      console.error('Error deleting customer:', error);
      throw error;
    }

    // Also soft-delete associated visits
    const { data: visits } = await supabase
      .from('customer_visits')
      .select('id')
      .eq('customer_id', id);

    if (visits && visits.length > 0) {
      const visitIds = visits.map(v => v.id);
      
      await supabase
        .from('customer_visits')
        .update({ is_deleted: true })
        .in('id', visitIds);

      await supabase
        .from('staff_commissions')
        .update({ is_deleted: true })
        .in('visit_id', visitIds);
    }

    return true;
  }
};
