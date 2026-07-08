import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  LayoutDashboard, Users, Package, Calendar, CalendarCheck,
  FileText, PieChart, Scissors,
  LogOut, User as UserIcon, List, Tag
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';
import type { UserRole } from '../../contexts/AuthContext';
import RoleGuard from './RoleGuard';

interface NavItem {
  name: string;
  href: string;
  icon: any;
  allowedRoles: UserRole[];
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, allowedRoles: ['Owner', 'Manager', 'Receptionist'] },
  { name: 'Calendar', href: '/calendar', icon: Calendar, allowedRoles: ['Owner', 'Manager', 'Receptionist'] },
  { name: 'Appointments', href: '/appointments', icon: CalendarCheck, allowedRoles: ['Owner', 'Manager', 'Receptionist'] },
  { name: 'Customer Management', href: '/customers', icon: Users, allowedRoles: ['Owner', 'Manager', 'Receptionist'] },
  { name: 'Services', href: '/services', icon: List, allowedRoles: ['Owner', 'Manager', 'Receptionist'] },
  { name: 'Packages', href: '/packages', icon: Tag, allowedRoles: ['Owner', 'Manager', 'Receptionist'] },
  { name: 'Inventory', href: '/inventory', icon: Package, allowedRoles: ['Owner', 'Manager', 'Receptionist'] },
  { name: 'Staff', href: '/staff', icon: Users, allowedRoles: ['Owner', 'Manager'] },
  { name: 'Expenses', href: '/expenses', icon: FileText, allowedRoles: ['Owner', 'Manager'] },
  { name: 'Accounts', href: '/accounts', icon: PieChart, allowedRoles: ['Owner', 'Manager'] },
];

export default function Sidebar({ onClose }: { onClose?: () => void }) {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="flex h-full w-full flex-col glass-sidebar rounded-[24px] relative overflow-hidden">
      
      {/* Subtle gold ambient glow at top */}
      <div
        className="absolute top-0 left-0 right-0 h-40 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at top center, rgba(200, 157, 60,0.04) 0%, transparent 70%)' }}
      />

      {/* Brand Header */}
      <div className="flex h-24 shrink-0 items-center px-6 relative" style={{ borderBottom: '1px solid rgba(200, 157, 60,0.1)' }}>
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center mr-3 shrink-0 overflow-hidden shadow-sm"
          style={{ border: '1px solid rgba(200, 157, 60,0.35)', boxShadow: '0 0 15px rgba(200, 157, 60,0.08)' }}
        >
          <img src="/logo.jpeg" alt="VJ hair & beauty studio Logo" className="w-full h-full object-cover" />
        </div>
        <div>
          <h1
            className="text-base font-semibold tracking-widest leading-none"
            style={{ fontFamily: "'Cinzel', 'Playfair Display', Georgia, serif", color: 'var(--gold)' }}
          >
            VJ hair & beauty studio
          </h1>
          <p className="text-[10px] tracking-[0.18em] uppercase mt-0.5" style={{ color: 'rgba(200, 157, 60,0.45)' }}>
            SALON
          </p>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex flex-1 flex-col overflow-y-auto custom-scrollbar px-3 py-5 bg-transparent">
        <nav className="flex-1 space-y-1">
          <div className="px-3 pb-3">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: 'rgba(200, 157, 60,0.3)' }}>
              Navigation
            </p>
          </div>
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <RoleGuard key={item.name} allowedRoles={item.allowedRoles}>
                <NavLink
                  to={item.href}
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      'group flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-300 relative',
                      isActive
                        ? 'text-white'
                        : 'text-[#B8B8B8] hover:text-white hover:bg-[rgba(200, 157, 60,0.04)]'
                    )
                  }
                  style={({ isActive }) => isActive ? {
                    background: 'linear-gradient(90deg, rgba(200, 157, 60,0.12) 0%, rgba(200, 157, 60,0.02) 100%)',
                    borderLeft: '3px solid var(--gold)',
                  } : {
                    background: 'transparent',
                    borderLeft: '3px solid transparent',
                  }}
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        className={cn(
                          'mr-3 h-5 w-5 shrink-0 transition-colors duration-300',
                          isActive ? 'text-[var(--gold)]' : 'text-white/40 group-hover:text-[var(--gold)]'
                        )}
                        strokeWidth={isActive ? 2 : 1.5}
                        aria-hidden="true"
                      />
                      <span className="relative z-10 text-[13px]">{item.name}</span>
                    </>
                  )}
                </NavLink>
              </RoleGuard>
            );
          })}
        </nav>
      </div>

      {/* Footer Actions */}
      <div
        className="p-3 space-y-2 relative"
        style={{ borderTop: '1px solid rgba(200, 157, 60,0.1)' }}
      >
        {profile && (
          <div
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
            style={{ background: 'rgba(200, 157, 60,0.04)', border: '1px solid rgba(200, 157, 60,0.1)' }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              style={{ background: 'rgba(200, 157, 60,0.1)', border: '1px solid rgba(200, 157, 60,0.25)' }}
            >
              <UserIcon className="w-3.5 h-3.5" style={{ color: 'var(--gold)' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold truncate" style={{ color: '#EAEAEA' }}>
                VJ hair & beauty studio
              </p>
              <p className="text-[10px] uppercase tracking-wider truncate" style={{ color: 'rgba(200, 157, 60,0.5)' }}>
                {profile.role}
              </p>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="w-full group flex items-center justify-center rounded-xl px-4 py-2.5 text-[12px] font-medium transition-all duration-200"
          style={{ color: '#CF6679', border: '1px solid transparent' }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(207,102,121,0.08)';
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(207,102,121,0.2)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.borderColor = 'transparent';
          }}
        >
          <LogOut className="mr-2 h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
