import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, IndianRupee, Phone, Calendar as CalendarIcon, User, X, Briefcase, FileText, Edit2 } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function Staff() {
  const [staffList, setStaffList] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit / Add Staff State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<any>(null);

  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [staffRes, commissionsRes, visitsRes] = await Promise.all([
        supabase.from('staff').select('*').eq('is_deleted', false),
        supabase.from('staff_commissions').select('*').eq('is_deleted', false),
        supabase.from('customer_visits').select('*, customers(name, is_deleted), visit_services(service_name, price)').eq('is_deleted', false)
      ]);

      if (staffRes.data) setStaffList(staffRes.data);
      if (visitsRes.data) {
        const validVisits = visitsRes.data.filter((v: any) => !v.customers || !v.customers.is_deleted);
        setVisits(validVisits);
        
        if (commissionsRes.data) {
          const validVisitIds = new Set(validVisits.map((v: any) => v.id));
          const validCommissions = commissionsRes.data.filter((c: any) => validVisitIds.has(c.visit_id));
          setCommissions(validCommissions);
        }
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('staff-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_commissions' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_visits' }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const staffData = {
        name: editingStaff.name || editingStaff.staff_name,
        gender: editingStaff.gender,
        salary: editingStaff.salary || 15000
      };

      if (editingStaff.id) {
        const { error } = await supabase.from('staff').update(staffData).eq('id', editingStaff.id);
        if (error) throw error;
        toast.success('Staff updated successfully!');
      } else {
        const { error } = await supabase.from('staff').insert([staffData]);
        if (error) throw error;
        toast.success('Staff added successfully!');
      }
      setIsEditModalOpen(false);
      fetchData();
    } catch (err: any) {
      console.error('Error saving staff:', err);
      toast.error(err.message || 'Failed to save staff details.');
    }
  };

  const handleSalaryChange = async (id: string, newSalary: string) => {
    const val = parseInt(newSalary, 10);
    if (!isNaN(val)) {
      setStaffList(prev => prev.map(s => s.id === id ? { ...s, salary: val } : s));
      await supabase.from('staff').update({ salary: val }).eq('id', id);
    }
  };



  const handlePaySalary = async (e: React.MouseEvent, staffId: string, amount: number, name: string) => {
    e.stopPropagation();
    if (confirm(`Pay Rs. ${amount} to ${name}?`)) {
      try {
        await supabase.from('expenses').insert([{
          title: `Salary - ${name} (Auto-generated payment for ${format(new Date(), 'MMM yyyy')})`,
          amount,
          category: 'Salary',
          date: new Date().toISOString()
        }]);
        toast.success('Salary Paid and Expense Recorded!');
      } catch (err) {
        console.error('Error recording expense:', err);
        toast.error('Failed to record salary payment.');
      }
    }
  };

  const calculateStaffMetrics = (staffId: string) => {
    const now = new Date();
    
    // Find all commissions for this staff this month
    const currentMonthCommissions = commissions.filter(c => {
      if (c.staff_id !== staffId) return false;
      const v = visits.find(visit => visit.id === c.visit_id);
      if (!v || !v.visit_date) return false;
      const vDate = new Date(v.visit_date);
      return vDate.getMonth() === now.getMonth() && vDate.getFullYear() === now.getFullYear();
    });

    const totalServiceRevenue = currentMonthCommissions.reduce((sum, c) => sum + (Number(c.service_amount) || 0), 0);

    const staffVisits = visits.filter(v => {
      if (v.staff_id !== staffId) return false;
      const vDate = new Date(v.visit_date);
      return vDate.getMonth() === now.getMonth() && vDate.getFullYear() === now.getFullYear();
    });

    return {
      totalServiceRevenue,
      customersServed: staffVisits.length,
      staffVisits
    };
  };

  const selectedStaff = staffList.find(s => s.id === selectedStaffId);
  const selectedStaffMetrics = selectedStaff ? calculateStaffMetrics(selectedStaff.id) : null;

  return (
    <div className="space-y-8 pb-10 relative max-w-7xl mx-auto">
      
      {/* Header Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="font-numbers text-5xl tracking-tight text-white leading-none mb-1">Staff Management</h1>
          <p className="mt-2 font-light tracking-wide" style={{ color: 'rgba(212,175,55,0.4)' }}>Manage team payroll, commissions, and performance.</p>
        </div>
        <button 
          onClick={() => {
            setEditingStaff({ salary: 15000, status: 'Active', gender: 'Female', commission_rate: 10 });
            setIsEditModalOpen(true);
          }}
          className="btn-primary"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Staff
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
           <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {staffList.map((staff) => {
            const staffName = staff.name || staff.staff_name || 'Unnamed';
            const metrics = calculateStaffMetrics(staff.id);
            const baseSalary = Number(staff.salary) || 15000;
            const totalPayable = baseSalary;
            
            const initials = staffName.replace(/[^a-zA-Z\s]/g, '').trim().split(/\s+/).map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();

            return (
              <div 
                key={staff.id} 
                className="glass-card hover:bg-[rgba(212,175,55,0.04)] transition-all cursor-pointer group flex flex-col overflow-hidden relative"
                style={{ border: '1px solid rgba(212,175,55,0.1)', background: 'rgba(20,20,20,0.8)' }}
                onClick={() => setSelectedStaffId(staff.id)}
              >
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingStaff({ ...staff, name: staffName, salary: baseSalary });
                    setIsEditModalOpen(true);
                  }}
                  className="absolute top-4 right-4 p-2 bg-black/60 backdrop-blur-md border border-white/10 rounded-full text-white/60 hover:text-white shadow-sm opacity-0 group-hover:opacity-100 transition-all z-10"
                >
                  <Edit2 className="w-4 h-4" />
                </button>

                <div className="p-6 border-b border-white/10">
                  <div className="flex items-center gap-4 mb-4 pr-8">
                    <div className="w-14 h-14 rounded-full flex items-center justify-center shrink-0 transition-colors" style={{ background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.25)' }}>
                      <span className="font-bold text-lg transition-colors" style={{ color: '#D4AF37' }}>{initials}</span>
                    </div>
                    <div className="flex-1 min-w-0 pr-2">
                      <h3 className="font-numbers text-2xl font-light text-white tracking-wide truncate">{staffName}</h3>
                      <p className="text-sm font-light text-white/60">{staff.gender}</p>
                    </div>
                    <div className="px-3 py-1 rounded-full text-xs font-bold shrink-0" style={staff.status === 'Active' ? { background: 'rgba(212,175,55,0.08)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.2)' } : { background: 'rgba(207,102,121,0.08)', color: '#CF6679', border: '1px solid rgba(207,102,121,0.2)' }}>
                      {staff.status || 'Active'}
                    </div>
                  </div>
                </div>

                <div className="p-6 flex-1 flex flex-col justify-between bg-black/5" onClick={e => e.stopPropagation()}>
                  <div className="space-y-4 mb-4">
                    <div className="flex flex-col">
                      <label className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: 'rgba(212,175,55,0.5)' }}>Monthly Salary</label>
                      <div className="relative flex items-center">
                        <IndianRupee className="w-4 h-4 text-white/60 absolute left-4" />
                        <input 
                          type="number" 
                          className="glass-input w-full !pl-10 pr-4 py-3 bg-black/40 text-white border-white/10"
                          value={baseSalary}
                          onChange={(e) => handleSalaryChange(staff.id, e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-sm font-bold tracking-widest uppercase" style={{ color: 'rgba(212,175,55,0.5)' }}>Total Payable</span>
                      <span className="font-numbers text-3xl font-light tracking-tight" style={{ color: '#D4AF37' }}>Rs. {totalPayable.toLocaleString()}</span>
                    </div>
                    <button 
                      onClick={(e) => handlePaySalary(e, staff.id, totalPayable, staffName)}
                      className="w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center"
                      style={{ background: 'linear-gradient(135deg, #D4AF37, #E5C158)', color: '#0A0A0A', boxShadow: '0 4px 16px rgba(212,175,55,0.2)' }}
                    >
                      Pay Salary
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit / Add Staff Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md flex flex-col animate-in zoom-in-95 duration-200 bg-background border border-white/10 shadow-2xl">
            <div className="flex justify-between items-center p-6 border-b border-white/10 bg-black/40 rounded-t-2xl">
              <h3 className="text-xl font-light tracking-tight text-white">{editingStaff?.id ? 'Edit Staff Details' : 'Add New Staff'}</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-black/5 rounded-full transition-colors text-white/60 hover:text-white"><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleSaveStaff} className="flex flex-col flex-1 bg-black/40">
              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-xs font-bold tracking-widest text-white/60 uppercase mb-2">Full Name</label>
                  <input 
                    type="text" 
                    required 
                    value={editingStaff?.name || ''} 
                    onChange={e => setEditingStaff({...editingStaff, name: e.target.value})}
                    className="glass-input bg-black/40 w-full px-4 py-3 border-white/10 text-white shadow-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold tracking-widest text-white/60 uppercase mb-2">Gender</label>
                  <select 
                    value={editingStaff?.gender || 'Female'} 
                    onChange={e => setEditingStaff({...editingStaff, gender: e.target.value})}
                    className="glass-input bg-black/40 w-full px-4 py-3 appearance-none border-white/10 text-white shadow-sm"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold tracking-widest text-white/60 uppercase mb-2">Base Salary</label>
                  <input 
                    type="number" 
                    required 
                    value={editingStaff?.salary || 15000} 
                    onChange={e => setEditingStaff({...editingStaff, salary: Number(e.target.value)})}
                    className="glass-input bg-black/40 w-full px-4 py-3 border-white/10 text-white shadow-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold tracking-widest text-white/60 uppercase mb-2">Status</label>
                  <select 
                    value={editingStaff?.status || 'Active'} 
                    onChange={e => setEditingStaff({...editingStaff, status: e.target.value})}
                    className="glass-input bg-black/40 w-full px-4 py-3 appearance-none border-white/10 text-white shadow-sm"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

              </div>
              
              <div className="p-6 border-t border-white/10 bg-black/5 rounded-b-2xl">
                <button type="submit" className="btn-primary w-full justify-center">
                  Save Details
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Staff Profile Modal */}
      {selectedStaffId && selectedStaff && selectedStaffMetrics && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 sm:p-6">
          <div className="glass-panel w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 bg-background border-white/10 shadow-2xl">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between p-8 border-b border-white/10 bg-black/40 shrink-0">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 rounded-full bg-black/5 flex items-center justify-center border border-white/10 shadow-sm">
                  <User className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-3xl font-light tracking-tight text-white flex items-center">
                    {selectedStaff.name || selectedStaff.staff_name} 
                    <span className="text-xs font-bold tracking-widest text-white/60 uppercase ml-4 px-3 py-1 bg-black/5 rounded-full border border-white/10">{selectedStaff.gender}</span>
                  </h3>
                  <p className="text-sm font-light text-white/60 mt-2 tracking-wide uppercase">Staff Member</p>
                </div>
              </div>
              <button onClick={() => setSelectedStaffId(null)} className="p-2 hover:bg-black/5 rounded-full transition-colors text-white/60 hover:text-white"><X className="w-6 h-6"/></button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 bg-transparent custom-scrollbar">
              <div className="grid lg:grid-cols-3 gap-8">
                
                {/* Left Column: Summary */}
                <div className="lg:col-span-1 space-y-6">
                  
                  {/* Monthly Summary */}
                  <div className="bg-black/40 p-6 rounded-2xl border border-white/10 relative overflow-hidden shadow-sm">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl"></div>
                    <h4 className="text-lg font-light text-white mb-6 flex items-center tracking-wide"><Briefcase className="w-5 h-5 mr-3 text-white/60"/> Monthly Summary</h4>
                    <div className="space-y-4 relative z-10">
                      <div className="flex justify-between items-center text-sm border-b border-white/10 pb-3">
                        <span className="font-light text-white/60">Customers Served</span>
                        <span className="font-medium text-white">{selectedStaffMetrics.customersServed}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm border-b border-white/10 pb-3">
                        <span className="font-light text-white/60">Service Revenue</span>
                        <span className="font-medium text-white">Rs. {selectedStaffMetrics.totalServiceRevenue.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm border-b border-white/10 pb-3">
                        <span className="font-light text-white/60">Base Salary</span>
                        <span className="font-medium text-white">Rs. {(selectedStaff.salary || 15000).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center pt-4">
                        <span className="font-bold tracking-widest text-white/60 uppercase text-xs">Total Payout</span>
                        <span className="font-light text-white text-2xl tracking-tight">Rs. {(selectedStaff.salary || 15000).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Right Column: Service History */}
                <div className="lg:col-span-2">
                  <div className="bg-black/40 p-6 rounded-2xl border border-white/10 h-full shadow-sm">
                    <h4 className="text-lg font-light text-white mb-6 flex items-center tracking-wide"><FileText className="w-5 h-5 mr-3 text-white/60"/> Service History (Current Month)</h4>
                    
                    {selectedStaffMetrics.staffVisits.length === 0 ? (
                      <div className="text-center py-12 text-white/60 border border-dashed border-white/10 rounded-2xl font-light bg-black/5">
                        No customers served this month.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-white">
                          <thead className="bg-black/5 text-white/60 text-xs uppercase font-bold tracking-wider border-b border-white/10">
                            <tr>
                              <th className="px-4 py-4 rounded-tl-lg">Date</th>
                              <th className="px-4 py-4">Customer</th>
                              <th className="px-4 py-4">Services</th>
                              <th className="px-4 py-4 text-right rounded-tr-lg">Service Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {selectedStaffMetrics.staffVisits.sort((a,b) => new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime()).map(v => {
                              const srvNames = v.visit_services?.map((s: any) => s.service_name).join(', ') || 'No Services';
                              const srvTotal = v.service_total || 0;
                              
                              return (
                                <tr key={v.id} className="hover:bg-black/5 transition-colors font-light">
                                  <td className="px-4 py-4 whitespace-nowrap text-white/60">{v.visit_date ? format(new Date(v.visit_date), 'dd MMM yyyy') : ''}</td>
                                  <td className="px-4 py-4 font-medium text-white">{v.customers?.name || 'Walk-in'}</td>
                                  <td className="px-4 py-4 text-white/60">{srvNames}</td>
                                  <td className="px-4 py-4 text-right text-white">Rs. {srvTotal.toLocaleString()}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
