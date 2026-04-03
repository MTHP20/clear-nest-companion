import { useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/contexts/SessionContext';
import type { ReadinessSnapshot } from '@/contexts/SessionContext';
import FamilyNoteField from '@/components/dashboard/FamilyNoteField';
import { FileText, Heart, Home, Landmark, MessageSquareQuote, Users, TrendingUp, ArrowRight } from 'lucide-react';

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

function ReadinessTrend({
  history,
  verifiedCount,
  disputedCount,
  checklistSize,
  docTotal,
  activeActions,
}: {
  history: ReadinessSnapshot[];
  verifiedCount: number;
  disputedCount: number;
  checklistSize: number;
  docTotal: number;
  activeActions: number;
}) {
  const W = 280, H = 80, PAD = 8;

  const points = useMemo(() => {
    if (history.length < 2) return null;
    const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
    const scores = sorted.map(s => s.score);
    const minS = Math.min(...scores, 0);
    const maxS = Math.max(...scores, 100);
    const range = maxS - minS || 1;
    return sorted.map((s, i) => ({
      x: PAD + (i / (sorted.length - 1)) * (W - PAD * 2),
      y: H - PAD - ((s.score - minS) / range) * (H - PAD * 2),
      score: s.score,
      date: s.date,
    }));
  }, [history]);

  const polyline = points
    ? points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
    : null;

  const latest = history.length > 0 ? history[history.length - 1].score : null;
  const previous = history.length > 1 ? history[history.length - 2].score : null;
  const delta = latest !== null && previous !== null ? latest - previous : null;

  return (
    <div className="cn-card">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4 text-primary" />
        <h2 className="font-display text-lg font-semibold text-foreground">Progress Momentum</h2>
        {delta !== null && delta > 0 && (
          <span className="ml-auto text-xs font-body font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
            +{delta}% this session
          </span>
        )}
      </div>

      {points ? (
        <div className="mb-3 overflow-hidden rounded-lg bg-primary/5 p-2">
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} aria-label="Readiness score trend chart">
            {/* Grid lines */}
            {[0, 25, 50, 75, 100].map(pct => {
              const y = H - PAD - (pct / 100) * (H - PAD * 2);
              return (
                <g key={pct}>
                  <line x1={PAD} y1={y} x2={W - PAD} y2={y} stroke="#e5e7eb" strokeWidth="0.5" />
                  <text x={PAD + 2} y={y - 2} fontSize="7" fill="#9ca3af" fontFamily="system-ui">
                    {pct}%
                  </text>
                </g>
              );
            })}
            {/* Area fill */}
            <polygon
              points={`${PAD},${H - PAD} ${polyline} ${points[points.length - 1].x.toFixed(1)},${H - PAD}`}
              fill="#9B7BC8"
              opacity="0.10"
            />
            {/* Trend line */}
            <polyline
              points={polyline!}
              fill="none"
              stroke="#9B7BC8"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Data points */}
            {points.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="3" fill="#9B7BC8" stroke="#fff" strokeWidth="1.5">
                <title>{p.date}: {p.score}%</title>
              </circle>
            ))}
          </svg>
        </div>
      ) : (
        <p className="font-body text-sm text-muted-foreground mb-3">
          Complete more conversations to see your readiness trend here.
        </p>
      )}

      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="font-display text-lg font-bold text-primary">{verifiedCount}</p>
          <p className="font-body text-xs text-muted-foreground">Verified</p>
        </div>
        <div>
          <p className="font-display text-lg font-bold text-foreground">{checklistSize}/{docTotal}</p>
          <p className="font-body text-xs text-muted-foreground">Checklist</p>
        </div>
        <div>
          <p className="font-display text-lg font-bold text-alert">{activeActions}</p>
          <p className="font-body text-xs text-muted-foreground">Tasks open</p>
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
  const lastDate = sessions[0]?.date;
  const W = 400, H = 100, padX = 18, padY = 14;
  const cW = W - padX * 2, cH = H - padY * 2;

  const pts = days.map((d, i) => ({
    x: padX + (i / (days.length - 1)) * cW,
    y: padY + (1 - d.count / maxCount) * cH,
    ...d,
  }));

  const linePath = pts.reduce((acc, p, i) => {
    if (i === 0) return `M${p.x},${p.y}`;
    const prev = pts[i - 1];
    const cx = (prev.x + p.x) / 2;
    return `${acc} C${cx},${prev.y} ${cx},${p.y} ${p.x},${p.y}`;
  }, '');

  const areaPath = `${linePath} L${pts[pts.length - 1].x},${H - padY} L${pts[0].x},${H - padY}Z`;
  const gold = '#F0C050';
  const muted = '#9B9080';
  const border = '#EDE8DF';

  return (
    <div style={{
      background: '#FFFFFF', borderRadius: 20, padding: '18px 20px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)', flex: 1, minWidth: 0, marginBottom: 24,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: '#1A1A1A' }}>Activity</span>
        <span style={{ fontSize: 11, color: muted, flex: 1 }}>Active sessions per day</span>
        <span style={{
          background: '#F0EBE1', borderRadius: 20, padding: '4px 12px',
          fontSize: 11, fontWeight: 500, color: '#1A1A1A',
        }}>Last 7 days</span>
      </div>

      <div style={{ position: 'relative' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none">
          <defs>
            <linearGradient id="ovGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={gold} stopOpacity="0.32" />
              <stop offset="100%" stopColor={gold} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.33, 0.66, 1].map((f, i) => (
            <line key={i} x1={padX} y1={padY + f * cH} x2={W - padX} y2={padY + f * cH} stroke="#f0ece4" strokeWidth="1" />
          ))}
          <path d={areaPath} fill="url(#ovGrad)" />
          <path d={linePath} fill="none" stroke={gold} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {pts.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="4.5" fill={gold} stroke="white" strokeWidth="2">
              <title>{p.label}: {p.count} session{p.count !== 1 ? 's' : ''}</title>
            </circle>
          ))}
        </svg>
        {total > 0 && (
          <div style={{
            position: 'absolute', top: '4%', left: '46%', transform: 'translateX(-50%)',
            background: 'white', border: '1.5px solid #eee', borderRadius: 10,
            padding: '3px 10px', boxShadow: '0 3px 10px rgba(0,0,0,0.1)',
            pointerEvents: 'none', whiteSpace: 'nowrap',
          }}>
            <span style={{ fontSize: 15, fontWeight: 700, display: 'block', color: '#1A1A1A' }}>{total}</span>
            <span style={{ fontSize: 10, color: muted }}>Total sessions</span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 2px 0', fontSize: 10, color: muted }}>
        {days.map(d => <span key={d.label}>{d.label}</span>)}
      </div>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 10, paddingTop: 10, borderTop: `1px solid ${border}` }}>
        <div style={{ fontSize: 12, color: muted }}>
          Sessions completed <strong style={{ color: '#1A1A1A' }}>{total}</strong>
        </div>
        {lastDate && (
          <div style={{ fontSize: 12, color: muted }}>
            Last updated <strong style={{ color: '#1A1A1A' }}>
              {new Date(lastDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </strong>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Readiness ring ────────────────────────────────────────────────────────────
function ReadinessCard({ score }: { score: number }) {
  const r = 28, circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  return (
    <div style={{
      background: '#EEF6F6', borderRadius: 20, padding: '18px 16px',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 8,
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: 24,
    }}>
      <div style={{ position: 'relative', width: 70, height: 70 }}>
        <svg width="70" height="70" viewBox="0 0 70 70" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="35" cy="35" r={r} fill="none" stroke="#CDE9E9" strokeWidth="6" />
          <circle cx="35" cy="35" r={r} fill="none" stroke="#5ECFCF" strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A' }}>{score}%</span>
        </div>
      </div>
      <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A', textAlign: 'center', lineHeight: 1.2, margin: 0 }}>
        Family<br />Readiness
      </p>
      <p style={{ fontSize: 10, color: '#9B9080', margin: 0 }}>Score</p>
    </div>
  );
}

interface DashboardOverviewProps {
  query?: string;
  categoryFilter?: string;
  confidenceFilter?: string;
}

export default function DashboardOverview({
  query = '',
  categoryFilter = 'all',
  confidenceFilter = 'all',
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
  const disputedCount = capturedItems.filter((i) => i.verificationStatus === 'disputed').length;
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

      {/* Activity chart + readiness ring */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 8 }}>
        <ActivityChart sessions={sessions} />
        <ReadinessCard score={readinessPct} />
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
          <div className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="font-display text-base font-semibold text-foreground">Topic Progress</h3>
            </div>
            {/* Change 5: POA urgency callout */}
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
          </div>

          <div className="cn-card">
            <h2 className="font-display text-lg font-semibold mb-4 text-foreground">Critical Documents</h2>
            <div className="space-y-3">
              {DOC_ITEMS.map((doc) => {
                const isChecked = checked.has(doc.id);
                return (
                  <button
                    key={doc.id}
                    onClick={() => toggleDoc(doc.id)}
                    className="flex items-center gap-3 w-full text-left group"
                  >
                    <span className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      isChecked ? 'bg-green-500 border-green-500' : 'border-amber-400 bg-amber-50'
                    }`}>
                      {isChecked && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
                        </svg>
                      )}
                    </span>
                    <span className={`font-body text-sm transition-colors ${
                      isChecked ? 'line-through text-muted-foreground' : 'text-foreground group-hover:text-primary'
                    }`}>
                      {doc.label}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="font-body text-xs text-muted-foreground mt-4">
              {checked.size} of {DOC_ITEMS.length} confirmed
            </p>
          </div>

          <ReadinessTrend history={readinessHistory} verifiedCount={verifiedCount} disputedCount={disputedCount} checklistSize={checked.size} docTotal={DOC_ITEMS.length} activeActions={activeActions} />
        </div>

        <div className="lg:col-span-2 lg:sticky lg:top-24 h-fit">
          <div className="bg-alert/10 rounded-lg p-4 mb-4">
            <h2 className="font-display text-xl font-semibold text-alert-foreground">Urgent Actions</h2>
          </div>
          {filteredActions.length === 0 ? (
            <div className="cn-card text-center py-8">
              <p className="font-body text-muted-foreground text-sm">
                No action items match your search right now.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredActions.slice(0, 4).map((action) => (
                <div key={action.id} className="cn-card-amber cn-card-hover cn-slide-in">
                  <div className="flex items-start gap-2 mb-2">
                    <span className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${action.severity === 'red' ? 'bg-destructive' : 'bg-alert'}`} />
                    <p className="font-body font-semibold text-foreground">{action.title}</p>
                  </div>
                  <p className="font-body text-sm text-muted-foreground mb-2">{action.description}</p>
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className="text-xs font-body px-2 py-1 rounded-full bg-sky-100 text-sky-700">{childName} (Dad)</span>
                    <span className="text-xs font-body px-2 py-1 rounded-full bg-amber-100 text-amber-700">Due {action.dueDate ?? 'TBD'}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => updateActionStatus(action.id, 'in-progress')}
                      className="text-xs font-body px-2.5 py-1 rounded-md bg-primary text-primary-foreground hover:opacity-90"
                    >
                      Start task
                    </button>
                    <button
                      onClick={() => updateActionStatus(action.id, 'done')}
                      className="text-xs font-body px-2.5 py-1 rounded-md bg-green-100 text-green-700 hover:bg-green-200"
                    >
                      Mark done
                    </button>
                    {action.learnMoreUrl && (
                      <a href={action.learnMoreUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-body px-2.5 py-1 rounded-md bg-background border border-border text-primary hover:bg-muted">
                        Open guidance
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
