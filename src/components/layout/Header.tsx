import React, { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, Bell, Gift, Menu, ChevronLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';

interface HeaderProps {
  toggleSidebar?: () => void;
  isSidebarOpen?: boolean;
}

export default function Header({ toggleSidebar, isSidebarOpen = true }: HeaderProps) {
  const [birthdays, setBirthdays] = useState<any[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const todayStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  });

  useEffect(() => {
    fetchNotifications();

    // Close dropdown on outside click
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    
    // Setup real-time listener for customers table to auto-refresh notifications
    const channel = supabase.channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'customers' },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchNotifications = async () => {
    try {
      const todayDate = new Date();
      const currentMonth = todayDate.getMonth() + 1;
      const currentDay = todayDate.getDate();

      const { data: bData, error: bError } = await supabase
        .from('customers')
        .select('id, name, phone, dob')
        .eq('is_deleted', false)
        .not('dob', 'is', null);

      if (bError) throw bError;

      if (bData) {
        // Filter in memory to avoid PostgreSQL date type LIKE errors
        const birthdaysToday = bData.filter(c => {
          if (!c.dob) return false;
          const [year, month, day] = c.dob.split('-');
          return parseInt(month, 10) === currentMonth && parseInt(day, 10) === currentDay;
        });
        setBirthdays(birthdaysToday);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  const sendWhatsAppGreeting = (customer: any) => {
    if (!customer.phone) return;
    const cleanPhone = customer.phone.replace(/\D/g, '');
    const message = `A Very Happy Birthday from Team VJ hair & beauty studio!!!\n\nTo make your special day even more memorable, we're delighted to offer you 50% OFF on any ONE service, valid exclusively until today.\n\nWe look forward to celebrating with you!\n\nWith love,\nTeam VJ hair & beauty studio`;
    const url = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  return (
    <header
      className="flex h-24 shrink-0 items-center justify-between px-4 md:px-8 sticky top-0 z-20 backdrop-blur-md"
      style={{
        background: 'rgba(10,10,10,0.6)',
        borderBottom: '1px solid rgba(200, 157, 60,0.08)',
      }}
    >
      
      {/* Left Side: Sidebar Toggle */}
      <div className="flex items-center">
        {toggleSidebar && (
          <button 
            onClick={toggleSidebar} 
            className="p-2.5 mr-4 rounded-xl text-white/60 hover:text-[var(--gold)] transition-all shadow-sm"
            style={{
              background: 'rgba(20,20,20,0.8)',
              border: '1px solid rgba(200, 157, 60,0.12)',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(200, 157, 60,0.3)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(200, 157, 60,0.12)';
            }}
          >
            {isSidebarOpen ? <ChevronLeft className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        )}
      </div>

      <div className="flex items-center gap-6">
        
        {/* Notifications */}
        <div className="relative" ref={dropdownRef}>
          <button 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="p-3 rounded-2xl text-white/60 hover:text-[var(--gold)] transition-all relative shadow-sm"
            style={{
              background: 'rgba(20,20,20,0.8)',
              border: '1px solid rgba(200, 157, 60,0.12)',
            }}
          >
            <Bell className="w-5 h-5" />
            {birthdays.length > 0 && (
              <span
                className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full animate-pulse"
                style={{
                  background: 'var(--gold)',
                  boxShadow: '0 0 10px rgba(200, 157, 60,0.8)',
                }}
              ></span>
            )}
          </button>

          {isDropdownOpen && (
            <div
              className="absolute right-0 mt-3 w-80 rounded-2xl overflow-hidden z-50"
              style={{
                background: 'rgba(17,17,17,0.95)',
                backdropFilter: 'blur(40px)',
                border: '1px solid rgba(200, 157, 60,0.15)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.8), 0 0 30px rgba(200, 157, 60,0.05)',
              }}
            >
              <div className="p-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(200, 157, 60,0.1)' }}>
                <h3 className="text-white font-medium text-sm">Notifications</h3>
                <span
                  className="text-xs px-2 py-1 rounded-full"
                  style={{
                    background: 'rgba(200, 157, 60,0.1)',
                    color: 'var(--gold)',
                    border: '1px solid rgba(200, 157, 60,0.2)',
                  }}
                >
                  {birthdays.length} New
                </span>
              </div>
              
              <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                {birthdays.length === 0 ? (
                  <div className="p-6 text-center text-white/40 text-sm">
                    No new notifications
                  </div>
                ) : (
                  <>
                    {birthdays.map((customer) => (
                      <div
                        key={`b-${customer.id}`}
                        className="p-4 hover:bg-white/5 transition-colors group"
                        style={{ borderBottom: '1px solid rgba(200, 157, 60,0.05)' }}
                      >
                        <div className="flex gap-3">
                          <div
                            className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
                            style={{ background: 'rgba(200, 157, 60,0.1)', border: '1px solid rgba(200, 157, 60,0.2)' }}
                          >
                            <Gift className="w-5 h-5" style={{ color: 'var(--gold)' }} />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm text-white mb-1">
                              It's <span className="font-bold" style={{ color: 'var(--gold)' }}>{customer.name}'s</span> Birthday today! {'\u{1F382}'}
                            </p>
                            <button 
                              onClick={() => sendWhatsAppGreeting(customer)}
                              className="text-xs bg-green-500/20 text-green-400 hover:bg-green-500/30 px-3 py-1.5 rounded-lg font-medium transition-colors mt-2"
                            >
                              Send WhatsApp Greeting
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Date Display */}
        <div
          className="hidden md:flex items-center gap-2 text-sm font-medium text-white px-4 py-2.5 rounded-2xl"
          style={{
            background: 'rgba(20,20,20,0.8)',
            border: '1px solid rgba(200, 157, 60,0.12)',
          }}
        >
          <CalendarIcon className="h-4 w-4" style={{ color: 'var(--gold)' }} />
          {todayStr}
        </div>
      </div>
    </header>
  );
}
