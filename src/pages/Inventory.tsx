import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Search, Edit2, Trash2, X, Package, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import type { Product } from '../types';

export default function Inventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 10;

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    purchase_price: 0,
    selling_price: 0,
    purchased_quantity: 0,
    sold_quantity: 0,
    salon_consumption: 0,
    current_stock: 0
  });

  // Auto-calculate current stock whenever relevant fields change
  useEffect(() => {
    const purchased = Number(formData.purchased_quantity) || 0;
    const sold = Number(formData.sold_quantity) || 0;
    const consumed = Number(formData.salon_consumption) || 0;
    setFormData(prev => ({ ...prev, current_stock: purchased - sold - consumed }));
  }, [formData.purchased_quantity, formData.sold_quantity, formData.salon_consumption]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1); // Reset to first page on search
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadProducts = useCallback(async () => {
    try {
      setIsLoading(true);
      
      let query = supabase.from('products').select('*', { count: 'exact' }).eq('is_deleted', false);
      
      if (debouncedSearch) {
        query = query.ilike('name', `%${debouncedSearch}%`);
      }
      
      const { data, count, error } = await query
        .order('name', { ascending: true })
        .range((page - 1) * limit, page * limit - 1);

      if (error) throw error;
      setProducts(data || []);
      setTotalCount(count || 0);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load products');
      toast.error('Failed to load products');
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    loadProducts();
    const channel = supabase
      .channel('products-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, loadProducts)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadProducts]);

  const openAddModal = () => {
    setProductToEdit(null);
    setFormData({ name: '', purchase_price: 0, selling_price: 0, purchased_quantity: 0, sold_quantity: 0, salon_consumption: 0, current_stock: 0 });
    setIsModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setProductToEdit(product);
    setFormData({
      name: product.name,
      purchase_price: product.purchase_price || 0,
      selling_price: product.selling_price || 0,
      purchased_quantity: product.purchased_quantity || 0,
      sold_quantity: product.sold_quantity || 0,
      salon_consumption: product.salon_consumption || 0,
      current_stock: product.current_stock || 0
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      toast.error('Product name is required');
      return;
    }

    try {
      const payload = {
        name: formData.name,
        purchase_price: Number(formData.purchase_price),
        selling_price: Number(formData.selling_price),
        purchased_quantity: Number(formData.purchased_quantity),
        sold_quantity: Number(formData.sold_quantity),
        salon_consumption: Number(formData.salon_consumption),
        current_stock: Number(formData.current_stock)
      };

      if (productToEdit) {
        const { error } = await supabase.from('products').update(payload).eq('id', productToEdit.id);
        if (error) throw error;
        toast.success('Product updated successfully');
      } else {
        const { error } = await supabase.from('products').insert(payload);
        if (error) throw error;
        toast.success('Product added successfully');
      }

      setIsModalOpen(false);
      loadProducts();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save product');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      toast.success('Product deleted successfully');
      
      // Handle page adjustment if it was the last item on the page
      if (products.length === 1 && page > 1) {
        setPage(page - 1);
      } else {
        loadProducts();
      }
    } catch (err: any) {
      toast.error('Failed to delete product');
    }
  };

  const totalPages = Math.ceil(totalCount / limit);

  return (
    <div className="space-y-8 relative max-w-7xl mx-auto pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-numbers text-5xl tracking-tight text-white leading-none mb-1">Inventory</h1>
          <p className="mt-2 font-light tracking-wide" style={{ color: 'rgba(205, 127, 50,0.4)' }}>Manage your product stock quantities directly.</p>
        </div>
        <button onClick={openAddModal} className="btn-primary">
          <Plus className="mr-2 h-4 w-4" />
          Add Product
        </button>
      </div>

      <div className="flex items-center w-full max-w-md glass-panel bg-black/40 px-4 py-3 focus-within:ring-1 focus-within:ring-primary/30 transition-all shadow-sm">
        <Search className="h-5 w-5 text-white/60 mr-3" />
        <input
          type="text"
          placeholder="Search products by name..."
          className="bg-transparent outline-none w-full text-sm text-white placeholder-secondary-foreground/50"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="glass-card overflow-hidden" style={{ border: '1px solid rgba(205, 127, 50,0.1)' }}>
        {isLoading ? (
          <div className="p-12 text-center text-white/60">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            Loading inventory...
          </div>
        ) : error ? (
          <div className="p-12 text-center text-danger">
            <p>{error}</p>
            <button onClick={loadProducts} className="mt-4 text-sm font-semibold underline text-white">Try Again</button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-sm text-left text-white">
                <thead className="text-xs uppercase font-bold tracking-wider" style={{ background: 'rgba(205, 127, 50,0.04)', borderBottom: '1px solid rgba(205, 127, 50,0.12)', color: 'rgba(205, 127, 50,0.6)' }}>
                  <tr>
                    <th className="px-6 py-5">Product Name</th>
                    <th className="px-6 py-5 text-center">Cost</th>
                    <th className="px-6 py-5 text-center">Price</th>
                    <th className="px-6 py-5 text-center">Purchased Qty</th>
                    <th className="px-6 py-5 text-center">Sold Qty</th>
                    <th className="px-6 py-5 text-center">Salon Consumption</th>
                    <th className="px-6 py-5 text-center">Current Stock</th>
                    <th className="px-6 py-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {products.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-16 text-white/60">
                        <Package className="h-10 w-10 mx-auto mb-4 text-white/60/30" />
                        <p className="text-base font-light tracking-wide text-white">No products found</p>
                      </td>
                    </tr>
                  )}
                  {products.map(item => (
                    <tr key={item.id} className="hover:bg-black/40 transition-colors group font-light">
                      <td className="px-6 py-4">
                        <div className="font-medium text-white text-base">{item.name}</div>
                      </td>
                      <td className="px-6 py-4 text-center text-white/60">Rs. {item.purchase_price || 0}</td>
                      <td className="px-6 py-4 text-center text-white/60">Rs. {item.selling_price || 0}</td>
                      <td className="px-6 py-4 text-center text-white/60">{item.purchased_quantity}</td>
                      <td className="px-6 py-4 text-center text-white/60">{item.sold_quantity}</td>
                      <td className="px-6 py-4 text-center text-white/60">{item.salon_consumption}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-sm font-bold`} style={item.current_stock <= 0 ? { background: 'rgba(207,102,121,0.1)', color: '#CF6679', border: '1px solid rgba(207,102,121,0.2)' } : { background: 'rgba(205, 127, 50,0.08)', color: '#D4AF37', border: '1px solid rgba(205, 127, 50,0.2)' }}>
                          {item.current_stock}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEditModal(item)} className="p-2 text-white/60 hover:bg-black/5 hover:text-white rounded-xl transition-colors">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(item.id)} className="p-2 text-danger hover:bg-danger/10 rounded-xl transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-white/10 bg-black/40 flex items-center justify-between">
                <span className="text-sm text-white/60 font-light">
                  Showing {(page - 1) * limit + 1} to {Math.min(page * limit, totalCount)} of {totalCount}
                </span>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-2 rounded-lg border border-white/10 text-white/60 hover:bg-black/5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-2 rounded-lg border border-white/10 text-white/60 hover:bg-black/5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel bg-background w-full max-w-md flex flex-col animate-in zoom-in-95 duration-200 shadow-2xl border border-white/10">
            <div className="flex items-center justify-between p-6 border-b border-white/10 bg-black/40 rounded-t-2xl">
              <h3 className="text-xl font-light tracking-tight text-white">{productToEdit ? 'Edit Product' : 'Add New Product'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-black/5 rounded-full text-white/60 transition-colors">
                <X className="w-5 h-5"/>
              </button>
            </div>
            <form onSubmit={handleSave} className="flex flex-col flex-1 bg-black/40">
              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-xs font-bold tracking-widest text-white/60 uppercase mb-2">Product Name *</label>
                  <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="glass-input bg-black/40 w-full px-4 py-3 border-white/10 shadow-sm text-white" placeholder="e.g. L'Oreal Shampoo" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold tracking-widest text-white/60 uppercase mb-2">Purchase Price (Cost)</label>
                    <input type="number" min="0" value={formData.purchase_price} onChange={e => setFormData({...formData, purchase_price: Number(e.target.value)})} className="glass-input bg-black/40 w-full px-4 py-3 border-white/10 shadow-sm text-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold tracking-widest text-white/60 uppercase mb-2">Selling Price</label>
                    <input type="number" min="0" value={formData.selling_price} onChange={e => setFormData({...formData, selling_price: Number(e.target.value)})} className="glass-input bg-black/40 w-full px-4 py-3 border-white/10 shadow-sm text-white" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold tracking-widest text-white/60 uppercase mb-2">Purchased Qty</label>
                    <input type="number" min="0" value={formData.purchased_quantity} onChange={e => setFormData({...formData, purchased_quantity: Number(e.target.value)})} className="glass-input bg-black/40 w-full px-4 py-3 border-white/10 shadow-sm text-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold tracking-widest text-white/60 uppercase mb-2">Sold Qty</label>
                    <input type="number" min="0" value={formData.sold_quantity} onChange={e => setFormData({...formData, sold_quantity: Number(e.target.value)})} className="glass-input bg-black/40 w-full px-4 py-3 border-white/10 shadow-sm text-white" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold tracking-widest text-white/60 uppercase mb-2">Salon Consumption</label>
                    <input type="number" min="0" value={formData.salon_consumption} onChange={e => setFormData({...formData, salon_consumption: Number(e.target.value)})} className="glass-input bg-black/40 w-full px-4 py-3 border-white/10 shadow-sm text-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold tracking-widest text-white/60 uppercase mb-2">Current Stock</label>
                    <input type="number" disabled value={formData.current_stock} className="glass-input bg-black/5 w-full px-4 py-3 border-white/10 text-white/60 cursor-not-allowed" title="Auto-calculated (Purchased - Sold - Consumed)" />
                  </div>
                </div>
                <p className="text-xs text-white/60 italic mt-2">Current Stock is auto-calculated as (Purchased Qty - Sold Qty - Salon Consumption).</p>
              </div>
              <div className="p-6 border-t border-white/10 bg-black/5 rounded-b-2xl flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary bg-black/40 border-white/10 text-white">Cancel</button>
                <button type="submit" className="btn-primary">{productToEdit ? 'Save Changes' : 'Add Product'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
