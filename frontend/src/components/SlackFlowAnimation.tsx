import { useState, useEffect, useCallback, useRef } from 'react';
import { RotateCcw, Play, Eye, ExternalLink, Bell, Wrench, CheckCircle2 } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SlackFlowAnimationProps {
  autoPlay?: boolean;
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STEP_DELAYS = [1000, 2000, 3500, 3000, 3500] as const;
const TOTAL_STEPS = 5;

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function SlackAvatar({ initials, gradient }: { initials: string; gradient: string }) {
  return (
    <div
      className={`w-9 h-9 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0 shadow-sm`}
    >
      <span className="text-white text-xs font-bold">{initials}</span>
    </div>
  );
}

function EmojiReaction({
  emoji,
  count,
  visible,
  highlight,
}: {
  emoji: string;
  count: number;
  visible: boolean;
  highlight?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-all duration-300 ${
        visible ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
      } ${
        highlight
          ? 'bg-blue-50 border-blue-200 text-blue-700'
          : 'bg-slate-50 border-slate-200 text-slate-600'
      }`}
    >
      <span>{emoji}</span>
      <span className="font-medium">{count}</span>
    </span>
  );
}

function ThreadLine() {
  return (
    <div className="ml-[18px] w-0.5 h-4 bg-slate-200 rounded-full" />
  );
}

/* ------------------------------------------------------------------ */
/*  Scene 1: Engineer reports                                          */
/* ------------------------------------------------------------------ */

function Scene1({ active }: { active: boolean }) {
  const [showMessage, setShowMessage] = useState(false);
  const [typedLength, setTypedLength] = useState(0);
  const [showEyes, setShowEyes] = useState(false);

  const fullText = 'payment gateway timeout for merchant X, getting 503 errors since 10 AM';

  useEffect(() => {
    if (!active) {
      setShowMessage(false);
      setTypedLength(0);
      setShowEyes(false);
      return;
    }

    const t1 = setTimeout(() => setShowMessage(true), 200);
    const t2 = setTimeout(() => {
      let i = 0;
      const interval = setInterval(() => {
        i += 2;
        if (i >= fullText.length) {
          setTypedLength(fullText.length);
          clearInterval(interval);
        } else {
          setTypedLength(i);
        }
      }, 25);
      return () => clearInterval(interval);
    }, 400);
    const t3 = setTimeout(() => setShowEyes(true), 1500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [active]);

  return (
    <div
      className={`transition-all duration-500 ${
        showMessage ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-5'
      }`}
    >
      <div className="flex items-start gap-3">
        <SlackAvatar initials="VG" gradient="from-purple-400 to-purple-600" />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-bold text-slate-900">Vijay Gupta</span>
            <span className="text-[10px] text-slate-400">10:32 AM</span>
          </div>
          <p className="text-sm text-slate-700 mt-1 leading-relaxed">
            <span className="inline-flex items-center bg-blue-50 text-blue-700 font-semibold px-1.5 rounded text-xs">
              @Argus
            </span>{' '}
            <span>
              {fullText.slice(0, typedLength)}
              {typedLength < fullText.length && active && (
                <span className="inline-block w-0.5 h-3.5 bg-slate-400 ml-0.5 animate-pulse align-text-bottom" />
              )}
            </span>
          </p>

          {/* Emoji reactions */}
          <div className="flex items-center gap-1.5 mt-2">
            <EmojiReaction emoji="👀" count={1} visible={showEyes} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Scene 2: Argus responds in thread                                  */
/* ------------------------------------------------------------------ */

function Scene2({ active }: { active: boolean }) {
  const [showCard, setShowCard] = useState(false);
  const [revealedFields, setRevealedFields] = useState(0);

  const fields = [
    { label: 'Priority', value: '🔴 High', color: 'text-red-600' },
    { label: 'Team', value: 'Payments', color: 'text-indigo-600' },
    { label: 'Assigned', value: '@Priya Patel', color: 'text-blue-600' },
    { label: 'Category', value: 'backend', color: 'text-slate-600' },
  ];

  useEffect(() => {
    if (!active) {
      setShowCard(false);
      setRevealedFields(0);
      return;
    }

    const t1 = setTimeout(() => setShowCard(true), 300);
    const timers = fields.map((_, i) =>
      setTimeout(() => setRevealedFields(i + 1), 800 + i * 200),
    );

    return () => {
      clearTimeout(t1);
      timers.forEach(clearTimeout);
    };
  }, [active]);

  return (
    <div>
      <ThreadLine />
      <div
        className={`transition-all duration-500 ${
          showCard ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-5'
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shrink-0 shadow-sm">
            <span className="text-base">🤖</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-bold text-slate-900">Argus</span>
              <span className="inline-flex items-center text-[9px] font-semibold uppercase tracking-wide bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                APP
              </span>
              <span className="text-[10px] text-slate-400">10:32 AM</span>
            </div>

            {/* Structured card */}
            <div className="mt-2 bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden max-w-sm">
              {/* Header */}
              <div className="bg-gradient-to-r from-red-50 to-orange-50 border-b border-slate-200 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-base">🚨</span>
                  <span className="text-sm font-bold text-slate-800">New Issue Tracked</span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5 font-medium">
                  Payment Gateway Timeout
                </p>
              </div>

              {/* Fields */}
              <div className="px-4 py-3 space-y-2">
                {fields.map((field, i) => (
                  <div
                    key={field.label}
                    className={`flex items-center justify-between transition-all duration-300 ${
                      i < revealedFields
                        ? 'opacity-100 translate-y-0'
                        : 'opacity-0 translate-y-2'
                    }`}
                  >
                    <span className="text-[11px] text-slate-400 uppercase tracking-wide font-medium">
                      {field.label}
                    </span>
                    <span className={`text-xs font-semibold ${field.color}`}>
                      {field.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Footer link */}
              <div
                className={`border-t border-slate-100 px-4 py-2 transition-all duration-300 ${
                  revealedFields >= fields.length
                    ? 'opacity-100'
                    : 'opacity-0'
                }`}
              >
                <span className="inline-flex items-center gap-1.5 text-xs text-blue-600 font-medium cursor-pointer hover:text-blue-700">
                  <ExternalLink className="w-3 h-3" />
                  View in Dashboard
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Scene 3: DM notification                                           */
/* ------------------------------------------------------------------ */

function Scene3({ active }: { active: boolean }) {
  const [showNotif, setShowNotif] = useState(false);

  useEffect(() => {
    if (!active) {
      setShowNotif(false);
      return;
    }
    const t = setTimeout(() => setShowNotif(true), 400);
    return () => clearTimeout(t);
  }, [active]);

  return (
    <div className="mt-4">
      <div
        className={`transition-all duration-500 ${
          showNotif ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
        }`}
      >
        <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200/80 rounded-lg px-4 py-3 max-w-sm shadow-sm">
          <div className="flex items-center gap-2 mb-1.5">
            <Bell className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-bold text-amber-800">Direct Message from Argus</span>
          </div>
          <p className="text-xs text-amber-700 leading-relaxed">
            &ldquo;You&apos;ve been assigned:{' '}
            <span className="font-semibold">Payment Gateway Timeout</span>&rdquo;
          </p>
          <div className="flex items-center gap-1.5 mt-2">
            <div className="w-5 h-5 rounded bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
              <span className="text-[8px] text-white font-bold">PP</span>
            </div>
            <span className="text-[10px] text-amber-600">Sent to Priya Patel</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Scene 4: Status updates + emoji swaps                              */
/* ------------------------------------------------------------------ */

function Scene4({ active }: { active: boolean }) {
  const [phase, setPhase] = useState(0); // 0=hidden, 1=in_progress, 2=resolved

  useEffect(() => {
    if (!active) {
      setPhase(0);
      return;
    }
    const t1 = setTimeout(() => setPhase(1), 500);
    const t2 = setTimeout(() => setPhase(2), 2200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [active]);

  return (
    <div className="space-y-3">
      {/* In Progress update */}
      <div
        className={`transition-all duration-500 ${
          phase >= 1 ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
        }`}
      >
        <ThreadLine />
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shrink-0 shadow-sm">
            <span className="text-base">🤖</span>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-bold text-slate-900">Argus</span>
              <span className="text-[10px] text-slate-400">11:15 AM</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Wrench className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs text-slate-600">
                Status Updated:{' '}
                <span className="line-through text-slate-400">Open</span>
                {' → '}
                <span className="font-semibold text-amber-600">In Progress</span>
              </span>
            </div>
            {/* Emoji swap indicator */}
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="text-[10px] text-slate-400">Reaction:</span>
              <span className="text-xs text-slate-400 line-through">👀</span>
              <span className="text-[10px] text-slate-400">→</span>
              <EmojiReaction emoji="🔧" count={1} visible={phase >= 1} highlight />
            </div>
          </div>
        </div>
      </div>

      {/* Resolved update */}
      <div
        className={`transition-all duration-500 ${
          phase >= 2 ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
        }`}
      >
        <ThreadLine />
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shrink-0 shadow-sm">
            <span className="text-base">🤖</span>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-bold text-slate-900">Argus</span>
              <span className="text-[10px] text-slate-400">12:58 PM</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
              <span className="text-xs text-slate-600">
                Issue Resolved by{' '}
                <span className="font-semibold text-slate-800">@Vijay</span>
                {' · '}
                <span className="text-green-600 font-medium">Time: 2.5 hrs</span>
              </span>
            </div>
            {/* Emoji swap indicator */}
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="text-[10px] text-slate-400">Reaction:</span>
              <span className="text-xs text-slate-400 line-through">🔧</span>
              <span className="text-[10px] text-slate-400">→</span>
              <EmojiReaction emoji="✅" count={1} visible={phase >= 2} highlight />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Scene 5: Reminder                                                  */
/* ------------------------------------------------------------------ */

function Scene5({ active }: { active: boolean }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!active) {
      setShow(false);
      return;
    }
    const t = setTimeout(() => setShow(true), 400);
    return () => clearTimeout(t);
  }, [active]);

  return (
    <div className="mt-4">
      <div
        className={`transition-all duration-500 ${
          show ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-3'
        }`}
      >
        <div className="bg-gradient-to-r from-red-50 to-rose-50 border border-red-200/80 rounded-lg px-4 py-3 max-w-sm shadow-sm">
          <div className="flex items-center gap-2 mb-1.5">
            <Bell className="w-4 h-4 text-red-500" />
            <span className="text-xs font-bold text-red-800">
              Reminder — Issue Still Open
            </span>
          </div>
          <p className="text-sm font-medium text-red-700">
            &ldquo;Payment Gateway Timeout&rdquo;
          </p>
          <p className="text-xs text-red-600 mt-1">
            <span className="font-semibold">@Priya</span> — please provide an update.
          </p>
          <div className="flex items-center gap-1.5 mt-2 text-[10px] text-red-400">
            <span>Auto-sent after 24h inactivity</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step indicator labels                                              */
/* ------------------------------------------------------------------ */

const STEP_LABELS = [
  { num: 1, label: 'Report', icon: Eye },
  { num: 2, label: 'Track', icon: ExternalLink },
  { num: 3, label: 'Notify', icon: Bell },
  { num: 4, label: 'Update', icon: Wrench },
  { num: 5, label: 'Remind', icon: Bell },
] as const;

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function SlackFlowAnimation({
  autoPlay = true,
  className = '',
}: SlackFlowAnimationProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const advanceStep = useCallback(
    (step: number) => {
      if (step > TOTAL_STEPS) {
        setIsPlaying(false);
        return;
      }
      setCurrentStep(step);
      timerRef.current = setTimeout(
        () => advanceStep(step + 1),
        STEP_DELAYS[step - 1] ?? 2000,
      );
    },
    [],
  );

  const startAnimation = useCallback(() => {
    clearTimer();
    setCurrentStep(0);
    setIsPlaying(true);

    timerRef.current = setTimeout(() => {
      advanceStep(1);
    }, 600);
  }, [clearTimer, advanceStep]);

  const resetAnimation = useCallback(() => {
    clearTimer();
    setCurrentStep(0);
    setIsPlaying(false);
  }, [clearTimer]);

  // Auto-play on mount
  useEffect(() => {
    if (autoPlay) {
      const t = setTimeout(startAnimation, 1000);
      return () => {
        clearTimeout(t);
        clearTimer();
      };
    }
    return clearTimer;
  }, [autoPlay, startAnimation, clearTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return clearTimer;
  }, [clearTimer]);

  return (
    <div className={`${className}`}>
      {/* Container styled like Slack */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
        {/* Slack-like header bar */}
        <div className="bg-gradient-to-r from-[#4a154b] to-[#611f69] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-white/20" />
              <div className="w-3 h-3 rounded-full bg-white/20" />
              <div className="w-3 h-3 rounded-full bg-white/20" />
            </div>
            <div className="ml-3 flex items-center gap-2">
              <span className="text-white/80 text-sm font-medium">#</span>
              <span className="text-white text-sm font-semibold">incidents</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isPlaying && currentStep === 0 && (
              <button
                onClick={startAnimation}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-white/90 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <Play className="w-3 h-3" />
                Play
              </button>
            )}
            {(currentStep > 0 || isPlaying) && (
              <button
                onClick={resetAnimation}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-white/90 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                Replay
              </button>
            )}
          </div>
        </div>

        {/* Slack sidebar hint + content */}
        <div className="flex min-h-[420px]">
          {/* Mini sidebar */}
          <div className="hidden sm:flex w-14 bg-[#4a154b] flex-col items-center py-4 gap-3 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
              <span className="text-white text-xs font-bold">NY</span>
            </div>
            <div className="w-6 h-0.5 bg-white/10 rounded-full" />
            <div className="w-8 h-8 rounded-lg bg-white/10" />
            <div className="w-8 h-8 rounded-lg bg-white/10" />
            <div className="w-8 h-8 rounded-lg bg-white/10" />
          </div>

          {/* Message area */}
          <div className="flex-1 p-5 space-y-1 overflow-y-auto bg-gradient-to-b from-white to-slate-50/50">
            {/* Date divider */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-2">
                Today
              </span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            {/* Scene 1 */}
            <Scene1 active={currentStep >= 1} />

            {/* Scene 2 */}
            {currentStep >= 2 && <Scene2 active={currentStep >= 2} />}

            {/* Scene 3 */}
            {currentStep >= 3 && <Scene3 active={currentStep >= 3} />}

            {/* Scene 4 */}
            {currentStep >= 4 && <Scene4 active={currentStep >= 4} />}

            {/* Scene 5 */}
            {currentStep >= 5 && <Scene5 active={currentStep >= 5} />}

            {/* Empty state when nothing playing */}
            {currentStep === 0 && !isPlaying && (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <Play className="w-8 h-8 mb-3 opacity-40" />
                <p className="text-sm font-medium">Click Play to see the flow</p>
              </div>
            )}
          </div>
        </div>

        {/* Step progress indicator */}
        <div className="bg-slate-50 border-t border-slate-200 px-4 py-3">
          <div className="flex items-center justify-between max-w-md mx-auto">
            {STEP_LABELS.map((s) => {
              const isActive = currentStep >= s.num;
              const isCurrent = currentStep === s.num;
              return (
                <div key={s.num} className="flex flex-col items-center gap-1">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isCurrent
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30 scale-110'
                        : isActive
                          ? 'bg-blue-100 text-blue-600'
                          : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    <s.icon className="w-3.5 h-3.5" />
                  </div>
                  <span
                    className={`text-[9px] font-semibold uppercase tracking-wide transition-colors duration-300 ${
                      isCurrent
                        ? 'text-blue-600'
                        : isActive
                          ? 'text-blue-400'
                          : 'text-slate-300'
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Progress bar */}
          <div className="mt-2.5 h-1 bg-slate-200 rounded-full max-w-md mx-auto overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${(currentStep / TOTAL_STEPS) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
