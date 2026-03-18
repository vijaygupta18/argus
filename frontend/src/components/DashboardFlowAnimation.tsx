import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus,
  X,
  ChevronDown,
  CheckCircle,
  Loader2,
  Send,
  UserPlus,
  ArrowRightLeft,
  Bell,
  RotateCcw,
  Sparkles,
  MessageSquare,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  useTypingAnimation hook                                            */
/* ------------------------------------------------------------------ */

function useTypingAnimation(text: string, active: boolean, speed = 45) {
  const [displayed, setDisplayed] = useState('');

  useEffect(() => {
    if (!active) {
      setDisplayed('');
      return;
    }
    let i = 0;
    setDisplayed('');
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(interval);
    }, speed);
    return () => clearInterval(interval);
  }, [text, active, speed]);

  return displayed;
}

/* ------------------------------------------------------------------ */
/*  Shared mini-UI atoms                                               */
/* ------------------------------------------------------------------ */

function TrafficLights() {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
      <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
      <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
    </div>
  );
}

function MiniSidebar() {
  return (
    <div className="w-12 bg-slate-800 rounded-bl-lg flex flex-col items-center py-3 gap-3 shrink-0">
      <div className="w-6 h-6 rounded-md bg-blue-500 flex items-center justify-center">
        <span className="text-[8px] font-bold text-white">A</span>
      </div>
      <div className="w-5 h-0.5 rounded-full bg-slate-600" />
      <div className="w-5 h-0.5 rounded-full bg-slate-700" />
      <div className="w-5 h-0.5 rounded-full bg-slate-700" />
    </div>
  );
}

