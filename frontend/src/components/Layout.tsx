import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  AlertCircle,
  Users,
  Settings,
  Shield,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/issues', icon: AlertCircle, label: 'Issues' },
  { to: '/teams', icon: Users, label: 'Teams' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

function RoleBadge({ role }: { role: 'admin' | 'leader' | 'worker' }) {
  const colors = {
    admin: 'bg-purple-100 text-purple-700',
    leader: 'bg-blue-100 text-blue-700',
    worker: 'bg-slate-100 text-slate-600',
  };

  return (
    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${colors[role]}`}>
      {role.charAt(0).toUpperCase() + role.slice(1)}
    </span>
  );
}

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0">
        {/* Logo / Brand */}
        <div className="h-16 flex items-center gap-2.5 px-6 border-b border-slate-200">
          <Shield className="w-6 h-6 text-blue-600" />
          <span className="text-lg font-semibold text-slate-900 tracking-tight">
            Argus
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User Info */}
        {user && (
          <div className="border-t border-slate-200 p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-sm font-semibold text-slate-600 shrink-0">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-slate-900 truncate">{user.name}</p>
                  {isAdmin && <RoleBadge role="admin" />}
                </div>
                <p className="text-xs text-slate-500 truncate">{user.email}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-2 w-full mt-3 px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}

export { RoleBadge };
