import React, { useState, useEffect } from 'react';
import { serviceService } from '../lib/serviceService';
import type { SalonService } from '../lib/serviceService';
import { 
  Search, Plus, Scissors, Trash2, Edit2, X, AlertCircle 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const serviceSchema = z.object({
  service_name: z.string().min(2, "Name is required"),
  category: z.string().min(1, "Category is required"),
  price: z.coerce.number().min(0, "Price must be positive")
});

type ServiceFormData = z.infer<typeof serviceSchema>;

export default function Services() {
  const [services, setServices] = useState<SalonService[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [serviceToEdit, setServiceToEdit] = useState<SalonService | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<any>({
    resolver: zodResolver(serviceSchema)
  });

  const loadServices = async () => {
    try {
      setIsLoading(true);
      const data = await serviceService.getServices();
      setServices(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load services');
      toast.error('Failed to load services');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadServices();
  }, []);

  const openAddModal = () => {
    setServiceToEdit(null);
    reset({ service_name: '', category: 'Hair Services', price: '' as any });
    setIsModalOpen(true);
  };

  const openEditModal = (service: SalonService) => {
    setServiceToEdit(service);
    reset({
      service_name: service.service_name,
      category: service.category || 'Other',
      price: service.price
    });
    setIsModalOpen(true);
  };

  const onSubmit = async (data: any) => {
    try {
      if (serviceToEdit) {
        await serviceService.updateService(serviceToEdit.id, data);
        toast.success('Service updated successfully');
      } else {
        await serviceService.addService(data);
        toast.success('Service added successfully');
      }
      setIsModalOpen(false);
      loadServices();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save service');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this service?')) return;
    try {
      await serviceService.deleteService(id);
      toast.success('Service deleted successfully');
      loadServices();
    } catch (err: any) {
      toast.error('Failed to delete service');
    }
  };

  const filteredServices = services.filter((s) => {
    return s.service_name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const groupedServices = filteredServices.reduce((acc, s) => {
    const cat = s.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {} as Record<string, typeof services>);

  return (
    <div className="space-y-8 relative max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-numbers text-5xl tracking-tight text-white leading-none mb-1">Services</h1>
          <p className="mt-2 font-light tracking-wide" style={{ color: 'rgba(205, 127, 50,0.4)' }}>Manage your salon's service menu and pricing.</p>
        </div>
        <button 
          onClick={openAddModal}
          className="btn-primary"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Service
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-1">
        <div className="glass-card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 p-3 rounded-2xl" style={{ background: 'rgba(205, 127, 50,0.08)', border: '1px solid rgba(205, 127, 50,0.15)' }}>
              <Scissors className="h-6 w-6" style={{ color: '#CD7F32' }} />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-xs font-bold tracking-[0.1em] uppercase" style={{ color: 'rgba(205, 127, 50,0.5)' }}>Total Services</dt>
                <dd className="font-numbers text-5xl font-light text-white mt-2">{services.length}</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 flex items-center glass-panel px-4 py-3 focus-within:ring-1 focus-within:ring-white/30 transition-all">
          <Search className="h-5 w-5 text-white/40 mr-3" />
          <input
            type="text"
            placeholder="Search services..."
            className="bg-transparent outline-none w-full text-sm text-white placeholder-white/40"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-white/50">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
            Loading services...
          </div>
        ) : error ? (
          <div className="p-12 text-center text-danger">
            <AlertCircle className="h-8 w-8 mx-auto mb-4" />
            <p>{error}</p>
            <button onClick={loadServices} className="mt-4 text-sm font-semibold underline text-white">Try Again</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-white">
              <thead className="text-xs uppercase font-bold tracking-wider" style={{ background: 'rgba(205, 127, 50,0.04)', borderBottom: '1px solid rgba(205, 127, 50,0.12)', color: 'rgba(205, 127, 50,0.6)' }}>
                <tr>
                  <th className="px-6 py-5">Service Name</th>
                  <th className="px-6 py-5">Price</th>
                  <th className="px-6 py-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredServices.length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-center py-16 text-white/50">
                      <Scissors className="h-10 w-10 mx-auto mb-4 text-white/30" />
                      <p className="text-base font-light tracking-wide text-white">No services found</p>
                    </td>
                  </tr>
                )}
                {Object.entries(groupedServices).map(([category, items]) => (
                  <React.Fragment key={category}>
                    <tr className="bg-black/40 border-y border-white/10">
                      <td colSpan={3} className="px-6 py-3 text-xs font-bold tracking-widest uppercase" style={{ color: '#CD7F32' }}>
                        {category}
                      </td>
                    </tr>
                    {items.map((service) => (
                      <tr key={service.id} className="hover:bg-black/40/5 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="font-medium text-white text-base">{service.service_name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-light text-white text-lg">Rs. {service.price.toLocaleString()}</div>
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEditModal(service)} className="p-2 text-white/70 hover:bg-black/40/5 hover:text-white rounded-xl transition-colors">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(service.id)} className="p-2 text-danger hover:bg-danger/10 rounded-xl transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md flex flex-col animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h3 className="text-xl font-light tracking-tight text-white">{serviceToEdit ? 'Edit Service' : 'Add New Service'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-black/40/5 rounded-full text-white/50 transition-colors">
                <X className="w-5 h-5"/>
              </button>
            </div>
            
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1">
              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-xs font-bold tracking-widest text-white/50 uppercase mb-2">Service Name *</label>
                  <input type="text" {...register("service_name")} className="glass-input w-full px-4 py-3" placeholder="e.g. Haircut" />
                  {errors.service_name && <p className="text-danger text-xs mt-1.5">{errors.service_name.message as string}</p>}
                </div>
                <div>
                  <label className="block text-xs font-bold tracking-widest text-white/50 uppercase mb-2">Category *</label>
                  <select {...register("category")} className="glass-input w-full px-4 py-3 appearance-none">
                    <option value="Hair Services" className="bg-black">Hair Services</option>
                    <option value="Hair Treatments" className="bg-black">Hair Treatments</option>
                    <option value="Hair Colour Services" className="bg-black">Hair Colour Services</option>
                    <option value="Hair Smoothing Services" className="bg-black">Hair Smoothing Services</option>
                    <option value="Beauty Services" className="bg-black">Beauty Services</option>
                    <option value="Other" className="bg-black">Other</option>
                  </select>
                  {errors.category && <p className="text-danger text-xs mt-1.5">{errors.category.message as string}</p>}
                </div>
                <div>
                  <label className="block text-xs font-bold tracking-widest text-white/50 uppercase mb-2">Price (Rs. ) *</label>
                  <input type="number" {...register("price")} className="glass-input w-full px-4 py-3" placeholder="Enter price..." />
                  {errors.price && <p className="text-danger text-xs mt-1.5">{errors.price.message as string}</p>}
                </div>
              </div>

              <div className="p-6 border-t border-white/10 bg-black/20 rounded-b-2xl flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="btn-primary disabled:opacity-50">
                  {isSubmitting ? 'Saving...' : 'Save Service'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

