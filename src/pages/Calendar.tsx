import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, IndianRupee, Users, Package, CalendarCheck, Check, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

type CalendarFilter = 'all' | 'visits' | 'appointments';

export default function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [visits, setVisits] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [filter, setFilter] = useState<CalendarFilter>('all');
  const [checkingIn, setCheckingIn] = useState<string | null>(null);

  const fetchAll = async () => {
    const [vRes, aRes] = await Promise.all([
      supabase.from('customer_visits').select(`
        *, customer:customer_id(name, is_deleted), staff:staff_id(name), visit_services(*), visit_products(*)
      `).eq('is_deleted', false),
      supabase.from('appointments').select('*, staff:staff_id(name), appointment_services(*)').eq('is_deleted', false),
    ]);
    if (vRes.data) setVisits(vRes.data.filter((v: any) => !v.customer || !v.customer.is_deleted));
    if (aRes.data) setAppointments(aRes.data);
  };

  useEffect(() => {
    fetchAll();
    const channel = supabase
      .channel('calendar-full-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_visits' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, fetchAll)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDay = monthStart.getDay();
  const paddingDays = Array.from({ length: startDay }).fill(null);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const selectedDateVisits = visits.filter(v => v.visit_date && isSameDay(new Date(v.visit_date), selectedDate));
  const selectedDateAppts = appointments.filter(a => a.appointment_date && isSameDay(parseISO(a.appointment_date), selectedDate));
  const totalRevenue = selectedDateVisits.reduce((sum, v) => sum + (Number(v.grand_total) || 0), 0);

  const handleCheckIn = async (appt: any) => {
    setCheckingIn(appt.id);
    try {
      let customerId: number | null = null;
      if (appt.customer_phone) {
        const { data: existing } = await supabase.from('customers').select('id').eq('phone', appt.customer_phone).eq('is_deleted', false).maybeSingle();
        if (existing) { customerId = existing.id; }
        else {
          const { data: newC, error: cErr } = await supabase.from('customers').insert([{ name: appt.customer_name, phone: appt.customer_phone }]).select().single();
          if (cErr) throw cErr;
          if (newC) customerId = newC.id;
        }
      }
      const svcList = appt.appointment_services || [];
      const serviceTotal = svcList.reduce((s: number, x: any) => s + Number(x.price || 0), 0);
      const { data: visitData, error: visitErr } = await supabase.from('customer_visits').insert([{
        customer_id: customerId, service_total: serviceTotal, product_total: 0,
        grand_total: serviceTotal, original_total: serviceTotal, discount_amount: 0, staff_id: appt.staff_id,
      }]).select().single();
      if (visitErr) throw visitErr;
      if (svcList.length > 0) {
        await supabase.from('visit_services').insert(svcList.map((s: any) => ({ visit_id: visitData.id, service_id: s.service_id, service_name: s.service_name, price: Number(s.price || 0) })));
      }
      await supabase.from('appointments').update({ status: 'checked_in', converted_visit_id: visitData.id }).eq('id', appt.id);
      toast.success(`✅ Checked in — ${appt.customer_name}`);
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || 'Check-in failed');
    } finally {
      setCheckingIn(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-4xl tracking-tight text-white" style={{ fontFamily: "'Cinzel', serif", fontWeight: 400 }}>Calendar</h2>
          <p className="mt-2 font-light tracking-wide" style={{ color: 'rgba(205, 127, 50,0.4)' }}>View visits and appointments.</p>
        </div>

        {/* Filter Toggle */}
        <div className="flex items-center bg-black/40 border border-white/10 rounded-xl p-1 gap-1">
          {([['all', 'All'], ['visits', 'Visits'], ['appointments', 'Appointments']] as [CalendarFilter, string][]).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilter(val)}
              className="px-4 py-2 text-xs font-bold rounded-lg transition-all duration-200"
              style={filter === val ? { background: val === 'appointments' ? 'rgba(96,165,250,0.15)' : 'rgba(205, 127, 50,0.12)', color: val === 'appointments' ? '#60a5fa' : '#D4AF37', border: `1px solid ${val === 'appointments' ? 'rgba(96,165,250,0.3)' : 'rgba(205, 127, 50,0.25)'}` } : { color: 'rgba(255,255,255,0.4)', border: '1px solid transparent' }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 h-[calc(100vh-160px)] min-h-[600px]">
        {/* Calendar Grid */}
        <div className="lg:col-span-2 glass-card p-6 flex flex-col" style={{ border: '1px solid rgba(205, 127, 50,0.1)' }}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-light tracking-tight text-white" style={{ fontFamily: "'Cinzel', serif" }}>{format(currentDate, 'MMMM yyyy')}</h3>
            <div className="flex gap-2">
              <button onClick={prevMonth} className="p-2 rounded-full text-white/50 hover:text-[#D4AF37] border border-transparent hover:border-[rgba(205, 127, 50,0.2)] transition-all"><ChevronLeft className="w-5 h-5" /></button>
              <button onClick={nextMonth} className="p-2 rounded-full text-white/50 hover:text-[#D4AF37] border border-transparent hover:border-[rgba(205, 127, 50,0.2)] transition-all"><ChevronRight className="w-5 h-5" /></button>
            </div>
          </div>

          {/* Legend */}
          <div className="flex gap-4 mb-4 text-xs font-bold tracking-wider">
            {(filter === 'all' || filter === 'visits') && <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#D4AF37' }} />Visits</span>}
            {(filter === 'all' || filter === 'appointments') && <span className="flex items-center gap-1.5" style={{ color: '#60a5fa' }}><span className="w-2.5 h-2.5 rounded-full bg-blue-400" />Appointments</span>}
          </div>

          <div className="grid grid-cols-7 gap-2 text-center text-sm font-bold tracking-widest uppercase mb-4" style={{ color: 'rgba(205, 127, 50,0.35)' }}>
            <div>Su</div><div>Mo</div><div>Tu</div><div>We</div><div>Th</div><div>Fr</div><div>Sa</div>
          </div>

          <div className="grid grid-cols-7 gap-2 flex-1">
            {(paddingDays as null[]).map((_, i) => (
              <div key={`pad-${i}`} className="rounded-xl border border-transparent opacity-30" style={{ background: 'rgba(17,17,17,0.5)' }} />
            ))}
            {daysInMonth.map((day, i) => {
              const dayVisits = filter !== 'appointments' ? visits.filter(v => v.visit_date && isSameDay(new Date(v.visit_date), day)) : [];
              const dayAppts = filter !== 'visits' ? appointments.filter(a => a.appointment_date && isSameDay(parseISO(a.appointment_date), day) && a.status === 'scheduled') : [];
              const dayRevenue = dayVisits.reduce((sum, v) => sum + (Number(v.grand_total) || 0), 0);
              const isSelected = isSameDay(day, selectedDate);

              return (
                <div
                  key={i}
                  onClick={() => setSelectedDate(day)}
                  className="rounded-xl border p-2 flex flex-col cursor-pointer transition-all duration-300"
                  style={isSelected ? { background: 'rgba(205, 127, 50,0.1)', borderColor: 'rgba(205, 127, 50,0.4)', boxShadow: '0 0 20px rgba(205, 127, 50,0.1)', transform: 'scale(1.05)' } : { background: 'rgba(17,17,17,0.6)', borderColor: 'rgba(205, 127, 50,0.06)' }}
                  onMouseEnter={e => { if (!isSelected) { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(205, 127, 50,0.2)'; (e.currentTarget as HTMLElement).style.background = 'rgba(205, 127, 50,0.04)'; } }}
                  onMouseLeave={e => { if (!isSelected) { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(205, 127, 50,0.06)'; (e.currentTarget as HTMLElement).style.background = 'rgba(17,17,17,0.6)'; } }}
                >
                  <span className={`text-sm font-bold mb-1 ${isSelected ? 'text-[#D4AF37]' : 'text-white/70'}`}>{format(day, 'd')}</span>
                  <div className="mt-auto space-y-1">
                    {dayVisits.length > 0 && (
                      <div className="text-xs">
                        <div className="font-semibold flex items-center" style={{ color: isSelected ? '#E5C158' : '#D4AF37' }}>₹{dayRevenue.toLocaleString()}</div>
                        <div className={`flex items-center ${isSelected ? 'text-white/90' : 'text-white/50'}`}><Users className="w-3 h-3 mr-0.5" />{dayVisits.length}</div>
                      </div>
                    )}
                    {dayAppts.length > 0 && (
                      <div className="flex items-center text-xs" style={{ color: '#60a5fa' }}>
                        <CalendarCheck className="w-3 h-3 mr-0.5" />{dayAppts.length}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Panel */}
        <div className="glass-card p-6 flex flex-col h-full overflow-hidden" style={{ border: '1px solid rgba(205, 127, 50,0.1)' }}>
          <h3 className="text-xl font-light tracking-wide text-white mb-4 pb-4 shrink-0" style={{ borderBottom: '1px solid rgba(205, 127, 50,0.1)', fontFamily: "'Cinzel', serif" }}>
            {format(selectedDate, 'dd MMMM yyyy')}
          </h3>

          <div className="grid grid-cols-2 gap-3 mb-4 shrink-0">
            {(filter === 'all' || filter === 'visits') && (
              <div className="p-4 rounded-2xl" style={{ background: 'rgba(17,17,17,0.6)', border: '1px solid rgba(205, 127, 50,0.1)' }}>
                <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(205, 127, 50,0.4)' }}>Revenue</p>
                <p className="text-2xl font-light flex items-center" style={{ color: '#D4AF37' }}><IndianRupee className="w-4 h-4 mr-0.5" />{totalRevenue.toLocaleString()}</p>
              </div>
            )}
            {(filter === 'all' || filter === 'appointments') && (
              <div className="p-4 rounded-2xl" style={{ background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.15)' }}>
                <p className="text-xs font-bold uppercase tracking-widest mb-1 text-blue-400">Appointments</p>
                <p className="text-2xl font-light text-blue-300">{selectedDateAppts.filter(a => a.status === 'scheduled').length}</p>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-4">
            {/* Appointments Section */}
            {(filter === 'all' || filter === 'appointments') && selectedDateAppts.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-3 flex items-center gap-1"><CalendarCheck className="w-3 h-3" /> Appointments</p>
                <div className="space-y-3">
                  {selectedDateAppts.map((a, i) => (
                    <div key={a.id || i} className="rounded-xl p-4" style={{ background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.15)' }}>
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-medium text-white">{a.customer_name}</span>
                        <span className="text-xs text-blue-400">{format(parseISO(a.appointment_date), 'hh:mm a')}</span>
                      </div>
                      {a.staff?.name && <p className="text-xs text-white/40 mb-2">with {a.staff.name}</p>}
                      {a.status === 'scheduled' && (
                        <button
                          onClick={() => handleCheckIn(a)}
                          disabled={checkingIn === a.id}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors"
                          style={{ color: '#34d399', background: 'rgba(52,211,153,0.08)', borderColor: 'rgba(52,211,153,0.25)' }}
                        >
                          {checkingIn === a.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Check In
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Visits Section */}
            {(filter === 'all' || filter === 'visits') && (
              <div>
                {(filter === 'all' && selectedDateAppts.length > 0) && (
                  <p className="text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-1" style={{ color: 'rgba(205, 127, 50,0.5)' }}><Users className="w-3 h-3" /> Completed Visits</p>
                )}
                {selectedDateVisits.length === 0 ? (
                  filter === 'visits' && (
                    <div className="text-center text-white/40 py-8">
                      <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="font-light">No visits on this date.</p>
                    </div>
                  )
                ) : (
                  <div className="space-y-3">
                    {selectedDateVisits.map((v, i) => (
                      <div key={v.id || i} className="rounded-2xl p-5 transition-all" style={{ background: 'rgba(17,17,17,0.6)', border: '1px solid rgba(205, 127, 50,0.08)' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(205, 127, 50,0.2)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(205, 127, 50,0.08)'; }}>
                        <div className="flex justify-between items-start mb-3">
                          <h4 className="font-medium text-white">{i + 1}. {v.customer?.name || 'Walk-in'}</h4>
                          <span className="font-bold" style={{ color: '#D4AF37' }}>₹{(v.grand_total || 0).toLocaleString()}</span>
                        </div>
                        <div className="text-sm text-white/60 space-y-1.5">
                          {v.visit_services?.map((svc: any, idx: number) => (
                            <div key={idx} className="flex justify-between px-3 py-1.5 rounded-lg" style={{ background: 'rgba(0,0,0,0.3)' }}>
                              <span className="text-white">{svc.service_name}</span>
                              <span>₹{svc.price}</span>
                            </div>
                          ))}
                          {v.visit_products?.map((prod: any, idx: number) => (
                            <div key={idx} className="flex justify-between px-3 py-1.5 rounded-lg" style={{ background: 'rgba(0,0,0,0.3)' }}>
                              <span className="text-white flex items-center"><Package className="w-3 h-3 mr-1.5 opacity-50" />{prod.product_name} (×{prod.quantity})</span>
                              <span>₹{prod.price}</span>
                            </div>
                          ))}
                          <div className="pt-2 flex justify-between text-xs" style={{ borderTop: '1px solid rgba(205, 127, 50,0.08)' }}>
                            <span className="uppercase tracking-wider font-bold" style={{ color: 'rgba(205, 127, 50,0.4)' }}>Served by</span>
                            <span className="text-white font-medium">{v.staff?.name || 'Unknown'}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Empty state for all */}
            {filter === 'all' && selectedDateVisits.length === 0 && selectedDateAppts.length === 0 && (
              <div className="text-center text-white/40 py-10">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="font-light">Nothing scheduled on this date.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
