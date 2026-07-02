import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { serviceService } from '../lib/serviceService';
import type { SalonService } from '../lib/serviceService';
import { 
  Search, Plus, Tag, Trash2, Edit2, X, AlertCircle 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const packageSchema = z.object({
  name: z.string().min(2, "Name is required"),
  description: z.string().optional(),
  price: z.coerce.number().min(0, "Price must be positive")
});

type PackageFormData = z.infer<typeof packageSchema>;

export default function Packages() {
  const [packages, setPackages] = useState<any[]>([]);
  const [availableServices, setAvailableServices] = useState<SalonService[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [packageToEdit, setPackageToEdit] = useState<any | null>(null);
  const [selectedServices, setSelectedServices] = useState<{service_id: string}[]>([]);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<any>({
    resolver: zodResolver(packageSchema)
  });

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [pkgRes, srvRes] = await Promise.all([
        supabase.from('packages').select('*, package_services(service_id)').eq('is_deleted', false).order('created_at', { ascending: false }),
        serviceService.getServices()
      ]);
      setPackages(pkgRes.data || []);
      setAvailableServices(srvRes);
    } catch (err: any) {
      toast.error('Failed to load packages');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openAddModal = () => {
    setPackageToEdit(null);
    setSelectedServices([]);
    reset({ name: '', description: '', price: '' as any });
    setIsModalOpen(true);
  };

  const openEditModal = (pkg: any) => {
    setPackageToEdit(pkg);
    setSelectedServices(pkg.package_services || []);
    reset({
      name: pkg.name,
      description: pkg.description || '',
      price: pkg.price
    });
    setIsModalOpen(true);
  };

  const onSubmit = async (data: any) => {
    try {
      if (packageToEdit) {
        // Update package
        await supabase.from('packages').update({
          name: data.name,
          description: data.description,
          price: data.price
        }).eq('id', packageToEdit.id);

        // Update services mapping
        await supabase.from('package_services').delete().eq('package_id', packageToEdit.id);
        if (selectedServices.length > 0) {
          const serviceInserts = selectedServices.map(s => ({ package_id: packageToEdit.id, service_id: s.service_id }));
          await supabase.from('package_services').insert(serviceInserts);
        }
        toast.success('Package updated');
      } else {
        // Insert package
        const { data: newPkg, error } = await supabase.from('packages').insert({
          name: data.name,
          description: data.description,
          price: data.price
        }).select().single();
        if (error) throw error;
        
        if (selectedServices.length > 0 && newPkg) {
          const serviceInserts = selectedServices.map(s => ({ package_id: newPkg.id, service_id: s.service_id }));
          await supabase.from('package_services').insert(serviceInserts);
        }
        toast.success('Package created');
      }
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error('Failed to save package');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this package?')) return;
    try {
      await supabase.from('packages').update({ is_deleted: true }).eq('id', id);
      toast.success('Package deleted');
      loadData();
    } catch (err: any) {
      toast.error('Failed to delete package');
    }
  };

  const filteredPackages = packages.filter((p) => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 glass-panel p-6 sm:p-8 animate-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="font-numbers text-5xl tracking-tight text-white leading-none mb-1">Packages</h1>
          <p className="mt-2 font-light tracking-wide" style={{ color: 'rgba(205, 127, 50,0.4)' }}>Manage bundled services</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60/50" />
            <input 
              type="text" 
              placeholder="Search packages..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="glass-input !pl-10 pr-4 py-2.5 w-full sm:w-64 text-sm"
            />
          </div>
          <button onClick={openAddModal} className="btn-primary py-2.5 whitespace-nowrap">
            <Plus className="w-4 h-4 mr-2" /> Add Package
          </button>
        </div>
      </div>

      {/* Package Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : filteredPackages.length === 0 ? (
        <div className="glass-panel p-12 text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(205, 127, 50,0.1)', border: '1px solid rgba(205, 127, 50,0.2)' }}>
            <Tag className="w-8 h-8" style={{ color: '#D4AF37' }} />
          </div>
          <h3 className="text-xl font-light text-white mb-2">No Packages Found</h3>
          <p className="text-white/60">Click "Add Package" to create a new service bundle.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPackages.map((pkg) => (
            <div key={pkg.id} className="glass-panel p-6 flex flex-col group relative overflow-hidden transition-all hover:shadow-md" style={{ border: '1px solid rgba(205, 127, 50,0.1)', background: 'rgba(17,17,17,0.6)' }}>
              <div className="absolute top-0 left-0 w-1 h-full transition-colors bg-[#D4AF37]/40 group-hover:bg-[#D4AF37]"></div>
              
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-numbers text-2xl font-light text-white">{pkg.name}</h3>
                  <p className="text-sm text-white/60 mt-1 line-clamp-2">{pkg.description}</p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEditModal(pkg)} className="p-2 text-white/60 hover:text-white hover:bg-black/5 rounded-lg transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(pkg.id)} className="p-2 text-danger hover:bg-danger/10 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 mt-2 mb-4">
                <span className="text-xs font-bold tracking-widest uppercase mb-2 block" style={{ color: 'rgba(205, 127, 50,0.5)' }}>Included Services</span>
                <div className="flex flex-wrap gap-2">
                  {pkg.package_services?.map((ps: any, idx: number) => {
                    const s = availableServices.find(as => as.id.toString() === ps.service_id.toString());
                    return s ? (
                      <span key={idx} className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-black/5 text-white">
                        {s.service_name}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>

              <div className="mt-auto pt-4 border-t border-white/10 flex justify-between items-center">
                <span className="text-xs font-bold tracking-widest uppercase" style={{ color: 'rgba(205, 127, 50,0.5)' }}>Price</span>
                <span className="font-numbers text-3xl font-light" style={{ color: '#D4AF37' }}>Rs. {pkg.price}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-white/10 bg-black/40 rounded-t-2xl shrink-0">
              <h3 className="text-xl font-light tracking-tight text-white">{packageToEdit ? 'Edit Package' : 'Create Package'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-black/5 rounded-full text-white/60 transition-colors">
                <X className="w-5 h-5"/>
              </button>
            </div>
            
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 space-y-5 bg-black/60 overflow-y-auto custom-scrollbar flex-1">
                <div>
                  <label className="block text-xs font-bold tracking-widest text-white/60 uppercase mb-2">Package Name *</label>
                  <input type="text" {...register("name")} className="glass-input w-full px-4 py-3" placeholder="e.g. Bridal Deluxe" />
                  {errors.name && <p className="text-danger text-xs mt-1.5">{errors.name.message as string}</p>}
                </div>
                
                <div>
                  <label className="block text-xs font-bold tracking-widest text-white/60 uppercase mb-2">Description</label>
                  <textarea {...register("description")} rows={2} className="glass-input w-full px-4 py-3 resize-none" placeholder="Details..." />
                </div>
                
                <div>
                  <label className="block text-xs font-bold tracking-widest text-white/60 uppercase mb-2">Package Price *</label>
                  <input type="number" {...register("price")} className="glass-input w-full px-4 py-3" placeholder="0" />
                  {errors.price && <p className="text-danger text-xs mt-1.5">{errors.price.message as string}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold tracking-widest text-white/60 uppercase mb-2 flex items-center justify-between">
                    <span>Included Services</span>
                    <button type="button" onClick={() => setSelectedServices([...selectedServices, {service_id: ''}])} className="text-xs font-bold transition-colors hover:opacity-80" style={{ color: '#D4AF37' }}>
                      + Add Service
                    </button>
                  </label>
                  
                  {selectedServices.length > 0 && (
                    <div className="space-y-3 mt-3">
                      {selectedServices.map((ps, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                          <select 
                            value={ps.service_id} 
                            onChange={(e) => {
                              const newS = [...selectedServices];
                              newS[idx].service_id = e.target.value;
                              setSelectedServices(newS);
                            }}
                            className="glass-input flex-1 px-4 py-3 appearance-none bg-black/40"
                          >
                            <option value="">-- Select Service --</option>
                            {availableServices.map(s => <option key={s.id} value={s.id}>{s.service_name}</option>)}
                          </select>
                          <button type="button" onClick={() => setSelectedServices(selectedServices.filter((_, i) => i !== idx))} className="p-3 text-danger hover:bg-danger/20 rounded-xl bg-danger/10 border border-danger/20 transition-colors">
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 border-t border-white/10 bg-black/40 rounded-b-2xl flex justify-end gap-3 shrink-0">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Save Package</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
