import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/contexts/SessionContext';
import FamilyNoteField from '@/components/dashboard/FamilyNoteField';

const CATEGORY_LABELS: Record<string, string> = {
  bank_accounts: 'Bank Accounts',
  financial_accounts: 'Financial Accounts',
  documents: 'Documents',
  care_wishes: 'Care Wishes',
  property: 'Property',
  key_contacts: 'Key Contacts',
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
            cx="60" cy="60" r={radius} fill="none"
            stroke="#4A7FA5" strokeWidth="10"
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

export default function DashboardOverview() {
  const navigate = useNavigate();
  const { capturedItems, actionItems, sessions, parentName } = useSession();
  const activeActions = actionItems.filter(a => a.status !== 'done').length;

  // Progress ring score (7 key areas)
  const areas = [
    capturedItems.some(i => i.category === 'bank_accounts' || i.category === 'financial_accounts'),
    capturedItems.some(i => i.category === 'property'),
    capturedItems.some(i => i.category === 'documents'),
    capturedItems.some(i => i.category === 'care_wishes'),
    capturedItems.some(i => i.category === 'key_contacts'),
    sessions.length > 0,
    actionItems.length > 0,
  ];
  const score = Math.round((areas.filter(Boolean).length / areas.length) * 100);

  // Document checklist
  const [checked, setChecked] = useState<Set<string>>(loadChecklist);
  const toggleDoc = (id: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      saveChecklist(next);
      return next;
    });
  };

  return (
    <div className="cn-stagger">
      {/* Stat Cards + Progress Ring */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {[
          { label: 'Items Captured', value: capturedItems.length },
          { label: 'Actions Required', value: activeActions, amber: true },
          { label: 'Sessions Completed', value: sessions.length },
          { label: 'Last Updated', value: 'Today' },
        ].map((stat) => (
          <div key={stat.label} className="cn-card cn-card-hover">
            <p className="font-body text-sm text-muted-foreground mb-1">{stat.label}</p>
            <p className={`font-display text-3xl font-bold ${stat.amber ? 'text-alert' : 'text-foreground'}`}>
              {stat.value}
            </p>
          </div>
        ))}
        <ProgressRing score={score} />
      </div>

      {/* Two Column Layout */}
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Left column: recently captured + next session + checklist */}
        <div className="lg:col-span-3 space-y-6">
          {/* Recently Captured */}
          <div>
            <h2 className="font-display text-xl font-semibold mb-4 text-foreground">Recently Captured</h2>
            {capturedItems.length === 0 ? (
              <div className="cn-card text-center py-8">
                <p className="font-body text-muted-foreground">
                  Nothing captured yet. Start a conversation with {parentName} to begin.
                </p>
                <button
                  onClick={() => navigate('/conversation')}
                  className="mt-4 bg-primary text-primary-foreground font-body font-medium py-2 px-4 rounded-lg text-sm hover:opacity-90 transition-opacity"
                >
                  Start Conversation
                </button>
              </div>
            ) : (
              <div className="space-y-3 cn-stagger">
                {capturedItems.slice(0, 4).map(item => (
                  <div key={item.id} className="cn-card cn-card-hover cn-slide-in">
                    <p className="text-xs font-body uppercase tracking-widest text-primary mb-2">
                      {CATEGORY_LABELS[item.category] || item.category}
                    </p>
                    <p className="font-body text-foreground mb-2">{item.content}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${item.confidence === 'clear' ? 'bg-primary' : 'bg-alert'}`} />
                        <span className="text-sm text-muted-foreground font-body">
                          {item.confidence === 'clear' ? 'Clear' : 'Needs follow-up'}
                        </span>
                      </div>
                      <span className="text-sm text-muted-foreground font-body">
                        {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <FamilyNoteField itemId={item.id} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Next Session Prompt — only shown once some data exists */}
          {capturedItems.length > 0 && (
            <div className="bg-primary/10 border border-primary/20 rounded-xl p-5">
              <p className="font-body text-foreground mb-1">
                <span className="font-semibold">Ready to continue?</span>{' '}
                {parentName} covered {capturedItems.length} topic{capturedItems.length !== 1 ? 's' : ''} so far. Keep going to complete the picture.
              </p>
              <button
                onClick={() => navigate('/conversation')}
                className="mt-3 bg-primary text-primary-foreground font-body font-medium py-2 px-4 rounded-lg text-sm hover:opacity-90 transition-opacity"
              >
                Continue Conversation
              </button>
            </div>
          )}

          {/* Critical Documents Checklist */}
          <div className="cn-card">
            <h2 className="font-display text-lg font-semibold mb-4 text-foreground">Critical Documents</h2>
            <div className="space-y-3">
              {DOC_ITEMS.map(doc => {
                const isChecked = checked.has(doc.id);
                return (
                  <button
                    key={doc.id}
                    onClick={() => toggleDoc(doc.id)}
                    className="flex items-center gap-3 w-full text-left group"
                  >
                    <span className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      isChecked
                        ? 'bg-green-500 border-green-500'
                        : 'border-amber-400 bg-amber-50'
                    }`}>
                      {isChecked && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
                        </svg>
                      )}
                    </span>
                    <span className={`font-body text-sm transition-colors ${
                      isChecked
                        ? 'line-through text-muted-foreground'
                        : 'text-foreground group-hover:text-primary'
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
        </div>

        {/* Urgent Actions */}
        <div className="lg:col-span-2">
          <div className="bg-alert/10 rounded-lg p-4 mb-4">
            <h2 className="font-display text-xl font-semibold text-alert-foreground">Urgent Actions</h2>
          </div>
          {actionItems.filter(a => a.status !== 'done').length === 0 ? (
            <div className="cn-card text-center py-8">
              <p className="font-body text-muted-foreground text-sm">
                No actions flagged yet. Start a conversation to begin.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {actionItems.filter(a => a.status !== 'done').slice(0, 3).map(action => (
                <div key={action.id} className="cn-card-amber cn-card-hover cn-slide-in">
                  <div className="flex items-start gap-2 mb-2">
                    <span className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${action.severity === 'red' ? 'bg-destructive' : 'bg-alert'}`} />
                    <p className="font-body font-semibold text-foreground">{action.title}</p>
                  </div>
                  <p className="font-body text-sm text-muted-foreground mb-2 line-clamp-2">{action.description}</p>
                  {action.learnMoreUrl && (
                    <a href={action.learnMoreUrl} target="_blank" rel="noopener noreferrer" className="font-body text-sm text-primary hover:underline">
                      What to do →
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