function StepIndicator({
  total,
  current,
}: {
  total: number;
  current: number;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1 rounded-full transition-all duration-300 ${
            i === current
              ? 'w-5 bg-blue-500'
              : i < current
                ? 'w-2 bg-blue-300'
                : 'w-2 bg-slate-200'
          }`}
        />
      ))}
    </div>
  );
}

function PriorityBar({ color }: { color: string }) {
  return <div className={`w-1 h-8 rounded-full ${color} shrink-0`} />;
}

/* ------------------------------------------------------------------ */
/*  Flow 1: Create from Web                                            */
/* ------------------------------------------------------------------ */

function CreateFlow({ active }: { active: boolean }) {
  const [step, setStep] = useState(-1);
  const timerRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const titleText = 'Redis memory at 98%';
  const typedTitle = useTypingAnimation(titleText, step >= 1, 50);

  const rcaSteps = [
    'Checking Prometheus...',
    'Searching ES logs...',
    'Analyzing...',
  ];

  const cleanup = useCallback(() => {
    timerRef.current.forEach(clearTimeout);
    timerRef.current = [];
  }, []);

  const play = useCallback(() => {
    cleanup();
    setStep(-1);
    // Step 0: button highlight, 0ms
    const t0 = setTimeout(() => setStep(0), 400);
    // Step 1: modal appears, typing starts
    const t1 = setTimeout(() => setStep(1), 1800);
    // Step 2: priority + team appear
    const t2 = setTimeout(() => setStep(2), 3800);
    // Step 3: submitted, card appears
    const t3 = setTimeout(() => setStep(3), 5800);
    // Step 4: RCA investigation
    const t4 = setTimeout(() => setStep(4), 7800);
    // Step 5: RCA summary
    const t5 = setTimeout(() => setStep(5), 12000);
    timerRef.current = [t0, t1, t2, t3, t4, t5];
  }, [cleanup]);

  useEffect(() => {
    if (active) play();
    else {
      cleanup();
      setStep(-1);
    }
    return cleanup;
  }, [active, play, cleanup]);

  const [rcaCheck0, setRcaCheck0] = useState(false);
  const [rcaCheck1, setRcaCheck1] = useState(false);
  const [rcaCheck2, setRcaCheck2] = useState(false);

  useEffect(() => {
    if (step === 4) {
      setRcaCheck0(false);
      setRcaCheck1(false);
      setRcaCheck2(false);
      const a = setTimeout(() => setRcaCheck0(true), 1200);
      const b = setTimeout(() => setRcaCheck1(true), 2400);
      const c = setTimeout(() => setRcaCheck2(true), 3600);
      return () => {
        clearTimeout(a);
        clearTimeout(b);
        clearTimeout(c);
      };
    }
  }, [step]);

  const rcaChecks = [rcaCheck0, rcaCheck1, rcaCheck2];

  return (
    <div className="relative h-full flex">
      <MiniSidebar />
      <div className="flex-1 p-3 overflow-hidden relative bg-slate-50 rounded-br-lg">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] font-semibold text-slate-700">
            Issues
          </div>
          <button
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold text-white transition-all duration-300 ${
              step === 0
                ? 'bg-blue-700 scale-95 shadow-lg shadow-blue-500/30'
                : 'bg-blue-600'
            }`}
          >
            <Plus className="w-3 h-3" />
            Create Issue
          </button>
        </div>

        {/* Background issue list */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 bg-white rounded-md px-2 py-1.5 border border-slate-100">
            <PriorityBar color="bg-orange-500" />
            <span className="text-[9px] text-slate-600 flex-1">
              API latency spike
            </span>
            <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600">
              Open
            </span>
          </div>
          <div className="flex items-center gap-2 bg-white rounded-md px-2 py-1.5 border border-slate-100">
            <PriorityBar color="bg-green-500" />
            <span className="text-[9px] text-slate-600 flex-1">
              Logs cleanup needed
            </span>
            <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600">
              In Progress
            </span>
          </div>
        </div>

        {/* New issue card appears at step 3 */}
        <div
          className={`mt-1.5 transition-all duration-500 ${
            step >= 3
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-3 pointer-events-none'
          }`}
        >
          <div className="flex items-center gap-2 bg-white rounded-md px-2 py-1.5 border border-blue-200 ring-1 ring-blue-100">
            <PriorityBar color="bg-red-500" />
            <span className="text-[9px] text-slate-800 font-medium flex-1">
              Redis memory at 98%
            </span>
            <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">
              Open
            </span>
          </div>
        </div>

        {/* RCA investigation at step 4+ */}
        <div
          className={`mt-2 transition-all duration-500 ${
            step >= 4
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-3 pointer-events-none'
          }`}
        >
          <div className="bg-white rounded-md border border-indigo-200 p-2">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Sparkles className="w-3 h-3 text-indigo-500" />
              <span className="text-[9px] font-semibold text-indigo-700">
                AI Root Cause Analysis
              </span>
            </div>
            <div className="space-y-1">
              {rcaSteps.map((label, i) => (
                <div key={label} className="flex items-center gap-1.5">
                  {rcaChecks[i] ? (
                    <CheckCircle className="w-3 h-3 text-green-500" />
                  ) : step >= 4 ? (
                    <Loader2 className="w-3 h-3 text-amber-500 animate-spin" />
                  ) : (
                    <div className="w-3 h-3 rounded-full bg-slate-100" />
                  )}
                  <span
                    className={`text-[9px] ${rcaChecks[i] ? 'text-green-700' : 'text-slate-500'}`}
                  >
                    {label}{' '}
                    {rcaChecks[i] && (
                      <span className="text-green-500 font-bold">
                        &#10003;
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>

            {/* RCA Summary at step 5 */}
            <div
              className={`mt-1.5 pt-1.5 border-t border-indigo-100 transition-all duration-500 ${
                step >= 5
                  ? 'opacity-100 max-h-20'
                  : 'opacity-0 max-h-0 overflow-hidden'
              }`}
            >
              <p className="text-[8px] text-slate-600 leading-relaxed">
                <span className="font-semibold text-slate-700">Summary:</span>{' '}
                Redis maxmemory-policy set to noeviction causing OOM. Connection
                pool leak detected in payment-service v2.3.1.
              </p>
            </div>
          </div>
        </div>

        {/* Modal overlay for step 1-2 */}
        <div
          className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${
            step >= 1 && step < 3
              ? 'opacity-100'
              : 'opacity-0 pointer-events-none'
          }`}
        >
          <div className="absolute inset-0 bg-black/20 rounded-br-lg" />
          <div className="relative bg-white rounded-lg border border-slate-200 shadow-xl w-[85%] p-3 z-10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-slate-800">
                Create Issue
              </span>
              <X className="w-3 h-3 text-slate-400" />
            </div>

            {/* Title field */}
            <div className="mb-2">
              <label className="text-[8px] text-slate-500 font-medium block mb-0.5">
                Title
              </label>
              <div className="border border-slate-200 rounded px-2 py-1 text-[9px] text-slate-800 min-h-[22px] bg-slate-50">
                {typedTitle}
                {step === 1 && typedTitle.length < titleText.length && (
                  <span className="inline-block w-0.5 h-3 bg-blue-500 animate-pulse ml-px align-middle" />
                )}
              </div>
            </div>

            {/* Priority + Team */}
            <div className="flex gap-2 mb-2">
              <div className="flex-1">
                <label className="text-[8px] text-slate-500 font-medium block mb-0.5">
                  Priority
                </label>
                <div
                  className={`transition-all duration-300 ${step >= 2 ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}
                >
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-semibold bg-red-100 text-red-700 ring-1 ring-red-200">
                    <span className="w-1 h-1 rounded-full bg-red-500" />
                    Critical
                  </span>
                </div>
              </div>
              <div className="flex-1">
                <label className="text-[8px] text-slate-500 font-medium block mb-0.5">
                  Team
                </label>
                <div
                  className={`transition-all duration-300 ${step >= 2 ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}
                  style={{ transitionDelay: '200ms' }}
                >
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-medium bg-slate-100 text-slate-600">
                    Infrastructure
                  </span>
                </div>
              </div>
            </div>

            {/* Submit button */}
            <button
              className={`w-full flex items-center justify-center gap-1 py-1 rounded text-[9px] font-semibold text-white transition-all duration-300 ${
                step >= 2
                  ? 'bg-blue-600 shadow-sm'
                  : 'bg-slate-300 cursor-not-allowed'
              }`}
            >
              <Send className="w-3 h-3" />
              Submit
            </button>
          </div>
        </div>

        {/* Step indicator */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
          <StepIndicator total={6} current={Math.max(0, step)} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Flow 2: Triage & Assign                                            */
/* ------------------------------------------------------------------ */

function TriageFlow({ active }: { active: boolean }) {
  const [step, setStep] = useState(-1);
  const timerRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const cleanup = useCallback(() => {
    timerRef.current.forEach(clearTimeout);
    timerRef.current = [];
  }, []);

  const play = useCallback(() => {
    cleanup();
    setStep(-1);
    const t0 = setTimeout(() => setStep(0), 400); // show issue list
    const t1 = setTimeout(() => setStep(1), 2400); // highlight critical, slide in detail
    const t2 = setTimeout(() => setStep(2), 4400); // click assign
    const t3 = setTimeout(() => setStep(3), 6400); // select Neha
    const t4 = setTimeout(() => setStep(4), 8400); // change team
    const t5 = setTimeout(() => setStep(5), 10400); // team updated notification
    timerRef.current = [t0, t1, t2, t3, t4, t5];
  }, [cleanup]);

  useEffect(() => {
    if (active) play();
    else {
      cleanup();
      setStep(-1);
    }
    return cleanup;
  }, [active, play, cleanup]);

  const issues = [
    {
      color: 'bg-red-500',
      title: 'Redis memory at 98%',
      priority: 'Critical',
      prioColor: 'bg-red-100 text-red-700',
    },
    {
      color: 'bg-orange-500',
      title: 'Payment timeout errors',
      priority: 'High',
      prioColor: 'bg-orange-100 text-orange-700',
    },
    {
      color: 'bg-green-500',
      title: 'Update docs for v2 API',
      priority: 'Low',
      prioColor: 'bg-green-100 text-green-700',
    },
  ];

  return (
    <div className="relative h-full flex">
      <MiniSidebar />
      <div className="flex-1 p-3 overflow-hidden relative bg-slate-50 rounded-br-lg">
        <div className="text-[10px] font-semibold text-slate-700 mb-2">
          Issues
        </div>

        {/* Issue list */}
        <div className="space-y-1.5">
          {issues.map((issue, i) => (
            <div
              key={issue.title}
              className={`flex items-center gap-2 bg-white rounded-md px-2 py-1.5 border transition-all duration-300 cursor-pointer ${
                step >= 1 && i === 0
                  ? 'border-blue-300 ring-1 ring-blue-100 bg-blue-50/50'
                  : 'border-slate-100'
              } ${step >= 0 ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-3'}`}
              style={{ transitionDelay: `${i * 100}ms` }}
            >
              <PriorityBar color={issue.color} />
              <span className="text-[9px] text-slate-700 flex-1 font-medium">
                {issue.title}
              </span>
              <span
                className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium ${issue.prioColor}`}
              >
                {issue.priority}
              </span>
            </div>
          ))}
        </div>

        {/* Detail panel slides in */}
        <div
          className={`absolute top-0 right-0 bottom-0 w-[65%] bg-white border-l border-slate-200 shadow-lg transition-all duration-500 rounded-br-lg ${
            step >= 1
              ? 'translate-x-0 opacity-100'
              : 'translate-x-full opacity-0'
          }`}
        >
          <div className="p-2.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-slate-800">
                Redis memory at 98%
              </span>
              <X className="w-3 h-3 text-slate-400" />
            </div>

            <div className="flex items-center gap-1.5 mb-3">
              <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold ring-1 ring-red-200">
                Critical
              </span>
              <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">
                Open
              </span>
            </div>

            {/* Assign button */}
            <div className="relative mb-2">
              <button
                className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-medium border transition-all duration-300 w-full ${
                  step >= 2
                    ? 'border-blue-300 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                <UserPlus className="w-3 h-3" />
                <span className="flex-1 text-left">
                  {step >= 3 ? 'Neha Singh' : 'Assign'}
                </span>
                <ChevronDown className="w-3 h-3" />
              </button>

              {/* Assign dropdown */}
              <div
                className={`absolute top-full left-0 right-0 mt-0.5 bg-white border border-slate-200 rounded shadow-lg z-10 transition-all duration-300 ${
                  step === 2
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 -translate-y-1 pointer-events-none'
                }`}
              >
                {['Rahul M.', 'Neha Singh', 'Amit K.'].map((name) => (
                  <div
                    key={name}
                    className={`px-2 py-1 text-[9px] cursor-pointer transition-colors ${
                      name === 'Neha Singh'
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {name}
                  </div>
                ))}
              </div>
            </div>

            {/* DM sent notification */}
            <div
              className={`flex items-center gap-1.5 mb-2 px-2 py-1 rounded bg-green-50 border border-green-200 transition-all duration-400 ${
                step >= 3
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 -translate-y-2 pointer-events-none'
              }`}
            >
              <Bell className="w-3 h-3 text-green-600" />
              <span className="text-[8px] text-green-700 font-medium">
                DM sent to Neha Singh
              </span>
            </div>

            {/* Change Team button */}
            <div className="relative mb-2">
              <button
                className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-medium border transition-all duration-300 w-full ${
                  step >= 4
                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                <ArrowRightLeft className="w-3 h-3" />
                <span className="flex-1 text-left">
                  {step >= 5 ? 'Infrastructure' : 'Change Team'}
                </span>
                <ChevronDown className="w-3 h-3" />
              </button>

              {/* Team dropdown */}
              <div
                className={`absolute top-full left-0 right-0 mt-0.5 bg-white border border-slate-200 rounded shadow-lg z-10 transition-all duration-300 ${
                  step === 4
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 -translate-y-1 pointer-events-none'
                }`}
              >
                {['Backend', 'Infrastructure', 'Frontend'].map((team) => (
                  <div
                    key={team}
                    className={`px-2 py-1 text-[9px] cursor-pointer transition-colors ${
                      team === 'Infrastructure'
                        ? 'bg-indigo-50 text-indigo-700 font-medium'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {team}
                  </div>
                ))}
              </div>
            </div>

            {/* Team updated notification */}
            <div
              className={`flex items-center gap-1.5 px-2 py-1 rounded bg-indigo-50 border border-indigo-200 transition-all duration-400 ${
                step >= 5
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 -translate-y-2 pointer-events-none'
              }`}
            >
              <CheckCircle className="w-3 h-3 text-indigo-600" />
              <span className="text-[8px] text-indigo-700 font-medium">
                Team updated to Infrastructure
              </span>
            </div>
          </div>
        </div>

        {/* Step indicator */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20">
          <StepIndicator total={6} current={Math.max(0, step)} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Flow 3: Resolve                                                    */
/* ------------------------------------------------------------------ */

function ResolveFlow({ active }: { active: boolean }) {
  const [step, setStep] = useState(-1);
  const timerRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const reasonText = 'Fixed connection pool size from 10 to 50';
  const typedReason = useTypingAnimation(reasonText, step >= 2, 40);

  const cleanup = useCallback(() => {
    timerRef.current.forEach(clearTimeout);
    timerRef.current = [];
  }, []);

  const play = useCallback(() => {
    cleanup();
    setStep(-1);
    const t0 = setTimeout(() => setStep(0), 400); // show in-progress issue
    const t1 = setTimeout(() => setStep(1), 2400); // click resolve, modal appears
    const t2 = setTimeout(() => setStep(2), 4000); // start typing reason
    const t3 = setTimeout(() => setStep(3), 7000); // submit
    const t4 = setTimeout(() => setStep(4), 9000); // success + confetti
    const t5 = setTimeout(() => setStep(5), 11000); // slack notification
    timerRef.current = [t0, t1, t2, t3, t4, t5];
  }, [cleanup]);

  useEffect(() => {
    if (active) play();
    else {
      cleanup();
      setStep(-1);
    }
    return cleanup;
  }, [active, play, cleanup]);

  return (
    <div className="relative h-full flex">
      <MiniSidebar />
      <div className="flex-1 p-3 overflow-hidden relative bg-slate-50 rounded-br-lg">
        {/* Issue detail view */}
        <div className="mb-2">
          <div className="text-[10px] font-bold text-slate-800 mb-1">
            Redis memory at 98%
          </div>
          <div className="flex items-center gap-1.5 mb-2">
            <span
              className={`text-[8px] px-1.5 py-0.5 rounded-full font-semibold ring-1 transition-all duration-500 ${
                step >= 4
                  ? 'bg-green-100 text-green-700 ring-green-200'
                  : 'bg-amber-100 text-amber-700 ring-amber-200'
              }`}
            >
              <span
                className={`inline-block w-1 h-1 rounded-full mr-1 align-middle ${step >= 4 ? 'bg-green-500' : 'bg-amber-500'}`}
              />
              {step >= 4 ? 'Resolved' : 'In Progress'}
            </span>
            <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold ring-1 ring-red-200">
              Critical
            </span>
            <span className="text-[8px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">
              Infrastructure
            </span>
          </div>

          <div className="text-[8px] text-slate-500 mb-2">
            Assigned to <span className="font-medium text-slate-700">Vijay Gupta</span>
          </div>
        </div>

        {/* Resolve button */}
        <button
          className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-semibold transition-all duration-300 ${
            step === 0
              ? 'bg-green-600 text-white shadow-sm hover:bg-green-700'
              : step >= 4
                ? 'bg-green-100 text-green-700 border border-green-200'
                : 'bg-green-600 text-white scale-95'
          }`}
        >
          <CheckCircle className="w-3 h-3" />
          {step >= 4 ? 'Resolved' : 'Resolve'}
        </button>

        {/* Success animation at step 4 */}
        <div
          className={`mt-2 transition-all duration-500 ${
            step >= 4
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-3 pointer-events-none'
          }`}
        >
          <div className="bg-green-50 border border-green-200 rounded-md p-2 relative overflow-hidden">
            {/* Simple success particles */}
            {step >= 4 && (
              <>
                <div className="absolute top-1 left-3 w-1 h-1 bg-green-400 rounded-full animate-ping" />
                <div
                  className="absolute top-2 right-4 w-1 h-1 bg-emerald-400 rounded-full animate-ping"
                  style={{ animationDelay: '200ms' }}
                />
                <div
                  className="absolute bottom-2 left-8 w-1 h-1 bg-green-300 rounded-full animate-ping"
                  style={{ animationDelay: '400ms' }}
                />
                <div
                  className="absolute top-1 right-10 w-0.5 h-0.5 bg-yellow-400 rounded-full animate-ping"
                  style={{ animationDelay: '100ms' }}
                />
                <div
                  className="absolute bottom-1 right-6 w-0.5 h-0.5 bg-emerald-500 rounded-full animate-ping"
                  style={{ animationDelay: '300ms' }}
                />
              </>
            )}
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-green-600" />
              <span className="text-[9px] font-semibold text-green-700">
                Issue Resolved!
              </span>
            </div>
            <p className="text-[8px] text-green-600 mt-1">
              Fixed connection pool size from 10 to 50
            </p>
          </div>
        </div>

        {/* Slack notification at step 5 */}
        <div
          className={`mt-2 transition-all duration-500 ${
            step >= 5
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-3 pointer-events-none'
          }`}
        >
          <div className="bg-white border border-slate-200 rounded-md p-2 shadow-sm">
            <div className="flex items-center gap-1.5 mb-1">
              <MessageSquare className="w-3 h-3 text-purple-500" />
              <span className="text-[8px] font-semibold text-slate-500">
                Slack Notification
              </span>
            </div>
            <div className="bg-slate-50 rounded px-2 py-1.5">
              <p className="text-[9px] text-slate-700">
                <span className="font-semibold">Issue Resolved</span> by{' '}
                <span className="text-blue-600 font-medium">@Vijay</span>
              </p>
              <p className="text-[8px] text-slate-500 mt-0.5">
                Time to resolve: <span className="font-medium">2.5 hrs</span>
              </p>
            </div>
          </div>
        </div>

        {/* Resolve modal overlay */}
        <div
          className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${
            step >= 1 && step < 3
              ? 'opacity-100'
              : 'opacity-0 pointer-events-none'
          }`}
        >
          <div className="absolute inset-0 bg-black/20 rounded-br-lg" />
          <div className="relative bg-white rounded-lg border border-slate-200 shadow-xl w-[85%] p-3 z-10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-slate-800">
                Resolve Issue
              </span>
              <X className="w-3 h-3 text-slate-400" />
            </div>

            <div className="mb-2">
              <label className="text-[8px] text-slate-500 font-medium block mb-0.5">
                Resolution Notes
              </label>
              <div className="border border-slate-200 rounded px-2 py-1.5 text-[9px] text-slate-800 min-h-[32px] bg-slate-50">
                {typedReason}
                {step === 2 && typedReason.length < reasonText.length && (
                  <span className="inline-block w-0.5 h-3 bg-blue-500 animate-pulse ml-px align-middle" />
                )}
              </div>
            </div>

            <button
              className={`w-full flex items-center justify-center gap-1 py-1 rounded text-[9px] font-semibold text-white transition-all duration-300 ${
                step >= 2 && typedReason.length > 10
                  ? 'bg-green-600 shadow-sm'
                  : 'bg-slate-300 cursor-not-allowed'
              }`}
            >
              <CheckCircle className="w-3 h-3" />
              Confirm Resolution
            </button>
          </div>
        </div>

        {/* Step indicator */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20">
          <StepIndicator total={6} current={Math.max(0, step)} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

const tabs = [
  { id: 'create', label: 'Create from Web' },
  { id: 'triage', label: 'Triage & Assign' },
  { id: 'resolve', label: 'Resolve' },
] as const;

type TabId = (typeof tabs)[number]['id'];

interface DashboardFlowAnimationProps {
  className?: string;
}

export default function DashboardFlowAnimation({
  className = '',
}: DashboardFlowAnimationProps) {
  const [activeTab, setActiveTab] = useState<TabId>('create');
  const [animKey, setAnimKey] = useState(0);

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    setAnimKey((k) => k + 1);
  };

  const handleReplay = () => {
    setAnimKey((k) => k + 1);
  };

  return (
    <div className={`w-full max-w-xl mx-auto ${className}`}>
      {/* Browser chrome */}
      <div className="bg-slate-100 rounded-t-xl border border-b-0 border-slate-200 px-4 py-2.5 flex items-center gap-3">
        <TrafficLights />
        <div className="flex-1 flex justify-center">
          <div className="bg-white rounded-md px-3 py-0.5 text-[10px] text-slate-400 font-mono border border-slate-200 min-w-[160px] text-center">
            app.argus.dev/issues
          </div>
        </div>
        <button
          onClick={handleReplay}
          className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          title="Replay animation"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tab bar */}
      <div className="bg-white border-x border-slate-200 px-2 pt-2 flex gap-0.5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`px-3 py-1.5 text-[11px] font-medium rounded-t-lg transition-all duration-200 ${
              activeTab === tab.id
                ? 'bg-slate-50 text-blue-700 border border-b-0 border-slate-200 -mb-px relative z-10'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div className="bg-white border border-slate-200 rounded-b-xl overflow-hidden">
        <div className="h-[320px] relative">
          {activeTab === 'create' && <CreateFlow key={`create-${animKey}`} active />}
          {activeTab === 'triage' && <TriageFlow key={`triage-${animKey}`} active />}
          {activeTab === 'resolve' && <ResolveFlow key={`resolve-${animKey}`} active />}
        </div>
      </div>
    </div>
  );
}
