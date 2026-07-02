import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { expenseService } from '../lib/expenseService';
import { Plus, Search, IndianRupee, X, Edit2, Trash2, PieChart, Package, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const EXPENSE_CATEGORIES = [
  'Electricity', 'Water', 'Rent', 'Internet', 'Salary', 'Inventory', 'Other Expenses'
];

const PAYMENT_METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Card'];
const STATUSES = ['Paid', 'Pending', 'Partially Paid'];

export default function Expenses() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [products, setProducts] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({ todayExpenses: 0, monthExpenses: 0, yearExpenses: 0, pendingPayments: 0, categoryAnalytics: [] });
  const [isLoading, setIsLoading] = useState(true);

  const [page, setPage] = useState(1);
  const limit = 10;


  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  
  const [showInventoryInfo, setShowInventoryInfo] = useState(false);
  const [showSummaryInfo, setShowSummaryInfo] = useState(false);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterMonth, setFilterMonth] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    category: '',
    day: format(new Date(), 'dd'),
    month: format(new Date(), 'MM'),
    year: format(new Date(), 'yyyy'),
    notes: '',
    paymentMethod: 'UPI',
    status: 'Paid'
  });

  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterCategory, filterStatus, filterMonth]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [expRes, statsRes, prodRes] = await Promise.all([
        expenseService.getExpenses({ page, limit, search: debouncedSearch, category: filterCategory, status: filterStatus, month: filterMonth }),
        expenseService.getExpenseStats(),
        supabase.from('products').select('*')
      ]);
      setExpenses(expRes.data);
      setTotalCount(expRes.count);
      setStats(statsRes);
      if (prodRes.data) setProducts(prodRes.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load expenses');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel('expenses-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, loadData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [page, debouncedSearch, filterCategory, filterStatus, filterMonth]);

  const resetForm = () => {
    setFormData({
      title: '',
      amount: '',
      category: '',
      day: format(new Date(), 'dd'),
      month: format(new Date(), 'MM'),
      year: format(new Date(), 'yyyy'),
      notes: '',
      paymentMethod: 'UPI',
      status: 'Paid'
    });
    setEditingExpenseId(null);
  };

  const handleOpenEdit = (expense: any) => {
    const d = new Date(expense.date);
    setFormData({
      title: expense.title,
      amount: expense.amount.toString(),
      category: expense.category,
      day: format(d, 'dd'),
      month: format(d, 'MM'),
      year: format(d, 'yyyy'),
      notes: expense.notes || '',
      paymentMethod: expense.payment_method || expense.paymentMethod || 'UPI',
      status: expense.status
    });
    setEditingExpenseId(expense.id);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.amount || !formData.category || !formData.day || !formData.month || !formData.year) {
      toast.error("Please fill all required fields.");
      return;
    }

    const dateStr = `${formData.year}-${formData.month}-${formData.day}`;

    const payload = {
      title: formData.title,
      amount: parseFloat(formData.amount),
      category: formData.category,
      date: new Date(dateStr).toISOString()
    };

    try {
      if (editingExpenseId) {
        const { error } = await supabase.from('expenses').update(payload).eq('id', editingExpenseId);
        if (error) throw error;
        toast.success("Expense updated");
      } else {
        const { error } = await supabase.from('expenses').insert([payload]);
        if (error) throw error;
        toast.success("Expense added");
      }
      setIsModalOpen(false);
      resetForm();
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save expense');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this expense?")) {
      try {
        await supabase.from('expenses').delete().eq('id', id);
        toast.success("Expense deleted");
        loadData();
      } catch (err) {
        toast.error('Failed to delete expense');
      }
    }
  };

  // Inventory Calculations
  let totalSpentInventory = 0;
  let currentStockValue = 0;
  let costOfConsumed = 0;
  let retailRevenue = 0;
  let retailCost = 0;

  products.forEach(p => {
    const cost = Number(p.purchase_price) || 0;
    const price = Number(p.selling_price) || 0;
    
    totalSpentInventory += (Number(p.purchased_quantity) || 0) * cost;
    currentStockValue += (Number(p.current_stock) || 0) * cost;
    costOfConsumed += (Number(p.salon_consumption) || 0) * cost;
    retailRevenue += (Number(p.sold_quantity) || 0) * price;
    retailCost += (Number(p.sold_quantity) || 0) * cost;
  });

  const retailProfit = retailRevenue - retailCost;

  return (
    <div className="space-y-8 pb-10 relative max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="font-numbers text-5xl tracking-tight text-white leading-none mb-1">Expense & Analytics</h1>
          <p className="mt-2 font-light tracking-wide" style={{ color: 'rgba(205, 127, 50,0.4)' }}>Track expenses and monitor inventory profitability.</p>
        </div>
        <button 
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="btn-primary"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Expense
        </button>
      </div>

      {/* Inventory Analytics Cards */}
      <div className="glass-card p-6" style={{ border: '1px solid rgba(205, 127, 50,0.1)' }}>
        <div className="flex justify-between items-center mb-6">
          <h4 className="font-numbers text-2xl tracking-wide text-white flex items-center"><Package className="w-5 h-5 mr-3" style={{ color: '#D4AF37' }}/> Inventory Accounting</h4>
          <button 
            onClick={() => setShowInventoryInfo(!showInventoryInfo)}
            className="text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-colors hover:bg-white/5"
            style={{ borderColor: 'rgba(205, 127, 50,0.3)', color: '#D4AF37' }}
          >
            {showInventoryInfo ? 'Hide Logic' : 'How is this calculated?'}
          </button>
        </div>
        
        {showInventoryInfo && (
          <div className="mb-6 p-4 rounded-xl text-sm font-light leading-relaxed" style={{ background: 'rgba(205, 127, 50,0.05)', border: '1px dashed rgba(205, 127, 50,0.2)' }}>
            <p className="text-white mb-2"><strong style={{ color: '#D4AF37' }}>Total Capital Invested:</strong> Qty Purchased × Purchase Price of all products ever bought.</p>
            <p className="text-white mb-2"><strong style={{ color: '#D4AF37' }}>Current Stock Value:</strong> Current Qty in Stock × Purchase Price. (Value sitting on your shelves).</p>
            <p className="text-white mb-2"><strong className="text-danger">Salon Consumption:</strong> Qty Used Internally × Purchase Price. (Products used for services, not sold to clients. This represents an indirect cost).</p>
            <p className="text-white mb-2"><strong className="text-success">Retail Revenue:</strong> Qty Sold to Clients × Selling Price. (Money received from selling products).</p>
            <p className="text-white"><strong className="text-success">Net Retail Profit:</strong> Retail Revenue − (Qty Sold to Clients × Purchase Price). (Actual profit made from retail sales only).</p>
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-white/60 mb-1">Total Capital Invested</p>
            <p className="font-numbers text-4xl font-light text-white">Rs. {totalSpentInventory.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-white/60 mb-1">Current Stock Value</p>
            <p className="font-numbers text-4xl font-light text-white">Rs. {currentStockValue.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-danger mb-1">Salon Consumption (Cost)</p>
            <p className="font-numbers text-4xl font-light text-danger">Rs. {costOfConsumed.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-success mb-1">Retail Revenue</p>
            <p className="font-numbers text-4xl font-light text-success">Rs. {retailRevenue.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-success mb-1">Net Retail Profit</p>
            <p className="font-numbers text-4xl font-light text-success font-bold">Rs. {retailProfit.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="flex justify-between items-end mb-2 mt-8">
        <h4 className="font-numbers text-2xl tracking-wide text-white">Operating Expenses</h4>
        <button 
          onClick={() => setShowSummaryInfo(!showSummaryInfo)}
          className="text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-colors hover:bg-white/5"
          style={{ borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}
        >
          {showSummaryInfo ? 'Hide Logic' : 'How is this calculated?'}
        </button>
      </div>

      {showSummaryInfo && (
        <div className="mb-4 p-4 rounded-xl text-sm font-light leading-relaxed bg-black/40 border border-white/5">
          <p className="text-white mb-2"><strong className="font-medium text-white/80">Operating Expenses (OpEx):</strong> These are day-to-day running costs (Rent, Electricity, Salary, etc.) added manually in this page.</p>
          <p className="text-white mb-2"><strong className="font-medium text-white/80">Time Filters:</strong> "Today", "This Month", and "This Year" only sum up expenses whose <em className="italic">recorded Date</em> falls within that exact timeframe.</p>
          <p className="text-white"><strong className="text-danger font-medium">Pending Payments:</strong> Sum of all expenses marked as "Pending" or "Partially Paid". These are liabilities you owe.</p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-6 flex flex-col justify-center" style={{ border: '1px solid rgba(205, 127, 50,0.1)' }}>
          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(205, 127, 50,0.4)' }}>Today's Expenses</p>
          <p className="font-numbers text-4xl font-light tracking-tight flex items-center mt-2" style={{ color: '#D4AF37' }}><IndianRupee className="w-6 h-6 mr-1" style={{ color: 'rgba(205, 127, 50,0.4)' }}/>{stats.todayExpenses.toLocaleString()}</p>
        </div>
        <div className="glass-card p-6 flex flex-col justify-center" style={{ border: '1px solid rgba(205, 127, 50,0.1)' }}>
          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(205, 127, 50,0.4)' }}>This Month</p>
          <p className="font-numbers text-4xl font-light tracking-tight flex items-center mt-2" style={{ color: '#D4AF37' }}><IndianRupee className="w-6 h-6 mr-1" style={{ color: 'rgba(205, 127, 50,0.4)' }}/>{stats.monthExpenses.toLocaleString()}</p>
        </div>
        <div className="glass-card p-6 flex flex-col justify-center" style={{ border: '1px solid rgba(205, 127, 50,0.1)' }}>
          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(205, 127, 50,0.4)' }}>This Year</p>
          <p className="font-numbers text-4xl font-light tracking-tight flex items-center mt-2" style={{ color: '#D4AF37' }}><IndianRupee className="w-6 h-6 mr-1" style={{ color: 'rgba(205, 127, 50,0.4)' }}/>{stats.yearExpenses.toLocaleString()}</p>
        </div>
        <div className="glass-card p-6 flex flex-col justify-center" style={{ border: '1px solid rgba(207,102,121,0.2)', background: 'rgba(207,102,121,0.05)' }}>
          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#CF6679' }}>Pending Payments</p>
          <p className="font-numbers text-4xl font-light tracking-tight flex items-center mt-2" style={{ color: '#CF6679' }}><IndianRupee className="w-6 h-6 mr-1 opacity-70"/>{stats.pendingPayments.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-8">
        
        {/* Main Content (Table) */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* Filters */}
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center flex-1 min-w-[200px] glass-panel px-4 py-3 focus-within:border-black/10 transition-all bg-black/40">
              <Search className="h-4 w-4 text-white/60 mr-3" />
              <input
                type="text"
                placeholder="Search description..."
                className="bg-transparent outline-none w-full text-sm text-white placeholder-secondary-foreground font-light tracking-wide"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="glass-input px-4 py-3 appearance-none bg-black/40">
              <option value="" className="text-white">All Months</option>
              <option value={format(new Date(), 'yyyy-MM')} className="text-white">This Month</option>
            </select>
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="glass-input px-4 py-3 appearance-none bg-black/40">
              <option value="" className="text-white">All Categories</option>
              {EXPENSE_CATEGORIES.map(c => <option key={c} value={c} className="text-white">{c}</option>)}
            </select>
          </div>

          <div className="glass-card overflow-hidden" style={{ border: '1px solid rgba(205, 127, 50,0.1)' }}>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-sm text-left text-white">
                <thead className="text-xs uppercase font-bold tracking-wider" style={{ background: 'rgba(205, 127, 50,0.04)', borderBottom: '1px solid rgba(205, 127, 50,0.12)', color: 'rgba(205, 127, 50,0.6)' }}>
                  <tr>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Description</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4">Amount</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isLoading ? (
                    <tr><td colSpan={5} className="text-center py-16 text-white/60">Loading expenses...</td></tr>
                  ) : expenses.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-16 text-white/60 font-light text-lg">No expenses found.</td></tr>
                  ) : (
                    expenses.map(e => (
                      <tr key={e.id} className="hover:bg-black/40 transition-colors group font-light">
                        <td className="px-6 py-4 whitespace-nowrap text-white/60">{format(new Date(e.date), 'dd MMM yyyy')}</td>
                        <td className="px-6 py-4 font-medium text-white">{e.title}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="bg-black/40 text-white border border-white/10 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">{e.category}</span>
                        </td>
                        <td className="px-6 py-4 font-bold text-white whitespace-nowrap">Rs. {Number(e.amount).toLocaleString()}</td>
                        <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleOpenEdit(e)} className="p-2 text-white/60 hover:bg-black/5 hover:text-white rounded-xl transition-colors"><Edit2 className="w-4 h-4"/></button>
                          <button onClick={() => handleDelete(e.id)} className="p-2 text-danger hover:bg-danger/10 rounded-xl transition-colors"><Trash2 className="w-4 h-4"/></button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalCount > limit && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-black/40">
                <div className="text-sm text-white/60">
                  Showing <span className="font-medium text-white">{((page - 1) * limit) + 1}</span> to <span className="font-medium text-white">{Math.min(page * limit, totalCount)}</span> of <span className="font-medium text-white">{totalCount}</span> expenses
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
        </div>

        {/* Sidebar Analytics */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-card p-6 sticky top-6" style={{ border: '1px solid rgba(205, 127, 50,0.1)' }}>
            <h4 className="text-xl font-light tracking-wide text-white mb-6 flex items-center" style={{ fontFamily: "'Cinzel', serif" }}><PieChart className="w-5 h-5 mr-3" style={{ color: '#D4AF37' }}/> Monthly Analytics</h4>
            {stats.categoryAnalytics.length === 0 ? (
              <p className="text-sm text-white/60 font-light">No expenses this month.</p>
            ) : (
              <div className="space-y-6">
                {stats.categoryAnalytics.map(([cat, amount]: [string, number]) => (
                  <div key={cat}>
                    <div className="flex justify-between text-sm mb-2 font-light">
                      <span className="text-white/60">{cat}</span>
                      <span className="text-white">Rs. {amount}</span>
                    </div>
                    <div className="w-full bg-black/5 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-primary h-full rounded-full" style={{ width: `${Math.min((amount / stats.monthExpenses) * 100, 100)}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg flex flex-col animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-white/10 shrink-0 bg-black/40 rounded-t-2xl">
              <h3 className="text-xl font-light tracking-tight text-white">{editingExpenseId ? 'Edit Expense' : 'Add New Expense'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-black/5 text-white/60 hover:text-white rounded-full transition-colors"><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col max-h-[70vh]">
              <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar bg-black/60">
                
                <div>
                  <label className="block text-xs font-bold tracking-widest text-white/60 uppercase mb-2">Description / Title *</label>
                  <input type="text" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="glass-input w-full px-4 py-3" placeholder="E.g., June Water Bill" />
                </div>

                <div>
                  <label className="block text-xs font-bold tracking-widest text-white/60 uppercase mb-2">Amount *</label>
                  <div className="relative flex items-center">
                    <IndianRupee className="w-4 h-4 text-white/60 absolute left-4" />
                    <input type="number" required min="0" step="0.01" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="glass-input w-full !pl-10 pr-4 py-3" placeholder="0.00" />
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-bold tracking-widest text-white/60 uppercase mb-2">Date *</label>
                  <div className="grid grid-cols-3 gap-3">
                    <select required value={formData.day} onChange={e => setFormData({...formData, day: e.target.value})} className="glass-input w-full px-4 py-3 appearance-none cursor-pointer bg-black/40">
                      <option value="" className="text-white/60">Day</option>
                      {Array.from({length: 31}, (_, i) => i + 1).map(d => (
                        <option key={d} value={d.toString().padStart(2, '0')} className="text-white">{d.toString().padStart(2, '0')}</option>
                      ))}
                    </select>
                    <select required value={formData.month} onChange={e => setFormData({...formData, month: e.target.value})} className="glass-input w-full px-4 py-3 appearance-none cursor-pointer bg-black/40">
                      <option value="" className="text-white/60">Month</option>
                      {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                        <option key={m} value={m.toString().padStart(2, '0')} className="text-white">
                          {format(new Date(2000, m - 1, 1), 'MMM')}
                        </option>
                      ))}
                    </select>
                    <select required value={formData.year} onChange={e => setFormData({...formData, year: e.target.value})} className="glass-input w-full px-4 py-3 appearance-none cursor-pointer bg-black/40">
                      <option value="" className="text-white/60">Year</option>
                      {Array.from({length: 10}, (_, i) => new Date().getFullYear() - i).map(y => (
                        <option key={y} value={y.toString()} className="text-white">{y}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold tracking-widest text-white/60 uppercase mb-2">Category *</label>
                  <select 
                    required 
                    value={formData.category} 
                    onChange={e => setFormData({...formData, category: e.target.value})}
                    className="glass-input bg-black/40 w-full px-4 py-3 appearance-none border-white/10 text-white shadow-sm"
                  >
                    <option value="" disabled>Select category</option>
                    {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold tracking-widest text-white/60 uppercase mb-2">Amount (Rs. ) *</label>
                  <input 
                    type="number" 
                    required 
                    min="0"
                    value={formData.amount} 
                    onChange={e => setFormData({...formData, amount: e.target.value})}
                    className="glass-input bg-black/40 w-full px-4 py-3 border-white/10 text-white shadow-sm"
                    placeholder="Enter amount"
                  />
                </div>
              </div>

              </div>
              <div className="p-6 border-t border-white/10 bg-black/40 rounded-b-2xl flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">
                  {editingExpenseId ? 'Save Changes' : 'Add Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
