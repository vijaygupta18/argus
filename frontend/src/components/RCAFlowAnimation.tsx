import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Brain,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Search,
  Sparkles,
  Terminal,
  Activity,
  Shield,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface RCAFlowAnimationProps {
  autoPlay?: boolean;
  className?: string;
}

interface ToolCall {
  index: number;
  total: number;
  name: string;
  result: string;
  duration: string;
}

interface RootCause {
  text: string;
  probability: 'High' | 'Medium' | 'Low';
}

/* ------------------------------------------------------------------ */
/*  Static Data                                                        */
/* ------------------------------------------------------------------ */

const TOOL_CALLS: ToolCall[] = [
  {
    index: 1,
    total: 6,
    name: 'check_prometheus_metrics',
    result: 'CPU spike to 95% on driver-worker-3',
    duration: '1.2s',
  },
  {
    index: 2,
    total: 6,
    name: 'search_elasticsearch_logs',
    result: 'Found 2,341 ERROR: "Connection pool exhausted"',
    duration: '3.4s',
  },
  {
    index: 3,
    total: 6,
    name: 'kubectl_get_pods',
    result: '3/5 driver-worker pods in CrashLoopBackOff',
    duration: '0.8s',
  },
  {
    index: 4,
    total: 6,
    name: 'check_postgres_slow_queries',
    result: '12 queries > 30s on booking_rides table',
    duration: '2.1s',
  },
  {
    index: 5,
    total: 6,
    name: 'inspect_recent_deployments',
    result: 'v2.4.1 deployed 47 min ago — config change in pool_size',
    duration: '0.6s',
  },
  {
    index: 6,
    total: 6,
    name: 'correlate_timeline',
    result: 'Memory spike began 3 min after v2.4.1 rollout',
    duration: '1.8s',
  },
];

const ROOT_CAUSES: RootCause[] = [
  { text: 'Connection pool misconfiguration in v2.4.1 deployment', probability: 'High' },
  { text: 'Redis maxmemory-policy set to noeviction', probability: 'Medium' },
  { text: 'Stale connection leak in driver-worker process', probability: 'Low' },
];

const SUGGESTED_FIXES = [
  'Rollback pool_size config to v2.3.9 default (50 -> 200)',
  'Set Redis eviction policy to allkeys-lru',
  'Add connection timeout + retry logic to driver-worker',
];

/* ------------------------------------------------------------------ */
/*  useTypingText hook                                                 */
/* ------------------------------------------------------------------ */

function useTypingText(
  text: string,
  active: boolean,
  speed = 18,
): { displayed: string; done: boolean } {
  const [charIndex, setCharIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      setCharIndex(0);
      return;
    }
    if (charIndex >= text.length) return;

    const timer = setTimeout(() => {
      setCharIndex((prev) => prev + 1);
    }, speed);

    return () => clearTimeout(timer);
  }, [active, charIndex, text, speed]);

  return {
    displayed: text.slice(0, charIndex),
    done: charIndex >= text.length,
  };
}

/* ------------------------------------------------------------------ */
/*  Phase 1: Trigger                                                   */
/* ------------------------------------------------------------------ */

