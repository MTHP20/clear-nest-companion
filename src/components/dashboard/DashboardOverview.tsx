import { useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/contexts/SessionContext';
import FamilyNoteField from '@/components/dashboard/FamilyNoteField';
import { FileText, Heart, Home, Landmark, MessageSquareQuote, Users } from 'lucide-react';

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
            stroke="#4A7FA5"
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

  const [checked, setChecked] = useState<Set<string>>(loadChecklist);
  const toggleDoc = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      saveChecklist(next);
      return next;
    });
  };

  return (
    <div className="cn-stagger">
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-9">
        {[
          { label: 'Items Captured', value: capturedItems.length },
          { label: 'Tasks Open', value: activeActions, amber: true, emphasize: true },
          { label: 'Needs Follow-up', value: needsFollowUpCount, amber: true },
          { label: 'Sessions Completed', value: sessions.length },
          {
            label: 'Last Updated',
            value: lastUpdated
              ? lastUpdated.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
              : 'No data',
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className={`cn-card cn-card-hover ${stat.emphasize ? 'ring-1 ring-alert/60 bg-alert/5' : ''}`}
          >
            <p className="font-body text-sm text-muted-foreground mb-1">{stat.label}</p>
            <p className={`font-display text-3xl font-bold ${stat.amber ? 'text-alert' : 'text-foreground'}`}>
              {stat.value}
            </p>
          </div>
        ))}
        <ProgressRing score={score} />
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
              <div className="space-y-4 cn-stagger">
                {filteredCaptured.slice(0, 10).map((item) => {
                  const quoteOpen = expandedQuote === item.id;
                  const detailOpen = expandedItem === item.id;
                  const style = CATEGORY_STYLES[item.category] ?? { chip: 'bg-slate-100 text-slate-700', icon: FileText };
                  const CategoryIcon = style.icon;
                  const summary = item.content.split('.').filter(Boolean)[0] ? `${item.content.split('.').filter(Boolean)[0]}.` : item.content;
                  const notePreview = userNotes[item.id];

                  return (
                    <div
                      key={item.id}
                      className={`cn-card cn-card-hover cn-slide-in ${viewMode === 'timeline' ? 'relative pl-10' : ''}`}
                    >
                      {viewMode === 'timeline' && (
                        <>
                          <div className="absolute left-3 top-0 bottom-0 w-px bg-border/70" />
                          <div className="absolute left-[7px] top-8 w-3 h-3 rounded-full bg-primary border border-card" />
                        </>
                      )}

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

          {capturedItems.length > 0 && (
            <div className="bg-primary/10 border border-primary/20 rounded-xl p-5">
              <p className="font-body text-foreground mb-1">
                <span className="font-semibold">Ready to continue?</span>{' '}
                {parentName} covered {capturedItems.length} topic{capturedItems.length !== 1 ? 's' : ''} so far.
                {needsFollowUpCount > 0 && ` ${needsFollowUpCount} still need follow-up.`}
              </p>
              <button
                onClick={() => navigate('/conversation')}
                className="mt-3 bg-primary text-primary-foreground font-body font-medium py-2 px-4 rounded-lg text-sm hover:opacity-90 transition-opacity"
              >
                Continue Conversation
              </button>
            </div>
          )}

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

          <div className="cn-card">
            <h2 className="font-display text-lg font-semibold mb-3 text-foreground">Progress Momentum</h2>
            <p className="font-body text-sm text-muted-foreground">
              Verified facts: <span className="font-semibold text-foreground">{verifiedCount}</span> • Disputed facts:{' '}
              <span className="font-semibold text-foreground">{disputedCount}</span>
            </p>
            <p className="font-body text-sm text-muted-foreground mt-1">
              Critical checklist complete: <span className="font-semibold text-foreground">{checked.size}/{DOC_ITEMS.length}</span>
            </p>
            <p className="font-body text-sm text-muted-foreground mt-1">
              Tasks remaining: <span className="font-semibold text-foreground">{activeActions}</span>
            </p>
          </div>
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
