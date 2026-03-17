import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClearNestLogo } from '@/components/ClearNestLogo';
import { Mic, LayoutDashboard, CheckCircle2, Loader2, X, ArrowRight, Lock } from 'lucide-react';

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
  try { return localStorage.getItem(CONSENT_KEY) === 'true'; } catch { return false; }
}

function saveConsent() {
  try { localStorage.setItem(CONSENT_KEY, 'true'); } catch { /* ignore */ }
}

export function loadProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch { return null; }
}

function saveProfile(profile: UserProfile) {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch { /* ignore */ }
}

function generateToken(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function isOnboarded(): boolean {
  return loadProfile() !== null && hasGivenConsent();
}

// ─── Onboarding modal (profile + T&Cs) — triggered from Open Dashboard ───────
function OnboardingModal({ onComplete, onClose }: { onComplete: () => void; onClose: () => void }) {
  const existingProfile = loadProfile();
  const [page, setPage] = useState<1 | 2>(1);

  // Page 1 — profile fields
  const [elderlyName, setElderlyName] = useState(existingProfile?.elderlyName ?? '');
  const [age, setAge] = useState(existingProfile?.age ?? '');
  const [gender, setGender] = useState<'male' | 'female' | 'prefer-not-to-say'>(
    existingProfile?.gender ?? 'prefer-not-to-say'
  );
  const [trustedContactName, setTrustedContactName] = useState(existingProfile?.trustedContactName ?? '');

  const canAdvance = elderlyName.trim().length > 0 && age.trim().length > 0;

  // Page 2 — consent
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div className="bg-background rounded-2xl shadow-2xl max-w-md w-full p-7 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-5">
          <div className={`w-2 h-2 rounded-full transition-colors ${page === 1 ? 'bg-primary' : 'bg-primary/30'}`} />
          <div className={`w-2 h-2 rounded-full transition-colors ${page === 2 ? 'bg-primary' : 'bg-primary/30'}`} />
          <span className="font-body text-xs text-muted-foreground ml-1">Step {page} of 2</span>
        </div>

        {page === 1 ? (
          <>
            <h2 id="onboarding-title" className="font-display text-xl font-semibold text-foreground mb-2">
              Let's get to know you
            </h2>
            <p className="font-body text-sm text-muted-foreground mb-5 leading-relaxed">
              This helps Clara personalise the conversation and remember you for next time.
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block font-body text-sm font-medium text-foreground mb-1.5">
                  Your name <span className="text-red-400">*</span>
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
                  Age <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="e.g. 74"
                  min="1"
                  max="120"
                  className="w-full border border-border rounded-lg px-3 py-2.5 font-body text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground/50"
                />
              </div>

              <div>
                <label className="block font-body text-sm font-medium text-foreground mb-1.5">
                  Gender
                </label>
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
                <label className="block font-body text-sm font-medium text-foreground mb-1">
                  Trusted contact's name
                </label>
                <p className="font-body text-xs text-muted-foreground mb-1.5">
                  The family member who will review this information (e.g. your son or daughter)
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
              onClick={handleProfileNext}
              disabled={!canAdvance}
              className="w-full flex items-center justify-center gap-2 bg-accent text-white font-body font-semibold py-3 rounded-lg transition-all duration-200 hover:bg-primary disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
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
              Clara will have a gentle conversation to help organise important family information.
              Please read and agree to the following before starting.
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

            <p className="font-body text-xs text-muted-foreground mb-5 leading-relaxed border-l-2 border-border pl-3">
              The person speaking with Clara must have the capacity to consent and must be doing so
              voluntarily. ClearNest must not be used coercively.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setPage(1)}
                className="flex-shrink-0 px-4 py-3 rounded-lg border border-border font-body text-sm text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Back
              </button>
              <button
                onClick={() => {
                  if (!canProceed) return;
                  saveConsent();
                  onComplete();
                }}
                disabled={!canProceed}
                className="flex-1 bg-accent text-white font-body font-semibold py-3 rounded-lg transition-all duration-200 hover:bg-primary disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
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

// ─── Post-onboarding prompt — offers Clara or Dashboard ───────────────────────
function ClaraPromptModal({
  onStartClara,
  onDashboard,
}: {
  onStartClara: () => void;
  onDashboard: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="clara-prompt-title"
    >
      <div className="bg-background rounded-2xl shadow-2xl max-w-sm w-full p-7 text-center">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ backgroundColor: '#EBF2F8' }}
        >
          <Mic className="w-7 h-7 text-primary" />
        </div>

        <h2 id="clara-prompt-title" className="font-display text-xl font-semibold text-foreground mb-2">
          You're all set
        </h2>
        <p className="font-body text-sm text-muted-foreground mb-6 leading-relaxed">
          Would you like to start talking to Clara now, or head straight to the dashboard?
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={onStartClara}
            className="w-full flex items-center justify-center gap-2 bg-accent text-white font-body font-semibold py-3 rounded-lg transition-all duration-200 hover:bg-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <Mic className="w-4 h-4" />
            Start talking to Clara
          </button>
          <button
            onClick={onDashboard}
            className="w-full flex items-center justify-center gap-2 border border-border text-foreground font-body font-medium py-3 rounded-lg transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <LayoutDashboard className="w-4 h-4" />
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Card style ───────────────────────────────────────────────────────────────
const cardStyle: React.CSSProperties = {
  borderLeft: 'none',
  boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
  borderRadius: '12px',
};

// ─── Landing page ─────────────────────────────────────────────────────────────
const Landing = () => {
  const navigate = useNavigate();
  const [connecting, setConnecting] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showClaraPrompt, setShowClaraPrompt] = useState(false);

  // Recompute on each render so state reflects localStorage changes mid-session
  const onboarded = isOnboarded();

  const goToConversation = () => {
    setShowClaraPrompt(false);
    setConnecting(true);
    setTimeout(() => navigate('/conversation'), 900);
  };

  const handleStartTalking = () => {
    if (!onboarded || connecting) return;
    goToConversation();
  };

  const handleOpenDashboard = () => {
    if (onboarded) {
      navigate('/dashboard');
    } else {
      setShowOnboarding(true);
    }
  };

  // Called when user finishes both onboarding steps
  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    setShowClaraPrompt(true);
  };

  return (
    <div className="h-screen overflow-hidden bg-background flex flex-col items-center justify-center px-6">
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

      {/* Logo & Tagline */}
      <div className="text-center mb-10">
        <div className="flex justify-center mb-3">
          <ClearNestLogo />
        </div>
        <p className="font-body text-muted-foreground text-base tracking-wide">
          A gentle way to get organised.
        </p>
        <p className="font-body text-sm mt-2 max-w-md mx-auto leading-relaxed" style={{ color: '#9CA3AF' }}>
          Clara gently helps you and your family organise what matters most.
        </p>
      </div>

      {/* Cards */}
      <div className="flex flex-row gap-5 w-full max-w-2xl items-stretch">

        {/* ── Elderly card ── */}
        <button
          onClick={handleStartTalking}
          disabled={!onboarded || connecting}
          className={`cn-card flex-1 flex flex-col items-center text-center p-8 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
            onboarded
              ? 'group hover:scale-[1.01] cursor-pointer'
              : 'cursor-default opacity-60'
          } ${connecting ? 'cursor-wait' : ''}`}
          style={cardStyle}
          aria-label={onboarded ? 'Start talking to Clara' : 'Complete setup to unlock'}
        >
          <div
            className={`w-14 h-14 rounded-full flex items-center justify-center mb-5 transition-colors duration-200 ${onboarded ? 'group-hover:bg-primary/20' : ''}`}
            style={{ backgroundColor: '#EBF2F8' }}
          >
            {onboarded
              ? <Mic className="w-7 h-7 text-primary" />
              : <Lock className="w-6 h-6 text-primary/60" />
            }
          </div>

          <h2 className="font-display text-xl font-semibold text-foreground mb-2">
            I'd like to have a chat
          </h2>
          <p className="font-body text-muted-foreground text-sm mb-8 leading-relaxed">
            {onboarded
              ? 'For Mum, Dad, or a loved one'
              : 'Complete setup via Open Dashboard first'}
          </p>

          <div className="flex-1" />

          <div
            className={`w-full flex flex-col items-center justify-center gap-3 font-bold transition-all duration-200 text-white ${
              connecting
                ? 'bg-primary/70'
                : onboarded
                  ? 'bg-accent group-hover:bg-primary'
                  : 'bg-muted-foreground/30'
            }`}
            style={{
              padding: '32px 24px',
              minHeight: '110px',
              fontSize: '24px',
              lineHeight: '1.3',
              borderRadius: '8px',
            }}
          >
            {connecting ? (
              <>
                <Loader2 className="w-8 h-8 animate-spin" />
                <span>Connecting</span>
                <span>to Clara…</span>
              </>
            ) : onboarded ? (
              <>
                <Mic className="w-8 h-8 mb-1" />
                <span>Start Talking</span>
                <span>to Clara</span>
              </>
            ) : (
              <>
                <Lock className="w-7 h-7 mb-1 opacity-70" />
                <span style={{ fontSize: '16px' }}>Setup required</span>
              </>
            )}
          </div>
        </button>

        {/* ── Divider ── */}
        <div className="flex flex-col items-center justify-center gap-3 flex-shrink-0 px-1">
          <div className="w-px flex-1 bg-border" />
          <span
            className="text-sm font-semibold uppercase tracking-widest font-body"
            style={{ color: '#F4A261' }}
          >
            or
          </span>
          <div className="w-px flex-1 bg-border" />
        </div>

        {/* ── Family card ── */}
        <div className="cn-card flex-1 flex flex-col items-center text-center p-8" style={cardStyle}>
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mb-5"
            style={{ backgroundColor: '#EBF2F8' }}
          >
            <LayoutDashboard className="w-7 h-7 text-primary" />
          </div>

          <h2 className="font-display text-xl font-semibold text-foreground mb-2">
            I'm supporting a family member
          </h2>
          <p className="font-body text-muted-foreground text-sm mb-6 leading-relaxed">
            {onboarded
              ? 'View the family summary and next steps'
              : 'Start here to set up your profile'}
          </p>

          <ul className="text-left w-full space-y-3 mb-8 flex-1">
            {(onboarded
              ? ['See what Clara has captured', 'Track what still needs doing', 'Share with family']
              : ['Enter your details', 'Review and agree to terms', 'Unlock Start Talking to Clara']
            ).map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm font-body text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: '#5B8DB8' }} />
                {item}
              </li>
            ))}
          </ul>

          <button
            onClick={handleOpenDashboard}
            className="w-full flex items-center justify-center gap-3 bg-accent text-white font-body font-semibold transition-colors duration-200 hover:bg-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            style={{ padding: '18px 24px', fontSize: '18px', borderRadius: '8px' }}
          >
            <LayoutDashboard className="w-5 h-5 flex-shrink-0" />
            {onboarded ? 'Open Dashboard' : 'Get Started'}
          </button>
        </div>

      </div>

      <p className="mt-6 text-base text-muted-foreground text-center max-w-sm leading-relaxed font-body">
        ClearNest never stores your information on our servers. Everything stays with your family.
      </p>

    </div>
  );
};

export default Landing;
