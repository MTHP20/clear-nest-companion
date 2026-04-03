import { useMemo, useState, useRef, useEffect } from 'react';
import type { ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/contexts/SessionContext';
import type { ReadinessSnapshot } from '@/contexts/SessionContext';
import FamilyNoteField from '@/components/dashboard/FamilyNoteField';
import { FileText, Heart, Home, Landmark, MessageSquareQuote, Users, Search } from 'lucide-react';

const CATEGORY_LABELS: Record<string, string> = {
  bank_accounts: 'Bank Accounts',
  financial_accounts: 'Financial Accounts',
  documents: 'Documents',
  care_wishes: 'Care Wishes',
  property: 'Property',
  key_contacts: 'Key Contacts',
};

const CATEGORY_STYLES: Record<string, { chip: string; icon: ComponentType<{ className?: string }> }> = {
  bank_accounts: { chip: 'bg-sky-100 text-sky-700', icon: Landmark },
  financial_accounts: { chip: 'bg-indigo-100 text-indigo-700', icon: Landmark },
  documents: { chip: 'bg-emerald-100 text-emerald-700', icon: FileText },
  care_wishes: { chip: 'bg-rose-100 text-rose-700', icon: Heart },
  property: { chip: 'bg-amber-100 text-amber-700', icon: Home },
  key_contacts: { chip: 'bg-violet-100 text-violet-700', icon: Users },
};

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
      background: 'rgba(255,255,255,0.07)',
      backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
      border: '1px solid rgba(255,255,255,0.13)', borderRadius: 22,
      boxShadow: '0 20px 50px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.09)',
      padding: '22px 22px 16px', flex: 1, minWidth: 0,
      display: 'flex', flexDirection: 'column', gap: 0,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 16, color: '#a78bfa', filter: 'drop-shadow(0 0 6px rgba(167,139,250,0.7))' }}>↗</span>
        <span style={{ fontFamily: 'Figtree, system-ui, sans-serif', fontSize: 18, fontWeight: 700, color: '#fff' }}>
          Progress Momentum
        </span>
        {delta !== null && delta > 0 && (
          <span style={{
            marginLeft: 'auto', fontSize: 11, fontWeight: 600,
            padding: '3px 10px', borderRadius: 20,
            background: 'rgba(167,139,250,0.15)', color: '#a78bfa',
            border: '1px solid rgba(167,139,250,0.25)',
          }}>+{delta}% this session</span>
        )}
      </div>

      {/* Chart area */}
      <div style={{
        background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 14, padding: '10px 14px 6px', marginBottom: 18,
        position: 'relative', height: 200,
      }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="none" overflow="visible">
          <defs>
            <linearGradient id="mFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="mLine" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#7c3aed" />
              <stop offset="100%" stopColor="#a78bfa" />
            </linearGradient>
          </defs>

          {/* Y-axis labels + grid */}
          {gridPcts.map((pct) => {
            const y = padY + (1 - pct / 100) * cH;
            return (
              <g key={pct}>
                <text x={0} y={y + 3} fontSize="8" fill="rgba(255,255,255,0.22)" fontFamily="Figtree,system-ui,sans-serif">{pct}%</text>
                <line x1={padX} y1={y} x2={W} y2={y} stroke={pct === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.05)'} strokeWidth="1" />
              </g>
            );
          })}

          {points && areaPath && linePath ? (
            <>
              <path d={areaPath} fill="url(#mFill)" />
              <path d={linePath} fill="none" stroke="url(#mLine)" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round"
                style={{ filter: 'drop-shadow(0 0 6px rgba(167,139,250,0.65))' }} />
              {points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={i === 0 || i === points.length - 1 ? 4 : 3.5}
                  fill={i === points.length - 1 ? '#a78bfa' : '#8b5cf6'}
                  stroke="rgba(255,255,255,0.35)" strokeWidth="1.5"
                  style={i === 0 || i === points.length - 1 ? { filter: 'drop-shadow(0 0 5px rgba(167,139,250,0.9))' } : undefined}>
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
                      fill="rgba(167,139,250,0.18)" stroke="rgba(167,139,250,0.35)" strokeWidth={0.75} />
                    <text x={lx} y={ly - 0.5} fontSize="8" fill="rgba(255,255,255,0.85)"
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
              style={{ filter: 'drop-shadow(0 0 6px rgba(167,139,250,0.65))' }} />
          )}
        </svg>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr 1px 1fr', gap: 6, textAlign: 'center', alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: 'Figtree, system-ui, sans-serif', fontSize: 26, fontWeight: 700, lineHeight: 1, marginBottom: 4, color: '#a78bfa', textShadow: '0 0 10px rgba(167,139,250,0.5)' }}>{verifiedCount}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.48)' }}>Verified</div>
        </div>
        <div style={{ width: 1, background: 'rgba(255,255,255,0.13)', alignSelf: 'stretch', margin: '4px 0' }} />
        <div>
          <div style={{ fontFamily: 'Figtree, system-ui, sans-serif', fontSize: 26, fontWeight: 700, lineHeight: 1, marginBottom: 4, color: '#fff' }}>{checklistSize}/{docTotal}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.48)' }}>Checklist</div>
        </div>
        <div style={{ width: 1, background: 'rgba(255,255,255,0.13)', alignSelf: 'stretch', margin: '4px 0' }} />
        <div>
          <div style={{ fontFamily: 'Figtree, system-ui, sans-serif', fontSize: 26, fontWeight: 700, lineHeight: 1, marginBottom: 4, color: '#F0C050', textShadow: '0 0 10px rgba(240,192,80,0.5)' }}>{activeActions}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.48)' }}>Tasks open</div>
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
          background: 'rgba(255,255,255,0.07)',
          backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
          border: '1px solid rgba(255,255,255,0.13)', borderRadius: 10,
          padding: '9px 14px', fontFamily: 'Figtree, system-ui, sans-serif',
          fontSize: 13, color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap', minWidth: 130,
          boxShadow: '0 6px 20px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.07)',
        }}
      >
        <span style={{ flex: 1 }}>{selected.label}</span>
        <span style={{
          fontSize: 10, color: 'rgba(255,255,255,0.48)',
          transition: 'transform 0.25s', display: 'inline-block',
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        }}>▾</span>
      </div>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', left: 0, minWidth: '100%',
          background: 'rgba(18,20,36,0.95)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.13)', borderRadius: 14, overflow: 'hidden',
          boxShadow: '0 16px 48px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.10)',
          zIndex: 100,
        }}>
          {options.map((opt, i) => (
            <div
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              style={{
                padding: '10px 16px', fontSize: 13,
                color: opt.value === value ? '#fff' : 'rgba(255,255,255,0.48)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9,
                background: opt.value === value ? 'rgba(94,207,207,0.12)' : undefined,
                fontWeight: opt.value === value ? 600 : 400,
                borderBottom: i < options.length - 1 ? '1px solid rgba(255,255,255,0.05)' : undefined,
                fontFamily: 'Figtree, system-ui, sans-serif',
              }}
            >
              <span style={{
                width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                border: opt.value === value ? 'none' : '1.5px solid rgba(255,255,255,0.13)',
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
      background: 'rgba(255,255,255,0.07)',
      backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
      border: '1px solid rgba(255,255,255,0.13)', borderRadius: 22,
      boxShadow: '0 20px 50px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.09)',
      padding: '22px 22px 14px', flex: 1, minWidth: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'Figtree, system-ui, sans-serif', fontSize: 22, fontWeight: 700, color: '#fff', marginRight: 'auto' }}>Activity</span>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.48)' }}>Active sessions per day</span>
        <div style={{
          background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.13)',
          borderRadius: 20, padding: '5px 13px', fontSize: 12, fontWeight: 500,
          color: '#fff', whiteSpace: 'nowrap',
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
              stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          ))}
          {[maxCount, Math.round(maxCount * 0.66), Math.round(maxCount * 0.33), 0].map((v, i) => (
            <text key={i} x={0} y={padY + i * (cH / 3) + 4} fontSize="10"
              fill="rgba(255,255,255,0.28)" fontFamily="Figtree,system-ui,sans-serif">{v}</text>
          ))}
          <path d={areaPath} fill="url(#darkFillGrad)" />
          <path d={linePath} fill="none" stroke="#F0C050" strokeWidth="2.8"
            strokeLinecap="round" strokeLinejoin="round"
            style={{ filter: 'drop-shadow(0 0 7px rgba(240,192,80,0.75))' }} />
          {total > 0 && (
            <circle cx={peak.x} cy={peak.y} r="6" fill="#F0C050"
              stroke="rgba(255,255,255,0.5)" strokeWidth="2.5"
              style={{ filter: 'drop-shadow(0 0 8px rgba(240,192,80,0.95))' }}>
              <title>{peak.label}: {peak.count} session{peak.count !== 1 ? 's' : ''}</title>
            </circle>
          )}
        </svg>
        {total > 0 && (
          <div style={{
            position: 'absolute', top: '10%', left: '46%', transform: 'translateX(-50%)',
            background: 'rgba(30,32,48,0.85)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.18)', borderRadius: 12, padding: '6px 14px 7px',
            pointerEvents: 'none', boxShadow: '0 6px 20px rgba(0,0,0,0.4)', whiteSpace: 'nowrap',
          }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#fff', display: 'block' }}>{total}</span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.48)' }}>Total sessions</span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 8px 0', fontSize: 11, color: 'rgba(255,255,255,0.48)' }}>
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
      background: 'rgba(255,255,255,0.07)',
      backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
      border: '1px solid rgba(255,255,255,0.13)', borderRadius: 22,
      boxShadow: '0 20px 50px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.09)',
      padding: '24px 20px', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 18,
      width: 230, flexShrink: 0,
    }}>
      <div style={{ fontFamily: 'Figtree, system-ui, sans-serif', fontSize: 20, fontWeight: 700, color: '#fff', textAlign: 'center', lineHeight: 1.2 }}>
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
          <circle cx="65" cy="65" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" />
          <circle cx="65" cy="65" r={r} fill="none" stroke="url(#ringGradDark)" strokeWidth="12"
            strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)', filter: 'drop-shadow(0 0 8px rgba(94,207,207,0.7))' }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: 'Figtree, system-ui, sans-serif', fontSize: 28, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{score}%</span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.48)', marginTop: 2 }}>prepared</span>
        </div>
      </div>

      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 9 }}>
        {legend.map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12, color: 'rgba(255,255,255,0.48)' }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
              background: item.color,
              boxShadow: item.glow ? `0 0 6px ${item.glow}` : undefined,
            }} />
            <span style={{ flex: 1 }}>{item.label}</span>
            <span style={{ fontWeight: 600, color: '#fff', fontSize: 12 }}>{item.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface DashboardOverviewProps {
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
  const [expandedQuote, setExpandedQuote] = useState<string | null>(null);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'timeline'>('cards');

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

  return (
    <div className="cn-stagger">

      {/* Activity + Momentum + Readiness row */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <ActivityChart sessions={sessions} />
        <ProgressMomentum history={readinessHistory} verifiedCount={verifiedCount} checklistSize={checked.size} docTotal={DOC_ITEMS.length} activeActions={activeActions} />
        <ReadinessCard score={readinessPct} capturedItems={capturedItems} />
      </div>

      {/* Search section */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: 10, minWidth: 200,
            background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
            border: '1px solid rgba(255,255,255,0.13)', borderRadius: 12, padding: '11px 16px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)',
          }}>
            <Search style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.48)', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search pension, will, solicitor, provider…"
              value={query}
              onChange={e => onQueryChange(e.target.value)}
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                fontFamily: 'Figtree, system-ui, sans-serif', fontSize: 13,
                color: '#fff', caretColor: '#5ECFCF',
              }}
            />
          </div>

          <GlassDropdown value={categoryFilter} options={CATEGORY_OPTIONS} onChange={onCategoryChange} />
          <GlassDropdown value={confidenceFilter} options={CONFIDENCE_OPTIONS} onChange={onConfidenceChange} />

          <button
            onClick={onDownload}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
              border: '1px solid rgba(255,255,255,0.13)', borderRadius: 10, padding: '9px 16px',
              fontFamily: 'Figtree, system-ui, sans-serif', fontSize: 13, fontWeight: 600, color: '#fff',
              cursor: 'pointer', whiteSpace: 'nowrap',
              boxShadow: '0 6px 20px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.07)',
            }}
          >
            ⬇ Download Report
          </button>
        </div>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.48)', paddingLeft: 4, margin: 0 }}>
          Downloads to your device only. Nothing is sent to ClearNest servers.
        </p>
      </div>

      <div className="grid lg:grid-cols-5 gap-7">
        <div className="lg:col-span-3 space-y-7">
          <div>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-xl font-semibold text-foreground">Recently Captured</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewMode('cards')}
                  className={`text-xs font-body px-3 py-1.5 rounded-full border ${viewMode === 'cards' ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}
                >
                  Cards
                </button>
                <button
                  onClick={() => setViewMode('timeline')}
                  className={`text-xs font-body px-3 py-1.5 rounded-full border ${viewMode === 'timeline' ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}
                >
                  Timeline
                </button>
              </div>
            </div>

            {filteredCaptured.length === 0 ? (
              <div className="cn-card text-center py-8">
                <p className="font-body text-muted-foreground">
                  No matches for the current search/filter. Start or continue a conversation with {parentName}.
                </p>
                <button
                  onClick={() => navigate('/conversation')}
                  className="mt-4 bg-primary text-primary-foreground font-body font-medium py-2 px-4 rounded-lg text-sm hover:opacity-90 transition-opacity"
                >
                  Continue Conversation
                </button>
              </div>
            ) : (
              <div className={viewMode === 'timeline' ? 'bg-white rounded-xl shadow-sm border border-border overflow-hidden cn-stagger' : 'space-y-4 cn-stagger'}>
                {filteredCaptured.slice(0, 10).map((item) => {
                  const quoteOpen = expandedQuote === item.id;
                  const detailOpen = expandedItem === item.id;
                  const style = CATEGORY_STYLES[item.category] ?? { chip: 'bg-slate-100 text-slate-700', icon: FileText };
                  const CategoryIcon = style.icon;
                  const summary = item.content.split('.').filter(Boolean)[0] ? `${item.content.split('.').filter(Boolean)[0]}.` : item.content;
                  const notePreview = userNotes[item.id];

                  if (viewMode === 'timeline') {
                    const catClass = item.category?.includes('bank') || item.category?.includes('financial') ? 'cat-financial' : item.category?.includes('property') ? 'cat-property' : item.category?.includes('document') ? 'cat-legal' : 'cat-general';
                    return (
                      <div key={item.id} className="timeline-item">
                        <div className="timeline-date">{item.timestamp.toLocaleDateString('en-GB', {day: 'numeric', month: 'short'})}</div>
                        <div className={`timeline-body ${catClass}`}>
                          <p className="text-sm font-body text-foreground">{item.content}</p>
                          <span className="text-xs text-muted-foreground capitalize">{item.category?.replace(/_/g, ' ')}</span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={item.id}
                      className="cn-card cn-card-hover cn-slide-in"
                    >
                      {/* cards mode — no timeline decorators */}

                      <div className="flex items-center justify-between mb-3">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-body font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full ${style.chip}`}>
                          <CategoryIcon className="w-3.5 h-3.5" />
                          {CATEGORY_LABELS[item.category] || item.category}
                        </span>
                        <span className="text-xs font-body text-muted-foreground">
                          {item.timestamp.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <p className="font-body font-medium text-foreground mb-1">{summary}</p>
                      {!detailOpen && (
                        <button
                          onClick={() => setExpandedItem(item.id)}
                          className="text-xs font-body text-primary hover:underline"
                        >
                          View details
                        </button>
                      )}
                      {detailOpen && (
                        <>
                          <p className="font-body text-foreground mb-3">{item.content}</p>
                          <button
                            onClick={() => setExpandedItem(null)}
                            className="text-xs font-body text-muted-foreground hover:text-foreground mb-2"
                          >
                            Hide details
                          </button>
                        </>
                      )}

                      <div className="flex items-center justify-between mt-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`w-2.5 h-2.5 rounded-full ${item.confidence === 'clear' ? 'bg-primary' : 'bg-alert'}`} />
                          <span className="text-sm text-muted-foreground font-body">
                            {item.confidence === 'clear' ? 'Clear' : 'Needs follow-up'}
                          </span>
                          <span className={`text-xs font-body px-2 py-0.5 rounded-full ${
                            item.verificationStatus === 'verified'
                              ? 'bg-green-100 text-green-700'
                              : item.verificationStatus === 'disputed'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-slate-100 text-slate-600'
                          }`}>
                            {item.verificationStatus ?? 'unverified'}
                          </span>
                          {notePreview && (
                            <span className="text-xs font-body px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                              {childName}'s note
                            </span>
                          )}
                        </div>

                        {item.sourceQuote && (
                          <button
                            onClick={() => setExpandedQuote(quoteOpen ? null : item.id)}
                            className="flex items-center gap-1 text-xs font-body text-primary hover:text-primary/70 transition-colors"
                            title={`See what ${parentName} said`}
                          >
                            <MessageSquareQuote className="w-3.5 h-3.5" />
                            <span>{quoteOpen ? 'Hide quote' : `${parentName}'s words`}</span>
                          </button>
                        )}
                      </div>

                      {/* Change 6: verified stamp */}
                      {item.confidence === 'clear' && (
                        <div className="verified-stamp">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                          Confirmed clear
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                        <button
                          onClick={() => updateCapturedVerification(item.id, 'verified')}
                          className="text-xs font-body px-2.5 py-1 rounded-md bg-green-100 text-green-700 hover:bg-green-200"
                        >
                          Verify ({childName})
                        </button>
                        <button
                          onClick={() => updateCapturedVerification(item.id, 'disputed')}
                          className="text-xs font-body px-2.5 py-1 rounded-md bg-red-100 text-red-700 hover:bg-red-200"
                        >
                          Mark disputed
                        </button>
                        <button
                          onClick={() => updateCapturedVerification(item.id, 'unverified')}
                          className="text-xs font-body px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200"
                        >
                          Reset
                        </button>
                      </div>

                      {quoteOpen && item.sourceQuote && (
                        <div className="mt-3 pt-3 border-t border-border">
                          <p className="text-xs font-body uppercase tracking-widest text-muted-foreground mb-2">
                            {parentName} said
                          </p>
                          <blockquote className="font-body text-sm text-foreground italic leading-relaxed border-l-2 border-primary/30 pl-3">
                            "{item.sourceQuote}"
                          </blockquote>
                        </div>
                      )}

                      <FamilyNoteField itemId={item.id} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>


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
      </div>
    </div>
  );
}
