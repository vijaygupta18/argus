import { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  AlertCircle,
  Users,
  Shield,
  LogOut,
  Menu,
  X,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { fetchDashboardStats } from '../api/client';
import Avatar from './Avatar';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/issues', icon: AlertCircle, label: 'Issues', badgeKey: 'open_issues' as const },
  { to: '/teams', icon: Users, label: 'Teams' },
  { to: '/how-it-works', icon: Sparkles, label: 'How It Works' },
];

function RoleBadge({ role }: { role: 'admin' | 'leader' | 'worker' | 'reader' }) {
  const colors = {
    admin: 'bg-purple-100 text-purple-700 ring-1 ring-purple-200',
    leader: 'bg-blue-100 text-blue-700 ring-1 ring-blue-200',
    worker: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
    reader: 'bg-gray-100 text-gray-500 ring-1 ring-gray-200',
  };

  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md ${colors[role]}`}>
      {role.charAt(0).toUpperCase() + role.slice(1)}
    </span>
  );
}

function BadgeCount({ value, isActive }: { value: number; isActive: boolean }) {
  const prevValueRef = useRef(value);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (prevValueRef.current !== value) {
      prevValueRef.current = value;
      setPulse(true);
      const timer = setTimeout(() => setPulse(false), 400);
      return () => clearTimeout(timer);
    }
  }, [value]);

  return (
    <span
      className={`text-xs font-semibold px-2 py-0.5 rounded-full min-w-[1.5rem] text-center transition-colors duration-200 ${
        isActive
          ? 'bg-blue-600 text-white'
          : 'bg-slate-200 text-slate-600'
      } ${pulse ? 'animate-badge-pulse' : ''}`}
    >
      {value}
    </span>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout, isAdmin } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: fetchDashboardStats,
    staleTime: 60_000,
  });

  const userRole: 'admin' | 'leader' | 'worker' | 'reader' = isAdmin
    ? 'admin'
    : user?.roles && Object.values(user.roles).includes('leader')
      ? 'leader'
      : user?.roles && Object.keys(user.roles).length > 0
        ? 'worker'
        : 'reader';

  return (
    <>
      {/* Logo / Brand */}
      <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-200/60 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-md shadow-blue-500/20">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div>
          <span className="text-lg font-bold text-slate-900 tracking-tight">
            Argus
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={onNavigate}
            className={({ isActive }) =>
              `relative flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-blue-50 text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-600 rounded-r-full transition-opacity duration-200 ${isActive ? 'opacity-100' : 'opacity-0'}`} />
                <item.icon className={`w-5 h-5 transition-colors duration-200 ${isActive ? 'text-blue-600' : ''}`} />
                <span className="flex-1">{item.label}</span>
                {item.badgeKey && stats && stats[item.badgeKey] > 0 && (
                  <BadgeCount
                    value={stats[item.badgeKey]}
                    isActive={isActive}
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User Info */}
      {user && (
        <div className="border-t border-slate-200/60 p-4 shrink-0 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          <div className="flex items-center gap-3">
            <Avatar name={user.name} size="md" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{user.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <RoleBadge role={userRole} />
              </div>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default function Layout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-gradient-to-b from-slate-50 to-white border-r border-slate-200 flex-col shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 h-14 bg-white/80 backdrop-blur-lg border-b border-slate-200 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-sm shadow-blue-500/20">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <span className="text-base font-bold text-slate-900">Argus</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      <div
        className={`md:hidden fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity duration-200 ${
          mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setMobileMenuOpen(false)}
      />

      {/* Mobile Sidebar Drawer */}
      <aside
        className={`md:hidden fixed top-0 left-0 bottom-0 z-50 w-72 bg-gradient-to-b from-slate-50 to-white border-r border-slate-200 flex flex-col transform transition-transform duration-300 ease-in-out ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarContent onNavigate={() => setMobileMenuOpen(false)} />
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto md:pt-0 pt-14">
        <div key={location.pathname} className="page-enter">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export { RoleBadge };
