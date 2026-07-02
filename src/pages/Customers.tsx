import React, { useState, useEffect, useMemo } from 'react';
import { customerService } from '../lib/customerService';
import type { Customer } from '../types';
import { 
  Search, Plus, User, Scissors, Receipt, Package,
  Trash2, Edit2, X, Users, UserPlus, IndianRupee, TrendingUp, Calendar as CalendarIcon,
  ChevronLeft, ChevronRight, Download, MessageCircle, Star, ClipboardList, Tag, Filter, SortDesc
} from 'lucide-react';
import { generateInvoicePDF } from '../lib/pdfGenerator';
import { format, isThisMonth, isToday, isYesterday, isThisWeek, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '../lib/supabase';
import { serviceService } from '../lib/serviceService';
import type { SalonService } from '../lib/serviceService';
import Select from 'react-select';

const selectStyles = {
  control: (base: any, state: any) => ({
    ...base,
    background: 'rgba(0, 0, 0, 0.4)',
    borderColor: state.isFocused ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.1)',
    borderRadius: '0.75rem',
    padding: '2px',
    boxShadow: 'none',
    '&:hover': {
      borderColor: 'rgba(255, 255, 255, 0.2)'
    }
  }),
  menu: (base: any) => ({
    ...base,
    background: 'rgba(20, 20, 20, 0.95)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '0.75rem',
    overflow: 'hidden',
    zIndex: 9999
  }),
  option: (base: any, state: any) => ({
    ...base,
    backgroundColor: state.isFocused ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
    color: state.isFocused ? '#fff' : 'rgba(255, 255, 255, 0.7)',
    cursor: 'pointer',
    '&:active': {
      backgroundColor: 'rgba(255, 255, 255, 0.15)'
    }
  }),
  singleValue: (base: any) => ({
    ...base,
    color: '#fff'
  }),
  input: (base: any) => ({
    ...base,
    color: '#fff'
  }),
  placeholder: (base: any) => ({
    ...base,
    color: 'rgba(255, 255, 255, 0.3)'
  }),
  groupHeading: (base: any) => ({
    ...base,
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: '0.75rem',
    letterSpacing: '0.1em',
    textTransform: 'uppercase'
  })
};

