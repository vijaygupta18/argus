import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import SlackFlowAnimation from '../components/SlackFlowAnimation';
import DashboardFlowAnimation from '../components/DashboardFlowAnimation';
import RCAFlowAnimation from '../components/RCAFlowAnimation';
import {
  Shield,
  MessageSquare,
  Brain,
  LayoutDashboard,
  Search,
  CheckCircle,
  Users,
  Bell,
  Clock,
  History,
  ArrowLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Intersection Observer hook                                         */
/* ------------------------------------------------------------------ */

function useInView(threshold = 0.2) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setInView(true);
      },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return { ref, inView };
}

/* ------------------------------------------------------------------ */
/*  Flow Steps Data                                                    */
/* ------------------------------------------------------------------ */

interface FlowStep {
  step: number;
  icon: typeof MessageSquare;
  title: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
  ringColor: string;
  visual: React.ReactNode;
}

/* ------------------------------------------------------------------ */
/*  Step Visuals                                                       */
/* ------------------------------------------------------------------ */

function SlackMessageVisual({ animate }: { animate: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm mt-4">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-bold">VG</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">Vijay Gupta</span>
            <span className="text-[10px] text-slate-400">11:42 AM</span>
          </div>
          <p className="text-sm text-slate-700 mt-1">
            <span className="inline-flex items-center bg-blue-50 text-blue-700 font-medium px-1 rounded text-xs">@Argus</span>{' '}
            <span
              className={`inline-block overflow-hidden whitespace-nowrap ${animate ? 'hiw-typewriter' : ''}`}
              style={{ maxWidth: animate ? '16ch' : '16ch' }}
            >
              redis is running high
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

function CategorizationVisual({ animate }: { animate: boolean }) {
  const items = [
    { label: 'Priority', value: 'High', colors: 'bg-orange-100 text-orange-700 ring-1 ring-orange-200' },
    { label: 'Category', value: 'Infrastructure', colors: 'bg-blue-100 text-blue-700 ring-1 ring-blue-200' },
    { label: 'Team', value: 'Infra', colors: 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200' },
    { label: 'Assignee', value: 'Rahul M.', colors: 'bg-green-100 text-green-700 ring-1 ring-green-200' },
  ];

  return (
    <div className="flex flex-wrap gap-2 mt-4">
      {items.map((item, i) => (
        <div
          key={item.label}
          className={`transition-all duration-500 ${
            animate ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
          }`}
          style={{ transitionDelay: animate ? `${i * 150}ms` : '0ms' }}
        >
          <div className="flex items-center gap-1.5 bg-white rounded-lg border border-slate-200 px-3 py-2 shadow-sm">
            <span className="text-[10px] text-slate-400 uppercase tracking-wide">{item.label}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${item.colors}`}>
              {item.value}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function DashboardMockVisual({ animate }: { animate: boolean }) {
  const rows = [
    { priority: 'bg-red-500', title: 'Redis OOM', status: 'Open', team: 'Infra' },
    { priority: 'bg-orange-500', title: 'API latency spike', status: 'Open', team: 'Backend' },
    { priority: 'bg-yellow-500', title: 'UI timeout errors', status: 'In Progress', team: 'Frontend' },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm mt-4 overflow-hidden">
      {rows.map((row, i) => (
        <div
          key={row.title}
          className={`flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 last:border-b-0 transition-all duration-500 ${
            animate ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
          }`}
          style={{ transitionDelay: animate ? `${i * 120}ms` : '0ms' }}
        >
          <div className={`w-1 h-6 rounded-full ${row.priority}`} />
          <span className="text-xs font-medium text-slate-700 flex-1">{row.title}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{row.status}</span>
          <span className="text-[10px] text-slate-400">{row.team}</span>
        </div>
      ))}
    </div>
  );
}

function RCAChecklistVisual({ animate }: { animate: boolean }) {
  const items = [
    { label: 'check_prometheus_metrics', done: true },
    { label: 'search_elasticsearch_logs', done: true },
    { label: 'kubectl_get_pods', done: false },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm mt-4 p-4 space-y-2.5">
      {items.map((item, i) => (
        <div
          key={item.label}
          className={`flex items-center gap-2.5 transition-all duration-500 ${
            animate ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'
          }`}
          style={{ transitionDelay: animate ? `${(i + 1) * 400}ms` : '0ms' }}
        >
          {item.done ? (
            <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
          ) : (
            <Loader2
              className={`w-4 h-4 text-amber-500 shrink-0 ${animate ? 'animate-spin' : ''}`}
            />
          )}
          <code className="text-xs text-slate-600 font-mono">{item.label}</code>
        </div>
      ))}
    </div>
  );
}

function ResolutionVisual({ animate }: { animate: boolean }) {
  return (
    <div
      className={`bg-white rounded-xl border border-slate-200 shadow-sm mt-4 p-4 transition-all duration-700 ${
        animate ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
      }`}
      style={{ transitionDelay: animate ? '200ms' : '0ms' }}
    >
      <div className="flex items-center gap-2 mb-2">
        <CheckCircle className="w-4 h-4 text-green-500" />
        <span className="text-xs font-semibold text-green-700">Resolved</span>
      </div>
      <p className="text-xs text-slate-600 leading-relaxed">
        Increased Redis maxmemory to 8GB and enabled eviction policy. Deployed config update via
        helm upgrade. Verified memory usage stabilized.
      </p>
      <div className="flex items-center gap-2 mt-3 text-[10px] text-slate-400">
        <span>Closed by Rahul M.</span>
        <span>&middot;</span>
        <span>Slack thread updated</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Flow Step Card (animated, with visual)                             */
/* ------------------------------------------------------------------ */
function FlowStepCardAnimated({ stepData, index }: { stepData: Omit<FlowStep, 'visual'>; index: number; }) {
  const { ref, inView } = useInView(0.15);
  const isEven = index % 2 === 0;

  const visuals: Record<number, React.ReactNode> = {
    1: <SlackMessageVisual animate={inView} />,
    2: <CategorizationVisual animate={inView} />,
    3: <DashboardMockVisual animate={inView} />,
    4: <RCAChecklistVisual animate={inView} />,
    5: <ResolutionVisual animate={inView} />,
  };

  return (
    <div ref={ref} className="relative flex items-start">
      {/* Timeline center line + dot — hidden on mobile, shown on md+ */}
      <div className="absolute left-5 top-0 bottom-0 flex flex-col items-center md:left-1/2 md:-translate-x-1/2 z-10">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg transition-all duration-700 ${
            inView ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
          } ${stepData.bgColor}`}
          style={{ transitionDelay: '100ms' }}
        >
          {stepData.step}
        </div>
        {index < 4 && (
          <div
            className={`w-0.5 flex-1 mt-2 rounded-full transition-all duration-1000 origin-top ${
              inView ? 'hiw-line-grow opacity-40' : 'opacity-0'
            }`}
            style={{
              transitionDelay: '400ms',
              backgroundColor:
                stepData.step === 1 ? '#a855f7' :
                stepData.step === 2 ? '#3b82f6' :
                stepData.step === 3 ? '#f59e0b' :
                stepData.step === 4 ? '#6366f1' : '#22c55e',
            }}
          />
        )}
      </div>

      {/* Card */}
      <div
        className={`ml-16 md:ml-0 md:w-[calc(50%-2rem)] transition-all duration-700 ${
          inView
            ? 'opacity-100 translate-x-0 translate-y-0'
            : `opacity-0 ${isEven ? 'md:-translate-x-8' : 'md:translate-x-8'} translate-y-4`
        } ${isEven ? 'md:mr-auto md:pr-4' : 'md:ml-auto md:pl-4'}`}
        style={{ transitionDelay: '200ms' }}
      >
        <div className={`rounded-2xl border p-6 bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow ${stepData.ringColor}`}>
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stepData.bgColor}`}>
              <stepData.icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                Step {stepData.step}
              </p>
              <h3 className="text-lg font-bold text-slate-900">{stepData.title}</h3>
            </div>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">{stepData.description}</p>
          {visuals[stepData.step]}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Interactive Demos                                                   */

function InteractiveDemos() {
  const { ref, inView } = useInView();
  const [activeTab, setActiveTab] = useState<'slack' | 'dashboard' | 'rca'>('slack');

  const tabs = [
    { id: 'slack' as const, label: 'Slack Flow', icon: MessageSquare },
    { id: 'dashboard' as const, label: 'Dashboard Flow', icon: LayoutDashboard },
    { id: 'rca' as const, label: 'AI Investigation', icon: Brain },
  ];

  return (
    <section ref={ref} className="max-w-5xl mx-auto px-4 py-20">
      <div className={`text-center mb-10 transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <h2 className="text-2xl font-bold text-slate-900">See It In Action</h2>
        <p className="text-sm text-slate-500 mt-2">Interactive demos showing every flow</p>
      </div>

      <div className={`transition-all duration-700 delay-200 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        {/* Tabs */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Animation */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
          {activeTab === 'slack' && <SlackFlowAnimation autoPlay />}
          {activeTab === 'dashboard' && <DashboardFlowAnimation />}
          {activeTab === 'rca' && <RCAFlowAnimation autoPlay />}
        </div>
      </div>
    </section>
  );
}


/*  Features Grid                                                      */
/* ------------------------------------------------------------------ */

const features = [
  { icon: Users, label: 'Multi-assign', desc: 'Assign issues to multiple team members simultaneously.' },
  { icon: Shield, label: 'Role-based Access', desc: 'Admin, Leader, Worker, and Reader roles with fine-grained permissions.' },
  { icon: Bell, label: 'Slack Notifications', desc: 'Thread updates, emoji swaps, and team mentions — all automated.' },
  { icon: Brain, label: 'AI-powered RCA', desc: 'Vishwakarma SRE agent investigates using Prometheus, ES, kubectl, and more.' },
  { icon: Clock, label: 'Periodic Reminders', desc: 'Stale issues get automatic follow-up reminders to keep things moving.' },
  { icon: History, label: 'Full Audit Trail', desc: 'Every action, comment, and status change is tracked and timestamped.' },
];

function FeaturesGrid() {
  const { ref, inView } = useInView(0.1);

  return (
    <section ref={ref} className="py-20 px-4">
      <div className="max-w-5xl mx-auto">
        <div
          className={`text-center mb-12 transition-all duration-700 ${
            inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <h2 className="text-3xl font-bold text-slate-900">Built for Real Operations</h2>
          <p className="text-slate-500 mt-2">Everything your team needs, nothing it doesn't.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <div
              key={f.label}
              className={`bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/80 p-6 hover:shadow-md hover:border-slate-300 transition-all duration-500 ${
                inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
              }`}
              style={{ transitionDelay: inView ? `${i * 80}ms` : '0ms' }}
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 mb-1">{f.label}</h3>
              <p className="text-xs text-slate-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Roles Section                                                      */
/* ------------------------------------------------------------------ */

const roles = [
  {
    name: 'Admin',
    color: 'from-purple-500 to-purple-700',
    badgeColor: 'bg-purple-100 text-purple-700 ring-1 ring-purple-200',
    perms: ['Manage all issues', 'Manage teams & members', 'Assign roles', 'Configure Slack integration', 'View audit trail'],
  },
  {
    name: 'Leader',
    color: 'from-blue-500 to-blue-700',
    badgeColor: 'bg-blue-100 text-blue-700 ring-1 ring-blue-200',
    perms: ['Manage team issues', 'Assign within team', 'Trigger RCA investigations', 'Close & resolve issues'],
  },
  {
    name: 'Worker',
    color: 'from-slate-500 to-slate-700',
    badgeColor: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
    perms: ['View assigned issues', 'Update status & comments', 'Mark issues resolved', 'View team dashboard'],
  },
  {
    name: 'Reader',
    color: 'from-emerald-500 to-emerald-700',
    badgeColor: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200',
    perms: ['View all issues (read-only)', 'Browse dashboards', 'Search & filter', 'No edit permissions'],
  },
];

function RolesSection() {
  const { ref, inView } = useInView(0.1);

  return (
    <section ref={ref} className="py-20 px-4 bg-gradient-to-b from-slate-50/50 to-white">
      <div className="max-w-5xl mx-auto">
        <div
          className={`text-center mb-12 transition-all duration-700 ${
            inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <h2 className="text-3xl font-bold text-slate-900">Role-Based Access</h2>
          <p className="text-slate-500 mt-2">Four roles, clear boundaries, full control.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {roles.map((role, i) => (
            <div
              key={role.name}
              className={`bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/80 overflow-hidden hover:shadow-md transition-all duration-500 ${
                inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}
              style={{ transitionDelay: inView ? `${i * 100}ms` : '0ms' }}
            >
              <div className={`h-1.5 bg-gradient-to-r ${role.color}`} />
              <div className="p-5">
                <span className={`text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md ${role.badgeColor}`}>
                  {role.name}
                </span>
                <ul className="mt-4 space-y-2">
                  {role.perms.map((p) => (
                    <li key={p} className="flex items-start gap-2 text-xs text-slate-600">
                      <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

const steps: Omit<FlowStep, 'visual'>[] = [
  {
    step: 1,
    icon: MessageSquare,
    title: 'Report via Slack',
    description: 'Tag @Argus in any Slack channel. Describe the issue in plain English.',
    color: 'purple',
    bgColor: 'bg-gradient-to-br from-purple-500 to-purple-700',
    borderColor: 'border-purple-300',
    ringColor: 'border-purple-200/60',
  },
  {
    step: 2,
    icon: Brain,
    title: 'AI Categorizes & Assigns',
    description:
      'AI analyzes the message, determines priority and category, picks the best team, and auto-assigns to the member with the lowest workload.',
    color: 'blue',
    bgColor: 'bg-gradient-to-br from-blue-500 to-blue-700',
    borderColor: 'border-blue-300',
    ringColor: 'border-blue-200/60',
  },
  {
    step: 3,
    icon: LayoutDashboard,
    title: 'Track on Dashboard',
    description:
      'View all issues, filter by status/priority/team. Search, paginate, and drill into details.',
    color: 'amber',
    bgColor: 'bg-gradient-to-br from-amber-500 to-amber-600',
    borderColor: 'border-amber-300',
    ringColor: 'border-amber-200/60',
  },
  {
    step: 4,
    icon: Search,
    title: 'AI Root Cause Analysis',
    description:
      'Vishwakarma (our SRE agent) investigates using Prometheus, Elasticsearch, kubectl, and more. Watch live progress as it checks each tool.',
    color: 'indigo',
    bgColor: 'bg-gradient-to-br from-indigo-500 to-indigo-700',
    borderColor: 'border-indigo-300',
    ringColor: 'border-indigo-200/60',
  },
  {
    step: 5,
    icon: CheckCircle,
    title: 'Resolve & Close',
    description:
      'Document how you fixed it. Slack thread gets updated. Emojis swap. Team is notified. History is tracked.',
    color: 'green',
    bgColor: 'bg-gradient-to-br from-green-500 to-green-600',
    borderColor: 'border-green-300',
    ringColor: 'border-green-200/60',
  },
];

export default function HowItWorksPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const [heroVisible, setHeroVisible] = useState(false);

  useEffect(() => {
    // Trigger hero animation on mount
    const t = setTimeout(() => setHeroVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 relative overflow-x-hidden">
      {/* Sticky header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-200/60">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/login" className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Back to Login</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-sm">
              <Shield className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-bold text-slate-900">Argus</span>
          </div>
          <Link
            to="/login"
            className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-1"
          >
            Sign In
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* Background decoration */}
      <div className="absolute top-20 left-1/4 w-96 h-96 bg-blue-100/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-96 right-1/4 w-96 h-96 bg-purple-100/20 rounded-full blur-3xl pointer-events-none" />

      {/* ============== HERO ============== */}
      <section ref={heroRef} className="py-24 md:py-32 px-4 text-center relative">
        <div
          className={`transition-all duration-1000 ${
            heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          {/* Pulsing shield */}
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500 to-blue-700 mb-8 shadow-xl shadow-blue-500/25 hiw-pulse-shield">
            <Shield className="w-10 h-10 text-white" />
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight">
            How <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Argus</span> Works
          </h1>
          <p className="text-lg md:text-xl text-slate-500 mt-4 max-w-xl mx-auto leading-relaxed">
            From Slack report to resolution — fully automated
          </p>

          <div className="mt-10 flex items-center justify-center gap-3">
            <a
              href="#flow"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all"
            >
              See the Flow
              <ChevronRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* ============== FLOW STEPS ============== */}
      <section id="flow" className="py-16 px-4 relative">
        <div className="max-w-5xl mx-auto">
          <div className="space-y-12 md:space-y-16">
            {steps.map((step, i) => (
              <FlowStepCardAnimated key={step.step} stepData={step} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ============== FEATURES ============== */}
      <InteractiveDemos />
      <FeaturesGrid />

      {/* ============== ROLES ============== */}
      <RolesSection />

      {/* ============== FOOTER CTA ============== */}
      <section className="py-20 px-4 text-center">
        <div className="max-w-md mx-auto">
          <h2 className="text-2xl font-bold text-slate-900">Ready to get started?</h2>
          <p className="text-slate-500 mt-2 text-sm">Sign in with your Google workspace account and start tracking issues.</p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all"
          >
            Sign In to Argus
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200/60 py-6 text-center">
        <p className="text-xs text-slate-400">Powered by AI &middot; Built for NammaYatri</p>
      </footer>
    </div>
  );
}