function TriggerPhase({ active }: { active: boolean }) {
  const [showCard, setShowCard] = useState(false);
  const [showText, setShowText] = useState(false);

  useEffect(() => {
    if (!active) {
      setShowCard(false);
      setShowText(false);
      return;
    }
    const t1 = setTimeout(() => setShowCard(true), 200);
    const t2 = setTimeout(() => setShowText(true), 800);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [active]);

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Issue card */}
      <div
        className={`transition-all duration-500 ${
          showCard ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'
        }`}
      >
        <div className="bg-white rounded-xl border border-red-200 shadow-sm shadow-red-100/50 px-5 py-4 flex items-center gap-3 max-w-sm">
          <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">Redis memory at 98%</p>
            <p className="text-xs text-slate-400 mt-0.5">Triggered 2 seconds ago</p>
          </div>
          <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-red-100 text-red-700 ring-1 ring-red-200 shrink-0">
            Critical
          </span>
        </div>
      </div>

      {/* Pulsing brain + text */}
      <div
        className={`flex items-center gap-2.5 transition-all duration-500 ${
          showText ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="relative">
          <Brain className="w-5 h-5 text-indigo-500" />
          <span className="absolute inset-0 rounded-full animate-ping bg-indigo-400/30" />
        </div>
        <span className="text-sm text-slate-500 font-medium">AI investigation triggered...</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Phase 2: Tool Calls Terminal                                       */
/* ------------------------------------------------------------------ */

function ToolCallsPhase({
  active,
  onAllDone,
}: {
  active: boolean;
  onAllDone: () => void;
}) {
  const [completedTools, setCompletedTools] = useState<number>(0);
  const [currentToolTyping, setCurrentToolTyping] = useState(false);
  const [currentResultTyping, setCurrentResultTyping] = useState(false);
  const doneRef = useRef(false);
  const terminalRef = useRef<HTMLDivElement>(null);

  // Reset when not active
  useEffect(() => {
    if (!active) {
      setCompletedTools(0);
      setCurrentToolTyping(false);
      setCurrentResultTyping(false);
      doneRef.current = false;
    }
  }, [active]);

  // Drive the tool-by-tool animation
  useEffect(() => {
    if (!active) return;

    if (completedTools >= TOOL_CALLS.length) {
      if (!doneRef.current) {
        doneRef.current = true;
        const t = setTimeout(onAllDone, 600);
        return () => clearTimeout(t);
      }
      return;
    }

    // Show tool name typing
    const t1 = setTimeout(() => setCurrentToolTyping(true), 300);

    // After tool name types, show result
    const t2 = setTimeout(() => setCurrentResultTyping(true), 900);

    // After result, mark done and move to next
    const t3 = setTimeout(() => {
      setCompletedTools((prev) => prev + 1);
      setCurrentToolTyping(false);
      setCurrentResultTyping(false);
    }, 1700);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [active, completedTools, onAllDone]);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [completedTools, currentToolTyping]);

  const progressPercent = Math.round((completedTools / TOOL_CALLS.length) * 100);
  const currentIndex = completedTools; // 0-based into TOOL_CALLS for the "in progress" one

  return (
    <div
      className={`transition-all duration-700 ${
        active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      {/* Progress bar */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 h-1.5 rounded-full bg-slate-700 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-green-400 to-emerald-400 transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <span className="text-xs font-mono text-slate-400 shrink-0 tabular-nums">
          {completedTools} of {TOOL_CALLS.length} tools
        </span>
      </div>

      {/* Terminal panel */}
      <div className="rounded-xl bg-slate-900 border border-slate-700/50 shadow-2xl overflow-hidden">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-800/80 border-b border-slate-700/50">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
          </div>
          <div className="flex items-center gap-1.5 ml-2">
            <Terminal className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[11px] font-mono text-slate-500">vishwakarma-rca</span>
          </div>
        </div>

        {/* Terminal body */}
        <div
          ref={terminalRef}
          className="p-4 font-mono text-[13px] leading-relaxed max-h-72 overflow-y-auto custom-scrollbar"
        >
          {/* Header */}
          <div className="flex items-center gap-2 mb-1">
            <Search className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-amber-300 font-semibold">Investigating:</span>
            <span className="text-white">Redis memory at 98%</span>
          </div>
          <div className="text-slate-600 mb-4 select-none">
            {'━'.repeat(40)}
          </div>

          {/* Completed tools */}
          {TOOL_CALLS.slice(0, completedTools).map((tool) => (
            <div key={tool.index} className="mb-3">
              <div className="flex items-center gap-2">
                <span className="text-slate-500">[{tool.index}/{tool.total}]</span>
                <span className="text-white">{tool.name}</span>
              </div>
              <div className="pl-8 text-slate-400">
                <span className="text-slate-600 select-none">{'\u2192'} </span>
                {tool.result}
              </div>
              <div className="pl-8 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                <span className="text-green-400 text-xs">done</span>
                <span className="text-slate-600 text-xs">({tool.duration})</span>
              </div>
            </div>
          ))}

          {/* Current tool being processed */}
          {currentIndex < TOOL_CALLS.length && (
            <div className="mb-3">
              <div
                className={`flex items-center gap-2 transition-opacity duration-300 ${
                  currentToolTyping ? 'opacity-100' : 'opacity-0'
                }`}
              >
                <span className="text-slate-500">
                  [{TOOL_CALLS[currentIndex].index}/{TOOL_CALLS[currentIndex].total}]
                </span>
                <span className="text-white">{TOOL_CALLS[currentIndex].name}</span>
                {!currentResultTyping && (
                  <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                )}
              </div>
              {currentResultTyping && (
                <div className="pl-8 text-slate-400 transition-opacity duration-200 opacity-100">
                  <span className="text-slate-600 select-none">{'\u2192'} </span>
                  {TOOL_CALLS[currentIndex].result}
                </div>
              )}
            </div>
          )}

          {/* Blinking cursor when not yet done */}
          {completedTools < TOOL_CALLS.length && !currentToolTyping && (
            <span className="inline-block w-2 h-4 bg-slate-400 animate-pulse" />
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Phase 3: Analysis Report                                           */
/* ------------------------------------------------------------------ */

function AnalysisPhase({ active }: { active: boolean }) {
  const [showSummary, setShowSummary] = useState(false);
  const [visibleCauses, setVisibleCauses] = useState(0);
  const [showFixes, setShowFixes] = useState(false);

  const summaryText = 'Primary Cause: Connection pool misconfiguration in v2.4.1 deployment';
  const { displayed: typedSummary, done: summaryDone } = useTypingText(summaryText, showSummary, 22);

  useEffect(() => {
    if (!active) {
      setShowSummary(false);
      setVisibleCauses(0);
      setShowFixes(false);
      return;
    }
    const t1 = setTimeout(() => setShowSummary(true), 400);
    return () => clearTimeout(t1);
  }, [active]);

  // Reveal root causes after summary is done
  useEffect(() => {
    if (!summaryDone || !active) return;
    if (visibleCauses >= ROOT_CAUSES.length) {
      const t = setTimeout(() => setShowFixes(true), 400);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setVisibleCauses((prev) => prev + 1), 350);
    return () => clearTimeout(t);
  }, [summaryDone, visibleCauses, active]);

  const probabilityColors: Record<string, string> = {
    High: 'bg-red-100 text-red-700 ring-1 ring-red-200',
    Medium: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200',
    Low: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
  };

  return (
    <div
      className={`transition-all duration-700 ${
        active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      <div className="bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-indigo-50 to-blue-50 border-b border-slate-200 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-bold text-slate-900">Root Cause Analysis Report</span>
        </div>

        <div className="p-5 space-y-4">
          {/* Typed summary */}
          <div className="min-h-[1.75rem]">
            <p className="text-sm font-semibold text-slate-800 leading-relaxed">
              {typedSummary}
              {showSummary && !summaryDone && (
                <span className="inline-block w-0.5 h-4 bg-indigo-500 ml-0.5 animate-pulse align-middle" />
              )}
            </p>
          </div>

          {/* Root causes */}
          {visibleCauses > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Root Causes
              </p>
              {ROOT_CAUSES.slice(0, visibleCauses).map((cause, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2.5 text-sm text-slate-700 animate-fade-up"
                >
                  <span className="text-slate-400 font-mono text-xs shrink-0">{i + 1}.</span>
                  <span className="flex-1">{cause.text}</span>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${probabilityColors[cause.probability]}`}
                  >
                    {cause.probability}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Suggested fixes */}
          {showFixes && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 animate-fade-up">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 mb-2">
                Suggested Fixes
              </p>
              <ul className="space-y-1.5">
                {SUGGESTED_FIXES.map((fix, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-emerald-800">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{fix}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Phase 4: Complete                                                  */
/* ------------------------------------------------------------------ */

function CompletePhase({ active }: { active: boolean }) {
  const [showCheck, setShowCheck] = useState(false);
  const [showMeta, setShowMeta] = useState(false);
  const [sparkles, setSparkles] = useState<{ id: number; x: number; y: number; delay: number }[]>([]);

  useEffect(() => {
    if (!active) {
      setShowCheck(false);
      setShowMeta(false);
      setSparkles([]);
      return;
    }
    const t1 = setTimeout(() => setShowCheck(true), 300);
    const t2 = setTimeout(() => setShowMeta(true), 800);
    const t3 = setTimeout(() => {
      // Generate sparkle positions
      const newSparkles = Array.from({ length: 8 }, (_, i) => ({
        id: i,
        x: Math.random() * 200 - 100,
        y: Math.random() * 80 - 60,
        delay: Math.random() * 0.6,
      }));
      setSparkles(newSparkles);
    }, 400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [active]);

  return (
    <div
      className={`flex flex-col items-center gap-3 transition-all duration-500 ${
        active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      {/* Checkmark with sparkles */}
      <div className="relative">
        <div
          className={`w-14 h-14 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-green-500/25 transition-all duration-500 ${
            showCheck ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
          }`}
        >
          <CheckCircle2 className="w-7 h-7 text-white" />
        </div>
        {/* Sparkle particles */}
        {sparkles.map((s) => (
          <span
            key={s.id}
            className="absolute top-1/2 left-1/2 pointer-events-none"
            style={{
              transform: `translate(${s.x}px, ${s.y}px)`,
              animationDelay: `${s.delay}s`,
            }}
          >
            <Sparkles
              className="w-3.5 h-3.5 text-amber-400 animate-pulse"
              style={{ animationDuration: '0.8s' }}
            />
          </span>
        ))}
      </div>

      {/* Text */}
      <p
        className={`text-base font-bold text-slate-900 transition-all duration-500 ${
          showCheck ? 'opacity-100' : 'opacity-0'
        }`}
      >
        Investigation Complete
      </p>

      {/* Meta line */}
      <div
        className={`flex items-center gap-2 text-xs text-slate-400 transition-all duration-500 ${
          showMeta ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <span>6 tools used</span>
        <span className="text-slate-300">&middot;</span>
        <span>14.2 seconds</span>
        <span className="text-slate-300">&middot;</span>
        <span className="flex items-center gap-1">
          <Shield className="w-3 h-3 text-indigo-400" />
          Vishwakarma
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

type Phase = 'idle' | 'trigger' | 'tools' | 'analysis' | 'complete';

export default function RCAFlowAnimation({
  autoPlay = true,
  className = '',
}: RCAFlowAnimationProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startAnimation = useCallback(() => {
    setPhase('trigger');

    // Phase 1 -> 2 at 2s
    timerRef.current = setTimeout(() => {
      setPhase('tools');
    }, 2000);
  }, []);

  // Tool calls phase signals completion via callback
  const handleToolsDone = useCallback(() => {
    setPhase('analysis');

    // Phase 3 -> 4 at ~3s after analysis start
    timerRef.current = setTimeout(() => {
      setPhase('complete');
    }, 4000);
  }, []);

  // Auto-play on mount
  useEffect(() => {
    if (autoPlay) {
      const t = setTimeout(startAnimation, 500);
      return () => clearTimeout(t);
    }
  }, [autoPlay, startAnimation]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Restart animation
  const handleReplay = useCallback(() => {
    setPhase('idle');
    setTimeout(() => startAnimation(), 100);
  }, [startAnimation]);

  // Phase label for indicator
  const phaseLabels: Record<Phase, string> = {
    idle: 'Waiting',
    trigger: 'Detecting issue',
    tools: 'Investigating',
    analysis: 'Analyzing results',
    complete: 'Done',
  };

  const phaseOrder: Phase[] = ['trigger', 'tools', 'analysis', 'complete'];
  const currentPhaseIndex = phaseOrder.indexOf(phase);

  return (
    <div className={`w-full max-w-lg mx-auto ${className}`}>
      {/* Phase indicator dots */}
      <div className="flex items-center justify-center gap-6 mb-6">
        {phaseOrder.map((p, i) => {
          const isActive = i === currentPhaseIndex;
          const isDone = i < currentPhaseIndex;
          return (
            <div key={p} className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  isActive
                    ? 'bg-indigo-500 scale-125 ring-4 ring-indigo-100'
                    : isDone
                      ? 'bg-green-400'
                      : 'bg-slate-200'
                }`}
              />
              <span
                className={`text-[11px] font-medium transition-colors duration-300 hidden sm:inline ${
                  isActive ? 'text-indigo-600' : isDone ? 'text-green-600' : 'text-slate-300'
                }`}
              >
                {phaseLabels[p]}
              </span>
            </div>
          );
        })}
      </div>

      {/* Animation content area */}
      <div className="relative min-h-[380px]">
        {/* Phase 1: Trigger */}
        {(phase === 'trigger') && (
          <div className="absolute inset-0 flex items-center justify-center">
            <TriggerPhase active={phase === 'trigger'} />
          </div>
        )}

        {/* Phase 2: Tool Calls */}
        {(phase === 'tools') && (
          <div className="absolute inset-0">
            <ToolCallsPhase active={phase === 'tools'} onAllDone={handleToolsDone} />
          </div>
        )}

        {/* Phase 3: Analysis */}
        {(phase === 'analysis' || phase === 'complete') && (
          <div
            className={`absolute inset-0 transition-opacity duration-500 ${
              phase === 'complete' ? 'opacity-40' : 'opacity-100'
            }`}
          >
            <AnalysisPhase active={phase === 'analysis' || phase === 'complete'} />
          </div>
        )}

        {/* Phase 4: Complete */}
        {phase === 'complete' && (
          <div className="absolute inset-0 flex items-end justify-center pb-4">
            <CompletePhase active={phase === 'complete'} />
          </div>
        )}

        {/* Idle state */}
        {phase === 'idle' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <Brain className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-400">Ready to investigate</p>
            </div>
          </div>
        )}
      </div>

      {/* Replay button (only after complete) */}
      {phase === 'complete' && (
        <div className="flex justify-center mt-4">
          <button
            onClick={handleReplay}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-indigo-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-indigo-50"
          >
            <Loader2 className="w-3.5 h-3.5" />
            Replay animation
          </button>
        </div>
      )}
    </div>
  );
}
