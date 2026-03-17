import { Activity } from 'lucide-react';
import Dashboard from '../components/Dashboard';

export default function DashboardPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-600" />
          <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          Real-time overview of all production issues and team performance
        </p>
      </div>
      <Dashboard />
    </div>
  );
}
