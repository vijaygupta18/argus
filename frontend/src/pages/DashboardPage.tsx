import Dashboard from '../components/Dashboard';

export default function DashboardPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">
          Overview of all production issues
        </p>
      </div>
      <Dashboard />
    </div>
  );
}
