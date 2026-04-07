import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClearNestLogo } from '@/components/ClearNestLogo';
import { Mic, LayoutDashboard, Loader2, X, ArrowRight } from 'lucide-react';

const CONSENT_KEY = 'cn-consent-v1';
const PROFILE_KEY = 'cn-user-profile';

export interface UserProfile {
  sessionToken: string;
  elderlyName: string;
  age: string;
  gender: 'male' | 'female' | 'prefer-not-to-say';
  trustedContactName: string;
  createdAt: string;
}

function hasGivenConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === 'true';
  } catch {
    return false;
  }
}

function saveConsent() {
  try {
    localStorage.setItem(CONSENT_KEY, 'true');
  } catch {
    /* ignore */
  }
}

export function loadProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch {
    return null;
  }
}

function saveProfile(profile: UserProfile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    /* ignore */
  }
}

function generateToken(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function isOnboarded(): boolean {
  return loadProfile() !== null && hasGivenConsent();
}

// ─── Onboarding modal ─────────────────────────────────────────────────────────
function OnboardingModal({ onComplete, onClose }: { onComplete: () => void; onClose: () => void }) {
  const existingProfile = loadProfile();
  const [page, setPage] = useState<1 | 2>(1);

  const [elderlyName, setElderlyName] = useState(existingProfile?.elderlyName ?? '');
  const [age, setAge] = useState(existingProfile?.age ?? '');
  const [gender, setGender] = useState<'male' | 'female' | 'prefer-not-to-say'>(
    existingProfile?.gender ?? 'prefer-not-to-say',
  );
  const [trustedContactName, setTrustedContactName] = useState(existingProfile?.trustedContactName ?? '');

  const canAdvance = elderlyName.trim().length > 0 && age.trim().length > 0;

  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const canProceed = terms && privacy;

  const handleProfileNext = () => {
    const profile: UserProfile = {
      sessionToken: existingProfile?.sessionToken ?? generateToken(),
      elderlyName: elderlyName.trim(),
      age: age.trim(),
      gender,
      trustedContactName: trustedContactName.trim(),
      createdAt: existingProfile?.createdAt ?? new Date().toISOString(),
    };
    saveProfile(profile);
    setPage(2);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div className="bg-background rounded-2xl shadow-2xl max-w-md w-full max-h-[90dvh] overflow-y-auto p-7 relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-5">
          <div className={`w-2 h-2 rounded-full transition-colors ${page === 1 ? 'bg-primary' : 'bg-primary/30'}`} />
          <div className={`w-2 h-2 rounded-full transition-colors ${page === 2 ? 'bg-primary' : 'bg-primary/30'}`} />
          <span className="font-body text-xs text-muted-foreground ml-1">Step {page} of 2</span>
        </div>

        {page === 1 ? (
          <>
            <h2 id="onboarding-title" className="font-display text-xl font-semibold text-foreground mb-2">
              Tell us about your loved one
            </h2>
            <p className="font-body text-sm text-muted-foreground mb-5 leading-relaxed">
              This helps Clara personalise the conversation for the person she&apos;ll be speaking with.
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block font-body text-sm font-medium text-foreground mb-1.5">
                  Their name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={elderlyName}
                  onChange={(e) => setElderlyName(e.target.value)}
                  placeholder="e.g. Margaret"
                  className="w-full border border-border rounded-lg px-3 py-2.5 font-body text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground/50"
                  autoFocus
                />
              </div>

              <div>
                <label className="block font-body text-sm font-medium text-foreground mb-1.5">
                  Their age <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="e.g. 74"
                  min={1}
                  max={120}
                  className="w-full border border-border rounded-lg px-3 py-2.5 font-body text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground/50"
                />
              </div>

              <div>
                <label className="block font-body text-sm font-medium text-foreground mb-1.5">Their gender</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as typeof gender)}
                  className="w-full border border-border rounded-lg px-3 py-2.5 font-body text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="prefer-not-to-say">Prefer not to say</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                </select>
              </div>

              <div>
                <label className="block font-body text-sm font-medium text-foreground mb-1">Your name</label>
                <p className="font-body text-xs text-muted-foreground mb-1.5">
                  You&apos;re the family member who will review what Clara captures
                </p>
                <input
                  type="text"
                  value={trustedContactName}
                  onChange={(e) => setTrustedContactName(e.target.value)}
                  placeholder="e.g. David"
                  className="w-full border border-border rounded-lg px-3 py-2.5 font-body text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground/50"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleProfileNext}
              disabled={!canAdvance}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-body font-semibold py-3 rounded-lg transition-all duration-200 hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          </>
        ) : (
          <>
            <h2 id="onboarding-title" className="font-display text-xl font-semibold text-foreground mb-2">
              Before you begin
            </h2>
            <p className="font-body text-sm text-muted-foreground mb-5 leading-relaxed">
              Clara talks things through at an easy pace, so the important details don&apos;t stay scattered.
              Please read and agree below before you continue.
            </p>

            <div className="space-y-4 mb-6">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={terms}
                  onChange={(e) => setTerms(e.target.checked)}
                  className="mt-0.5 w-5 h-5 rounded border-border accent-primary shrink-0 cursor-pointer"
                />
                <span className="font-body text-sm text-foreground leading-relaxed">
                  I have read and agree to the{' '}
                  <a
                    href="/terms-of-service.md"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-2 hover:opacity-80"
                  >
                    Terms of Service
                  </a>
                  , including that ClearNest is not legal or financial advice.
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={privacy}
                  onChange={(e) => setPrivacy(e.target.checked)}
                  className="mt-0.5 w-5 h-5 rounded border-border accent-primary shrink-0 cursor-pointer"
                />
                <span className="font-body text-sm text-foreground leading-relaxed">
                  I understand how my data is handled as described in the{' '}
                  <a
                    href="/privacy-policy.md"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-2 hover:opacity-80"
                  >
                    Privacy Policy
                  </a>
                  , including that voice conversations are processed by ElevenLabs.
                </span>
              </label>
            </div>

            <p className="font-body text-xs text-muted-foreground mb-4 leading-relaxed border-l-2 border-border pl-3">
              Only use ClearNest when the person speaking understands what they&apos;re sharing and agrees
              freely—not under pressure.
            </p>

            <p
              className="font-body text-xs text-muted-foreground min-h-[1.25rem] mb-3"
              role="status"
              aria-live="polite"
            >
              {!canProceed ? 'Select both boxes above to continue.' : ''}
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setPage(1)}
                className="flex-shrink-0 px-4 py-3 rounded-lg border border-border font-body text-sm text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!canProceed) return;
                  saveConsent();
                  onComplete();
                }}
                disabled={!canProceed}
                aria-disabled={!canProceed}
                className="flex-1 bg-primary text-primary-foreground font-body font-semibold py-3 rounded-lg transition-all duration-200 hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                I agree — continue
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Post-onboarding prompt ───────────────────────────────────────────────────
function ClaraPromptModal({
  onStartClara,
  onDashboard,
}: {
  onStartClara: () => void;
  onDashboard: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="clara-prompt-title"
    >
      <div className="bg-background rounded-2xl shadow-2xl max-w-sm w-full p-7 text-center">
        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 bg-primary/10">
          <Mic className="w-7 h-7 text-primary" />
        </div>

        <h2 id="clara-prompt-title" className="font-display text-xl font-semibold text-foreground mb-2">
          You&apos;re all set
        </h2>
        <p className="font-body text-sm text-muted-foreground mb-6 leading-relaxed">
          Would you like to start talking to Clara now, or head straight to the dashboard?
        </p>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={onStartClara}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-body font-semibold py-3 rounded-lg transition-all duration-200 hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Mic className="w-4 h-4" />
            Start talking to Clara
          </button>
          <button
            type="button"
            onClick={onDashboard}
            className="w-full flex items-center justify-center gap-2 border border-border text-foreground font-body font-medium py-3 rounded-lg transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <LayoutDashboard className="w-4 h-4" />
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Policy content ───────────────────────────────────────────────────────────
const POLICIES = {
  privacy: {
    title: 'Privacy Policy',
    sections: [
      {
        heading: 'What we collect',
        body: 'We collect the name, age, and gender of your loved one, along with your name as the trusted contact. During voice sessions, audio is streamed to ElevenLabs for real-time transcription. The resulting transcript and any facts Clara captures are stored in our Supabase database, scoped to your family.',
      },
      {
        heading: 'How it is used',
        body: "Your information is used solely to personalise Clara's conversations and display a summary on your family dashboard. We do not use your data for advertising, profiling, or any purpose beyond the ClearNest service.",
      },
      {
        heading: 'Data retention',
        body: 'Conversation transcripts are automatically deleted after 30 days unless you choose to pin them. Captured facts and profile data remain until you delete them. You can remove your data at any time via the dashboard.',
      },
      {
        heading: 'Third-party processors',
        body: 'Voice audio is processed by ElevenLabs (elevenlabs.io) under their own privacy policy. Structured data is stored in Supabase (supabase.com). No other third parties receive your personal data.',
      },
      {
        heading: 'Your rights',
        body: 'You have the right to access, correct, or delete any data we hold about you. To exercise these rights, contact us at privacy@clearnest.app. We will respond within 30 days.',
      },
      {
        heading: 'Cookies',
        body: 'ClearNest does not use tracking or advertising cookies. We use only essential local storage to remember your session and consent preferences on this device.',
      },
    ],
  },
  safeguarding: {
    title: 'Safeguarding Policy',
    sections: [
      {
        heading: 'Our commitment',
        body: 'ClearNest is committed to the safety and wellbeing of all users, particularly older adults and those who may be vulnerable. We believe everyone has the right to live free from abuse, neglect, and exploitation.',
      },
      {
        heading: 'Informed consent',
        body: 'Clara should only be used when the person speaking understands what they are sharing and agrees freely — without pressure, coercion, or undue influence from family members or others. If you are unsure whether someone has capacity to consent, do not use ClearNest until appropriate guidance has been sought.',
      },
      {
        heading: 'Not a substitute for professional advice',
        body: 'ClearNest is an organisational tool only. It does not provide legal, financial, or medical advice. Information captured by Clara should always be reviewed with qualified professionals (solicitors, financial advisers, GPs) before any decisions are made.',
      },
      {
        heading: 'If you have a concern',
        body: 'If you believe someone is at risk of harm — including financial abuse, coercion, or exploitation — contact your local Adult Social Care team or call the Adult Safeguarding helpline. In an emergency, always call 999.',
      },
      {
        heading: 'Reporting a concern about ClearNest',
        body: 'If you have a safeguarding concern specifically about how ClearNest is being used, contact us at safeguarding@clearnest.app. We treat all reports seriously and will respond within 2 business days.',
      },
      {
        heading: 'Useful contacts',
        body: 'Age UK: 0800 678 1602 · Action on Elder Abuse: 080 8808 8141 · NHS: 111 · Emergency: 999',
      },
    ],
  },
} as const;

type PolicyKey = keyof typeof POLICIES;

// ─── Glass policy modal ────────────────────────────────────────────────────────
function PolicyModal({ policyKey, onClose }: { policyKey: PolicyKey; onClose: () => void }) {
  const policy = POLICIES[policyKey];

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: 'rgba(10,8,20,0.72)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="policy-modal-title"
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative',
          background: 'linear-gradient(145deg,rgba(230,222,250,0.62) 0%,rgba(210,200,240,0.50) 50%,rgba(195,180,235,0.44) 100%)',
          backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)',
          border: '1px solid rgba(200,180,240,0.55)',
          borderRadius: 28,
          boxShadow: '0 24px 72px rgba(40,20,100,0.32),inset 0 1.5px 0 rgba(255,255,255,0.60)',
          maxWidth: 600, width: '100%',
          maxHeight: '80dvh',
          display: 'flex', flexDirection: 'column',
          fontFamily: "'Figtree', system-ui, sans-serif",
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '26px 28px 20px',
          borderBottom: '1px solid rgba(155,123,200,0.20)',
          flexShrink: 0,
        }}>
          <span id="policy-modal-title" style={{ fontSize: 22, fontWeight: 900, color: 'rgba(60,30,120,0.95)' }}>
            {policy.title}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'rgba(155,123,200,0.18)', border: '1px solid rgba(155,123,200,0.30)',
              borderRadius: '50%', width: 34, height: 34,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'rgba(60,30,120,0.8)', fontSize: 18, lineHeight: 1,
              flexShrink: 0,
            }}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="cn-policy-scroll" style={{ overflowY: 'auto', scrollbarWidth: 'none', padding: '22px 28px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {policy.sections.map(section => (
            <div key={section.heading}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(80,40,160,0.85)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                {section.heading}
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.7, color: 'rgba(40,20,80,0.80)' }}>
                {section.body}
              </div>
            </div>
          ))}

          <div style={{ marginTop: 8, paddingTop: 16, borderTop: '1px solid rgba(155,123,200,0.20)', fontSize: 11, color: 'rgba(100,80,150,0.55)', textAlign: 'center' }}>
            © 2026 Pannonl Ltd · Not legal or financial advice
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sphere ───────────────────────────────────────────────────────────────────
function ClaraSphere({ size = 160 }: { size?: number }) {
  const inset = Math.round(size * 0.09);
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        background: 'conic-gradient(from 0deg,rgba(155,123,200,0) 0%,rgba(155,123,200,0.7) 25%,rgba(200,170,255,0.5) 50%,rgba(100,60,180,0.6) 75%,rgba(155,123,200,0) 100%)',
        animation: 'cnSphereRot 12s linear infinite', filter: 'blur(6px)',
      }} />
      <div style={{
        position: 'absolute', inset, borderRadius: '50%',
        background: 'conic-gradient(from 120deg,rgba(180,150,230,0) 0%,rgba(220,200,255,0.6) 30%,rgba(80,40,160,0.5) 60%,rgba(180,150,230,0) 100%)',
        animation: 'cnSphereRot2 8s linear infinite', filter: 'blur(7px)',
      }} />
      <div style={{
        position: 'absolute',
        width: Math.round(size * 0.6), height: Math.round(size * 0.38),
        borderRadius: '50%',
        background: 'radial-gradient(ellipse,rgba(196,168,232,0.88) 0%,rgba(155,123,200,0.4) 50%,transparent 70%)',
        top: Math.round(size * 0.12), left: Math.round(size * 0.09),
        animation: 'cnSphereSmoke1 6.5s ease-in-out infinite', filter: 'blur(8px)',
      }} />
      <div style={{
        position: 'absolute',
        top: Math.round(size * 0.13), left: Math.round(size * 0.18),
        width: '38%', height: '28%', borderRadius: '50%',
        background: 'radial-gradient(ellipse,rgba(255,255,255,0.65) 0%,transparent 70%)', zIndex: 9,
      }} />
    </div>
  );
}

