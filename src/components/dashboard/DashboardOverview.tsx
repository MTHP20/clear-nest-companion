import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/contexts/SessionContext';
import type { CapturedItem, ReadinessSnapshot } from '@/contexts/SessionContext';
import { BookOpenCheck, CreditCard, HandCoins, HeartHandshake, House, Users, Search, Clock, MessageSquareQuote } from 'lucide-react';
import { useConversation } from '@elevenlabs/react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';


const DOC_ITEMS = [
  { id: 'will', label: 'Will — location confirmed' },
  { id: 'lpa', label: 'Lasting Power of Attorney — in place' },
  { id: 'life-insurance', label: 'Life Insurance — provider known' },
  { id: 'pension', label: 'Pension details — confirmed' },
  { id: 'property-deeds', label: 'Property deeds — location known' },
  { id: 'nhs', label: 'NHS number — recorded' },
];

function loadChecklist(): Set<string> {
  try {
    const raw = localStorage.getItem('cn-doc-checklist');
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveChecklist(checked: Set<string>) {
  localStorage.setItem('cn-doc-checklist', JSON.stringify([...checked]));
}

function ProgressMomentum({
  history,
  verifiedCount,
  checklistSize,
  docTotal,
  activeActions,
}: {
  history: ReadinessSnapshot[];
  verifiedCount: number;
  checklistSize: number;
  docTotal: number;
  activeActions: number;
}) {
  const W = 280, H = 88, padX = 28, padY = 8;
  const cW = W - padX, cH = H - padY * 2;

  const points = useMemo(() => {
    if (history.length < 2) return null;
    const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
    const scores = sorted.map(s => s.score);
    const minS = Math.min(...scores, 0);
    const maxS = Math.max(...scores, 100);
    const range = maxS - minS || 1;
    return sorted.map((s, i) => ({
      x: padX + (i / (sorted.length - 1)) * cW,
      y: padY + (1 - (s.score - minS) / range) * cH,
      score: s.score,
      date: s.date,
    }));
  }, [history]);

  const linePath = points
    ? points.reduce((acc, p, i) => {
        if (i === 0) return `M${p.x.toFixed(1)},${p.y.toFixed(1)}`;
        const prev = points[i - 1];
        const cx = (prev.x + p.x) / 2;
        return `${acc} C${cx.toFixed(1)},${prev.y.toFixed(1)} ${cx.toFixed(1)},${p.y.toFixed(1)} ${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      }, '')
    : null;

  const areaPath = linePath && points
    ? `${linePath} L${points[points.length - 1].x.toFixed(1)},${H - padY} L${points[0].x.toFixed(1)},${H - padY}Z`
    : null;

  const latest = history.length > 0 ? history[history.length - 1].score : null;
  const previous = history.length > 1 ? history[history.length - 2].score : null;
  const delta = latest !== null && previous !== null ? latest - previous : null;

  const gridPcts = [100, 75, 50, 25, 0];

  return (
    <div style={{
      background: 'var(--ov-card-bg)',
      backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
      border: '1px solid var(--ov-card-border)', borderRadius: 22,
      boxShadow: 'var(--ov-shadow)',
      padding: '22px 22px 16px', flex: 1, minWidth: 0,
      display: 'flex', flexDirection: 'column', gap: 0,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 16, color: 'var(--ov-accent)', filter: 'drop-shadow(0 0 6px rgba(70,99,172,0.7))' }}>↗</span>
        <span style={{ fontFamily: 'Figtree, system-ui, sans-serif', fontSize: 18, fontWeight: 700, color: 'var(--ov-text)' }}>
          Progress Momentum
        </span>
        {delta !== null && delta > 0 && (
          <span style={{
            marginLeft: 'auto', fontSize: 11, fontWeight: 600,
            padding: '3px 10px', borderRadius: 20,
            background: 'rgba(70,99,172,0.15)', color: 'var(--ov-accent)',
            border: '1px solid rgba(70,99,172,0.25)',
          }}>+{delta}% this session</span>
        )}
      </div>

      {/* Chart area */}
      <div style={{
        background: 'var(--ov-inner)', border: '1px solid var(--ov-card-border)',
        borderRadius: 14, padding: '10px 14px 6px', marginBottom: 18,
        position: 'relative', height: 200,
      }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="none" overflow="visible">
          <defs>
            <linearGradient id="mFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4663ac" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#4663ac" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="mLine" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#2d4b9a" />
              <stop offset="100%" stopColor="#4663ac" />
            </linearGradient>
          </defs>

          {/* Y-axis labels + grid */}
          {gridPcts.map((pct) => {
            const y = padY + (1 - pct / 100) * cH;
            return (
              <g key={pct}>
                <text x={0} y={y + 3} fontSize="8" fill="var(--ov-svg-text)" fontFamily="Figtree,system-ui,sans-serif">{pct}%</text>
                <line x1={padX} y1={y} x2={W} y2={y} stroke={pct === 0 ? 'var(--ov-card-border)' : 'var(--ov-grid)'} strokeWidth="1" />
              </g>
            );
          })}

          {points && areaPath && linePath ? (
            <>
              <path d={areaPath} fill="url(#mFill)" />
              <path d={linePath} fill="none" stroke="url(#mLine)" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round"
                style={{ filter: 'drop-shadow(0 0 6px rgba(70,99,172,0.65))' }} />
              {points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={i === 0 || i === points.length - 1 ? 4 : 3.5}
                  fill={i === points.length - 1 ? '#4663ac' : '#8b5cf6'}
                  stroke="rgba(70,99,172,0.25)" strokeWidth="1.5"
                  style={i === 0 || i === points.length - 1 ? { filter: 'drop-shadow(0 0 5px rgba(70,99,172,0.9))' } : undefined}>
                  <title>{p.date}: {p.score}%</title>
                </circle>
              ))}
              {/* Current value label above last point */}
              {(() => {
                const last = points[points.length - 1];
                const lx = Math.min(last.x, W - 18);
                const ly = last.y - 16;
                return (
                  <g>
                    <rect x={lx - 17} y={ly - 9} width={34} height={12} rx={4}
                      fill="rgba(70,99,172,0.18)" stroke="rgba(70,99,172,0.35)" strokeWidth={0.75} />
                    <text x={lx} y={ly - 0.5} fontSize="8" fill="var(--ov-svg-strong)"
                      fontFamily="Figtree,system-ui,sans-serif" textAnchor="middle" fontWeight="600">
                      {last.score}%
                    </text>
                  </g>
                );
              })()}
            </>
          ) : (
            /* Flat line at bottom when no history */
            <line x1={padX} y1={H - padY} x2={W} y2={H - padY}
              stroke="url(#mLine)" strokeWidth="2.5" strokeLinecap="round"
              style={{ filter: 'drop-shadow(0 0 6px rgba(70,99,172,0.65))' }} />
          )}
        </svg>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr 1px 1fr', gap: 6, textAlign: 'center', alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: 'Figtree, system-ui, sans-serif', fontSize: 26, fontWeight: 700, lineHeight: 1, marginBottom: 4, color: 'var(--ov-accent)', textShadow: '0 0 10px rgba(70,99,172,0.5)' }}>{verifiedCount}</div>
          <div style={{ fontSize: 11, color: 'var(--ov-muted)' }}>Verified</div>
        </div>
        <div style={{ width: 1, background: 'var(--ov-card-border)', alignSelf: 'stretch', margin: '4px 0' }} />
        <div>
          <div style={{ fontFamily: 'Figtree, system-ui, sans-serif', fontSize: 26, fontWeight: 700, lineHeight: 1, marginBottom: 4, color: 'var(--ov-text)' }}>{checklistSize}/{docTotal}</div>
          <div style={{ fontSize: 11, color: 'var(--ov-muted)' }}>Checklist</div>
        </div>
        <div style={{ width: 1, background: 'var(--ov-card-border)', alignSelf: 'stretch', margin: '4px 0' }} />
        <div>
          <div style={{ fontFamily: 'Figtree, system-ui, sans-serif', fontSize: 26, fontWeight: 700, lineHeight: 1, marginBottom: 4, color: '#F0C050', textShadow: '0 0 10px rgba(240,192,80,0.5)' }}>{activeActions}</div>
          <div style={{ fontSize: 11, color: 'var(--ov-muted)' }}>Tasks open</div>
        </div>
      </div>
    </div>
  );
}

function ProgressRing({ score }: { score: number }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="cn-card flex flex-col items-center justify-center py-6">
      <div className="relative w-32 h-32">
        <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="10" />
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="#9B7BC8"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-display text-2xl font-bold text-foreground">{score}%</span>
        </div>
      </div>
      <p className="font-body text-sm text-center text-muted-foreground mt-3 max-w-[140px] leading-snug">
        Your family is <span className="font-semibold text-foreground">{score}% prepared</span>
      </p>
      <p className="font-body text-xs text-muted-foreground mt-1">Family Readiness Score</p>
    </div>
  );
}

// ─── Glass Dropdown ────────────────────────────────────────────────────────────
function GlassDropdown({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.value === value) ?? options[0];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        menuRef.current && !menuRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleOpen = () => {
    if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect());
    setOpen(v => !v);
  };

  const menu = open && rect ? (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: rect.bottom + 8,
        left: rect.left,
        minWidth: rect.width,
        zIndex: 9999,
        background: 'var(--ov-tooltip)',
        border: '1px solid var(--ov-card-border)',
        borderRadius: 14,
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.28), 0 2px 8px rgba(0,0,0,0.12)',
      }}
    >
      {options.map((opt, i) => (
        <div
          key={opt.value}
          onClick={() => { onChange(opt.value); setOpen(false); }}
          style={{
            padding: '10px 16px', fontSize: 13,
            color: opt.value === value ? 'var(--ov-text)' : 'var(--ov-muted)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9,
            background: opt.value === value ? 'rgba(94,207,207,0.15)' : 'transparent',
            fontWeight: opt.value === value ? 600 : 400,
            borderBottom: i < options.length - 1 ? '1px solid var(--ov-grid)' : undefined,
            fontFamily: 'Figtree, system-ui, sans-serif',
          }}
          onMouseEnter={e => { if (opt.value !== value) (e.currentTarget as HTMLDivElement).style.background = 'var(--ov-nav-hover-bg)'; }}
          onMouseLeave={e => { if (opt.value !== value) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
        >
          <span style={{
            width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
            border: opt.value === value ? 'none' : '1.5px solid rgba(70,99,172,0.25)',
            background: opt.value === value ? '#5ECFCF' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, color: opt.value === value ? '#0d0f1a' : 'transparent',
            boxShadow: opt.value === value ? '0 0 8px rgba(94,207,207,0.55)' : 'none',
          }}>✓</span>
          {opt.label}
        </div>
      ))}
    </div>
  ) : null;

  return (
    <div ref={triggerRef} style={{ position: 'relative', userSelect: 'none' }}>
      <div
        onClick={handleOpen}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--ov-card-bg)',
          backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
          border: '1px solid var(--ov-card-border)', borderRadius: 10,
          padding: '9px 14px', fontFamily: 'Figtree, system-ui, sans-serif',
          fontSize: 13, color: 'var(--ov-text)', cursor: 'pointer', whiteSpace: 'nowrap', minWidth: 130,
          boxShadow: '0 6px 20px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.72)',
        }}
      >
        <span style={{ flex: 1 }}>{selected.label}</span>
        <span style={{
          fontSize: 10, color: 'var(--ov-muted)',
          transition: 'transform 0.25s', display: 'inline-block',
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        }}>▾</span>
      </div>
      {createPortal(menu, document.body)}
    </div>
  );
}

// ─── Activity Chart ────────────────────────────────────────────────────────────
function ActivityChart({ sessions }: { sessions: { date: Date; itemsCaptured: number }[] }) {
  const days = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - i));
      return {
        label: d.toLocaleDateString('en-GB', { day: '2-digit' }),
        count: sessions.filter(s => new Date(s.date).toDateString() === d.toDateString()).length,
      };
    });
  }, [sessions]);

  const maxCount = Math.max(...days.map(d => d.count), 1);
  const total = sessions.length;
  const W = 460, H = 155, padX = 38, padY = 14;
  const cW = W - padX - 16, cH = H - padY * 2;

  const pts = days.map((d, i) => ({
    x: padX + (i / (days.length - 1)) * cW,
    y: padY + (1 - d.count / maxCount) * cH,
    ...d,
  }));

  const linePath = pts.reduce((acc, p, i) => {
    if (i === 0) return `M${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    const prev = pts[i - 1];
    const cx = (prev.x + p.x) / 2;
    return `${acc} C${cx.toFixed(1)},${prev.y.toFixed(1)} ${cx.toFixed(1)},${p.y.toFixed(1)} ${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }, '');

  const areaPath = `${linePath} L${pts[pts.length - 1].x.toFixed(1)},${H - padY} L${pts[0].x.toFixed(1)},${H - padY}Z`;
  const peakIdx = days.reduce((best, d, i) => d.count > days[best].count ? i : best, 0);
  const peak = pts[peakIdx];

  const now = new Date();
  const dateRange = `${days[0].label}–${days[6].label} ${now.toLocaleString('en-GB', { month: 'short' })}`;

  return (
    <div style={{
      background: 'var(--ov-card-bg)',
      backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
      border: '1px solid var(--ov-card-border)', borderRadius: 22,
      boxShadow: 'var(--ov-shadow)',
      padding: '22px 22px 14px', flex: 1, minWidth: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'Figtree, system-ui, sans-serif', fontSize: 22, fontWeight: 700, color: 'var(--ov-text)', marginRight: 'auto' }}>Activity</span>
        <span style={{ fontSize: 12, color: 'var(--ov-muted)' }}>Active sessions per day</span>
        <div style={{
          background: 'var(--ov-inner)', border: '1px solid var(--ov-card-border)',
          borderRadius: 20, padding: '5px 13px', fontSize: 12, fontWeight: 500,
          color: 'var(--ov-text)', whiteSpace: 'nowrap',
        }}>{dateRange}</div>
      </div>

      <div style={{ position: 'relative', height: H }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none">
          <defs>
            <linearGradient id="darkFillGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F0C050" stopOpacity="0.30" />
              <stop offset="100%" stopColor="#F0C050" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3].map(i => (
            <line key={i} x1={padX} y1={padY + i * (cH / 3)} x2={W - 16} y2={padY + i * (cH / 3)}
              stroke="var(--ov-grid)" strokeWidth="1" />
          ))}
          {[maxCount, Math.round(maxCount * 0.66), Math.round(maxCount * 0.33), 0].map((v, i) => (
            <text key={i} x={0} y={padY + i * (cH / 3) + 4} fontSize="10"
              fill="var(--ov-svg-text)" fontFamily="Figtree,system-ui,sans-serif">{v}</text>
          ))}
          <path d={areaPath} fill="url(#darkFillGrad)" />
          <path d={linePath} fill="none" stroke="#F0C050" strokeWidth="2.8"
            strokeLinecap="round" strokeLinejoin="round"
            style={{ filter: 'drop-shadow(0 0 7px rgba(240,192,80,0.75))' }} />
          {total > 0 && (
            <circle cx={peak.x} cy={peak.y} r="6" fill="#F0C050"
              stroke="rgba(70,99,172,0.25)" strokeWidth="2.5"
              style={{ filter: 'drop-shadow(0 0 8px rgba(240,192,80,0.95))' }}>
              <title>{peak.label}: {peak.count} session{peak.count !== 1 ? 's' : ''}</title>
            </circle>
          )}
        </svg>
        {total > 0 && (
          <div style={{
            position: 'absolute', top: '10%', left: '46%', transform: 'translateX(-50%)',
            background: 'var(--ov-tooltip)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
            border: '1px solid var(--ov-card-border)', borderRadius: 12, padding: '6px 14px 7px',
            pointerEvents: 'none', boxShadow: '0 6px 20px rgba(0,0,0,0.4)', whiteSpace: 'nowrap',
          }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--ov-text)', display: 'block' }}>{total}</span>
            <span style={{ fontSize: 10, color: 'var(--ov-muted)' }}>Total sessions</span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 8px 0', fontSize: 11, color: 'var(--ov-muted)' }}>
        {days.map(d => <span key={d.label}>{d.label}</span>)}
      </div>
    </div>
  );
}

// ─── Readiness ring ────────────────────────────────────────────────────────────
function ReadinessCard({ score, capturedItems, horizontal = false }: { score: number; capturedItems: { category: string }[]; horizontal?: boolean }) {
  const r = horizontal ? 75 : 50, circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;

  const total = capturedItems.length || 1;
  const finances = capturedItems.filter(i => i.category === 'bank_accounts' || i.category === 'financial_accounts').length;
  const documents = capturedItems.filter(i => i.category === 'documents').length;
  const property = capturedItems.filter(i => i.category === 'property').length;
  const other = Math.max(0, total - finances - documents - property);

  const legend = [
    { label: 'Finances',  pct: Math.round((finances  / total) * 100), color: '#5ECFCF', glow: 'rgba(94,207,207,0.7)' },
    { label: 'Documents', pct: Math.round((documents / total) * 100), color: '#F0C050', glow: 'rgba(240,192,80,0.7)' },
    { label: 'Property',  pct: Math.round((property  / total) * 100), color: '#5DD87A', glow: 'rgba(93,216,122,0.7)' },
    { label: 'Other',     pct: Math.round((other     / total) * 100), color: 'rgba(255,255,255,0.25)', glow: '' },
  ];

  return (
    <div style={{
      background: 'var(--ov-card-bg)',
      backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
      border: '1px solid var(--ov-card-border)', borderRadius: 22,
      boxShadow: 'var(--ov-shadow)',
      padding: horizontal ? '24px 28px' : '24px 20px',
      display: 'flex',
      flexDirection: horizontal ? 'row' : 'column',
      alignItems: 'center',
      justifyContent: horizontal ? undefined : 'center',
      gap: horizontal ? 28 : 18,
    }}>
      {/* Title — top in vertical, hidden here in horizontal (shown on right) */}
      {!horizontal && (
        <div style={{ fontFamily: 'Figtree, system-ui, sans-serif', fontSize: 20, fontWeight: 700, color: 'var(--ov-text)', textAlign: 'center', lineHeight: 1.2 }}>
          Readiness<br />Score
        </div>
      )}

      {/* Ring */}
      <div style={{ position: 'relative', width: horizontal ? 180 : 130, height: horizontal ? 180 : 130, flexShrink: 0 }}>
        {horizontal ? (
          <svg width="180" height="180" viewBox="0 0 180 180" style={{ transform: 'rotate(-90deg)' }}>
            <defs>
              <linearGradient id="ringGradDark" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#5ECFCF" />
                <stop offset="100%" stopColor="#F0C050" />
              </linearGradient>
            </defs>
            <circle cx="90" cy="90" r={r} fill="none" stroke="var(--ov-card-border)" strokeWidth="14" />
            <circle cx="90" cy="90" r={r} fill="none" stroke="url(#ringGradDark)" strokeWidth="14"
              strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)', filter: 'drop-shadow(0 0 10px rgba(94,207,207,0.7))' }} />
          </svg>
        ) : (
          <svg width="130" height="130" viewBox="0 0 130 130" style={{ transform: 'rotate(-90deg)' }}>
            <defs>
              <linearGradient id="ringGradDark" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#5ECFCF" />
                <stop offset="100%" stopColor="#F0C050" />
              </linearGradient>
            </defs>
            <circle cx="65" cy="65" r={r} fill="none" stroke="var(--ov-card-border)" strokeWidth="12" />
            <circle cx="65" cy="65" r={r} fill="none" stroke="url(#ringGradDark)" strokeWidth="12"
              strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)', filter: 'drop-shadow(0 0 8px rgba(94,207,207,0.7))' }} />
          </svg>
        )}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: 'Figtree, system-ui, sans-serif', fontSize: horizontal ? 38 : 28, fontWeight: 900, color: 'var(--ov-text)', lineHeight: 1 }}>{score}%</span>
          <span style={{ fontSize: horizontal ? 11 : 10, color: 'var(--ov-muted)', marginTop: horizontal ? 4 : 2 }}>prepared</span>
        </div>
      </div>

      {/* Legend — below ring in vertical, right column in horizontal */}
      {horizontal ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontFamily: 'Figtree, system-ui, sans-serif', fontSize: 20, fontWeight: 700, color: 'var(--ov-text)', lineHeight: 1.2 }}>
            Readiness<br />Score
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {legend.map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12, color: 'var(--ov-muted)' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: item.color, boxShadow: item.glow ? `0 0 6px ${item.glow}` : undefined }} />
                <span style={{ flex: 1 }}>{item.label}</span>
                <span style={{ fontWeight: 600, color: 'var(--ov-text)', fontSize: 12 }}>{item.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 9 }}>
          {legend.map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12, color: 'var(--ov-muted)' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: item.color, boxShadow: item.glow ? `0 0 6px ${item.glow}` : undefined }} />
              <span style={{ flex: 1 }}>{item.label}</span>
              <span style={{ fontWeight: 600, color: 'var(--ov-text)', fontSize: 12 }}>{item.pct}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface DashboardOverviewProps {
  advancedMode?: boolean;
  query?: string;
  categoryFilter?: string;
  confidenceFilter?: string;
  onQueryChange?: (v: string) => void;
  onCategoryChange?: (v: string) => void;
  onConfidenceChange?: (v: string) => void;
  onDownload?: () => void;
  onNavigatePage?: (page: string) => void;
}

const CATEGORY_OPTIONS = [
  { value: 'all',                label: 'All categories' },
  { value: 'bank_accounts',      label: 'Bank Accounts' },
  { value: 'financial_accounts', label: 'Financial' },
  { value: 'property',           label: 'Property' },
  { value: 'documents',          label: 'Documents' },
  { value: 'care_wishes',        label: 'Care Wishes' },
  { value: 'key_contacts',       label: 'Key Contacts' },
];

const CONFIDENCE_OPTIONS = [
  { value: 'all',              label: 'All confidence' },
  { value: 'clear',            label: 'Clear' },
  { value: 'needs-follow-up',  label: 'Needs follow-up' },
];

export default function DashboardOverview({
  advancedMode = false,
  query = '',
  categoryFilter = 'all',
  confidenceFilter = 'all',
  onQueryChange = () => {},
  onCategoryChange = () => {},
  onConfidenceChange = () => {},
  onDownload = () => {},
  onNavigatePage = () => {},
}: DashboardOverviewProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const {
    capturedItems,
    actionItems,
    sessions,
    readinessHistory,
    parentName,
    childName,
    familyId,
    userNotes,
    updateCapturedVerification,
    removeCapturedItem,
    updateActionStatus,
    setLastClaraMessage,
    setLastUserMessage,
    handleAgentToolCall,
  } = useSession();

  const activeActions = actionItems.filter((a) => a.status !== 'done').length;
  const [rcIdx, setRcIdx] = useState(0);
  const [hoveredPanel, setHoveredPanel] = useState<number | null>(null);
  const [dismissTarget, setDismissTarget] = useState<CapturedItem | null>(null);

  // ── Clara-in-dashboard mode ───────────────────────────────────────────────────
  const [claraActive, setClaraActive] = useState(false);
  const [claraTopicsVisible, setClaraTopicsVisible] = useState(false);
  const [claraSelectedTopic, setClaraSelectedTopic] = useState<string | null>(null);
  const [claraHasStarted, setClaraHasStarted] = useState(false);
  const [claraIsHolding, setClaraIsHolding] = useState(false);
  const [claraMicPressed, setClaraMicPressed] = useState(false);
  const [claraError, setClaraError] = useState<string | null>(null);
  const claraIsHoldingRef = useRef(false);
  const claraAudioUnlockedRef = useRef(false);
  const claraConnectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const claraConvMethodsRef = useRef<{
    start: (config: object) => Promise<void>;
    end: () => Promise<void>;
    setVolume: (v: { volume: number }) => void;
  } | null>(null);
  const claraInterruptBufferRef = useRef<string[]>([]);

  const agentId = import.meta.env.VITE_ELEVENLABS_AGENT_ID as string;

  const cleanClaraMsg = (raw: string) =>
    raw.replace(/\[NOTE:[^\]]*\]/gi, '').replace(/^\[Patient\]\s*/i, '').replace(/\s{2,}/g, ' ').trim();

  const { status: claraStatus, isSpeaking: claraIsSpeaking } = useConversation({
    onConnect: (props) => {
      claraConvMethodsRef.current = props as typeof claraConvMethodsRef.current;
      if (claraConnectionTimeoutRef.current) {
        clearTimeout(claraConnectionTimeoutRef.current);
        claraConnectionTimeoutRef.current = null;
      }
      setClaraHasStarted(true);
      setClaraError(null);
    },
    onMessage: useCallback((message: { source: string; message: string }) => {
      if (message.source === 'ai') {
        const cleaned = cleanClaraMsg(message.message);
        if (cleaned) {
          setLastClaraMessage(cleaned);
          const noteMatch = message.message.match(/\[NOTE:\s*([^\]]+)\]/i);
          if (noteMatch) {
            const noteStr = noteMatch[1];
            const get = (key: string) => { const m = noteStr.match(new RegExp(`${key}=([^,\\]]+)`, 'i')); return m ? m[1].trim() : undefined; };
            handleAgentToolCall('capture_note', { category: get('category') ?? 'general', content: get('content') ?? noteStr, confidence: get('confidence') ?? 'clear', flag: get('flag') === 'true' });
          }
        }
        if (claraInterruptBufferRef.current.length > 0) {
          setLastUserMessage(claraInterruptBufferRef.current.join(' … '));
          claraInterruptBufferRef.current = [];
        }
      } else if (message.source === 'user') {
        if (claraIsHoldingRef.current) {
          claraInterruptBufferRef.current.push(message.message);
        } else {
          setLastUserMessage(message.message);
        }
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [setLastClaraMessage, setLastUserMessage, handleAgentToolCall]),
    onDisconnect: useCallback(() => {
      claraConvMethodsRef.current = null;
      claraIsHoldingRef.current = false;
      setClaraIsHolding(false);
      if (claraConnectionTimeoutRef.current) {
        clearTimeout(claraConnectionTimeoutRef.current);
        claraConnectionTimeoutRef.current = null;
      }
    }, []),
    onError: useCallback((error: Error) => {
      console.error('Clara error:', error);
      setClaraError("Clara couldn't connect. Please try again.");
      claraConvMethodsRef.current = null;
      if (claraConnectionTimeoutRef.current) {
        clearTimeout(claraConnectionTimeoutRef.current);
        claraConnectionTimeoutRef.current = null;
      }
    }, []),
  });

  const claraIsSessionActive = claraStatus === 'connected';
  const claraIsStarting = claraStatus === 'connecting';

  const buildClaraContext = useCallback((topic: string | null) => {
    const coveredCats = new Set(capturedItems.map(i => i.category));
    const ALL_CATS = ['bank_accounts','financial_accounts','documents','property','care_wishes','key_contacts'];
    const CATEGORY_LABELS: Record<string,string> = { bank_accounts:'Bank Accounts', financial_accounts:'Financial', documents:'Documents', property:'Property', care_wishes:'Care Wishes', key_contacts:'Key Contacts' };
    let baseContext = '';
    if (capturedItems.length > 0) {
      const linesByCat: Record<string, string[]> = {};
      for (const item of capturedItems.slice(0, 30)) {
        if (!linesByCat[item.category]) linesByCat[item.category] = [];
        if (linesByCat[item.category].length < 3) linesByCat[item.category].push(item.content.trim());
      }
      baseContext = `From previous sessions with ${parentName} (reviewed by ${childName}):\n${Object.entries(linesByCat).map(([cat, lines]) => `- [${CATEGORY_LABELS[cat] ?? cat}]: ${lines.join('; ')}`).join('\n')}\n\n`;
    }
    if (!topic || topic === 'all') {
      const notCovered = ALL_CATS.filter(c => !coveredCats.has(c));
      return `${baseContext}${notCovered.length > 0 ? `Topics NOT yet covered: ${notCovered.map(c => CATEGORY_LABELS[c]).join(', ')}.` : `All main topics have been covered — do a gentle check.`}\nFocus this session on what's missing.`;
    }
    const TOPIC_DEEP: Record<string,string> = { bank_accounts:`bank accounts`, financial_accounts:`financial accounts (pensions, ISAs, investments)`, documents:`documents (will, LPA, insurance)`, property:`property (home, deeds, mortgage)`, care_wishes:`care wishes (care preferences, end-of-life)`, key_contacts:`key contacts (GP, solicitor, accountant)` };
    return `${baseContext}⚠️ TOPIC FOCUS OVERRIDE: For this session, talk ONLY about ${TOPIC_DEEP[topic] ?? topic}. Explore this topic in depth. Once thorough, end the session warmly.`;
  }, [capturedItems, parentName, childName]);

  const startClaraSession = useCallback(async () => {
    if (claraStatus !== 'disconnected') return;
    setClaraError(null);
    const context = buildClaraContext(claraSelectedTopic);
    try {
      await claraConvMethodsRef.current!.start({
        agentId,
        connectionType: 'websocket',
        dynamicVariables: { context, elderly_name: parentName, trusted_contact_name: childName, family_id: familyId },
      });
    } catch (err) {
      if (claraConnectionTimeoutRef.current) { clearTimeout(claraConnectionTimeoutRef.current); claraConnectionTimeoutRef.current = null; }
      setClaraError("Clara couldn't connect. Please try again.");
      console.error(err);
    }
  }, [agentId, claraStatus, buildClaraContext, claraSelectedTopic, parentName, childName, familyId]);

  const endClaraSession = useCallback(async () => {
    setClaraIsHolding(false);
    claraIsHoldingRef.current = false;
    if (claraConnectionTimeoutRef.current) { clearTimeout(claraConnectionTimeoutRef.current); claraConnectionTimeoutRef.current = null; }
    try { await claraConvMethodsRef.current?.end(); } catch (_) { /* ignore */ }
  }, []);

  const exitClaraMode = useCallback(async () => {
    await endClaraSession();
    setClaraActive(false);
    setClaraTopicsVisible(false);
    setClaraSelectedTopic(null);
    setClaraHasStarted(false);
    setClaraIsHolding(false);
    setClaraMicPressed(false);
    setClaraError(null);
  }, [endClaraSession]);

  useEffect(() => {
    return () => {
      if (claraConnectionTimeoutRef.current) clearTimeout(claraConnectionTimeoutRef.current);
      claraConvMethodsRef.current?.end().catch(() => {});
    };
  }, []);

  const handleClaraPressStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!claraAudioUnlockedRef.current) {
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioCtx();
        ctx.resume().then(() => ctx.close());
        claraAudioUnlockedRef.current = true;
      } catch (_) { /* non-critical */ }
    }
    setClaraMicPressed(true);
    if (!claraIsSessionActive) { startClaraSession(); return; }
    claraIsHoldingRef.current = true;
    setClaraIsHolding(true);
  }, [claraIsSessionActive, startClaraSession]);

  const handleClaraPressEnd = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setClaraMicPressed(false);
    if (!claraIsSessionActive) return;
    claraIsHoldingRef.current = false;
    setClaraIsHolding(false);
  }, [claraIsSessionActive]);

  const handleClaraCardClick = () => {
    if (claraActive) return;
    setClaraActive(true);
    setTimeout(() => setClaraTopicsVisible(true), 420);
  };

  const filteredCaptured = useMemo(() => {
    const q = query.trim().toLowerCase();
    return capturedItems.filter((item) => {
      const matchesQuery = !q
        || item.content.toLowerCase().includes(q)
        || item.category.toLowerCase().includes(q)
        || (item.sourceQuote ?? '').toLowerCase().includes(q)
        || (userNotes[item.id] ?? '').toLowerCase().includes(q);
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      const matchesConfidence = confidenceFilter === 'all' || item.confidence === confidenceFilter;
      return matchesQuery && matchesCategory && matchesConfidence;
    });
  }, [capturedItems, query, categoryFilter, confidenceFilter, userNotes]);

  const filteredActions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return actionItems.filter((action) => {
      if (action.status === 'done') return false;
      if (!q) return true;
      return action.title.toLowerCase().includes(q) || action.description.toLowerCase().includes(q);
    });
  }, [actionItems, query]);

  const areas = [
    capturedItems.some((i) => i.category === 'bank_accounts' || i.category === 'financial_accounts'),
    capturedItems.some((i) => i.category === 'property'),
    capturedItems.some((i) => i.category === 'documents'),
    capturedItems.some((i) => i.category === 'care_wishes'),
    capturedItems.some((i) => i.category === 'key_contacts'),
    sessions.length > 0,
    actionItems.length > 0,
  ];
  const score = Math.round((areas.filter(Boolean).length / areas.length) * 100);

  const needsFollowUpCount = capturedItems.filter((i) => i.confidence === 'needs-follow-up').length;
  const verifiedCount = capturedItems.filter((i) => i.verificationStatus === 'verified').length;
  const lastUpdated = capturedItems[0]?.timestamp ? new Date(capturedItems[0].timestamp) : undefined;

  // Change 3: readiness ring
  const totalTopics = 7;
  const coveredTopics = [
    capturedItems.some(i => i.category === 'bank_accounts'),
    capturedItems.some(i => i.category === 'financial_accounts'),
    capturedItems.some(i => i.category === 'property'),
    capturedItems.some(i => i.category === 'documents'),
    capturedItems.some(i => i.category === 'documents' && (i.content?.toLowerCase().includes('power') || i.content?.toLowerCase().includes('lpa'))) || capturedItems.some(i => i.category === 'key_contacts'),
    capturedItems.some(i => i.category === 'key_contacts'),
    capturedItems.some(i => i.category === 'care_wishes'),
  ].filter(Boolean).length;
  const readinessPct = Math.round((coveredTopics / totalTopics) * 100);

  // Change 4: topic progress
  const topicProgress = [
    { name: 'Bank Accounts', icon: '💷', category: 'bank_accounts' },
    { name: 'Pension', icon: '🏦', category: 'financial_accounts' },
    { name: 'Property', icon: '🏠', category: 'property' },
    { name: 'Documents & Will', icon: '📄', category: 'documents' },
    { name: 'Power of Attorney', icon: '⚖️', category: 'documents' },
    { name: 'Key Contacts', icon: '📞', category: 'key_contacts' },
    { name: 'Care Wishes', icon: '❤️', category: 'care_wishes' },
  ];

  const [checked, setChecked] = useState<Set<string>>(loadChecklist);
  const toggleDoc = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveChecklist(next);
      return next;
    });
  };

  const hasFollowUps = needsFollowUpCount > 0 || activeActions > 0;
  const primarySessionLabel = hasFollowUps ? `Continue with ${parentName}` : 'Start New Session';

  const NAV_PANELS = [
    { Icon: CreditCard,     label: 'Bank Accounts',        category: 'bank_accounts',      page: 'financial' },
    { Icon: HandCoins,      label: 'Pensions & Investments', category: 'financial_accounts', page: 'financial' },
    { Icon: House,          label: 'Property',             category: 'property',           page: 'property'  },
    { Icon: BookOpenCheck,  label: 'Will & Documents',     category: 'documents',          page: 'documents' },
    { Icon: Users,          label: 'Key Contacts',         category: 'key_contacts',       page: 'contacts'  },
    { Icon: HeartHandshake, label: 'Care Wishes',          category: 'care_wishes',        page: 'care'      },
  ];

  // ── Simple mode (advanced mode OFF) ─────────────────────────────────────────
  if (!advancedMode) {
    const rcItems = filteredCaptured.slice(0, 10);
    const rcTotal = rcItems.length;
    const safeIdx = rcTotal > 0 ? Math.min(rcIdx, rcTotal - 1) : 0;
    const currentItem = rcItems[safeIdx];
    const RC_TAG: Record<string, string> = {
      bank_accounts: 'FINANCE', financial_accounts: 'FINANCE',
      documents: 'DOCUMENTS', care_wishes: 'CARE WISHES',
      property: 'PROPERTY', key_contacts: 'CONTACTS',
    };

    return (
      <>
      <div key="simple" className="cn-stagger" style={{ display: 'grid', gap: 18, flex: 1, gridTemplateRows: isMobile ? undefined : 'auto 1fr' }}>

        {/* Row 1: Recently Captured | Readiness Score */}
        <div style={{
          display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 18,
          opacity: claraActive ? 0 : 1,
          transform: claraActive ? 'translateY(-12px)' : 'translateY(0)',
          pointerEvents: claraActive ? 'none' : 'auto',
          transition: 'opacity 0.4s ease, transform 0.4s ease',
        }}>

          {/* Recently Captured */}
          <div style={{
            background: 'var(--ov-card-bg)',
            backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
            border: '1px solid var(--ov-card-border)', borderRadius: 22,
            boxShadow: 'var(--ov-shadow)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 280,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 22px 16px', flexShrink: 0 }}>
              <span style={{ fontFamily: 'Figtree, system-ui, sans-serif', fontSize: 20, fontWeight: 700, color: 'var(--ov-accent)', textShadow: '0 0 18px rgba(70,99,172,0.45)' }}>
                Recently Captured
              </span>
              <span style={{ fontSize: 14, color: 'var(--ov-muted)', fontWeight: 500 }}>
                {rcTotal > 0 ? `${safeIdx + 1} / ${rcTotal}` : '0 items'}
              </span>
            </div>
            <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
              {rcTotal === 0 ? (
                <div style={{ padding: '0 22px 16px', color: 'var(--ov-muted)', fontSize: 14 }}>
                  No captures yet. Start a conversation with {parentName}.
                </div>
              ) : (
                <div style={{
                  display: 'flex', height: '100%',
                  transform: `translateX(-${safeIdx * 100}%)`,
                  transition: 'transform 0.38s cubic-bezier(0.4,0,0.2,1)',
                }}>
                  {rcItems.map((item) => {
                    const dotColor = item.verificationStatus === 'verified' ? '#5DD87A'
                      : item.verificationStatus === 'disputed' ? '#FF5F52'
                      : item.confidence === 'needs-follow-up' ? '#F0C050' : '#5ECFCF';
                    const dotGlow = item.verificationStatus === 'verified' ? 'rgba(93,216,122,0.6)'
                      : item.verificationStatus === 'disputed' ? 'rgba(255,95,82,0.6)'
                      : item.confidence === 'needs-follow-up' ? 'rgba(240,192,80,0.6)' : 'rgba(94,207,207,0.6)';
                    const statusLabel = item.verificationStatus === 'verified' ? 'Confirmed'
                      : item.verificationStatus === 'disputed' ? 'Disputed'
                      : item.confidence === 'needs-follow-up' ? 'Needs follow-up' : 'To verify';
                    return (
                      <div key={item.id} style={{ minWidth: '100%', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 11, padding: '0 22px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--ov-inner)', border: '1px solid var(--ov-card-border)', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 600, color: 'var(--ov-muted)', letterSpacing: '0.4px' }}>
                            {RC_TAG[item.category] || item.category.replace(/_/g, ' ').toUpperCase()}
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--ov-muted)', whiteSpace: 'nowrap' }}>
                            {item.timestamp.toLocaleString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ov-accent)', lineHeight: 1.45 }}>
                          {item.content.length > 140 ? `${item.content.slice(0, 140)}…` : item.content}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--ov-muted)' }}>
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, boxShadow: `0 0 5px ${dotGlow}`, flexShrink: 0 }} />
                              {statusLabel}
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 6, padding: '2px 8px', fontSize: 10, color: 'var(--ov-muted)' }}>
                              {item.verificationStatus ?? 'unverified'}
                            </div>
                          </div>
                          {item.sourceQuote && (
                            <div style={{ fontSize: 11, color: 'var(--ov-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <MessageSquareQuote style={{ width: 11, height: 11 }} />
                              {parentName}'s words
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {rcTotal > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '10px 22px 6px', flexShrink: 0 }}>
                {rcItems.map((_, i) => (
                  <div key={i} onClick={() => setRcIdx(i)} style={{
                    flex: 1, height: 3, borderRadius: 99, cursor: 'pointer',
                    background: i === safeIdx ? 'var(--ov-accent)' : 'var(--ov-grid)',
                    boxShadow: i === safeIdx ? '0 0 6px rgba(70,99,172,0.7)' : 'none',
                    transition: 'background 0.3s, box-shadow 0.3s',
                  }} />
                ))}
              </div>
            )}
            <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr', flexShrink: 0 }}>
              <button
                onClick={() => { if (currentItem) setDismissTarget(currentItem); }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#FF5F52'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--ov-muted)'; (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
                style={{ padding: '14px 10px', textAlign: 'center', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--ov-muted)', background: 'none', border: 'none', borderRadius: '0 0 0 22px', transition: 'background 0.2s, color 0.2s', fontFamily: 'Figtree, system-ui, sans-serif' }}
              >Dismiss</button>
              <div style={{ background: 'rgba(255,255,255,0.08)', margin: '8px 0' }} />
              <button
                onClick={() => { if (currentItem) updateCapturedVerification(currentItem.id, 'verified'); if (safeIdx < rcTotal - 1) setRcIdx(safeIdx + 1); }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#5DD87A'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--ov-muted)'; (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
                style={{ padding: '14px 10px', textAlign: 'center', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--ov-muted)', background: 'none', border: 'none', borderRadius: '0 0 22px 0', transition: 'background 0.2s, color 0.2s', fontFamily: 'Figtree, system-ui, sans-serif' }}
              >Verify</button>
            </div>
            {/* 30-day expiry notice */}
            <div style={{ padding: '6px 18px 14px', textAlign: 'center', fontSize: 10, color: 'var(--ov-muted)', opacity: 0.55, lineHeight: 1.4 }}>
              Dismissed items are permanently deleted · All captured data auto-purges after 30 days
            </div>
          </div>

          {/* Readiness Score */}
          <ReadinessCard score={readinessPct} capturedItems={capturedItems} horizontal />
        </div>

        {/* Row 2: Nav Panels | Chat to Clara */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 300px', gap: 18 }}>

          {/* Left column — nav panels (fades out) + topics/dialogue overlay (fades in) */}
          <div style={{ position: 'relative', height: '100%' }}>

            {/* Nav Panels 3×2 — fades out when Clara active */}
            <div style={{
              display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gridTemplateRows: isMobile ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)', gap: 10,
              height: '100%',
              opacity: claraActive ? 0 : 1,
              transition: 'opacity 0.35s ease',
              pointerEvents: claraActive ? 'none' : 'auto',
            }}>
              {NAV_PANELS.map((panel, i) => {
                const isActive = panel.category === categoryFilter;
                const isHov = hoveredPanel === i;
                return (
                  <div
                    key={panel.category}
                    onClick={() => onNavigatePage(panel.page)}
                    onMouseEnter={() => setHoveredPanel(i)}
                    onMouseLeave={() => setHoveredPanel(null)}
                    style={{
                      background: isActive ? 'var(--ov-inner)' : isHov ? 'var(--ov-nav-hover-bg)' : 'var(--ov-card-bg)',
                      backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
                      border: `1px solid ${isActive ? 'var(--ov-accent)' : 'var(--ov-card-border)'}`,
                      borderRadius: 16,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      gap: 8, padding: isMobile ? '14px 8px' : '20px 10px', cursor: 'pointer',
                      transition: 'background 0.2s, border-color 0.2s, transform 0.2s, box-shadow 0.2s',
                      transform: isHov ? 'translateY(-3px)' : 'translateY(0)',
                      boxShadow: isActive
                        ? '0 6px 24px rgba(0,0,0,0.3), 0 0 0 1px rgba(70,99,172,0.16), inset 0 1px 0 rgba(255,255,255,0.10)'
                        : isHov ? '0 12px 28px rgba(0,0,0,0.38)' : '0 6px 20px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.72)',
                    }}
                  >
                    <panel.Icon style={{
                      width: isMobile ? 28 : 42, height: isMobile ? 28 : 42,
                      color: isActive ? 'var(--ov-accent)' : isHov ? 'var(--ov-text)' : 'var(--ov-muted)',
                      filter: isActive ? 'drop-shadow(0 0 14px rgba(70,99,172,0.8))' : isHov ? 'drop-shadow(0 0 12px rgba(255,255,255,0.35))' : 'drop-shadow(0 2px 6px rgba(0,0,0,0.5))',
                      transition: 'transform 0.2s, filter 0.2s, color 0.2s',
                      transform: isHov ? 'scale(1.12)' : 'scale(1)',
                      display: 'block', margin: '0 auto',
                    }} />
                    <span style={{
                      fontSize: isMobile ? 11 : 10, fontWeight: 600,
                      color: isActive ? 'var(--ov-accent)' : 'var(--ov-text)',
                      textAlign: 'center', lineHeight: 1.35,
                      opacity: isMobile || isHov || isActive ? 1 : 0,
                      transition: 'opacity 0.2s, color 0.2s',
                      fontFamily: 'Figtree, system-ui, sans-serif',
                    }}>{panel.label}</span>
                  </div>
                );
              })}
            </div>

            {/* Clara mode overlay — topics / ready prompt / live dialogue */}
            <div style={{
              position: 'absolute', inset: 0,
              opacity: claraTopicsVisible ? 1 : 0,
              transition: 'opacity 0.45s ease 0.1s',
              pointerEvents: claraTopicsVisible ? 'auto' : 'none',
              display: 'flex', flexDirection: 'column', justifyContent: 'center',
              paddingLeft: 4,
            }}>
              {!claraSelectedTopic ? (
                /* State 1: Topic picker */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <p style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
                    textTransform: 'uppercase', color: 'var(--ov-text)', opacity: 0.4,
                    margin: '0 0 10px 0', fontFamily: 'Figtree, system-ui, sans-serif',
                  }}>Topics to cover</p>
                  {NAV_PANELS.map(panel => {
                    const covered = capturedItems.some(i => i.category === panel.category);
                    return (
                      <button
                        key={panel.category}
                        onClick={() => !covered && setClaraSelectedTopic(panel.category)}
                        disabled={covered}
                        style={{
                          background: 'none', border: 'none', padding: 0,
                          textAlign: 'left', cursor: covered ? 'default' : 'pointer',
                          fontSize: 'clamp(20px, 2.8vw, 38px)', fontWeight: 900,
                          lineHeight: 1.08, letterSpacing: '-1px',
                          color: 'var(--ov-text)',
                          opacity: covered ? 0.22 : 1,
                          textDecoration: covered ? 'line-through' : 'none',
                          transition: 'opacity 0.15s ease',
                          fontFamily: 'Figtree, system-ui, sans-serif',
                          display: 'flex', alignItems: 'center', gap: 10,
                        }}
                        onMouseEnter={e => { if (!covered) (e.currentTarget as HTMLButtonElement).style.opacity = '0.6'; }}
                        onMouseLeave={e => { if (!covered) (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
                      >
                        <panel.Icon size="0.55em" fill="currentColor" color="currentColor" strokeWidth={0} style={{ flexShrink: 0 }} />
                        {panel.label}
                      </button>
                    );
                  })}
                </div>
              ) : claraHasStarted ? (
                /* State 3: Live dialogue */
                <div style={{
                  fontSize: 'clamp(28px, 3.5vw, 52px)', fontWeight: 900,
                  lineHeight: 1.1, color: 'var(--ov-text)',
                  letterSpacing: '-1.5px', whiteSpace: 'pre-line', wordBreak: 'break-word',
                  fontFamily: 'Figtree, system-ui, sans-serif',
                }}>
                  {claraIsHolding ? 'Listening…' : claraIsSpeaking ? 'Hold to\ninterrupt' : claraIsStarting ? 'Connecting\nto Clara…' : 'Hold to\nspeak.'}
                </div>
              ) : (
                /* State 2: Topic selected, waiting to hold */
                <div>
                  <p style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
                    textTransform: 'uppercase', color: 'var(--ov-text)', opacity: 0.4,
                    margin: '0 0 10px 0', fontFamily: 'Figtree, system-ui, sans-serif',
                  }}>{NAV_PANELS.find(p => p.category === claraSelectedTopic)?.label}</p>
                  <div style={{
                    fontSize: 'clamp(32px, 4vw, 56px)', fontWeight: 900,
                    lineHeight: 1.0, color: 'var(--ov-text)',
                    letterSpacing: '-2px', whiteSpace: 'pre-line',
                    fontFamily: 'Figtree, system-ui, sans-serif',
                  }}>Hold Clara{'\n'}to begin.</div>
                </div>
              )}

              {claraError && (
                <p style={{ fontSize: 12, color: '#FF5F52', margin: '10px 0 0', fontFamily: 'Figtree, system-ui, sans-serif' }}>
                  {claraError}
                </p>
              )}
            </div>
          </div>

          {/* Chat to Clara — desktop only */}
          {!isMobile && (
          <div
            onClick={!claraActive ? handleClaraCardClick : undefined}
            onMouseDown={claraActive && claraSelectedTopic ? handleClaraPressStart : undefined}
            onMouseUp={claraActive && claraSelectedTopic ? handleClaraPressEnd : undefined}
            onMouseLeave={claraActive && claraSelectedTopic ? handleClaraPressEnd : undefined}
            onTouchStart={claraActive && claraSelectedTopic ? handleClaraPressStart : undefined}
            onTouchEnd={claraActive && claraSelectedTopic ? handleClaraPressEnd : undefined}
            onTouchCancel={claraActive && claraSelectedTopic ? handleClaraPressEnd : undefined}
            style={{
              cursor: claraActive ? (claraSelectedTopic ? 'pointer' : 'default') : 'pointer',
              background: claraActive ? 'transparent' : 'rgba(155,123,200,0.18)',
              backdropFilter: claraActive ? 'none' : 'blur(12px)',
              WebkitBackdropFilter: claraActive ? 'none' : 'blur(12px)',
              border: `1px solid ${claraActive ? 'transparent' : 'rgba(155,123,200,0.35)'}`,
              borderRadius: 22, padding: '24px 20px',
              position: 'relative', overflow: 'hidden',
              boxShadow: claraActive ? 'none' : '0 8px 30px rgba(61,31,138,0.35), inset 0 1px 0 rgba(255,255,255,0.12)',
              transition: 'background 0.5s ease, border-color 0.5s ease, box-shadow 0.5s ease, transform 0.2s',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              userSelect: 'none', WebkitUserSelect: 'none',
            } as React.CSSProperties}
            onMouseEnter={e => {
              if (claraActive) return;
              const d = e.currentTarget as HTMLDivElement;
              d.style.transform = 'scale(1.02)';
              d.style.boxShadow = '0 12px 40px rgba(61,31,138,0.5), inset 0 1px 0 rgba(255,255,255,0.12)';
            }}
            onMouseLeave={e => {
              if (claraActive) return;
              const d = e.currentTarget as HTMLDivElement;
              d.style.transform = 'scale(1)';
              d.style.boxShadow = '0 8px 30px rgba(61,31,138,0.35), inset 0 1px 0 rgba(255,255,255,0.12)';
            }}
          >
            {/* Decorative arcs — fade out when leaving */}
            <div style={{
              position: 'absolute', top: -12, right: -12, width: 95, height: 95, zIndex: 0,
              opacity: claraActive ? 0 : 1, transition: 'opacity 0.3s ease',
            }}>
              {[
                { size: 84, color: 'rgba(94,207,207,0.45)', rot: -20 },
                { size: 60, color: 'rgba(255,255,255,0.18)', rot: -8 },
                { size: 38, color: 'rgba(155,123,200,0.6)',  rot:  6 },
              ].map((arc, i) => (
                <div key={i} style={{
                  position: 'absolute',
                  width: arc.size, height: arc.size, borderRadius: '50%',
                  border: '5px solid transparent',
                  borderTopColor: arc.color, borderRightColor: arc.color,
                  top: (84 - arc.size) / 2, right: (84 - arc.size) / 2,
                  transform: `rotate(${arc.rot}deg)`,
                }} />
              ))}
            </div>

            {/* Purple sphere — always visible, scales with session state */}
            <div style={{
              transform: `scale(${
                claraMicPressed && !claraIsHolding ? 0.94 :
                claraIsSpeaking                   ? 1.35 :
                claraIsHolding                    ? 1.22 :
                claraIsStarting                   ? 1.08 :
                claraIsSessionActive              ? 1.08 :
                                                    1.0
              })`,
              transition: claraMicPressed ? 'transform 80ms ease' : 'transform 0.7s cubic-bezier(0.22,1,0.36,1)',
              transformOrigin: 'center',
            }}>
              <div style={{ position: 'relative', width: 180, height: 180 }}>
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  background: 'conic-gradient(from 0deg,rgba(155,123,200,0) 0%,rgba(155,123,200,0.6) 25%,rgba(200,170,255,0.4) 50%,rgba(100,60,180,0.5) 75%,rgba(155,123,200,0) 100%)',
                  animation: 'cnSphereRot 12s linear infinite', filter: 'blur(6px)',
                }} />
                <div style={{
                  position: 'absolute', inset: '8%', borderRadius: '50%',
                  background: 'conic-gradient(from 120deg,rgba(180,150,230,0) 0%,rgba(220,200,255,0.5) 30%,rgba(80,40,160,0.4) 60%,rgba(180,150,230,0) 100%)',
                  animation: 'cnSphereRot2 8s linear infinite', filter: 'blur(8px)',
                }} />
                <div style={{
                  position: 'absolute', width: '65%', height: '42%', borderRadius: '50%',
                  background: 'radial-gradient(ellipse,rgba(196,168,232,0.8) 0%,rgba(155,123,200,0.4) 50%,transparent 70%)',
                  top: '12%', left: '10%', animation: 'cnSphereSmoke1 6.5s ease-in-out infinite', filter: 'blur(8px)',
                }} />
                <div style={{
                  position: 'absolute', top: '14%', left: '20%', width: '36%', height: '26%', borderRadius: '50%',
                  background: 'radial-gradient(ellipse,rgba(255,255,255,0.55) 0%,transparent 70%)', zIndex: 9,
                }} />
              </div>
            </div>

            {/* Title + subtitle — fade out when Clara activates */}
            <div style={{
              fontFamily: 'Figtree, system-ui, sans-serif', fontSize: 22, fontWeight: 900, lineHeight: 1.2,
              color: 'white', marginBottom: 6, position: 'relative', zIndex: 1, textAlign: 'center',
              opacity: claraActive ? 0 : 1, transition: 'opacity 0.25s ease',
            }}>
              <span style={{ color: '#5ECFCF' }}>Chat</span> to Clara
            </div>
            <div style={{
              fontSize: 12, color: 'rgba(255,255,255,0.48)', position: 'relative', zIndex: 1, textAlign: 'center',
              opacity: claraActive ? 0 : 1, transition: 'opacity 0.25s ease',
            }}>
              {primarySessionLabel}
            </div>

            {/* Session phase label — shows when session active */}
            {claraHasStarted && (
              <div style={{
                fontSize: 13, fontWeight: 500, color: 'var(--ov-muted)',
                marginTop: 14, position: 'relative', zIndex: 1, textAlign: 'center',
                opacity: 0.7,
              }}>
                {claraIsStarting     && 'Connecting…'}
                {claraIsSpeaking && !claraIsHolding && 'Hold to interrupt'}
                {!claraIsSpeaking && !claraIsHolding && claraIsSessionActive && 'Hold to speak'}
                {claraIsHolding      && 'Release when done'}
              </div>
            )}
          </div>
          )}
        </div>

      </div>

      {/* Dismiss confirmation modal — shared across both render paths */}
      <AlertDialog open={dismissTarget !== null} onOpenChange={open => { if (!open) setDismissTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete this item?</AlertDialogTitle>
            <AlertDialogDescription>
              {dismissTarget && (
                <>
                  <span style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>
                    &ldquo;{dismissTarget.content.length > 100
                      ? `${dismissTarget.content.slice(0, 100)}…`
                      : dismissTarget.content}&rdquo;
                  </span>
                  This will be removed from your dashboard and permanently deleted from the database.
                  This action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDismissTarget(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (dismissTarget) {
                  removeCapturedItem(dismissTarget.id);
                  setRcIdx(prev => Math.max(0, prev - 1));
                }
                setDismissTarget(null);
              }}
              style={{ background: '#FF5F52', color: 'white' }}
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* End Chat button — fixed bottom-right, visible only in Clara mode */}
      {claraActive && (
        <button
          onClick={exitClaraMode}
          style={{
            position: 'fixed', bottom: 28, right: 28, zIndex: 50,
            background: 'rgba(255,255,255,0.18)',
            backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.35)',
            borderRadius: 14, padding: '12px 22px',
            fontFamily: 'Figtree, system-ui, sans-serif',
            fontSize: 14, fontWeight: 700, color: 'var(--ov-text)',
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.55)',
            transition: 'background 0.2s, box-shadow 0.2s, transform 0.15s',
            animation: 'fadeUp 0.35s cubic-bezier(0.22,1,0.36,1) both',
          }}
          onMouseEnter={e => {
            const b = e.currentTarget as HTMLButtonElement;
            b.style.background = 'rgba(255,95,82,0.18)';
            b.style.color = '#FF5F52';
            b.style.borderColor = 'rgba(255,95,82,0.35)';
            b.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={e => {
            const b = e.currentTarget as HTMLButtonElement;
            b.style.background = 'rgba(255,255,255,0.18)';
            b.style.color = 'var(--ov-text)';
            b.style.borderColor = 'rgba(255,255,255,0.35)';
            b.style.transform = 'translateY(0)';
          }}
        >
          End Chat
        </button>
      )}
      </>
    );
  }

  return (
    <>
    <div key="advanced" className="cn-stagger">

      {/* Activity + Momentum + Readiness row */}
      <div style={{
        display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 300px', gap: 16, marginBottom: 16,
        opacity: claraActive ? 0 : 1,
        transform: claraActive ? 'translateY(-12px)' : 'translateY(0)',
        pointerEvents: claraActive ? 'none' : 'auto',
        transition: 'opacity 0.4s ease, transform 0.4s ease',
      }}>
        <ActivityChart sessions={sessions} />
        <ProgressMomentum history={readinessHistory} verifiedCount={verifiedCount} checklistSize={checked.size} docTotal={DOC_ITEMS.length} activeActions={activeActions} />
        {!isMobile && <ReadinessCard score={readinessPct} capturedItems={capturedItems} />}
      </div>

      {/* Search section */}
      <div style={{
        marginBottom: 24,
        opacity: claraActive ? 0 : 1,
        pointerEvents: claraActive ? 'none' : 'auto',
        transition: 'opacity 0.35s ease',
      }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: 10, minWidth: 200,
            background: 'var(--ov-card-bg)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
            border: '1px solid var(--ov-card-border)', borderRadius: 12, padding: '11px 16px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)',
          }}>
            <Search style={{ width: 14, height: 14, color: 'var(--ov-muted)', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search pension, will, solicitor, provider…"
              value={query}
              onChange={e => onQueryChange(e.target.value)}
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                fontFamily: 'Figtree, system-ui, sans-serif', fontSize: 13,
                color: 'var(--ov-text)', caretColor: '#4663ac',
              }}
            />
          </div>

          <GlassDropdown value={categoryFilter} options={CATEGORY_OPTIONS} onChange={onCategoryChange} />
          <GlassDropdown value={confidenceFilter} options={CONFIDENCE_OPTIONS} onChange={onConfidenceChange} />

          <button
            onClick={onDownload}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              background: 'var(--ov-card-bg)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
              border: '1px solid var(--ov-card-border)', borderRadius: 10, padding: '9px 16px',
              fontFamily: 'Figtree, system-ui, sans-serif', fontSize: 13, fontWeight: 600, color: 'var(--ov-text)',
              cursor: 'pointer', whiteSpace: 'nowrap',
              boxShadow: 'var(--ov-shadow)',
            }}
          >
            ⬇ Download Report
          </button>
        </div>
        {/* <p style={{ fontSize: 11, color: 'var(--ov-muted)', paddingLeft: 4, margin: 0 }}>
          Downloads to your device only. Nothing is sent to ClearNest servers.
        </p> */}
      </div>

      {/* Recently Captured + Nav Panels */}
      {(() => {
        const rcItems = filteredCaptured.slice(0, 10);
        const rcTotal = rcItems.length;
        const safeIdx = rcTotal > 0 ? Math.min(rcIdx, rcTotal - 1) : 0;
        const currentItem = rcItems[safeIdx];

        const RC_TAG: Record<string, string> = {
          bank_accounts: 'FINANCE', financial_accounts: 'FINANCE',
          documents: 'DOCUMENTS', care_wishes: 'CARE WISHES',
          property: 'PROPERTY', key_contacts: 'CONTACTS',
        };

        return (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 18 }}>

            {/* Nav Panels 3×2 — column 1, with topics overlay */}
            <div style={{ position: 'relative', height: '100%', order: isMobile ? 3 : 0 }}>
              <div style={{
                display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gridTemplateRows: isMobile ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)', gap: 10,
                height: '100%',
                opacity: claraActive ? 0 : 1,
                transition: 'opacity 0.35s ease',
                pointerEvents: claraActive ? 'none' : 'auto',
              }}>
              {NAV_PANELS.map((panel, i) => {
                const isActive = panel.category === categoryFilter;
                const isHov = hoveredPanel === i;
                return (
                  <div
                    key={panel.category}
                    onClick={() => onNavigatePage(panel.page)}
                    onMouseEnter={() => setHoveredPanel(i)}
                    onMouseLeave={() => setHoveredPanel(null)}
                    style={{
                      background: isActive ? 'var(--ov-inner)' : isHov ? 'var(--ov-nav-hover-bg)' : 'var(--ov-card-bg)',
                      backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
                      border: `1px solid ${isActive ? 'var(--ov-accent)' : 'var(--ov-card-border)'}`,
                      borderRadius: 16,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      gap: 8, padding: isMobile ? '14px 8px' : '20px 10px', cursor: 'pointer',
                      transition: 'background 0.2s, border-color 0.2s, transform 0.2s, box-shadow 0.2s',
                      transform: isHov ? 'translateY(-3px)' : 'translateY(0)',
                      boxShadow: isActive
                        ? '0 6px 24px rgba(0,0,0,0.3), 0 0 0 1px rgba(70,99,172,0.16), inset 0 1px 0 rgba(255,255,255,0.10)'
                        : isHov ? '0 12px 28px rgba(0,0,0,0.38)' : '0 6px 20px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.72)',
                    }}
                  >
                    <panel.Icon style={{
                      width: isMobile ? 28 : 42, height: isMobile ? 28 : 42,
                      color: isActive ? 'var(--ov-accent)' : isHov ? 'var(--ov-text)' : 'var(--ov-muted)',
                      filter: isActive ? 'drop-shadow(0 0 14px rgba(70,99,172,0.8))' : isHov ? 'drop-shadow(0 0 12px rgba(255,255,255,0.35))' : 'drop-shadow(0 2px 6px rgba(0,0,0,0.5))',
                      transition: 'transform 0.2s, filter 0.2s, color 0.2s',
                      transform: isHov ? 'scale(1.12)' : 'scale(1)',
                      display: 'block', margin: '0 auto',
                    }} />
                    <span style={{
                      fontSize: isMobile ? 11 : 10, fontWeight: 600,
                      color: isActive ? 'var(--ov-accent)' : 'var(--ov-text)',
                      textAlign: 'center', lineHeight: 1.35,
                      opacity: isMobile || isHov || isActive ? 1 : 0,
                      transition: 'opacity 0.2s, color 0.2s',
                      fontFamily: 'Figtree, system-ui, sans-serif',
                    }}>{panel.label}</span>
                  </div>
                );
              })}
              </div>

              {/* Topics / dialogue overlay */}
              <div style={{
                position: 'absolute', inset: 0,
                opacity: claraTopicsVisible ? 1 : 0,
                transition: 'opacity 0.45s ease 0.1s',
                pointerEvents: claraTopicsVisible ? 'auto' : 'none',
                display: 'flex', flexDirection: 'column', justifyContent: 'center',
                paddingLeft: 4,
              }}>
                {!claraSelectedTopic ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <p style={{
                      fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
                      textTransform: 'uppercase', color: 'var(--ov-text)', opacity: 0.4,
                      margin: '0 0 10px 0', fontFamily: 'Figtree, system-ui, sans-serif',
                    }}>Topics to cover</p>
                    {NAV_PANELS.map(panel => {
                      const covered = capturedItems.some(i => i.category === panel.category);
                      return (
                        <button
                          key={panel.category}
                          onClick={() => !covered && setClaraSelectedTopic(panel.category)}
                          disabled={covered}
                          style={{
                            background: 'none', border: 'none', padding: 0,
                            textAlign: 'left', cursor: covered ? 'default' : 'pointer',
                            fontSize: 'clamp(18px, 2.2vw, 32px)', fontWeight: 900,
                            lineHeight: 1.08, letterSpacing: '-1px',
                            color: 'var(--ov-text)',
                            opacity: covered ? 0.22 : 1,
                            textDecoration: covered ? 'line-through' : 'none',
                            transition: 'opacity 0.15s ease',
                            fontFamily: 'Figtree, system-ui, sans-serif',
                            display: 'flex', alignItems: 'center', gap: 10,
                          }}
                          onMouseEnter={e => { if (!covered) (e.currentTarget as HTMLButtonElement).style.opacity = '0.6'; }}
                          onMouseLeave={e => { if (!covered) (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
                        >
                          <panel.Icon size="0.55em" fill="currentColor" color="currentColor" strokeWidth={0} style={{ flexShrink: 0 }} />
                          {panel.label}
                        </button>
                      );
                    })}
                  </div>
                ) : claraHasStarted ? (
                  <div style={{
                    fontSize: 'clamp(24px, 3vw, 44px)', fontWeight: 900,
                    lineHeight: 1.1, color: 'var(--ov-text)',
                    letterSpacing: '-1.5px', whiteSpace: 'pre-line',
                    fontFamily: 'Figtree, system-ui, sans-serif',
                  }}>
                    {claraIsHolding ? 'Listening…' : claraIsSpeaking ? 'Hold to\ninterrupt' : claraIsStarting ? 'Connecting\nto Clara…' : 'Hold to\nspeak.'}
                  </div>
                ) : (
                  <div>
                    <p style={{
                      fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
                      textTransform: 'uppercase', color: 'var(--ov-text)', opacity: 0.4,
                      margin: '0 0 10px 0', fontFamily: 'Figtree, system-ui, sans-serif',
                    }}>{NAV_PANELS.find(p => p.category === claraSelectedTopic)?.label}</p>
                    <div style={{
                      fontSize: 'clamp(28px, 3.5vw, 50px)', fontWeight: 900,
                      lineHeight: 1.0, color: 'var(--ov-text)',
                      letterSpacing: '-2px', whiteSpace: 'pre-line',
                      fontFamily: 'Figtree, system-ui, sans-serif',
                    }}>Hold Clara{'\n'}to begin.</div>
                  </div>
                )}

                {claraError && (
                  <p style={{ fontSize: 12, color: '#FF5F52', margin: '10px 0 0', fontFamily: 'Figtree, system-ui, sans-serif' }}>
                    {claraError}
                  </p>
                )}
              </div>
            </div>

            {/* Recently Captured sliding card */}
            <div style={{
              background: 'var(--ov-card-bg)',
              backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
              border: '1px solid var(--ov-card-border)', borderRadius: 22,
              boxShadow: 'var(--ov-shadow)',
              display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 280,
              opacity: claraActive ? 0 : 1,
              pointerEvents: claraActive ? 'none' : 'auto',
              transition: 'opacity 0.4s ease',
              order: isMobile ? 1 : 0,
            }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 22px 16px', flexShrink: 0 }}>
                <span style={{ fontFamily: 'Figtree, system-ui, sans-serif', fontSize: 20, fontWeight: 700, color: 'var(--ov-accent)', textShadow: '0 0 18px rgba(70,99,172,0.45)' }}>
                  Recently Captured
                </span>
                <span style={{ fontSize: 14, color: 'var(--ov-muted)', fontWeight: 500 }}>
                  {rcTotal > 0 ? `${safeIdx + 1} / ${rcTotal}` : '0 items'}
                </span>
              </div>

              {/* Sliding track */}
              <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                {rcTotal === 0 ? (
                  <div style={{ padding: '0 22px 16px', color: 'var(--ov-muted)', fontSize: 14 }}>
                    No captures yet. Start a conversation with {parentName}.
                  </div>
                ) : (
                  <div style={{
                    display: 'flex', height: '100%',
                    transform: `translateX(-${safeIdx * 100}%)`,
                    transition: 'transform 0.38s cubic-bezier(0.4,0,0.2,1)',
                  }}>
                    {rcItems.map((item) => {
                      const dotColor = item.verificationStatus === 'verified' ? '#5DD87A'
                        : item.verificationStatus === 'disputed' ? '#FF5F52'
                        : item.confidence === 'needs-follow-up' ? '#F0C050'
                        : '#5ECFCF';
                      const dotGlow = item.verificationStatus === 'verified' ? 'rgba(93,216,122,0.6)'
                        : item.verificationStatus === 'disputed' ? 'rgba(255,95,82,0.6)'
                        : item.confidence === 'needs-follow-up' ? 'rgba(240,192,80,0.6)'
                        : 'rgba(94,207,207,0.6)';
                      const statusLabel = item.verificationStatus === 'verified' ? 'Confirmed'
                        : item.verificationStatus === 'disputed' ? 'Disputed'
                        : item.confidence === 'needs-follow-up' ? 'Needs follow-up'
                        : 'To verify';
                      return (
                        <div key={item.id} style={{ minWidth: '100%', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 11, padding: '0 22px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <div style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              background: 'var(--ov-inner)', border: '1px solid var(--ov-card-border)',
                              borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 600,
                              color: 'var(--ov-muted)', letterSpacing: '0.4px',
                            }}>
                              {RC_TAG[item.category] || item.category.replace(/_/g, ' ').toUpperCase()}
                            </div>
                            <span style={{ fontSize: 11, color: 'var(--ov-muted)', whiteSpace: 'nowrap' }}>
                              {item.timestamp.toLocaleString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ov-accent)', lineHeight: 1.45 }}>
                            {item.content.length > 140 ? `${item.content.slice(0, 140)}…` : item.content}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--ov-muted)' }}>
                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, boxShadow: `0 0 5px ${dotGlow}`, flexShrink: 0 }} />
                                {statusLabel}
                              </div>
                              <div style={{
                                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)',
                                borderRadius: 6, padding: '2px 8px', fontSize: 10, color: 'var(--ov-muted)',
                              }}>{item.verificationStatus ?? 'unverified'}</div>
                            </div>
                            {item.sourceQuote && (
                              <div style={{ fontSize: 11, color: 'var(--ov-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <MessageSquareQuote style={{ width: 11, height: 11 }} />
                                {parentName}'s words
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Pagination bar */}
              {rcTotal > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '10px 22px 6px', flexShrink: 0 }}>
                  {rcItems.map((_, i) => (
                    <div
                      key={i}
                      onClick={() => setRcIdx(i)}
                      style={{
                        flex: 1, height: 3, borderRadius: 99, cursor: 'pointer',
                        background: i === safeIdx ? 'var(--ov-accent)' : 'var(--ov-grid)',
                        boxShadow: i === safeIdx ? '0 0 6px rgba(70,99,172,0.7)' : 'none',
                        transition: 'background 0.3s, box-shadow 0.3s',
                      }}
                    />
                  ))}
                </div>
              )}

              <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />

              {/* Dismiss / Verify */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr', flexShrink: 0 }}>
                <button
                  onClick={() => { if (currentItem) setDismissTarget(currentItem); }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#FF5F52'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--ov-muted)'; (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
                  style={{ padding: '14px 10px', textAlign: 'center', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--ov-muted)', background: 'none', border: 'none', borderRadius: '0 0 0 22px', transition: 'background 0.2s, color 0.2s', fontFamily: 'Figtree, system-ui, sans-serif' }}
                >Dismiss</button>
                <div style={{ background: 'rgba(255,255,255,0.08)', margin: '8px 0' }} />
                <button
                  onClick={() => {
                    if (currentItem) updateCapturedVerification(currentItem.id, 'verified');
                    if (safeIdx < rcTotal - 1) setRcIdx(safeIdx + 1);
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#5DD87A'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--ov-muted)'; (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
                  style={{ padding: '14px 10px', textAlign: 'center', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--ov-muted)', background: 'none', border: 'none', borderRadius: '0 0 22px 0', transition: 'background 0.2s, color 0.2s', fontFamily: 'Figtree, system-ui, sans-serif' }}
                >Verify</button>
              </div>
              {/* 30-day expiry notice */}
              <div style={{ padding: '6px 18px 14px', textAlign: 'center', fontSize: 10, color: 'var(--ov-muted)', opacity: 0.55, lineHeight: 1.4 }}>
                Dismissed items are permanently deleted · All captured data auto-purges after 30 days
              </div>
            </div>

            {/* Readiness Card — mobile only, order 2 (between Recently Captured and Nav Panels) */}
            {isMobile && (
              <div style={{ order: 2 }}>
                <ReadinessCard score={readinessPct} capturedItems={capturedItems} />
              </div>
            )}

            {/* Chat to Clara — column 3, desktop only */}
            {!isMobile && (
            <div
              onClick={!claraActive ? handleClaraCardClick : undefined}
              onMouseDown={claraActive && claraSelectedTopic ? handleClaraPressStart : undefined}
              onMouseUp={claraActive && claraSelectedTopic ? handleClaraPressEnd : undefined}
              onMouseLeave={claraActive && claraSelectedTopic ? handleClaraPressEnd : undefined}
              onTouchStart={claraActive && claraSelectedTopic ? handleClaraPressStart : undefined}
              onTouchEnd={claraActive && claraSelectedTopic ? handleClaraPressEnd : undefined}
              onTouchCancel={claraActive && claraSelectedTopic ? handleClaraPressEnd : undefined}
              style={{
                cursor: claraActive ? (claraSelectedTopic ? 'pointer' : 'default') : 'pointer',
                background: claraActive ? 'transparent' : 'rgba(155,123,200,0.18)',
                backdropFilter: claraActive ? 'none' : 'blur(12px)',
                WebkitBackdropFilter: claraActive ? 'none' : 'blur(12px)',
                border: `1px solid ${claraActive ? 'transparent' : 'rgba(155,123,200,0.35)'}`,
                borderRadius: 22, padding: '24px 20px',
                position: 'relative', overflow: 'hidden',
                boxShadow: claraActive ? 'none' : '0 8px 30px rgba(61,31,138,0.35), inset 0 1px 0 rgba(255,255,255,0.12)',
                transition: 'background 0.5s ease, border-color 0.5s ease, box-shadow 0.5s ease, transform 0.2s',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                userSelect: 'none', WebkitUserSelect: 'none',
              } as React.CSSProperties}
              onMouseEnter={e => {
                if (claraActive) return;
                const d = e.currentTarget as HTMLDivElement;
                d.style.transform = 'scale(1.02)';
                d.style.boxShadow = '0 12px 40px rgba(61,31,138,0.5), inset 0 1px 0 rgba(255,255,255,0.12)';
              }}
              onMouseLeave={e => {
                if (claraActive) return;
                const d = e.currentTarget as HTMLDivElement;
                d.style.transform = 'scale(1)';
                d.style.boxShadow = '0 8px 30px rgba(61,31,138,0.35), inset 0 1px 0 rgba(255,255,255,0.12)';
              }}
            >
              {/* Decorative arcs — fade out when Clara activates */}
              <div style={{
                position: 'absolute', top: -12, right: -12, width: 95, height: 95, zIndex: 0,
                opacity: claraActive ? 0 : 1, transition: 'opacity 0.3s ease',
              }}>
                {[
                  { size: 84, color: 'rgba(94,207,207,0.45)', rot: -20 },
                  { size: 60, color: 'rgba(255,255,255,0.18)', rot: -8 },
                  { size: 38, color: 'rgba(155,123,200,0.6)',  rot:  6 },
                ].map((arc, i) => (
                  <div key={i} style={{
                    position: 'absolute',
                    width: arc.size, height: arc.size, borderRadius: '50%',
                    border: '5px solid transparent',
                    borderTopColor: arc.color, borderRightColor: arc.color,
                    top: (84 - arc.size) / 2, right: (84 - arc.size) / 2,
                    transform: `rotate(${arc.rot}deg)`,
                  }} />
                ))}
              </div>

              {/* Purple sphere — scales with session state */}
              <div style={{
                transform: `scale(${
                  claraMicPressed && !claraIsHolding ? 0.94 :
                  claraIsSpeaking                   ? 1.35 :
                  claraIsHolding                    ? 1.22 :
                  claraIsStarting                   ? 1.08 :
                  claraIsSessionActive              ? 1.08 :
                                                      1.0
                })`,
                transition: claraMicPressed ? 'transform 80ms ease' : 'transform 0.7s cubic-bezier(0.22,1,0.36,1)',
                transformOrigin: 'center',
              }}>
                <div style={{ position: 'relative', width: 160, height: 160 }}>
                  <div style={{
                    position: 'absolute', inset: 0, borderRadius: '50%',
                    background: 'conic-gradient(from 0deg,rgba(155,123,200,0) 0%,rgba(155,123,200,0.6) 25%,rgba(200,170,255,0.4) 50%,rgba(100,60,180,0.5) 75%,rgba(155,123,200,0) 100%)',
                    animation: 'cnSphereRot 12s linear infinite', filter: 'blur(6px)',
                  }} />
                  <div style={{
                    position: 'absolute', inset: '8%', borderRadius: '50%',
                    background: 'conic-gradient(from 120deg,rgba(180,150,230,0) 0%,rgba(220,200,255,0.5) 30%,rgba(80,40,160,0.4) 60%,rgba(180,150,230,0) 100%)',
                    animation: 'cnSphereRot2 8s linear infinite', filter: 'blur(8px)',
                  }} />
                  <div style={{
                    position: 'absolute', width: '65%', height: '42%', borderRadius: '50%',
                    background: 'radial-gradient(ellipse,rgba(196,168,232,0.8) 0%,rgba(155,123,200,0.4) 50%,transparent 70%)',
                    top: '12%', left: '10%', animation: 'cnSphereSmoke1 6.5s ease-in-out infinite', filter: 'blur(8px)',
                  }} />
                  <div style={{
                    position: 'absolute', top: '14%', left: '20%', width: '36%', height: '26%', borderRadius: '50%',
                    background: 'radial-gradient(ellipse,rgba(255,255,255,0.55) 0%,transparent 70%)', zIndex: 9,
                  }} />
                </div>
              </div>

              {/* Title + subtitle — fade out when Clara activates */}
              <div style={{
                fontFamily: 'Figtree, system-ui, sans-serif', fontSize: 22, fontWeight: 900, lineHeight: 1.2,
                color: 'white', marginBottom: 6, position: 'relative', zIndex: 1, textAlign: 'center',
                opacity: claraActive ? 0 : 1, transition: 'opacity 0.25s ease',
              }}>
                <span style={{ color: '#5ECFCF' }}>Chat</span> to Clara
              </div>
              <div style={{
                fontSize: 12, color: 'rgba(255,255,255,0.48)', position: 'relative', zIndex: 1, textAlign: 'center',
                opacity: claraActive ? 0 : 1, transition: 'opacity 0.25s ease',
              }}>
                {primarySessionLabel}
              </div>

              {/* Session phase label */}
              {claraHasStarted && (
                <div style={{
                  fontSize: 13, fontWeight: 500, color: 'var(--ov-muted)',
                  marginTop: 14, position: 'relative', zIndex: 1, textAlign: 'center', opacity: 0.7,
                }}>
                  {claraIsStarting     && 'Connecting…'}
                  {claraIsSpeaking && !claraIsHolding && 'Hold to interrupt'}
                  {!claraIsSpeaking && !claraIsHolding && claraIsSessionActive && 'Hold to speak'}
                  {claraIsHolding      && 'Release when done'}
                </div>
              )}
            </div>
            )}

            {/* Clara sphere — mobile only, order 4, sticky above bottom nav */}
            {isMobile && (
              <div style={{ order: 4 }}>
                <div
                  onClick={!claraActive ? handleClaraCardClick : undefined}
                  onTouchStart={claraActive && claraSelectedTopic ? handleClaraPressStart : undefined}
                  onTouchEnd={claraActive && claraSelectedTopic ? handleClaraPressEnd : undefined}
                  onTouchCancel={claraActive && claraSelectedTopic ? handleClaraPressEnd : undefined}
                  style={{
                    position: 'sticky',
                    bottom: 72,
                    zIndex: 20,
                    cursor: claraActive ? (claraSelectedTopic ? 'pointer' : 'default') : 'pointer',
                    background: claraActive ? 'transparent' : 'rgba(155,123,200,0.18)',
                    backdropFilter: claraActive ? 'none' : 'blur(12px)',
                    WebkitBackdropFilter: claraActive ? 'none' : 'blur(12px)',
                    border: `1px solid ${claraActive ? 'transparent' : 'rgba(155,123,200,0.35)'}`,
                    borderRadius: 22, padding: '16px 20px',
                    overflow: 'hidden',
                    boxShadow: claraActive ? 'none' : '0 8px 30px rgba(61,31,138,0.35), inset 0 1px 0 rgba(255,255,255,0.12)',
                    transition: 'background 0.5s ease, border-color 0.5s ease, box-shadow 0.5s ease',
                    display: 'flex', alignItems: 'center', gap: 16,
                    userSelect: 'none', WebkitUserSelect: 'none',
                    marginTop: 4,
                  } as React.CSSProperties}
                >
                  {/* Decorative arcs */}
                  <div style={{
                    position: 'absolute', top: -8, right: -8, width: 72, height: 72, zIndex: 0,
                    opacity: claraActive ? 0 : 1, transition: 'opacity 0.3s ease', pointerEvents: 'none',
                  }}>
                    {[
                      { size: 64, color: 'rgba(94,207,207,0.45)', rot: -20 },
                      { size: 46, color: 'rgba(255,255,255,0.18)', rot: -8 },
                      { size: 28, color: 'rgba(155,123,200,0.6)', rot: 6 },
                    ].map((arc, i) => (
                      <div key={i} style={{
                        position: 'absolute', width: arc.size, height: arc.size, borderRadius: '50%',
                        border: '4px solid transparent',
                        borderTopColor: arc.color, borderRightColor: arc.color,
                        top: (64 - arc.size) / 2, right: (64 - arc.size) / 2,
                        transform: `rotate(${arc.rot}deg)`,
                      }} />
                    ))}
                  </div>

                  {/* Sphere */}
                  <div style={{
                    transform: `scale(${
                      claraMicPressed && !claraIsHolding ? 0.92 :
                      claraIsSpeaking ? 1.18 :
                      claraIsHolding ? 1.1 :
                      claraIsStarting ? 1.05 :
                      claraIsSessionActive ? 1.05 : 1.0
                    })`,
                    transition: claraMicPressed ? 'transform 80ms ease' : 'transform 0.7s cubic-bezier(0.22,1,0.36,1)',
                    transformOrigin: 'center', flexShrink: 0,
                  }}>
                    <div style={{ position: 'relative', width: 72, height: 72 }}>
                      <div style={{
                        position: 'absolute', inset: 0, borderRadius: '50%',
                        background: 'conic-gradient(from 0deg,rgba(155,123,200,0) 0%,rgba(155,123,200,0.6) 25%,rgba(200,170,255,0.4) 50%,rgba(100,60,180,0.5) 75%,rgba(155,123,200,0) 100%)',
                        animation: 'cnSphereRot 12s linear infinite', filter: 'blur(4px)',
                      }} />
                      <div style={{
                        position: 'absolute', inset: '8%', borderRadius: '50%',
                        background: 'conic-gradient(from 120deg,rgba(180,150,230,0) 0%,rgba(220,200,255,0.5) 30%,rgba(80,40,160,0.4) 60%,rgba(180,150,230,0) 100%)',
                        animation: 'cnSphereRot2 8s linear infinite', filter: 'blur(5px)',
                      }} />
                      <div style={{
                        position: 'absolute', width: '65%', height: '42%', borderRadius: '50%',
                        background: 'radial-gradient(ellipse,rgba(196,168,232,0.8) 0%,rgba(155,123,200,0.4) 50%,transparent 70%)',
                        top: '12%', left: '10%', animation: 'cnSphereSmoke1 6.5s ease-in-out infinite', filter: 'blur(5px)',
                      }} />
                      <div style={{
                        position: 'absolute', top: '14%', left: '20%', width: '36%', height: '26%', borderRadius: '50%',
                        background: 'radial-gradient(ellipse,rgba(255,255,255,0.55) 0%,transparent 70%)', zIndex: 9,
                      }} />
                    </div>
                  </div>

                  {/* Title + status */}
                  <div style={{ flex: 1, position: 'relative', zIndex: 1 }}>
                    <div style={{
                      fontFamily: 'Figtree, system-ui, sans-serif', fontSize: 18, fontWeight: 900,
                      color: 'white', lineHeight: 1.2,
                      opacity: claraActive ? 0 : 1, transition: 'opacity 0.25s ease',
                    }}>
                      <span style={{ color: '#5ECFCF' }}>Chat</span> to Clara
                    </div>
                    <div style={{
                      fontSize: 12, color: 'rgba(255,255,255,0.48)', marginTop: 2,
                      opacity: claraActive ? 0 : 1, transition: 'opacity 0.25s ease',
                    }}>
                      {primarySessionLabel}
                    </div>
                    {claraHasStarted && (
                      <div style={{
                        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
                        fontSize: 14, fontWeight: 700, color: 'var(--ov-text)',
                        fontFamily: 'Figtree, system-ui, sans-serif',
                        opacity: claraActive ? 1 : 0, transition: 'opacity 0.25s ease',
                      }}>
                        {claraIsStarting && 'Connecting…'}
                        {claraIsSpeaking && !claraIsHolding && 'Hold to interrupt'}
                        {!claraIsSpeaking && !claraIsHolding && claraIsSessionActive && 'Hold to speak'}
                        {claraIsHolding && 'Release when done'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

          </div>
        );
      })()}

          {/* Change 4: Topic Progress panel */}
          {/* <div className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="font-display text-base font-semibold text-foreground">Topic Progress</h3>
            </div>
            {capturedItems.filter(i =>
              i.category === 'documents' &&
              (i.content?.toLowerCase().includes('power') || i.content?.toLowerCase().includes('lpa') || i.content?.toLowerCase().includes('attorney'))
            ).length === 0 && (
              <div className="poa-urgent">
                <span>⚠️</span>
                <div>
                  <strong>Power of Attorney — act now</strong>
                  <p>Without LPA, Court of Protection costs £20,000+. Takes 20 weeks to register.</p>
                </div>
              </div>
            )}
            {topicProgress.map((topic) => {
              const total = capturedItems.filter(i => i.category === topic.category).length;
              const clear = capturedItems.filter(i => i.category === topic.category && i.confidence === 'clear').length;
              const pct = total === 0 ? 0 : Math.round((clear / total) * 100);
              const barColor = pct === 0 ? '#E5E7EB' : pct === 100 ? '#4CAF7D' : '#F4A261';
              return (
                <div key={topic.name} className="topic-item">
                  <div className="topic-icon bg-muted">{topic.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-body text-foreground">{topic.name}</span>
                      <span className="topic-pct" style={{color: barColor}}>{pct}%</span>
                    </div>
                    <div className="topic-bar-wrap">
                      <div className="topic-bar" style={{width: `${pct}%`, background: barColor}}></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div> */}
    </div>

    {/* ── Dismiss confirmation modal ──────────────────────────────────── */}
    <AlertDialog open={dismissTarget !== null} onOpenChange={open => { if (!open) setDismissTarget(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Permanently delete this item?</AlertDialogTitle>
          <AlertDialogDescription>
            {dismissTarget && (
              <>
                <span style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>
                  &ldquo;{dismissTarget.content.length > 100
                    ? `${dismissTarget.content.slice(0, 100)}…`
                    : dismissTarget.content}&rdquo;
                </span>
                This will be removed from your dashboard and permanently deleted from the database.
                This action cannot be undone.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setDismissTarget(null)}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (dismissTarget) {
                removeCapturedItem(dismissTarget.id);
                // Advance carousel if there are more items
                setRcIdx(prev => Math.max(0, prev - 1));
              }
              setDismissTarget(null);
            }}
            style={{ background: '#FF5F52', color: 'white' }}
          >
            Delete permanently
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* End Chat button — fixed bottom-right, visible only in Clara mode */}
    {claraActive && (
      <button
        onClick={exitClaraMode}
        style={{
          position: 'fixed', bottom: 28, right: 28, zIndex: 50,
          background: 'rgba(255,255,255,0.18)',
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.35)',
          borderRadius: 14, padding: '12px 22px',
          fontFamily: 'Figtree, system-ui, sans-serif',
          fontSize: 14, fontWeight: 700, color: 'var(--ov-text)',
          cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.55)',
          transition: 'background 0.2s, box-shadow 0.2s, transform 0.15s',
          animation: 'fadeUp 0.35s cubic-bezier(0.22,1,0.36,1) both',
        }}
        onMouseEnter={e => {
          const b = e.currentTarget as HTMLButtonElement;
          b.style.background = 'rgba(255,95,82,0.18)';
          b.style.color = '#FF5F52';
          b.style.borderColor = 'rgba(255,95,82,0.35)';
          b.style.transform = 'translateY(-2px)';
        }}
        onMouseLeave={e => {
          const b = e.currentTarget as HTMLButtonElement;
          b.style.background = 'rgba(255,255,255,0.18)';
          b.style.color = 'var(--ov-text)';
          b.style.borderColor = 'rgba(255,255,255,0.35)';
          b.style.transform = 'translateY(0)';
        }}
      >
        End Chat
      </button>
    )}
    </>
  );
}
