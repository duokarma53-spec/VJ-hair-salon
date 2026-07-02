import { supabase } from './supabase';

export interface SalonService {
  id: string;
  service_name: string;
  category?: string;
  price: number;
  created_at?: string;
}

export const serviceService = {
  async getServices() {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as SalonService[];
  },

  async addService(serviceData: Omit<SalonService, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('services')
      .insert([serviceData])
      .select()
      .single();

    if (error) throw error;
    return data as SalonService;
  },

  async updateService(id: string, updates: Partial<Omit<SalonService, 'id' | 'created_at'>>) {
    const { data, error } = await supabase
      .from('services')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as SalonService;
  },

  async deleteService(id: string) {
    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }
};