const customerSchema = z.object({
  name: z.string().min(2, "Name is required"),
  phone: z.string().min(10, "Valid phone number is required"),
  dobDay: z.string().optional(),
  dobMonth: z.string().optional(),
  dobYear: z.string().optional(),
  notes: z.string().optional()
});
type CustomerFormData = z.infer<typeof customerSchema>;

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTime, setFilterTime] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'spend' | 'alphabet'>('recent');
  const [isLoading, setIsLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 10;
  
  const [services, setServices] = useState<SalonService[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalCustomers: 0, newThisMonth: 0, totalRevenue: 0, avgSpend: 0 });

  const groupedServices = useMemo(() => services.reduce((acc, service) => {
    const category = service.category || 'Other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(service);
    return acc;
  }, {} as Record<string, typeof services>), [services]);

  const serviceOptions = useMemo(() => {
    return Object.entries(groupedServices).map(([category, items]) => ({
      label: category,
      options: items.map(s => ({
        value: s.id.toString(),
        label: `${s.service_name} - ₹${s.price}`
      }))
    }));
  }, [groupedServices]);

  // Discount & Payment state for Add Customer modal
  const [addFinalAmount, setAddFinalAmount] = useState<string>('');
  const [addPaymentMethod, setAddPaymentMethod] = useState<string>('Cash');
  // Discount & Payment state for Record Visit modal
  const [visitFinalAmount, setVisitFinalAmount] = useState<string>('');
  const [visitPaymentMethod, setVisitPaymentMethod] = useState<string>('Cash');

  const [error, setError] = useState<string | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);
  
  // Modals state
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);
  const [customerServices, setCustomerServices] = useState<{serviceId: string}[]>([]);
  const [customerProducts, setCustomerProducts] = useState<{productId: string, quantity: number}[]>([]);
  const [customerStaffId, setCustomerStaffId] = useState<string>('');
  
  const [selectedCustomerForHistory, setSelectedCustomerForHistory] = useState<number | null>(null);
  const [selectedHistory, setSelectedHistory] = useState<any[]>([]);
  const [selectedCustomerRewards, setSelectedCustomerRewards] = useState<{points: number, membership_tier: string} | null>(null);

  // Record Visit modal state
  const [isRecordVisitOpen, setIsRecordVisitOpen] = useState(false);
  const [visitCustomer, setVisitCustomer] = useState<Customer | null>(null);
  const [visitServices, setVisitServices] = useState<{serviceId: string}[]>([]);
  const [visitProducts, setVisitProducts] = useState<{productId: string, quantity: number}[]>([]);
  const [visitStaffId, setVisitStaffId] = useState<string>('');
  const [isSubmittingVisit, setIsSubmittingVisit] = useState(false);
  const [visitToEdit, setVisitToEdit] = useState<any | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema)
  });

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [custData, srvData, stfRes, prodRes, statsData] = await Promise.all([
        customerService.getCustomers({ page, limit, search: debouncedSearch }),
        serviceService.getServices(),
        supabase.from('staff').select('*').eq('is_deleted', false),
        supabase.from('products').select('*').eq('is_deleted', false),
        customerService.getCustomerStats()
      ]);
      setCustomers(custData.data);
      setTotalCount(custData.count);
      setStats(statsData);
      setServices(srvData);
      if (stfRes.data) setStaff(stfRes.data);
      if (prodRes.data) setProducts(prodRes.data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
      toast.error('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const channel = supabase
      .channel('customers-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, loadData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [page, debouncedSearch]);

  useEffect(() => {
    const fetchHistory = async () => {
      if (selectedCustomerForHistory) {
        const [{ data: historyData }, { data: rewardsData }] = await Promise.all([
          supabase
            .from('customer_visits')
            .select('*, visit_services(*), visit_products(*)')
            .eq('customer_id', selectedCustomerForHistory)
            .eq('is_deleted', false)
            .order('visit_date', { ascending: false }),
          supabase
            .from('customer_rewards')
            .select('*')
            .eq('customer_id', selectedCustomerForHistory)
            .maybeSingle()
        ]);
        setSelectedHistory(historyData || []);
        setSelectedCustomerRewards(rewardsData || { points: 0, membership_tier: 'Standard' });
      }
    };
    fetchHistory();
  }, [selectedCustomerForHistory]);

  const handleDeleteVisit = async (visitId: string) => {
    if (!window.confirm("Are you sure you want to completely delete this visit? This will reverse revenue, restock products, and remove staff commissions. This action cannot be undone.")) {
      return;
    }
    try {
      // 1. Fetch visit details
      const { data: visit, error: vErr } = await supabase.from('customer_visits').select('*').eq('id', visitId).single();
      if (vErr || !visit) throw new Error("Could not find visit");

      // 2. Subtract from customer amount_paid
      const { data: cust } = await supabase.from('customers').select('amount_paid').eq('id', visit.customer_id).single();
      if (cust) {
        const newTotal = Math.max(0, Number(cust.amount_paid) - Number(visit.grand_total));
        await supabase.from('customers').update({ amount_paid: newTotal }).eq('id', visit.customer_id);
      }

      // 3. Restock products
      const { data: vpData } = await supabase.from('visit_products').select('product_id, quantity').eq('visit_id', visitId);
      if (vpData) {
        for (const vp of vpData) {
          const { data: p } = await supabase.from('products').select('current_stock, sold_quantity').eq('id', vp.product_id).single();
          if (p) {
            await supabase.from('products').update({
              current_stock: Number(p.current_stock) + Number(vp.quantity),
              sold_quantity: Math.max(0, Number(p.sold_quantity) - Number(vp.quantity))
            }).eq('id', vp.product_id);
          }
        }
      }

      // 4. Delete visit relationships
      await supabase.from('visit_services').delete().eq('visit_id', visitId);
      await supabase.from('visit_products').delete().eq('visit_id', visitId);
      await supabase.from('staff_commissions').delete().eq('visit_id', visitId);

      // 5. Reset appointment if exists
      await supabase.from('appointments').update({ status: 'scheduled', converted_visit_id: null }).eq('converted_visit_id', visitId);

      // 6. Delete visit (mark as deleted)
      await supabase.from('customer_visits').update({ is_deleted: true }).eq('id', visitId);

      // Update local state
      setSelectedHistory(prev => prev.filter(v => v.id !== visitId));
      loadData(); // Refresh customers list for amount_paid updates
      toast.success("Visit completely reversed and deleted.");

    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to delete visit");
    }
  };

  const handleEditVisit = async (visitId: string, currentDate: string, currentTotal: number, customerId: string) => {
    const rawDate = currentDate.split('T')[0];
    const newDateStr = window.prompt("Enter new date for this visit (YYYY-MM-DD):", rawDate);
    if (!newDateStr) return;
    
    // Basic date validation
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDateStr)) {
      toast.error("Invalid date format. Please use YYYY-MM-DD.");
      return;
    }

    const newTotalStr = window.prompt("Enter new Grand Total (₹):", String(currentTotal));
    if (!newTotalStr) return;
    const newTotal = Number(newTotalStr);
    if (isNaN(newTotal) || newTotal < 0) {
      toast.error("Invalid amount.");
      return;
    }

    // Set time to noon UTC to avoid timezone shifting issues
    const newDate = `${newDateStr}T12:00:00Z`;

    try {
      // If total changed, update customer amount_paid
      const difference = newTotal - currentTotal;
      if (difference !== 0) {
        const { data: cust } = await supabase.from('customers').select('amount_paid').eq('id', customerId).single();
        if (cust) {
           await supabase.from('customers').update({ amount_paid: Number(cust.amount_paid || 0) + difference }).eq('id', customerId);
        }
      }

      await supabase.from('customer_visits').update({ visit_date: newDate, grand_total: newTotal }).eq('id', visitId);
      
      setSelectedHistory(prev => prev.map(v => v.id === visitId ? { ...v, visit_date: newDate, grand_total: newTotal } : v));
      toast.success("Visit updated!");
      loadData(); // refresh customers list if amount_paid changed
    } catch (err: any) {
      toast.error(err.message || "Failed to update visit");
    }
  };

  const openAddModal = () => {
    setCustomerToEdit(null);
    setCustomerServices([]);
    setCustomerProducts([]);
    setCustomerStaffId('');
    setAddFinalAmount('');
    setAddPaymentMethod('Cash');
    reset({ name: '', phone: '', dobDay: '', dobMonth: '', dobYear: '', notes: '' });
    setIsCustomerModalOpen(true);
  };

  const openEditModal = (customer: Customer) => {
    setCustomerToEdit(customer);
    let dDay = '', dMonth = '', dYear = '';
    if (customer.dob) {
      const [y, m, d] = customer.dob.split('-');
      dDay = d.substring(0, 2);
      dMonth = m;
      dYear = y !== '1900' ? y : '';
    }

    // Match existing services by name
    const matchedServices = customer.services_taken 
      ? customer.services_taken.map(name => {
          const s = services.find(x => x.service_name === name);
          return s ? { serviceId: s.id } : null;
        }).filter(Boolean) as {serviceId: string}[]
      : [];
    setCustomerServices(matchedServices);

    const matchedProducts = customer.products_bought
      ? customer.products_bought.map(name => {
          const p = products.find(x => x.name === name);
          return p ? { productId: p.id, quantity: 1 } : null;
        }).filter(Boolean) as {productId: string, quantity: number}[]
      : [];
    setCustomerProducts(matchedProducts);

    const matchedStaff = customer.staff_served && customer.staff_served.length > 0
      ? staff.find(s => s.name === customer.staff_served?.[0] || (s as any).staff_name === customer.staff_served?.[0])
      : null;
    setCustomerStaffId(matchedStaff ? matchedStaff.id.toString() : '');

    reset({
      name: customer.name,
      phone: customer.phone,
      dobDay: dDay,
      dobMonth: dMonth,
      dobYear: dYear,
      notes: customer.notes || ''
    });
    setIsCustomerModalOpen(true);
  };

  const onSubmitCustomer = async (data: CustomerFormData) => {
    try {
      const yearToUse = data.dobYear || '1900';
      const parsedDob = (data.dobMonth && data.dobDay) 
        ? `${yearToUse}-${data.dobMonth}-${data.dobDay}` 
        : null;

      if (!customerToEdit) {
        // Check for existing customer to prevent duplicates
        let existingCusts: any[] = [];
        if (data.phone?.trim()) {
           const { data: pData } = await supabase.from('customers').select('id, name').eq('phone', data.phone.trim()).eq('is_deleted', false);
           existingCusts = pData || [];
        }
        if (existingCusts.length === 0 && data.name?.trim()) {
           const { data: nData } = await supabase.from('customers').select('id, name').ilike('name', data.name.trim()).eq('is_deleted', false);
           existingCusts = nData || [];
        }

        if (existingCusts.length > 0) {
          if (!window.confirm(`⚠️ Customer "${existingCusts[0].name}" already exists in the system!\n\nIf this is the same person, please click CANCEL and use the "Record Visit" button on their existing profile.\n\nAre you absolutely sure you want to create a duplicate profile?`)) {
            return;
          }
        }

        if (customerServices.length === 0 && customerProducts.length === 0) {
          toast.error("Please select at least one service or product.");
          return;
        }
        if (!customerStaffId) {
          toast.error("Please select a staff member.");
          return;
        }
      }

      let serviceTotal = 0;
      const parsedServices = customerServices.map(cs => {
        const s = services.find(x => x.id.toString() === cs.serviceId.toString());
        if (s) {
          serviceTotal += Number(s.price);
          return s.service_name;
        }
        return '';
      }).filter(Boolean);

      let productTotal = 0;
      const parsedProducts = customerProducts.map(cp => {
        const p = products.find(x => x.id.toString() === cp.productId.toString());
        if (p) {
          productTotal += Number(p.selling_price || p.sellingPrice || 0) * cp.quantity;
          return p.name;
        }
        return '';
      }).filter(Boolean);

      const originalTotal = serviceTotal + productTotal;
      const finalAmt = addFinalAmount !== '' ? Number(addFinalAmount) : originalTotal;
      const discountAmt = Math.max(0, originalTotal - finalAmt);
      const grandTotal = finalAmt;

      const parsedData: any = {
        name: data.name,
        phone: data.phone,
        dob: parsedDob,
        services_taken: parsedServices,
        products_bought: parsedProducts,
      };
      
      if (!customerToEdit) {
        parsedData.amountPaid = grandTotal;
      }
      
      if (customerStaffId) {
        parsedData.staff_served = [staff.find(s => s.id.toString() === customerStaffId.toString())?.name || ''];
      }

      if (customerToEdit) {
        await customerService.updateCustomer(customerToEdit.id, parsedData);
        toast.success('Customer updated successfully');
      } else {
        const newCust = await customerService.addCustomer(parsedData);
        
        // --- Create Visit & Commission automatically ---
        const selectedStaffMember = staff.find(s => s.id.toString() === customerStaffId.toString());
        const commissionRate = selectedStaffMember ? Number(selectedStaffMember.commission_rate || 10) : 10;
        const commissionAmount = serviceTotal * (commissionRate / 100);
        
        const { data: visitData, error: visitErr } = await supabase.from('customer_visits').insert([{
          customer_id: newCust.id,
          service_total: serviceTotal,
          product_total: productTotal,
          original_total: originalTotal,
          discount_amount: discountAmt,
          grand_total: grandTotal,
          staff_id: customerStaffId,
          payment_method: addPaymentMethod
        }]).select().single();

        if (visitErr) throw visitErr;

        const vServicesData = customerServices.map(cs => {
          const s = services.find(x => x.id.toString() === cs.serviceId.toString())!;
          return { service_id: s.id, service_name: s.service_name, price: Number(s.price) };
        });

        if (vServicesData.length > 0) {
          await supabase.from('visit_services').insert(
            vServicesData.map(vs => ({ visit_id: visitData.id, ...vs }))
          );
        }

        const vProductsData = customerProducts.map(cp => {
          const p = products.find(x => x.id.toString() === cp.productId.toString())!;
          return { product_id: p.id, product_name: p.name, quantity: cp.quantity, price: Number(p.selling_price || p.sellingPrice || 0) * cp.quantity };
        });

        if (vProductsData.length > 0) {
          await supabase.from('visit_products').insert(
            vProductsData.map(vp => ({ visit_id: visitData.id, ...vp }))
          );
          for (const vp of vProductsData) {
            const p = products.find(x => x.id === vp.product_id)!;
            const newQty = (Number(p.current_stock || p.currentStock) || 0) - vp.quantity;
            const newSold = (Number(p.sold_quantity || p.soldQuantity) || 0) + vp.quantity;
            await supabase.from('products').update({ current_stock: newQty, sold_quantity: newSold }).eq('id', p.id);
          }
        }

        await supabase.from('staff_commissions').insert([{
          staff_id: customerStaffId,
          visit_id: visitData.id,
          service_amount: serviceTotal,
          commission_amount: commissionAmount
        }]);

        toast.success('Customer added and visit recorded successfully!');
      }
      setIsCustomerModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save customer');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this customer? This action cannot be undone.')) return;
    try {
      await customerService.deleteCustomer(id);
      toast.success('Customer deleted successfully');
      loadData();
    } catch (err: any) {
      toast.error('Failed to delete customer');
    }
  };

  const openRecordVisit = (customer: Customer) => {
    setVisitCustomer(customer);
    setVisitToEdit(null);
    setVisitServices([{ serviceId: '' }]);
    setVisitProducts([]);
    setVisitStaffId('');
    setVisitFinalAmount('');
    setVisitPaymentMethod('Cash');
    setIsRecordVisitOpen(true);
  };

  const openEditFullVisit = (visit: any) => {
    setVisitCustomer(selectedCustomer || null);
    setVisitToEdit(visit);
    
    const vServices = (visit.visit_services || []).map((vs: any) => ({
      serviceId: services.find((s: any) => s.service_name === vs.service_name)?.id?.toString() || ''
    })).filter((vs: any) => vs.serviceId);
    setVisitServices(vServices.length > 0 ? vServices : [{ serviceId: '' }]);
    
    const vProducts = (visit.visit_products || []).map((vp: any) => ({
      productId: products.find((p: any) => p.name === vp.product_name)?.id?.toString() || '',
      quantity: vp.quantity || 1
    })).filter((vp: any) => vp.productId);
    setVisitProducts(vProducts);
    
    setVisitStaffId(visit.staff_id?.toString() || '');
    setVisitFinalAmount(visit.grand_total?.toString() || '');
    setVisitPaymentMethod(visit.payment_method || 'Cash');
    
    setIsRecordVisitOpen(true);
  };

  const handleRecordVisit = async () => {
    if (!visitCustomer) return;
    const filledServices = visitServices.filter(vs => vs.serviceId);
    const filledProducts = visitProducts.filter(vp => vp.productId);
    if (filledServices.length === 0 && filledProducts.length === 0) {
      toast.error('Please select at least one service or product.');
      return;
    }
    if (!visitStaffId) {
      toast.error('Please select a staff member.');
      return;
    }
    setIsSubmittingVisit(true);
    try {
      let serviceTotal = 0;
      const parsedServiceNames = filledServices.map(vs => {
        const s = services.find(x => x.id.toString() === vs.serviceId.toString());
        if (s) { serviceTotal += Number(s.price); return s.service_name; }
        return '';
      }).filter(Boolean);

      let productTotal = 0;
      const parsedProductNames = filledProducts.map(vp => {
        const p = products.find(x => x.id.toString() === vp.productId.toString());
        if (p) { productTotal += Number(p.selling_price || 0) * vp.quantity; return p.name; }
        return '';
      }).filter(Boolean);

      const originalTotal = serviceTotal + productTotal;
      const finalAmt = visitFinalAmount !== '' ? Number(visitFinalAmount) : originalTotal;
      const discountAmt = Math.max(0, originalTotal - finalAmt);
      const grandTotal = finalAmt;

      const selectedStaffMember = staff.find(s => s.id.toString() === visitStaffId.toString());
      const commissionRate = selectedStaffMember ? Number(selectedStaffMember.commission_rate || 10) : 10;
      const commissionAmount = serviceTotal * (commissionRate / 100);

      let currentVisitId = '';

      if (visitToEdit) {
        currentVisitId = visitToEdit.id;
        // Revert old product stock
        const { data: oldVp } = await supabase.from('visit_products').select('product_id, quantity').eq('visit_id', currentVisitId);
        if (oldVp) {
          for (const vp of oldVp) {
            const p = products.find(x => x.id === vp.product_id);
            if (p) {
              await supabase.from('products').update({
                current_stock: Number(p.current_stock || p.currentStock || 0) + Number(vp.quantity),
                sold_quantity: Math.max(0, Number(p.sold_quantity || p.soldQuantity || 0) - Number(vp.quantity))
              }).eq('id', vp.product_id);
            }
          }
        }
        
        // Delete old relations
        await supabase.from('visit_services').delete().eq('visit_id', currentVisitId);
        await supabase.from('visit_products').delete().eq('visit_id', currentVisitId);
        await supabase.from('staff_commissions').delete().eq('visit_id', currentVisitId);
        
        // Update visit record
        const { error: visitErr } = await supabase.from('customer_visits').update({
          service_total: serviceTotal,
          product_total: productTotal,
          original_total: originalTotal,
          discount_amount: discountAmt,
          grand_total: grandTotal,
          staff_id: visitStaffId,
          payment_method: visitPaymentMethod
        }).eq('id', currentVisitId);
        if (visitErr) throw visitErr;
        
      } else {
        // 1. Insert the visit
        const { data: visitData, error: visitErr } = await supabase
          .from('customer_visits')
          .insert([{
            customer_id: visitCustomer.id,
            service_total: serviceTotal,
            product_total: productTotal,
            original_total: originalTotal,
            discount_amount: discountAmt,
            grand_total: grandTotal,
            staff_id: visitStaffId,
            payment_method: visitPaymentMethod
          }])
          .select()
          .single();
        if (visitErr) throw visitErr;
        currentVisitId = visitData.id;
      }

      // 2. Insert visit_services
      const vServicesData = filledServices.map(vs => {
        const s = services.find(x => x.id.toString() === vs.serviceId.toString())!;
        return { visit_id: currentVisitId, service_id: s.id, service_name: s.service_name, price: Number(s.price) };
      });
      if (vServicesData.length > 0) {
        const { error: vsErr } = await supabase.from('visit_services').insert(vServicesData);
        if (vsErr) throw vsErr;
      }

      // 3. Insert visit_products & update stock
      if (filledProducts.length > 0) {
        const vProductsData = filledProducts.map(vp => {
          const p = products.find(x => x.id.toString() === vp.productId.toString())!;
          return { visit_id: currentVisitId, product_id: p.id, product_name: p.name, quantity: vp.quantity, price: Number(p.selling_price || p.sellingPrice || 0) * vp.quantity };
        });
        const { error: vpErr } = await supabase.from('visit_products').insert(vProductsData);
        if (vpErr) throw vpErr;

        for (const vp of vProductsData) {
          const p = products.find(x => x.id === vp.product_id)!;
          const newQty = Number(p.current_stock || p.currentStock || 0) - vp.quantity;
          const newSold = Number(p.sold_quantity || p.soldQuantity || 0) + vp.quantity;
          await supabase.from('products').update({ current_stock: newQty, sold_quantity: newSold }).eq('id', p.id);
        }
      }

      // 4. Insert commission
      const { error: commErr } = await supabase.from('staff_commissions').insert([{
        staff_id: visitStaffId,
        visit_id: currentVisitId,
        service_amount: serviceTotal,
        commission_amount: commissionAmount
      }]);
      if (commErr) throw commErr;

      // 5. Update customer aggregate: amount_paid, services_taken, staff_served
      const difference = visitToEdit ? (grandTotal - Number(visitToEdit.grand_total)) : grandTotal;
      const updatedAmountPaid = Number(visitCustomer.amountPaid || 0) + difference;
      const existingServices = visitCustomer.services_taken || [];
      const newServicesList = Array.from(new Set([...existingServices, ...parsedServiceNames]));
      const existingStaff = visitCustomer.staff_served || [];
      const staffName = selectedStaffMember?.name || selectedStaffMember?.staff_name || '';
      const newStaffList = staffName && !existingStaff.includes(staffName) ? [...existingStaff, staffName] : existingStaff;

      await supabase.from('customers').update({
        amount_paid: updatedAmountPaid,
        services_taken: newServicesList,
        staff_served: newStaffList
      }).eq('id', visitCustomer.id);

      // Force history refresh if modal is open
      if (visitToEdit && selectedCustomerForHistory) {
        const [{ data: historyData }] = await Promise.all([
          supabase.from('customer_visits').select('*, visit_services(*), visit_products(*)').eq('customer_id', selectedCustomerForHistory).eq('is_deleted', false).order('visit_date', { ascending: false })
        ]);
        setSelectedHistory(historyData || []);
      }

      toast.success(`Visit ${visitToEdit ? 'updated' : 'recorded'} for ${visitCustomer.name}! ₹${grandTotal.toLocaleString()}`);
      setIsRecordVisitOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to record visit');
    } finally {
      setIsSubmittingVisit(false);
    }
  };

  // Derived Data (no longer filtered locally)
  const selectedCustomer = customers.find(c => c.id === selectedCustomerForHistory);

  // We can't synchronously calculate total spend across 50k customers in UI for the table.
  // The 'amount_paid' field on customer table aggregates this on save, let's use it!
  const getCustomerTotalSpend = (customer: Customer) => {
    return customer.amountPaid || 0;
  };
  
  // Similarly, visit count isn't readily available without an RPC. 
  // For now we omit or leave as 'History' button. Let's omit the generic visit count in list for performance.

  const processedCustomers = useMemo(() => {
    let result = [...customers];
    
    if (filterTime !== 'all') {
      result = result.filter(c => {
        if (!c.createdAt) return false;
        const date = new Date(c.createdAt);
        if (filterTime === 'today') return isToday(date);
        if (filterTime === 'week') return isThisWeek(date, { weekStartsOn: 1 });
        if (filterTime === 'month') return isThisMonth(date);
        return true;
      });
    }
    
    result.sort((a, b) => {
      if (sortBy === 'spend') {
        return getCustomerTotalSpend(b) - getCustomerTotalSpend(a);
      } else if (sortBy === 'alphabet') {
        return a.name.localeCompare(b.name);
      } else {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      }
    });
    
    return result;
  }, [customers, filterTime, sortBy]);

  const groupedCustomers = useMemo(() => {
    if (sortBy === 'spend') {
      return { 'Sorted by Spend': processedCustomers };
    }
    if (sortBy === 'alphabet') {
      return processedCustomers.reduce((acc, c) => {
        const letter = c.name.charAt(0).toUpperCase();
        if (!acc[letter]) acc[letter] = [];
        acc[letter].push(c);
        return acc;
      }, {} as Record<string, Customer[]>);
    }
    
    return processedCustomers.reduce((acc, c) => {
      if (!c.createdAt) {
        if (!acc['Unknown Date']) acc['Unknown Date'] = [];
        acc['Unknown Date'].push(c);
        return acc;
      }
      const date = new Date(c.createdAt);
      let groupKey = format(date, 'MMMM yyyy');
      if (isToday(date)) groupKey = `Today (${format(date, 'EEEE')})`;
      else if (isYesterday(date)) groupKey = `Yesterday (${format(date, 'EEEE')})`;
      else if (isThisWeek(date, { weekStartsOn: 1 })) groupKey = `This Week (${format(date, 'EEEE, dd MMM')})`;
      else groupKey = format(date, 'EEEE, dd MMM yyyy');
      
      if (!acc[groupKey]) acc[groupKey] = [];
      acc[groupKey].push(c);
      return acc;
    }, {} as Record<string, Customer[]>);
  }, [processedCustomers, sortBy]);


  return (
    <div className="space-y-8 relative max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-4xl font-light tracking-tight text-white">Customers</h2>
          <p className="text-white/50 mt-2 font-light tracking-wide">Manage your client relationships and view their history.</p>
        </div>
        <button 
          onClick={openAddModal}
          className="btn-primary"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Customer
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="glass-card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-black/40/5 p-3 rounded-2xl border border-white/20">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-xs font-bold tracking-[0.1em] text-white/60 uppercase">Total Customers</dt>
                <dd className="text-3xl font-light text-white mt-1">{stats.totalCustomers}</dd>
              </dl>
            </div>
          </div>
        </div>
        <div className="glass-card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-black/40/5 p-3 rounded-2xl border border-white/20">
              <UserPlus className="h-6 w-6 text-white" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-xs font-bold tracking-[0.1em] text-white/60 uppercase">New This Month</dt>
                <dd className="text-3xl font-light text-white mt-1">{stats.newThisMonth}</dd>
              </dl>
            </div>
          </div>
        </div>
        <div className="glass-card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-black/40/5 p-3 rounded-2xl border border-white/20">
              <IndianRupee className="h-6 w-6 text-white" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-xs font-bold tracking-[0.1em] text-white/60 uppercase">Lifetime Revenue</dt>
                <dd className="text-3xl font-light text-white mt-1">₹{stats.totalRevenue.toLocaleString()}</dd>
              </dl>
            </div>
          </div>
        </div>
        <div className="glass-card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-black/40/5 p-3 rounded-2xl border border-white/20">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-xs font-bold tracking-[0.1em] text-white/60 uppercase">Average Spend</dt>
                <dd className="text-3xl font-light text-white mt-1">₹{Math.round(stats.avgSpend).toLocaleString()}</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="flex items-center w-full max-w-md glass-panel px-4 py-3 focus-within:ring-1 focus-within:ring-white/30 transition-all">
          <Search className="h-5 w-5 text-white/40 mr-3" />
          <input
            type="text"
            placeholder="Search by name or phone..."
            className="bg-transparent outline-none w-full text-sm text-white placeholder-white/40"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-2">
          <div className="glass-panel px-3 py-2 flex items-center gap-2">
            <Filter className="w-4 h-4 text-white/60" />
            <select
              value={filterTime}
              onChange={(e) => setFilterTime(e.target.value as any)}
              className="bg-transparent text-sm text-white outline-none border-none appearance-none pr-4 cursor-pointer"
            >
              <option value="all" className="bg-[#1a1a1a]">All Time</option>
              <option value="today" className="bg-[#1a1a1a]">Today</option>
              <option value="week" className="bg-[#1a1a1a]">This Week</option>
              <option value="month" className="bg-[#1a1a1a]">This Month</option>
            </select>
          </div>
          <div className="glass-panel px-3 py-2 flex items-center gap-2">
            <SortDesc className="w-4 h-4 text-white/60" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-sm text-white outline-none border-none appearance-none pr-4 cursor-pointer"
            >
              <option value="recent" className="bg-[#1a1a1a]">Recently Added</option>
              <option value="spend" className="bg-[#1a1a1a]">Highest Spend</option>
              <option value="alphabet" className="bg-[#1a1a1a]">Alphabetical</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-white/50">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
            Loading customers...
          </div>
        ) : error ? (
          <div className="p-12 text-center text-danger">
            <p>{error}</p>
            <button onClick={loadData} className="mt-4 text-sm font-semibold underline text-white">Try Again</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-white">
              <thead className="bg-black/40/5 text-white/60 text-xs uppercase font-bold tracking-wider border-b border-white/10">
                <tr>
                  <th className="px-6 py-5">Customer</th>
                  <th className="px-6 py-5">Contact</th>
                  <th className="px-6 py-5">Lifetime Spend</th>
                  <th className="px-6 py-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {processedCustomers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-16 text-white/60">
                      <User className="h-10 w-10 mx-auto mb-4 opacity-50" />
                      <p className="text-base font-light tracking-wide text-white">No customers found</p>
                    </td>
                  </tr>
                )}
                
                {Object.entries(groupedCustomers).map(([groupName, groupCustomers]) => (
                  <React.Fragment key={groupName}>
                    {/* Group Header */}
                    <tr className="bg-black/60">
                      <td colSpan={4} className="px-6 py-3 text-xs font-bold tracking-widest text-primary uppercase border-y border-white/5">
                        {groupName} <span className="text-white/40 ml-2">({groupCustomers.length})</span>
                      </td>
                    </tr>
                    
                    {/* Customers in this group */}
                    {groupCustomers.map((customer) => {
                      const initials = customer.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
                      
                      return (
                        <tr key={customer.id} className="hover:bg-black/40 transition-colors group">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-4">
                              <div className="h-11 w-11 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0">
                                {initials}
                              </div>
                              <div>
                                <div className="font-medium text-white text-base">{customer.name}</div>
                                {customer.dob && <div className="text-xs text-white/60 mt-1 uppercase tracking-wide">DOB: {format(new Date(customer.dob), 'dd MMM yyyy')}</div>}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-white/60 font-light">
                            <div className="flex items-center gap-2">
                              {customer.phone}
                              {customer.phone && (
                                <a 
                                  href={`https://wa.me/${customer.phone.replace(/\D/g, '')}?text=${encodeURIComponent('Hello from VJ Hair Salon!')}`}
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-[#25D366] hover:text-[#128C7E] transition-colors bg-[#25D366]/10 p-1.5 rounded-lg"
                                  title="Message on WhatsApp"
                                >
                                  <MessageCircle className="w-4 h-4" />
                                </a>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="font-light text-white text-lg">
                              ₹{getCustomerTotalSpend(customer).toLocaleString()}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => openRecordVisit(customer)}
                                title="Record Visit"
                                className="p-2 text-emerald-400 hover:bg-emerald-400/10 rounded-xl transition-colors"
                              >
                                <ClipboardList className="w-4 h-4" />
                              </button>
                              <button onClick={() => setSelectedCustomerForHistory(customer.id)} className="p-2 text-white hover:bg-black/5 rounded-xl transition-colors">
                                <CalendarIcon className="w-4 h-4" />
                              </button>
                              <button onClick={() => openEditModal(customer)} className="p-2 text-white/60 hover:bg-black/5 hover:text-white rounded-xl transition-colors">
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDelete(customer.id)} className="p-2 text-danger hover:bg-danger/10 rounded-xl transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
            
            {/* Pagination Controls */}
            {totalCount > limit && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-black/40">
                <div className="text-sm text-white/60">
                  Showing <span className="font-medium text-white">{((page - 1) * limit) + 1}</span> to <span className="font-medium text-white">{Math.min(page * limit, totalCount)}</span> of <span className="font-medium text-white">{totalCount}</span> customers
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-2 rounded-lg border border-white/10 bg-black/40 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5 text-white" />
                  </button>
                  <button 
                    onClick={() => setPage(p => p + 1)}
                    disabled={page * limit >= totalCount}
                    className="p-2 rounded-lg border border-white/10 bg-black/40 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add/Edit Customer Modal (No Billing) */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md flex flex-col animate-in zoom-in-95 duration-200 max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-white/10 bg-black/40 rounded-t-2xl shrink-0">
              <h3 className="text-xl font-light tracking-tight text-white">{customerToEdit ? 'Edit Customer' : 'Add New Customer'}</h3>
              <button onClick={() => setIsCustomerModalOpen(false)} className="p-2 hover:bg-black/5 rounded-full text-white/60 transition-colors">
                <X className="w-5 h-5"/>
              </button>
            </div>
            <form onSubmit={handleSubmit(onSubmitCustomer)} className="flex flex-col flex-1 overflow-hidden min-h-0">
              <div className="p-6 space-y-5 bg-black/60 overflow-y-auto custom-scrollbar flex-1">
                <div>
                  <label className="block text-xs font-bold tracking-widest text-white/60 uppercase mb-2">Full Name *</label>
                  <input type="text" {...register("name")} className="glass-input w-full px-4 py-3" placeholder="e.g. Jane Doe" />
                  {errors.name && <p className="text-danger text-xs mt-1.5">{errors.name.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-bold tracking-widest text-white/60 uppercase mb-2">Phone Number *</label>
                  <input type="tel" {...register("phone")} className="glass-input w-full px-4 py-3" placeholder="e.g. 9876543210" />
                  {errors.phone && <p className="text-danger text-xs mt-1.5">{errors.phone.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-bold tracking-widest text-white/60 uppercase mb-2">Personal Note (Optional)</label>
                  <textarea {...register("notes")} className="glass-input w-full px-4 py-3 min-h-[80px]" placeholder="e.g. Likes a specific type of coffee, allergic to some products..." />
                  {errors.notes && <p className="text-danger text-xs mt-1.5">{errors.notes.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-bold tracking-widest text-white/60 uppercase mb-2">Date of Birth</label>
                  <div className="grid grid-cols-3 gap-3">
                    <select {...register("dobDay")} className="glass-input w-full px-4 py-3 appearance-none cursor-pointer bg-black/40">
                      <option value="" className="text-white/60">Day</option>
                      {Array.from({length: 31}, (_, i) => i + 1).map(d => (
                        <option key={d} value={d.toString().padStart(2, '0')} className="text-white">{d}</option>
                      ))}
                    </select>
                    <select {...register("dobMonth")} className="glass-input w-full px-4 py-3 appearance-none cursor-pointer bg-black/40">
                      <option value="" className="text-white/60">Month</option>
                      {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                        <option key={m} value={m.toString().padStart(2, '0')} className="text-white">
                          {format(new Date(2000, m - 1, 1), 'MMM')}
                        </option>
                      ))}
                    </select>
                    <select {...register("dobYear")} className="glass-input w-full px-4 py-3 appearance-none cursor-pointer bg-black/40">
                      <option value="" className="text-white/60">Year</option>
                      {Array.from({length: 100}, (_, i) => new Date().getFullYear() - i).map(y => (
                        <option key={y} value={y} className="text-white">{y}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {!customerToEdit && (
                  <div>
                    <label className="block text-xs font-bold tracking-widest text-white/60 uppercase mb-3">Select Staff Member *</label>
                    <select 
                      value={customerStaffId} 
                      onChange={(e) => setCustomerStaffId(e.target.value)}
                      className="glass-input w-full px-4 py-3.5 appearance-none mb-2 bg-black/40"
                    >
                      <option value="" className="text-white/60">-- Choose Staff --</option>
                      {staff.map(s => <option key={s.id} value={s.id} className="text-white">{s.name || s.staff_name}</option>)}
                    </select>
                  </div>
                )}
                {!customerToEdit && (
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <label className="block text-xs font-bold tracking-widest text-white/60 uppercase">Services Taken</label>
                      <button type="button" onClick={() => setCustomerServices([...customerServices, {serviceId: ''}])} className="text-xs font-bold text-white bg-black/5 hover:bg-black/10 border border-white/10 px-3 py-1.5 rounded-lg transition-colors">
                        + Add Service
                      </button>
                    </div>
                    {customerServices.length === 0 ? (
                      <div className="text-sm text-white/60/60 font-light italic p-6 bg-black/5 rounded-2xl border border-dashed border-white/10 text-center">No services added. Click above to add.</div>
                    ) : (
                      <div className="space-y-3">
                        {customerServices.map((cs, idx) => (
                          <div key={idx} className="flex items-center gap-3">
                            <div className="flex-1">
                              <Select
                                instanceId={`customer-service-${idx}`}
                                styles={selectStyles}
                                options={serviceOptions}
                                placeholder="Search & Select Service..."
                                value={serviceOptions.flatMap(g => g.options).find(o => o.value === cs.serviceId) || null}
                                onChange={(selected: any) => {
                                  const newSvcs = [...customerServices];
                                  newSvcs[idx].serviceId = selected ? selected.value : '';
                                  setCustomerServices(newSvcs);
                                }}
                                isClearable
                                classNamePrefix="react-select"
                              />
                            </div>
                            <button type="button" onClick={() => setCustomerServices(customerServices.filter((_, i) => i !== idx))} className="p-3 text-danger hover:bg-danger/20 rounded-xl bg-danger/10 border border-danger/20 transition-colors">
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {!customerToEdit && (
                  /* Products Purchased Section */
                  <div className="mt-5">
                    <div className="flex justify-between items-center mb-3">
                      <label className="block text-xs font-bold tracking-widest text-white/60 uppercase">Products Purchased</label>
                      <button type="button" onClick={() => setCustomerProducts([...customerProducts, {productId: '', quantity: 1}])} className="text-xs font-bold text-[var(--gold)] bg-[var(--gold)]/10 hover:bg-[var(--gold)]/20 border border-[var(--gold)]/20 px-3 py-1.5 rounded-lg transition-colors flex items-center">
                        <Package className="w-3 h-3 mr-1" /> Add Product
                      </button>
                    </div>
                    {customerProducts.length === 0 ? (
                      <div className="text-sm text-white/60/60 font-light italic p-6 bg-black/5 rounded-2xl border border-dashed border-white/10 text-center">No products added. Click above to add.</div>
                    ) : (
                      <div className="space-y-3">
                        {customerProducts.map((cp, idx) => (
                          <div key={idx} className="flex items-center gap-3">
                            <select 
                              value={cp.productId} 
                              onChange={(e) => {
                                const newProds = [...customerProducts];
                                newProds[idx].productId = e.target.value;
                                setCustomerProducts(newProds);
                              }}
                              className="glass-input flex-1 px-4 py-3 appearance-none bg-black/40 w-full"
                            >
                              <option value="" className="text-white/60">-- Select Product --</option>
                              {products.filter(p => p.current_stock > 0 || p.currentStock > 0 || cp.productId === p.id.toString()).map(p => (
                                <option key={p.id} value={p.id} className="text-white">
                                  {p.name} - ₹{p.selling_price || p.sellingPrice} (Stock: {p.current_stock || p.currentStock})
                                </option>
                              ))}
                            </select>
                            <input 
                              type="number" 
                              min="1"
                              max={products.find(p => p.id.toString() === cp.productId)?.current_stock || 99}
                              value={cp.quantity || ''}
                              onChange={(e) => {
                                const newProds = [...customerProducts];
                                newProds[idx].quantity = parseInt(e.target.value) || 1;
                                setCustomerProducts(newProds);
                              }}
                              className="glass-input px-3 py-3 text-center bg-black/40 shrink-0"
                              style={{ width: '80px', flexBasis: '80px' }}
                              placeholder="Qty"
                            />
                            <button type="button" onClick={() => setCustomerProducts(customerProducts.filter((_, i) => i !== idx))} className="p-3 text-danger hover:bg-danger/20 rounded-xl bg-danger/10 border border-danger/20 transition-colors shrink-0">
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                  {!customerToEdit && (customerServices.length > 0 || customerProducts.length > 0) && (() => {
                    const calcSvcTotal = customerServices.reduce((sum, cs) => sum + Number(services.find(s => s.id.toString() === cs.serviceId.toString())?.price || 0), 0);
                    const calcProdTotal = customerProducts.reduce((sum, cp) => sum + (Number(products.find(p => p.id.toString() === cp.productId.toString())?.selling_price || products.find(p => p.id.toString() === cp.productId.toString())?.sellingPrice || 0) * cp.quantity), 0);
                    const calcTotal = calcSvcTotal + calcProdTotal;
                    const finalAmt = addFinalAmount !== '' ? Number(addFinalAmount) : calcTotal;
                    const discountAmt = Math.max(0, calcTotal - finalAmt);
                    return (
                      <div className="mt-6 space-y-3">
                        <div className="bg-black/20 p-5 rounded-xl border border-[var(--gold)]/30 flex justify-between items-center">
                          <span className="text-xs font-bold tracking-widest text-[var(--gold)] uppercase">Calculated Total</span>
                          <span className="text-2xl font-light text-white">₹{calcTotal.toLocaleString()}</span>
                        </div>
                        <div>
                          <label className="block text-xs font-bold tracking-widest text-white/60 uppercase mb-2">Final Amount (Edit for Discount)</label>
                          <input
                            type="number"
                            value={addFinalAmount}
                            onChange={e => setAddFinalAmount(e.target.value)}
                            placeholder={calcTotal.toString()}
                            className="glass-input w-full px-4 py-3"
                          />
                          {discountAmt > 0 && (
                            <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1">
                              <Tag className="w-3 h-3" /> ₹{discountAmt.toLocaleString()} discount applied — Final: ₹{finalAmt.toLocaleString()}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="block text-xs font-bold tracking-widest text-white/60 uppercase mb-2">Payment Method</label>
                          <select
                            value={addPaymentMethod}
                            onChange={(e) => setAddPaymentMethod(e.target.value)}
                            className="glass-input w-full px-4 py-3 appearance-none bg-black/40"
                          >
                            <option value="Cash" className="text-white">Cash</option>
                            <option value="UPI" className="text-white">UPI</option>
                          </select>
                        </div>
                      </div>
                    );
                  })()}
              </div>
              <div className="p-6 border-t border-white/10 bg-black/40 rounded-b-2xl shrink-0 flex justify-end gap-3">
                <button type="button" onClick={() => setIsCustomerModalOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="btn-primary disabled:opacity-50">
                  {customerToEdit ? 'Save Changes' : 'Add Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Visit Modal */}
      {isRecordVisitOpen && visitCustomer && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg flex flex-col animate-in zoom-in-95 duration-200 max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-white/10 bg-black/40 rounded-t-2xl shrink-0">
              <div>
                <h3 className="text-xl font-light tracking-tight text-white flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-emerald-400" />
                  Record Visit
                </h3>
                <p className="text-sm text-white/50 mt-1 font-light">{visitCustomer.name} &middot; {visitCustomer.phone}</p>
              </div>
              <button onClick={() => setIsRecordVisitOpen(false)} className="p-2 hover:bg-black/5 rounded-full text-white/60 transition-colors">
                <X className="w-5 h-5"/>
              </button>
            </div>

            <div className="p-6 space-y-6 bg-black/60 overflow-y-auto custom-scrollbar flex-1">
              {/* Staff Selector */}
              <div>
                <label className="block text-xs font-bold tracking-widest text-white/60 uppercase mb-2">Staff Member *</label>
                <select
                  value={visitStaffId}
                  onChange={(e) => setVisitStaffId(e.target.value)}
                  className="glass-input w-full px-4 py-3 appearance-none bg-black/40"
                >
                  <option value="">-- Choose Staff --</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.name || s.staff_name}</option>)}
                </select>
              </div>

              {/* Services */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-xs font-bold tracking-widest text-white/60 uppercase flex items-center gap-1">
                    <Scissors className="w-3 h-3" /> Services *
                  </label>
                  <button
                    type="button"
                    onClick={() => setVisitServices([...visitServices, { serviceId: '' }])}
                    className="text-xs font-bold text-white bg-black/5 hover:bg-black/10 border border-white/10 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    + Add Service
                  </button>
                </div>
                {visitServices.length === 0 ? (
                  <div className="text-sm text-white/40 font-light italic p-4 bg-black/5 rounded-xl border border-dashed border-white/10 text-center">No services added.</div>
                ) : (
                  <div className="space-y-3">
                    {visitServices.map((vs, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <div className="flex-1">
                          <Select
                            instanceId={`visit-service-${idx}`}
                            styles={selectStyles}
                            options={serviceOptions}
                            placeholder="Search & Select Service..."
                            value={serviceOptions.flatMap(g => g.options).find(o => o.value === vs.serviceId) || null}
                            onChange={(selected: any) => {
                              const updated = [...visitServices];
                              updated[idx].serviceId = selected ? selected.value : '';
                              setVisitServices(updated);
                            }}
                            isClearable
                            classNamePrefix="react-select"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setVisitServices(visitServices.filter((_, i) => i !== idx))}
                          className="p-3 text-danger hover:bg-danger/20 rounded-xl bg-danger/10 border border-danger/20 transition-colors shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Products */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-xs font-bold tracking-widest text-white/60 uppercase flex items-center gap-1">
                    <Package className="w-3 h-3" /> Products
                  </label>
                  <button
                    type="button"
                    onClick={() => setVisitProducts([...visitProducts, { productId: '', quantity: 1 }])}
                    className="text-xs font-bold text-[var(--gold)] bg-[var(--gold)]/10 hover:bg-[var(--gold)]/20 border border-[var(--gold)]/20 px-3 py-1.5 rounded-lg transition-colors flex items-center"
                  >
                    <Package className="w-3 h-3 mr-1" /> Add Product
                  </button>
                </div>
                {visitProducts.length === 0 ? (
                  <div className="text-sm text-white/40 font-light italic p-4 bg-black/5 rounded-xl border border-dashed border-white/10 text-center">No products added.</div>
                ) : (
                  <div className="space-y-3">
                    {visitProducts.map((vp, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <select
                          value={vp.productId}
                          onChange={(e) => {
                            const updated = [...visitProducts];
                            updated[idx].productId = e.target.value;
                            setVisitProducts(updated);
                          }}
                          className="glass-input flex-1 px-4 py-3 appearance-none bg-black/40"
                        >
                          <option value="">-- Select Product --</option>
                          {products.filter(p => p.current_stock > 0 || vp.productId === p.id.toString()).map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name} - ₹{p.selling_price} (Stock: {p.current_stock})
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="1"
                          max={products.find(p => p.id.toString() === vp.productId)?.current_stock || 99}
                          value={vp.quantity || ''}
                          onChange={(e) => {
                            const updated = [...visitProducts];
                            updated[idx].quantity = parseInt(e.target.value) || 1;
                            setVisitProducts(updated);
                          }}
                          className="glass-input px-3 py-3 text-center bg-black/40 shrink-0"
                          style={{ width: '80px' }}
                          placeholder="Qty"
                        />
                        <button
                          type="button"
                          onClick={() => setVisitProducts(visitProducts.filter((_, i) => i !== idx))}
                          className="p-3 text-danger hover:bg-danger/20 rounded-xl bg-danger/10 border border-danger/20 transition-colors shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Live Total + Discount */}
              {(visitServices.some(vs => vs.serviceId) || visitProducts.some(vp => vp.productId)) && (() => {
                const calcSvc = visitServices.reduce((sum, vs) => sum + Number(services.find(s => s.id.toString() === vs.serviceId)?.price || 0), 0);
                const calcProd = visitProducts.reduce((sum, vp) => sum + (Number(products.find(p => p.id.toString() === vp.productId)?.selling_price || 0) * vp.quantity), 0);
                const calcTotal = calcSvc + calcProd;
                const finalAmt = visitFinalAmount !== '' ? Number(visitFinalAmount) : calcTotal;
                const discountAmt = Math.max(0, calcTotal - finalAmt);
                return (
                  <div className="space-y-3">
                    <div className="bg-black/20 p-5 rounded-xl border border-emerald-400/30 flex justify-between items-center">
                      <span className="text-xs font-bold tracking-widest text-emerald-400 uppercase">Calculated Total</span>
                      <span className="text-2xl font-light text-white">₹{calcTotal.toLocaleString()}</span>
                    </div>
                    <div>
                      <label className="block text-xs font-bold tracking-widest text-white/60 uppercase mb-2">Final Amount (Edit for Discount)</label>
                      <input
                        type="number"
                        value={visitFinalAmount}
                        onChange={e => setVisitFinalAmount(e.target.value)}
                        placeholder={calcTotal.toString()}
                        className="glass-input w-full px-4 py-3"
                      />
                      {discountAmt > 0 && (
                        <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1">
                          <Tag className="w-3 h-3" /> ₹{discountAmt.toLocaleString()} discount applied — Final: ₹{finalAmt.toLocaleString()}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-bold tracking-widest text-white/60 uppercase mb-2">Payment Method</label>
                      <select
                        value={visitPaymentMethod}
                        onChange={(e) => setVisitPaymentMethod(e.target.value)}
                        className="glass-input w-full px-4 py-3 appearance-none bg-black/40"
                      >
                        <option value="Cash" className="text-white">Cash</option>
                        <option value="UPI" className="text-white">UPI</option>
                      </select>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="p-6 border-t border-white/10 bg-black/40 rounded-b-2xl shrink-0 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsRecordVisitOpen(false)}
                className="btn-secondary"
                disabled={isSubmittingVisit}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRecordVisit}
                disabled={isSubmittingVisit}
                className="btn-primary disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmittingVisit ? (
                  <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Saving...</>
                ) : (
                  <><ClipboardList className="w-4 h-4" /> Record Visit</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Profile History Modal */}
      {selectedCustomerForHistory && selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between p-8 border-b border-white/10 bg-black/40 shrink-0">
              <div className="flex items-center gap-6">
                <div className="h-16 w-16 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary-foreground font-bold text-xl shrink-0 shadow-sm">
                  {selectedCustomer.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-3xl font-light tracking-tight text-white">{selectedCustomer.name}</h3>
                  {selectedCustomerRewards && (
                    <div className="flex items-center gap-2 mt-2 mb-1">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${selectedCustomerRewards.membership_tier === 'Gold' ? 'bg-[#FFDF00]/10 text-[#B8860B] border-[#FFDF00]/30' : selectedCustomerRewards.membership_tier === 'Silver' ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-primary/5 text-primary border-primary/20'}`}>
                        <Star className="w-3 h-3 mr-1" /> {selectedCustomerRewards.membership_tier} Member
                      </span>
                      <span className="text-sm font-bold text-white/60">{selectedCustomerRewards.points} pts</span>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-x-6 gap-y-1 mt-1 text-sm text-white/60 tracking-wide uppercase">
                    <span className="flex items-center"><User className="w-4 h-4 mr-2"/> {selectedCustomer.phone}</span>
                    {selectedCustomer.dob && <span>DOB: {format(new Date(selectedCustomer.dob), 'dd MMM yyyy')}</span>}
                    <span>Joined {format(new Date(selectedCustomer.createdAt), 'MMM yyyy')}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setSelectedCustomerForHistory(null)} className="p-2 hover:bg-black/5 rounded-full text-white/60 transition-colors">
                <X className="w-6 h-6"/>
              </button>
            </div>
            <div className="p-8 overflow-y-auto bg-black/60 flex-1 custom-scrollbar">
              <h4 className="text-xs font-bold tracking-[0.2em] text-white/60 uppercase mb-6 flex items-center">
                <Receipt className="w-4 h-4 mr-2" /> Visit History
              </h4>
              {selectedHistory.length === 0 ? (
                <div className="text-center py-12 text-white/60/60 bg-black/5 rounded-2xl border border-dashed border-white/10">
                  <CalendarIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-base font-light tracking-wide">No past visits recorded.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {selectedHistory.map((visit: any, index) => {
                    const servicesList = visit.visit_services || [];
                    const productsList = visit.visit_products || [];
                    
                    return (
                      <div key={visit.id} className="bg-black/40 p-6 rounded-2xl border border-white/10 shadow-sm flex flex-col md:flex-row gap-6 relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-1 h-full bg-primary/40 group-hover:bg-primary transition-colors"></div>
                        <div className="shrink-0 flex flex-col justify-center w-32 border-r border-white/10 pr-6">
                          <span className="text-xs font-bold tracking-widest text-white/60 uppercase mb-1">Date</span>
                          <span className="text-lg font-light text-white">{format(new Date(visit.visit_date), 'dd MMM')}</span>
                          <span className="text-sm text-white/60">{format(new Date(visit.visit_date), 'yyyy')}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          {servicesList.length > 0 && (
                            <div className="mb-4">
                              <span className="text-xs font-bold tracking-widest text-white/60 uppercase mb-2 flex items-center">
                                <Scissors className="w-3 h-3 mr-1" /> Services
                              </span>
                              <div className="flex flex-wrap gap-2">
                                {servicesList.map((vs: any, idx: number) => (
                                  <span key={idx} className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-medium bg-black/5 text-white border border-white/10">
                                    {vs.service_name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {productsList.length > 0 && (
                            <div>
                              <span className="text-xs font-bold tracking-widest text-white/60 uppercase mb-2 flex items-center">
                                <Package className="w-3 h-3 mr-1" /> Products
                              </span>
                              <div className="flex flex-wrap gap-2">
                                {productsList.map((vp: any, idx: number) => (
                                  <span key={idx} className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-medium bg-black/5 text-white border border-white/10">
                                    {vp.quantity}x {vp.product_name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="shrink-0 flex flex-col justify-center items-end pl-6 border-l border-white/10 min-w-[120px] gap-3">
                          <div>
                            <span className="text-xs font-bold tracking-widest text-white/60 uppercase mb-1 block text-right">Total</span>
                            <span className="text-2xl font-light text-white">₹{visit.grand_total}</span>
                            {visit.payment_method && (
                              <span className={`text-[10px] mt-1 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider block w-max ml-auto ${visit.payment_method === 'UPI' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                                {visit.payment_method}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                generateInvoicePDF({
                                  invoiceNumber: visit.id.substring(0, 8).toUpperCase(),
                                  date: visit.visit_date,
                                  customerName: selectedCustomer.name,
                                  customerPhone: selectedCustomer.phone,
                                  services: servicesList.map((s: any) => ({ name: s.service_name, quantity: 1, price: s.price || 0, amount: s.price || 0 })),
                                  products: productsList.map((p: any) => ({ name: p.product_name, quantity: p.quantity, price: p.price || 0, amount: (p.price || 0) * p.quantity })),
                                  subtotal: visit.grand_total,
                                  tax: 0,
                                  discount: 0,
                                  grandTotal: visit.grand_total,
                                  paymentMethod: visit.payment_method
                                });
                              }}
                              className="text-xs font-bold px-3 py-1.5 bg-black/5 hover:bg-black/10 text-white rounded-lg border border-white/10 transition-colors flex items-center"
                            >
                              <Download className="w-3 h-3 mr-1" /> Invoice
                            </button>
                            <button
                              onClick={() => openEditFullVisit(visit)}
                              className="p-1.5 hover:bg-white/10 text-white/60 rounded-lg transition-colors border border-transparent hover:border-white/20"
                              title="Edit Visit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteVisit(visit.id)}
                              className="p-1.5 hover:bg-danger/20 text-danger rounded-lg transition-colors border border-transparent hover:border-danger/30"
                              title="Delete Visit"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
