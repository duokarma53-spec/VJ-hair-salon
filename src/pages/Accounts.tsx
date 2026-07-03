import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { PieChart as PieChartIcon, ArrowUpRight, ArrowDownRight, IndianRupee, Download, Package, Calendar, ChevronDown, ChevronUp, X as XIcon, Info } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import toast from 'react-hot-toast';

const COLORS = ['#F4E3C5', '#CD7F32', '#996515', '#C5B358', '#E6C200', '#FFDF00'];

export default function Accounts() {
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  
  const [visits, setVisits] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [drawerType, setDrawerType] = useState<'revenue' | 'expenses' | 'inventory' | 'profit' | null>(null);
  const [showFormula, setShowFormula] = useState(false);
  const [drawerVisits, setDrawerVisits] = useState<any[]>([]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const sDate = new Date(startDate);
      sDate.setHours(0, 0, 0, 0);
      const eDate = new Date(endDate);
      eDate.setHours(23, 59, 59, 999);

      let visitQuery = supabase.from('customer_visits').select('grand_total, visit_date, customer:customer_id(is_deleted)').eq('is_deleted', false)
        .gte('visit_date', sDate.toISOString()).lte('visit_date', eDate.toISOString());
        
      let expenseQuery = supabase.from('expenses').select('amount, category, date').eq('is_deleted', false)
        .gte('date', sDate.toISOString()).lte('date', eDate.toISOString());

      // Products don't have date filtering for purchased/sold quantities, so we fetch all to show lifetime inventory impact
      let productQuery = supabase.from('products').select('name, purchase_price, selling_price, purchased_quantity, sold_quantity').eq('is_deleted', false);

      // Recent Transactions Queries
      let recentVisitsQuery = supabase.from('customer_visits')
        .select('id, grand_total, visit_date, customer:customer_id(name, is_deleted)')
        .eq('is_deleted', false)
        .gte('visit_date', sDate.toISOString()).lte('visit_date', eDate.toISOString())
        .order('visit_date', { ascending: false })
        .limit(10);
        
      let recentExpensesQuery = supabase.from('expenses')
        .select('id, title, category, amount, date')
        .eq('is_deleted', false)
        .gte('date', sDate.toISOString()).lte('date', eDate.toISOString())
        .order('date', { ascending: false })
        .limit(10);

      const [vRes, eRes, pRes, rvRes, reRes] = await Promise.all([
        visitQuery,
        expenseQuery,
        productQuery,
        recentVisitsQuery,
        recentExpensesQuery
      ]);

      if (vRes.data) {
        const validVisits = vRes.data.filter((v: any) => !v.customer || !v.customer.is_deleted);
        setVisits(validVisits);
      }
      if (eRes.data) setExpenses(eRes.data);
      if (pRes.data) setProducts(pRes.data);

      const validRecentVisits = (rvRes.data || []).filter((v: any) => !v.customer || !v.customer.is_deleted);
      const incomes = validRecentVisits.map((v: any) => ({
        id: v.id,
        title: `Visit: ${v.customer?.name || 'Walk-in'}`,
        amount: Number(v.grand_total) || 0,
        type: 'income',
        date: new Date(v.visit_date)
      }));
      
      const outgoings = (reRes.data || []).map((exp: any) => ({
        id: exp.id,
        title: exp.title || exp.category,
        amount: Number(exp.amount) || 0,
        type: 'expense',
        date: new Date(exp.date)
      }));

      const merged = [...incomes, ...outgoings]
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .slice(0, 10);

      setRecentTransactions(merged);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load accounts data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('accounts-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_visits' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [startDate, endDate]);

  // Calculations
  const totalRevenue = visits.reduce((sum, v) => sum + (Number(v.grand_total) || 0), 0);
  const totalExpenses = expenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
  
  // Inventory Impact (Lifetime)
  const totalInventoryPurchasedCost = products.reduce((sum, p) => sum + ((Number(p.purchased_quantity) || 0) * (Number(p.purchase_price) || 0)), 0);
  const totalInventorySoldRevenue = products.reduce((sum, p) => sum + ((Number(p.sold_quantity) || 0) * (Number(p.selling_price) || 0)), 0);

  const netProfit = totalRevenue - totalExpenses - totalInventoryPurchasedCost;

  // Per-visit for drawer
  const drawerVisitRows = visits.slice(0, 20);

  // Category breakdown for expense drawer
  const expenseCategoryBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {};
    expenses.forEach(exp => {
      if (!breakdown[exp.category]) breakdown[exp.category] = 0;
      breakdown[exp.category] += Number(exp.amount) || 0;
    });
    return Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  // Pie Chart Data (Category breakdown)
  const expenseData = useMemo(() => {
    const breakdown: Record<string, number> = {};
    expenses.forEach(exp => {
      if (!breakdown[exp.category]) breakdown[exp.category] = 0;
      breakdown[exp.category] += Number(exp.amount) || 0;
    });
    // Add Inventory as an expense category for the pie chart representation visually
    if (totalInventoryPurchasedCost > 0) {
       breakdown['Inventory Purchases (Total)'] = totalInventoryPurchasedCost;
    }

    return Object.entries(breakdown).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
  }, [expenses, totalInventoryPurchasedCost]);

  const handleDeleteTransaction = async (id: string, type: 'income' | 'expense') => {
    if (!window.confirm(`Are you sure you want to permanently delete this ${type}? This action cannot be undone.`)) {
      return;
    }
    try {
      if (type === 'expense') {
        await supabase.from('expenses').update({ is_deleted: true }).eq('id', id);
        toast.success("Expense deleted successfully");
      } else {
        // Income = Customer Visit
        const { data: visit, error: vErr } = await supabase.from('customer_visits').select('*').eq('id', id).single();
        if (vErr || !visit) throw new Error("Could not find visit");

        if (visit.customer_id) {
          const { data: cust } = await supabase.from('customers').select('amount_paid').eq('id', visit.customer_id).single();
          if (cust) {
            const newTotal = Math.max(0, Number(cust.amount_paid) - Number(visit.grand_total));
            await supabase.from('customers').update({ amount_paid: newTotal }).eq('id', visit.customer_id);
          }
        }

        const { data: vpData } = await supabase.from('visit_products').select('product_id, quantity').eq('visit_id', id);
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

        await supabase.from('visit_services').delete().eq('visit_id', id);
        await supabase.from('visit_products').delete().eq('visit_id', id);
        await supabase.from('staff_commissions').delete().eq('visit_id', id);

        await supabase.from('appointments').update({ status: 'scheduled', converted_visit_id: null }).eq('converted_visit_id', id);

        await supabase.from('customer_visits').update({ is_deleted: true }).eq('id', id);
        toast.success("Visit completely reversed and deleted.");
      }
      
      setRecentTransactions(prev => prev.filter(t => t.id !== id));
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || `Failed to delete ${type}`);
    }
  };

  // CSV Exports
  const exportCustomerCSV = async () => {
    try {
      const { data, error } = await supabase.from('customers').select('*').eq('is_deleted', false);
      if (error) throw error;
      if (!data || data.length === 0) {
        toast.error('No customers found.');
        return;
      }
      
      const headers = ['ID', 'Name', 'Phone', 'Date of Birth', 'Services Taken', 'Staff Served', 'Amount Paid'];
      const rows = data.map(c => [
        c.id,
        `"${c.name}"`,
        `"${c.phone || ''}"`,
        c.dob || '',
        `"${(c.services_taken || []).join(', ')}"`,
        `"${(c.staff_served || []).join(', ')}"`,
        c.amount_paid || 0
      ]);
      
      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `customers_export_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Customer CSV exported!');
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to export customers');
    }
  };

  const exportFinanceCSV = async () => {
    try {
      const { data: allVisitsRaw } = await supabase.from('customer_visits').select('visit_date, grand_total, customer:customer_id(name, is_deleted)').eq('is_deleted', false);
      const allVisits = (allVisitsRaw || []).filter((v: any) => !v.customer || !v.customer.is_deleted);
      const { data: allExpenses } = await supabase.from('expenses').select('date, title, category, amount').eq('is_deleted', false);
      const { data: allProducts } = await supabase.from('products').select('name, purchased_quantity, purchase_price, created_at');

      if ((!allVisits || allVisits.length === 0) && (!allExpenses || allExpenses.length === 0) && (!allProducts || allProducts.length === 0)) {
        toast.error('No financial data found.');
        return;
      }

      const headers = ['Date', 'Type', 'Description', 'Category/Customer', 'Amount'];
      
      const incomes = (allVisits || []).map((v: any) => [
        format(new Date(v.visit_date), 'yyyy-MM-dd HH:mm'),
        'Income',
        `"Visit - ${v.customer?.name || 'Walk-in'}"`,
        `"Services & Products"`,
        v.grand_total || 0
      ]);
      
      const outgoings = (allExpenses || []).map((e: any) => [
        format(new Date(e.date), 'yyyy-MM-dd'),
        'Expense',
        `"${e.title || e.category}"`,
        `"${e.category}"`,
        e.amount || 0
      ]);

      const inventory = (allProducts || []).filter(p => (p.purchased_quantity || 0) > 0).map((p: any) => [
        format(new Date(p.created_at || new Date()), 'yyyy-MM-dd'),
        'Expense',
        `"Inventory Purchase - ${p.name}"`,
        `"Inventory"`,
        (p.purchased_quantity || 0) * (p.purchase_price || 0)
      ]);
      
      const allTx = [...incomes, ...outgoings, ...inventory].sort((a, b) => new Date(b[0] as string).getTime() - new Date(a[0] as string).getTime());
      
      const csvContent = [headers.join(','), ...allTx.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `finance_export_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Finance CSV exported!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to export finance data');
    }
  };

  return (
    <div className="space-y-6 pb-10">
      {/* KPI Explanation Drawer */}
      {drawerType && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setDrawerType(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-md h-full glass-panel flex flex-col overflow-hidden shadow-2xl"
            style={{ borderLeft: '1px solid rgba(205, 127, 50,0.15)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-white/10 bg-black/40 shrink-0">
              <h3 className="text-xl font-light text-white tracking-tight">
                {drawerType === 'revenue' && '📈 Revenue Breakdown'}
                {drawerType === 'expenses' && '📊 Expense Breakdown'}
                {drawerType === 'inventory' && '📦 Inventory Cost Details'}
                {drawerType === 'profit' && '💰 Net Profit Calculation'}
              </h3>
              <button onClick={() => setDrawerType(null)} className="p-2 text-white/50 hover:text-white transition-colors rounded-full hover:bg-white/5">
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4 bg-black/60">
              {drawerType === 'revenue' && (
                <>
                  <p className="text-xs text-white/40 font-light">Sum of all customer visit totals in the selected period.</p>
                  <div className="space-y-2">
                    {drawerVisitRows.map((v, i) => (
                      <div key={i} className="flex justify-between items-center py-2 border-b border-white/5">
                        <span className="text-sm text-white/80">{v.customer?.name || 'Walk-in'}</span>
                        <span className="text-sm font-bold" style={{ color: '#CD7F32' }}>+₹{Number(v.grand_total || 0).toLocaleString()}</span>
                      </div>
                    ))}
                    {visits.length > 20 && <p className="text-xs text-white/30 italic text-center">...and {visits.length - 20} more visits</p>}
                  </div>
                  <div className="pt-4 border-t border-white/10 flex justify-between items-center">
                    <span className="text-xs font-bold tracking-widest text-white/50 uppercase">Total Revenue</span>
                    <span className="text-2xl font-light" style={{ color: '#CD7F32' }}>₹{totalRevenue.toLocaleString()}</span>
                  </div>
                </>
              )}
              {drawerType === 'expenses' && (
                <>
                  <p className="text-xs text-white/40 font-light">All recorded operating expenses in the selected period, grouped by category.</p>
                  <div className="space-y-2">
                    {expenseCategoryBreakdown.map(([cat, amt]) => (
                      <div key={cat} className="flex justify-between items-center py-2 border-b border-white/5">
                        <span className="text-sm text-white/80">{cat}</span>
                        <span className="text-sm font-bold text-danger">-₹{amt.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                  <div className="pt-4 border-t border-white/10 flex justify-between items-center">
                    <span className="text-xs font-bold tracking-widest text-white/50 uppercase">Total Expenses</span>
                    <span className="text-2xl font-light text-danger">₹{totalExpenses.toLocaleString()}</span>
                  </div>
                </>
              )}
              {drawerType === 'inventory' && (
                <>
                  <p className="text-xs text-white/40 font-light mb-4">Summary of all purchased inventory items.</p>
                  <div className="space-y-2">
                    {products.filter(p => (p.purchased_quantity || 0) > 0).map((p, i) => (
                      <div key={i} className="flex justify-between items-center py-3 border-b border-white/5">
                        <span className="text-sm text-white/90 font-medium">{p.name || 'Unknown Product'}</span>
                        <span className="font-numbers text-sm font-bold ml-4" style={{ color: '#CD7F32' }}>₹{((p.purchased_quantity || 0) * (p.purchase_price || 0)).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                  <div className="pt-6 mt-4 border-t border-white/10">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold tracking-widest text-white/50 uppercase">Total Inventory Value</span>
                      <span className="font-numbers text-3xl font-light" style={{ color: '#CD7F32' }}>₹{totalInventoryPurchasedCost.toLocaleString()}</span>
                    </div>
                  </div>
                </>
              )}
              {drawerType === 'profit' && (
                <>
                  <p className="text-xs text-white/40 font-light">Net Profit = Revenue − Operating Expenses − Inventory Purchased</p>
                  <div className="space-y-3 mt-4">
                    <div className="flex justify-between items-center p-4 rounded-xl" style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)' }}>
                      <span className="text-sm text-white/70">Total Revenue</span>
                      <span className="font-bold text-emerald-400">+ ₹{totalRevenue.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center p-4 rounded-xl" style={{ background: 'rgba(207,102,121,0.06)', border: '1px solid rgba(207,102,121,0.15)' }}>
                      <span className="text-sm text-white/70">Operating Expenses</span>
                      <span className="font-bold text-danger">− ₹{totalExpenses.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center p-4 rounded-xl" style={{ background: 'rgba(205, 127, 50,0.05)', border: '1px solid rgba(205, 127, 50,0.12)' }}>
                      <span className="text-sm text-white/70">Inventory Purchased</span>
                      <span className="font-bold" style={{ color: '#CD7F32' }}>− ₹{totalInventoryPurchasedCost.toLocaleString()}</span>
                    </div>
                    <div className="h-px" style={{ background: 'rgba(205, 127, 50,0.2)' }} />
                    <div className="flex justify-between items-center p-4 rounded-xl" style={{ background: netProfit >= 0 ? 'rgba(52,211,153,0.08)' : 'rgba(207,102,121,0.08)', border: `1px solid ${netProfit >= 0 ? 'rgba(52,211,153,0.2)' : 'rgba(207,102,121,0.2)'}` }}>
                      <span className="text-sm font-bold text-white">Net Profit</span>
                      <span className={`text-2xl font-light ${netProfit >= 0 ? 'text-emerald-400' : 'text-danger'}`}>= ₹{netProfit.toLocaleString()}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-numbers text-5xl tracking-tight text-white leading-none mb-1">Accounts Overview</h1>
          <p className="font-light mt-1 tracking-wide" style={{ color: 'rgba(205, 127, 50,0.4)' }}>Financial summary, P&L, and expense tracking.</p>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2 bg-black/40 px-3 py-2 border border-white/10 shadow-sm rounded-lg">
            <Calendar className="w-4 h-4 text-white/60" />
            <input 
              type="date" 
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="bg-transparent text-sm text-white outline-none font-medium"
            />
            <span className="text-white/60 mx-1">to</span>
            <input 
              type="date" 
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="bg-transparent text-sm text-white outline-none font-medium"
            />
          </div>

          <button onClick={exportCustomerCSV} className="btn-secondary flex items-center bg-black/40 border-white/10 shadow-sm">
            <Download className="w-4 h-4 mr-2" /> Customers CSV
          </button>
          <button onClick={exportFinanceCSV} className="btn-primary flex items-center shadow-sm">
            <Download className="w-4 h-4 mr-2" /> Finance CSV
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-white/60">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          Loading accounts data...
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div 
              onClick={() => setDrawerType('revenue')}
              className="glass-card p-6 flex flex-col justify-center cursor-pointer hover:bg-black/40 transition-colors" 
              style={{ border: '1px solid rgba(205, 127, 50,0.1)', background: 'rgba(17,17,17,0.6)' }}
            >
              <div className="flex justify-between items-start">
                <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(205, 127, 50,0.5)' }}>Total Revenue</h3>
                <div className="bg-success/10 p-2 rounded-lg border border-success/20"><ArrowUpRight className="h-5 w-5 text-success" /></div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <span className="font-numbers text-5xl font-light tracking-tight flex items-center mt-2" style={{ color: '#CD7F32' }}><IndianRupee className="w-6 h-6 mr-1" style={{ color: 'rgba(205, 127, 50,0.4)' }} />{totalRevenue.toLocaleString()}</span>
              </div>
            </div>
            
            <div 
              onClick={() => setDrawerType('expenses')}
              className="glass-card p-6 flex flex-col justify-center border border-danger/20 bg-danger/5 cursor-pointer hover:bg-danger/10 transition-colors"
            >
              <div className="flex justify-between items-start">
                <h3 className="text-xs font-bold uppercase tracking-widest text-danger">Operating Expenses</h3>
                <div className="bg-danger/10 p-2 rounded-lg border border-danger/20"><ArrowDownRight className="h-5 w-5 text-danger" /></div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <span className="font-numbers text-5xl font-light text-danger flex items-center tracking-tight mt-2"><IndianRupee className="w-6 h-6 mr-1 text-danger" />{totalExpenses.toLocaleString()}</span>
              </div>
            </div>

            <div 
              onClick={() => setDrawerType('inventory')}
              className="glass-card p-6 flex flex-col justify-center relative overflow-hidden cursor-pointer hover:bg-[rgba(205, 127, 50,0.1)] transition-colors" 
              style={{ border: '1px solid rgba(205, 127, 50,0.2)', background: 'rgba(205, 127, 50,0.05)' }}
            >
              <div className="absolute top-0 right-0 p-4 opacity-[0.03]">
                 <Package className="w-24 h-24" style={{ color: '#CD7F32' }} />
              </div>
              <div className="relative z-10">
                <div className="flex justify-between items-start">
                  <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: '#CD7F32' }}>Inventory Purchased</h3>
                  <div className="p-2 rounded-lg" style={{ background: 'rgba(205, 127, 50,0.1)', border: '1px solid rgba(205, 127, 50,0.2)' }}><Package className="h-5 w-5" style={{ color: '#CD7F32' }} /></div>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <span className="font-numbers text-5xl font-light flex items-center tracking-tight mt-2" style={{ color: '#CD7F32' }}><IndianRupee className="w-6 h-6 mr-1" style={{ color: 'rgba(205, 127, 50,0.4)' }} />{totalInventoryPurchasedCost.toLocaleString()}</span>
                </div>
                <p className="text-xs font-light mt-2 text-primary/70">Lifetime product cost</p>
              </div>
            </div>

            <div 
              onClick={() => setDrawerType('profit')}
              className="glass-card p-6 relative overflow-hidden flex flex-col justify-center group cursor-pointer hover:bg-black/40 transition-colors" 
              style={{ border: '1px solid rgba(205, 127, 50,0.1)', background: 'rgba(17,17,17,0.6)' }}
            >
              <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:scale-110 transition-transform duration-500">
                 <IndianRupee className="w-24 h-24" style={{ color: '#CD7F32' }} />
              </div>
              <div className="relative z-10">
                <div className="flex justify-between items-start">
                  <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(205, 127, 50,0.5)' }}>Net Profit</h3>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <span className={`font-numbers text-5xl font-light tracking-tight flex items-center mt-2 ${netProfit >= 0 ? 'text-success' : 'text-danger'}`}>
                    <IndianRupee className={`w-6 h-6 mr-1 ${netProfit >= 0 ? 'text-success/50' : 'text-danger/50'}`} />{netProfit.toLocaleString()}
                  </span>
                </div>
                <p className="text-xs font-light mt-2 text-white/60 italic flex items-center gap-1">
                  <Info className="w-3 h-3" /> Rev - (Op. Exp + Inventory)
                </p>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            
            {/* Pie Chart */}
            <div className="glass-card p-6" style={{ border: '1px solid rgba(205, 127, 50,0.1)', background: 'rgba(17,17,17,0.6)' }}>
              <h3 className="text-xl font-light text-white mb-6 tracking-tight" style={{ fontFamily: "'Cinzel', serif" }}>Expense Breakdown</h3>
              {expenseData.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-white/60 text-sm italic font-light">
                  No expenses recorded for this period.
                </div>
              ) : (
                <div className="h-[300px] w-full relative">
                  <ResponsiveContainer width="99%" height="100%" minHeight={300}>
                    <PieChart>
                      <Pie
                        data={expenseData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {expenseData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="transparent" />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        formatter={(value: any) => `Rs. ${value}`} 
                        contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', boxShadow: '0 4px 15px rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(10px)' }}
                        itemStyle={{ color: '#fff' }}
                      />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Recent Transactions List */}
            <div className="glass-card p-6 flex flex-col h-full max-h-[420px]" style={{ border: '1px solid rgba(205, 127, 50,0.1)', background: 'rgba(17,17,17,0.6)' }}>
              <div className="flex justify-between items-center mb-6 shrink-0">
                <h3 className="text-xl font-light text-white tracking-tight" style={{ fontFamily: "'Cinzel', serif" }}>Recent Transactions</h3>
                <span className="text-xs font-bold px-3 py-1.5 bg-black/40 text-white border border-white/10 rounded-lg shadow-sm">Period</span>
              </div>
              
              <div className="space-y-4 overflow-y-auto custom-scrollbar pr-2 flex-1">
                {recentTransactions.length === 0 ? (
                  <p className="text-sm text-center text-white/60 italic font-light mt-10">No transactions found.</p>
                ) : (
                  recentTransactions.map(tx => (
                    <div key={`${tx.type}-${tx.id}`} className="flex justify-between items-center pb-4 border-b border-white/10 last:border-0 last:pb-0 group">
                      <div>
                        <p className="font-medium text-base text-white">{tx.title}</p>
                        <p className="text-xs font-light tracking-wide text-white/60 mt-1 uppercase">{format(tx.date, 'dd MMM yyyy, hh:mm a')}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`font-bold text-sm px-3 py-1 rounded-lg border ${tx.type === 'income' ? 'text-success bg-success/10 border-success/20' : 'text-danger bg-danger/10 border-danger/20'}`}>
                          {tx.type === 'income' ? '+' : '-'}Rs. {tx.amount.toLocaleString()}
                        </span>
                        <button
                          onClick={() => handleDeleteTransaction(tx.id, tx.type)}
                          className="p-1.5 hover:bg-danger/20 text-danger rounded-lg transition-colors border border-transparent hover:border-danger/30 opacity-0 group-hover:opacity-100"
                          title={`Delete ${tx.type}`}
                        >
                          <XIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  );
}