// ─── Landing ──────────────────────────────────────────────────────────────────
const Landing = () => {
  const navigate = useNavigate();
  const [connecting, setConnecting] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showClaraPrompt, setShowClaraPrompt] = useState(false);
  const [policyModal, setPolicyModal] = useState<PolicyKey | null>(null);

  const onboarded = isOnboarded();
  const profile = loadProfile();

  const goToConversation = () => {
    setShowClaraPrompt(false);
    setConnecting(true);
    setTimeout(() => navigate('/conversation'), 900);
  };

  const handleClaraCard = () => {
    if (connecting) return;
    if (onboarded) {
      goToConversation();
    } else {
      setShowOnboarding(true);
    }
  };

  const handleDashboard = () => {
    if (onboarded) {
      navigate('/dashboard');
    } else {
      setShowOnboarding(true);
    }
  };

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    setShowClaraPrompt(true);
  };

  const greeting = onboarded
    ? "Hey, it's\ngood to see\nyou again"
    : "Hey,\nwelcome\naboard!";

  const claraSubtitle = onboarded && profile?.elderlyName
    ? `Continue with ${profile.elderlyName}`
    : 'Start your first session';

  return (
    <div style={{ minHeight: '100dvh', background: '#ECEDF5', position: 'relative', overflow: 'hidden', fontFamily: "'Figtree', system-ui, sans-serif" }}>
      <style>{`
        @keyframes cnLandingSlideLeft {
          from { opacity: 0; transform: translateX(-40px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes cnLandingSlideRight {
          from { opacity: 0; transform: translateX(40px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes cnLandingFadeDown {
          from { opacity: 0; transform: translateY(-12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .cn-policy-scroll::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Background blobs */}
      <div style={{ position: 'fixed', borderRadius: '50%', filter: 'blur(130px)', pointerEvents: 'none', zIndex: 0, width: 700, height: 700, background: 'rgba(155,123,200,0.15)', top: -200, right: '15%' }} />
      <div style={{ position: 'fixed', borderRadius: '50%', filter: 'blur(130px)', pointerEvents: 'none', zIndex: 0, width: 500, height: 500, background: 'rgba(94,207,207,0.08)', bottom: -100, right: '48%' }} />
      <div style={{ position: 'fixed', borderRadius: '50%', filter: 'blur(130px)', pointerEvents: 'none', zIndex: 0, width: 380, height: 380, background: 'rgba(155,123,200,0.09)', top: '30%', left: 20 }} />

      {/* Modals */}
      {showOnboarding && (
        <OnboardingModal
          onComplete={handleOnboardingComplete}
          onClose={() => setShowOnboarding(false)}
        />
      )}
      {showClaraPrompt && (
        <ClaraPromptModal
          onStartClara={goToConversation}
          onDashboard={() => { setShowClaraPrompt(false); navigate('/dashboard'); }}
        />
      )}
      {policyModal && (
        <PolicyModal policyKey={policyModal} onClose={() => setPolicyModal(null)} />
      )}

      {/* Logo — top centre */}
      <div style={{
        position: 'absolute', top: 28, left: 0, right: 0, zIndex: 2,
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        animation: 'cnLandingFadeDown 0.5s cubic-bezier(0.22,1,0.36,1) both',
        pointerEvents: 'none',
      }}>
        <div style={{ transform: 'scale(0.8)', transformOrigin: 'center' }}>
          <ClearNestLogo />
        </div>
      </div>

      {/* Scene */}
      <div style={{
        position: 'relative', zIndex: 1,
        minHeight: '100dvh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'clamp(80px, 8vw, 120px) clamp(32px, 7vw, 140px) clamp(48px, 4vw, 80px)',
        gap: 'clamp(32px, 4vw, 72px)',
        flexWrap: 'wrap',
      }}>

        {/* Greeting — fills left half */}
        <div style={{
          fontSize: 'clamp(64px, 8.5vw, 130px)',
          fontWeight: 900,
          lineHeight: 1.0,
          color: '#7A59BE',
          flex: '1 1 0',
          minWidth: 0,
          letterSpacing: '-3px',
          whiteSpace: 'pre-line',
          animation: 'cnLandingSlideLeft 0.7s cubic-bezier(0.22,1,0.36,1) 0.1s both',
        }}>
          {greeting}
        </div>

        {/* Cards column — right half */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 20,
          flex: '1 1 0',
          minWidth: 'min(100%, 360px)',
          maxWidth: 520,
          animation: 'cnLandingSlideRight 0.7s cubic-bezier(0.22,1,0.36,1) 0.25s both',
        }}>

          {/* Clara card — centered contents, big sphere */}
          <div
            onClick={handleClaraCard}
            style={{
              position: 'relative',
              background: 'linear-gradient(145deg,rgba(230,222,250,0.60) 0%,rgba(210,200,240,0.44) 50%,rgba(190,175,230,0.40) 100%)',
              backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)',
              border: '1px solid rgba(200,180,240,0.50)',
              borderRadius: 32, padding: '36px 28px 32px',
              overflow: 'hidden', cursor: connecting ? 'wait' : 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              textAlign: 'center',
              boxShadow: '0 14px 44px rgba(80,50,160,0.18),0 2px 8px rgba(80,50,160,0.08),inset 0 1.5px 0 rgba(255,255,255,0.60),inset 0 -1px 0 rgba(155,123,200,0.15)',
              transition: 'transform 0.22s cubic-bezier(0.22,1,0.36,1),box-shadow 0.22s ease',
            }}
            onMouseEnter={e => {
              const d = e.currentTarget as HTMLDivElement;
              d.style.transform = 'translateY(-4px) scale(1.012)';
              d.style.boxShadow = '0 24px 64px rgba(80,50,160,0.26),0 4px 12px rgba(80,50,160,0.10),inset 0 1.5px 0 rgba(255,255,255,0.65),inset 0 -1px 0 rgba(155,123,200,0.15)';
            }}
            onMouseLeave={e => {
              const d = e.currentTarget as HTMLDivElement;
              d.style.transform = 'translateY(0) scale(1)';
              d.style.boxShadow = '0 14px 44px rgba(80,50,160,0.18),0 2px 8px rgba(80,50,160,0.08),inset 0 1.5px 0 rgba(255,255,255,0.60),inset 0 -1px 0 rgba(155,123,200,0.15)';
            }}
          >
            {/* Decorative arcs */}
            <div style={{ position: 'absolute', top: -20, right: -20, width: 140, height: 140, pointerEvents: 'none' }}>
              {[
                { size: 118, color: 'rgba(94,207,207,0.50)', rot: -22 },
                { size: 82,  color: 'rgba(255,255,255,0.35)', rot: -8  },
                { size: 52,  color: 'rgba(155,123,200,0.75)', rot:  6  },
              ].map((arc, i) => (
                <div key={i} style={{
                  position: 'absolute',
                  width: arc.size, height: arc.size, borderRadius: '50%',
                  border: '5px solid transparent',
                  borderTopColor: arc.color, borderRightColor: arc.color,
                  top: (118 - arc.size) / 2 + 11, right: (118 - arc.size) / 2 + 11,
                  transform: `rotate(${arc.rot}deg)`,
                }} />
              ))}
            </div>

            <ClaraSphere size={160} />

            {/* Title */}
            <div style={{ fontSize: 38, fontWeight: 900, lineHeight: 1.15, color: 'rgba(255,255,255,0.97)', textShadow: '0 1px 14px rgba(80,40,160,0.25)', marginTop: 20, marginBottom: 8, position: 'relative', zIndex: 1 }}>
              {connecting ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                  <Loader2 style={{ width: 28, height: 28, animation: 'spin 1s linear infinite' }} />
                  Connecting…
                </span>
              ) : (
                <><span style={{ color: '#5ECFCF' }}>Chat</span> to Clara</>
              )}
            </div>

            {/* Subtitle */}
            <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', fontWeight: 400, position: 'relative', zIndex: 1 }}>
              {claraSubtitle}
            </div>
          </div>

          {/* Dashboard — glassmorphism */}
          <div
            onClick={handleDashboard}
            style={{
              position: 'relative',
              background: 'linear-gradient(145deg,rgba(140,100,210,0.38) 0%,rgba(100,60,180,0.30) 60%,rgba(80,40,160,0.26) 100%)',
              backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)',
              border: '1px solid rgba(180,150,240,0.40)',
              borderRadius: 28, padding: '26px 32px',
              display: 'flex', alignItems: 'center', gap: 20,
              cursor: 'pointer',
              boxShadow: '0 10px 32px rgba(80,50,160,0.22),inset 0 1.5px 0 rgba(255,255,255,0.30),inset 0 -1px 0 rgba(100,60,200,0.20)',
              transition: 'transform 0.22s cubic-bezier(0.22,1,0.36,1),box-shadow 0.22s ease',
            }}
            onMouseEnter={e => {
              const d = e.currentTarget as HTMLDivElement;
              d.style.transform = 'translateY(-3px) scale(1.012)';
              d.style.boxShadow = '0 20px 52px rgba(80,50,160,0.32),inset 0 1.5px 0 rgba(255,255,255,0.36),inset 0 -1px 0 rgba(100,60,200,0.20)';
            }}
            onMouseLeave={e => {
              const d = e.currentTarget as HTMLDivElement;
              d.style.transform = 'translateY(0) scale(1)';
              d.style.boxShadow = '0 10px 32px rgba(80,50,160,0.22),inset 0 1.5px 0 rgba(255,255,255,0.30),inset 0 -1px 0 rgba(100,60,200,0.20)';
            }}
          >
            {/* Grid icon */}
            <div style={{ width: 34, height: 34, flexShrink: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
              {[0,1,2,3].map(i => (
                <span key={i} style={{ background: 'rgba(255,255,255,0.88)', borderRadius: 5, display: 'block' }} />
              ))}
            </div>
            <span style={{ fontSize: 22, fontWeight: 900, color: 'rgba(255,255,255,0.95)', letterSpacing: 1.5 }}>DASHBOARD</span>
          </div>

        </div>
      </div>

      {/* Footer */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 2,
        padding: '10px 24px', textAlign: 'center',
        background: 'rgba(236,237,245,0.65)', backdropFilter: 'blur(10px)',
      }}>
        <p style={{ fontSize: 11, color: 'rgba(100,90,130,0.65)', margin: 0 }}>
          Not legal or financial advice. ClearNest is an organisational tool only. &nbsp;·&nbsp;
          <a href="/admin" style={{ color: 'inherit', textDecoration: 'underline' }}>Admin</a>
          &nbsp;·&nbsp;
          <button type="button" onClick={() => setPolicyModal('privacy')} style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', textDecoration: 'underline', cursor: 'pointer', fontSize: 'inherit', fontFamily: 'inherit' }}>Privacy Policy</button>
          &nbsp;·&nbsp;
          <a href="/terms-of-service.md" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>Terms of Service</a>
          &nbsp;·&nbsp;
          <button type="button" onClick={() => setPolicyModal('safeguarding')} style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', textDecoration: 'underline', cursor: 'pointer', fontSize: 'inherit', fontFamily: 'inherit' }}>Safeguarding</button>
        </p>
      </div>
    </div>
  );
};

export default Landing;
