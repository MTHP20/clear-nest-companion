import { useMemo, useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/contexts/SessionContext';
import type { ReadinessSnapshot } from '@/contexts/SessionContext';
import { FileText, Heart, Home, Landmark, MessageSquareQuote, Users, Search, Clock } from 'lucide-react';


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
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.value === value) ?? options[0];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative', userSelect: 'none' }}>
      <div
        onClick={() => setOpen(v => !v)}
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
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', left: 0, minWidth: '100%',
          background: 'var(--ov-tooltip)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid var(--ov-card-border)', borderRadius: 14, overflow: 'hidden',
          boxShadow: '0 16px 48px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.10)',
          zIndex: 100,
        }}>
          {options.map((opt, i) => (
            <div
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              style={{
                padding: '10px 16px', fontSize: 13,
                color: opt.value === value ? 'var(--ov-text)' : 'var(--ov-muted)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9,
                background: opt.value === value ? 'rgba(94,207,207,0.12)' : undefined,
                fontWeight: opt.value === value ? 600 : 400,
                borderBottom: i < options.length - 1 ? '1px solid rgba(255,255,255,0.05)' : undefined,
                fontFamily: 'Figtree, system-ui, sans-serif',
              }}
            >
              <span style={{
                width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                border: opt.value === value ? 'none' : '1.5px solid var(--ov-card-border)',
                background: opt.value === value ? '#5ECFCF' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, color: opt.value === value ? '#0d0f1a' : 'transparent',
                boxShadow: opt.value === value ? '0 0 8px rgba(94,207,207,0.55)' : 'none',
              }}>✓</span>
              {opt.label}
            </div>
          ))}
        </div>
      )}
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
function ReadinessCard({ score, capturedItems }: { score: number; capturedItems: { category: string }[] }) {
  const r = 50, circ = 2 * Math.PI * r;
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
      padding: '24px 20px', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 18,
    }}>
      <div style={{ fontFamily: 'Figtree, system-ui, sans-serif', fontSize: 20, fontWeight: 700, color: 'var(--ov-text)', textAlign: 'center', lineHeight: 1.2 }}>
        Readiness<br />Score
      </div>

      <div style={{ position: 'relative', width: 130, height: 130, flexShrink: 0 }}>
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
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: 'Figtree, system-ui, sans-serif', fontSize: 28, fontWeight: 900, color: 'var(--ov-text)', lineHeight: 1 }}>{score}%</span>
          <span style={{ fontSize: 10, color: 'var(--ov-muted)', marginTop: 2 }}>prepared</span>
        </div>
      </div>

      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 9 }}>
        {legend.map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12, color: 'var(--ov-muted)' }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
              background: item.color,
              boxShadow: item.glow ? `0 0 6px ${item.glow}` : undefined,
            }} />
            <span style={{ flex: 1 }}>{item.label}</span>
            <span style={{ fontWeight: 600, color: 'var(--ov-text)', fontSize: 12 }}>{item.pct}%</span>
          </div>
        ))}
      </div>
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
}: DashboardOverviewProps) {
  const navigate = useNavigate();
  const {
    capturedItems,
    actionItems,
    sessions,
    readinessHistory,
    parentName,
    childName,
    userNotes,
    updateCapturedVerification,
    updateActionStatus,
  } = useSession();

  const activeActions = actionItems.filter((a) => a.status !== 'done').length;
  const [rcIdx, setRcIdx] = useState(0);
  const [hoveredPanel, setHoveredPanel] = useState<number | null>(null);

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
    { Icon: Landmark,           label: 'Financial & Pension', category: 'financial_accounts' },
    { Icon: FileText,           label: 'Documents & Will',    category: 'documents'          },
    { Icon: Home,               label: 'Property',            category: 'property'           },
    { Icon: Heart,              label: 'Care Wishes',         category: 'care_wishes'        },
    { Icon: Users,              label: 'Key Contacts',        category: 'key_contacts'       },
    { Icon: MessageSquareQuote, label: 'Conversations',       category: 'conversations'      },
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
      <div className="cn-stagger" style={{ display: 'grid', gridTemplateColumns: '1fr 230px', gap: 18 }}>

        {/* Row 1 col 1: 6 nav panels 3×2 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(2, 1fr)', gap: 10 }}>
          {NAV_PANELS.map((panel, i) => {
            const isActive = panel.category === categoryFilter;
            const isHov = hoveredPanel === i;
            return (
              <div
                key={panel.category}
                onClick={() => panel.category === 'conversations' ? navigate('/conversation') : onCategoryChange(panel.category === categoryFilter ? 'all' : panel.category)}
                onMouseEnter={() => setHoveredPanel(i)}
                onMouseLeave={() => setHoveredPanel(null)}
                style={{
                  background: isActive ? 'var(--ov-inner)' : isHov ? 'var(--ov-nav-hover-bg)' : 'var(--ov-card-bg)',
                  backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
                  border: `1px solid ${isActive ? 'var(--ov-accent)' : 'var(--ov-card-border)'}`,
                  borderRadius: 16,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 10, padding: '20px 10px', cursor: 'pointer',
                  transition: 'background 0.2s, border-color 0.2s, transform 0.2s, box-shadow 0.2s',
                  transform: isHov ? 'translateY(-3px)' : 'translateY(0)',
                  boxShadow: isActive
                    ? '0 6px 24px rgba(0,0,0,0.3), 0 0 0 1px rgba(70,99,172,0.16), inset 0 1px 0 rgba(255,255,255,0.10)'
                    : isHov ? '0 12px 28px rgba(0,0,0,0.38)' : '0 6px 20px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.72)',
                }}
              >
                <panel.Icon style={{
                  width: 42, height: 42,
                  color: isActive ? 'var(--ov-accent)' : isHov ? 'var(--ov-text)' : 'var(--ov-muted)',
                  filter: isActive ? 'drop-shadow(0 0 14px rgba(70,99,172,0.8))' : isHov ? 'drop-shadow(0 0 12px rgba(255,255,255,0.35))' : 'drop-shadow(0 2px 6px rgba(0,0,0,0.5))',
                  transition: 'transform 0.2s, filter 0.2s, color 0.2s',
                  transform: isHov ? 'scale(1.12)' : 'scale(1)',
                  display: 'block', margin: '0 auto',
                }} />
                <span style={{
                  fontSize: 10, fontWeight: 600,
                  color: isActive ? 'var(--ov-accent)' : 'var(--ov-text)',
                  textAlign: 'center', lineHeight: 1.35,
                  opacity: isHov || isActive ? 1 : 0,
                  transition: 'opacity 0.2s, color 0.2s',
                  fontFamily: 'Figtree, system-ui, sans-serif',
                }}>{panel.label}</span>
              </div>
            );
          })}
        </div>

        {/* Row 1 col 2: Chat to Clara card — full height */}
        <div
          onClick={() => navigate('/conversation')}
          style={{
            cursor: 'pointer',
            background: 'rgba(155,123,200,0.18)',
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(155,123,200,0.35)',
            borderRadius: 22, padding: '24px 20px',
            position: 'relative', overflow: 'hidden',
            boxShadow: '0 8px 30px rgba(61,31,138,0.35), inset 0 1px 0 rgba(255,255,255,0.12)',
            transition: 'transform 0.2s, box-shadow 0.2s',
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
          }}
          onMouseEnter={e => {
            const d = e.currentTarget as HTMLDivElement;
            d.style.transform = 'scale(1.02)';
            d.style.boxShadow = '0 12px 40px rgba(61,31,138,0.5), inset 0 1px 0 rgba(255,255,255,0.12)';
          }}
          onMouseLeave={e => {
            const d = e.currentTarget as HTMLDivElement;
            d.style.transform = 'scale(1)';
            d.style.boxShadow = '0 8px 30px rgba(61,31,138,0.35), inset 0 1px 0 rgba(255,255,255,0.12)';
          }}
        >
          {/* Decorative arcs */}
          <div style={{ position: 'absolute', top: -12, right: -12, width: 95, height: 95, zIndex: 0 }}>
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
          {/* Purple sphere */}
          <div style={{ position: 'relative', width: 52, height: 52, marginBottom: 14, zIndex: 1 }}>
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: 'conic-gradient(from 0deg,rgba(155,123,200,0) 0%,rgba(155,123,200,0.6) 25%,rgba(200,170,255,0.4) 50%,rgba(100,60,180,0.5) 75%,rgba(155,123,200,0) 100%)',
              animation: 'cnSphereRot 12s linear infinite', filter: 'blur(3px)',
            }} />
            <div style={{
              position: 'absolute', inset: 4, borderRadius: '50%',
              background: 'conic-gradient(from 120deg,rgba(180,150,230,0) 0%,rgba(220,200,255,0.5) 30%,rgba(80,40,160,0.4) 60%,rgba(180,150,230,0) 100%)',
              animation: 'cnSphereRot2 8s linear infinite', filter: 'blur(4px)',
            }} />
            <div style={{
              position: 'absolute', width: 34, height: 22, borderRadius: '50%',
              background: 'radial-gradient(ellipse,rgba(196,168,232,0.8) 0%,rgba(155,123,200,0.4) 50%,transparent 70%)',
              top: 6, left: 5, animation: 'cnSphereSmoke1 6.5s ease-in-out infinite', filter: 'blur(5px)',
            }} />
            <div style={{
              position: 'absolute', top: 8, left: 10, width: '36%', height: '26%', borderRadius: '50%',
              background: 'radial-gradient(ellipse,rgba(255,255,255,0.55) 0%,transparent 70%)', zIndex: 9,
            }} />
          </div>
          <div style={{ fontFamily: 'Figtree, system-ui, sans-serif', fontSize: 22, fontWeight: 900, lineHeight: 1.2, color: 'white', marginBottom: 6, position: 'relative', zIndex: 1 }}>
            <span style={{ color: '#5ECFCF' }}>Chat</span> to<br />Clara
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.48)', position: 'relative', zIndex: 1 }}>
            {primarySessionLabel}
          </div>
          <div style={{
            position: 'absolute', bottom: 18, right: 18,
            width: 42, height: 42, background: 'linear-gradient(135deg,#9B7BC8,#3D1F8A)',
            borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: 13, fontWeight: 700, zIndex: 2,
            boxShadow: '0 0 16px rgba(155,123,200,0.7)',
          }}>GO</div>
        </div>

        {/* Row 2: Recently Captured + Readiness Score — equal width, spans both columns */}
        <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>

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
                onClick={() => { if (currentItem) updateCapturedVerification(currentItem.id, 'disputed'); if (safeIdx < rcTotal - 1) setRcIdx(safeIdx + 1); }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#FF5F52'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--ov-muted)'; (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
                style={{ padding: '14px 10px', textAlign: 'center', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--ov-muted)', background: 'none', border: 'none', borderRadius: '0 0 0 22px', transition: 'background 0.2s, color 0.2s', fontFamily: 'Figtree, system-ui, sans-serif' }}
              >Dispute</button>
              <div style={{ background: 'rgba(255,255,255,0.08)', margin: '8px 0' }} />
              <button
                onClick={() => { if (currentItem) updateCapturedVerification(currentItem.id, 'verified'); if (safeIdx < rcTotal - 1) setRcIdx(safeIdx + 1); }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#5DD87A'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--ov-muted)'; (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
                style={{ padding: '14px 10px', textAlign: 'center', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--ov-muted)', background: 'none', border: 'none', borderRadius: '0 0 22px 0', transition: 'background 0.2s, color 0.2s', fontFamily: 'Figtree, system-ui, sans-serif' }}
              >Verify</button>
            </div>
          </div>

          {/* Readiness Score */}
          <ReadinessCard score={readinessPct} capturedItems={capturedItems} />
        </div>

      </div>
    );
  }

  return (
    <div className="cn-stagger">

      {/* Activity + Momentum + Readiness row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 230px', gap: 16, marginBottom: 16 }}>
        <ActivityChart sessions={sessions} />
        <ProgressMomentum history={readinessHistory} verifiedCount={verifiedCount} checklistSize={checked.size} docTotal={DOC_ITEMS.length} activeActions={activeActions} />
        <ReadinessCard score={readinessPct} capturedItems={capturedItems} />
      </div>

      {/* Search section */}
      <div style={{ marginBottom: 24 }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 230px', gap: 18 }}>

            {/* Recently Captured sliding card */}
            <div style={{
              background: 'var(--ov-card-bg)',
              backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
              border: '1px solid var(--ov-card-border)', borderRadius: 22,
              boxShadow: 'var(--ov-shadow)',
              display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 280,
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

              {/* Dispute / Verify */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr', flexShrink: 0 }}>
                <button
                  onClick={() => {
                    if (currentItem) updateCapturedVerification(currentItem.id, 'disputed');
                    if (safeIdx < rcTotal - 1) setRcIdx(safeIdx + 1);
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#FF5F52'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--ov-muted)'; (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
                  style={{ padding: '14px 10px', textAlign: 'center', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--ov-muted)', background: 'none', border: 'none', borderRadius: '0 0 0 22px', transition: 'background 0.2s, color 0.2s', fontFamily: 'Figtree, system-ui, sans-serif' }}
                >Dispute</button>
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
            </div>

            {/* Nav Panels 3×2 — spans columns 2 & 3 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(2, 1fr)', gap: 10, gridColumn: '2 / 4' }}>
              {NAV_PANELS.map((panel, i) => {
                const isActive = panel.category === categoryFilter;
                const isHov = hoveredPanel === i;
                return (
                  <div
                    key={panel.category}
                    onClick={() => panel.category === 'conversations' ? navigate('/conversation') : onCategoryChange(panel.category === categoryFilter ? 'all' : panel.category)}
                    onMouseEnter={() => setHoveredPanel(i)}
                    onMouseLeave={() => setHoveredPanel(null)}
                    style={{
                      background: isActive ? 'var(--ov-inner)' : isHov ? 'var(--ov-nav-hover-bg)' : 'var(--ov-card-bg)',
                      backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
                      border: `1px solid ${isActive ? 'var(--ov-accent)' : 'var(--ov-card-border)'}`,
                      borderRadius: 16,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      gap: 10, padding: '20px 10px', cursor: 'pointer',
                      transition: 'background 0.2s, border-color 0.2s, transform 0.2s, box-shadow 0.2s',
                      transform: isHov ? 'translateY(-3px)' : 'translateY(0)',
                      boxShadow: isActive
                        ? '0 6px 24px rgba(0,0,0,0.3), 0 0 0 1px rgba(70,99,172,0.16), inset 0 1px 0 rgba(255,255,255,0.10)'
                        : isHov ? '0 12px 28px rgba(0,0,0,0.38)' : '0 6px 20px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.72)',
                    }}
                  >
                    <panel.Icon style={{
                      width: 64, height: 64,
                      color: isActive ? 'var(--ov-accent)' : isHov ? 'var(--ov-text)' : 'var(--ov-muted)',
                      filter: isActive ? 'drop-shadow(0 0 14px rgba(70,99,172,0.8))' : isHov ? 'drop-shadow(0 0 12px rgba(255,255,255,0.35))' : 'drop-shadow(0 2px 6px rgba(0,0,0,0.5))',
                      transition: 'transform 0.2s, filter 0.2s, color 0.2s',
                      transform: isHov ? 'scale(1.12)' : 'scale(1)',
                      display: 'block', margin: '0 auto',
                    }} />
                    <span style={{
                      fontSize: 10, fontWeight: 600,
                      color: isActive ? 'var(--ov-accent)' : 'var(--ov-text)',
                      textAlign: 'center', lineHeight: 1.35,
                      opacity: isHov || isActive ? 1 : 0,
                      transition: 'opacity 0.2s, color 0.2s',
                      fontFamily: 'Figtree, system-ui, sans-serif',
                    }}>{panel.label}</span>
                  </div>
                );
              })}
            </div>

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
  );
}
