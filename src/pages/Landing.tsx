import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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

// ─── Onboarding modal (profile + T&Cs) — triggered from Open Dashboard ───────
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
                  <Link
                    to="/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-2 hover:opacity-80"
                  >
                    Terms of Service
                  </Link>
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
                  <Link
                    to="/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-2 hover:opacity-80"
                  >
                    Privacy Policy
                  </Link>
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

const cardStyle: React.CSSProperties = {
  borderLeft: 'none',
  boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
  borderRadius: '12px',
};

const Landing = () => {
  const navigate = useNavigate();
  const [connecting, setConnecting] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showClaraPrompt, setShowClaraPrompt] = useState(false);

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

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    setShowClaraPrompt(true);
  };

  return (
    <div className="min-h-dvh overflow-y-auto bg-background flex flex-col items-center justify-center px-4 py-8 sm:px-6 sm:py-10 pb-[max(2rem,env(safe-area-inset-bottom))]">
      {showOnboarding && (
        <OnboardingModal
          onComplete={handleOnboardingComplete}
          onClose={() => setShowOnboarding(false)}
        />
      )}

      {showClaraPrompt && (
        <ClaraPromptModal
          onStartClara={goToConversation}
          onDashboard={() => {
            setShowClaraPrompt(false);
            navigate('/dashboard');
          }}
        />
      )}

      <div className="text-center mb-8 sm:mb-10 w-full max-w-lg">
        <div className="flex justify-center mb-3">
          <ClearNestLogo />
        </div>
        <p className="font-body text-muted-foreground text-base tracking-wide">A gentle way to get organised.</p>
        <p className="font-body text-sm mt-2 mx-auto leading-relaxed text-muted-foreground max-w-md">
          When the important details live in one person&apos;s head, the load lands on the family.
          Clara helps you get it down—together, at an easy pace.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-5 w-full max-w-2xl items-stretch">
        <button
          type="button"
          onClick={handleStartTalking}
          disabled={!onboarded || connecting}
          className={`cn-card flex-1 flex flex-col items-center text-center p-6 sm:p-8 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:hover:scale-[1.01] active:scale-[0.99] md:active:scale-100 ${
            onboarded ? 'group cursor-pointer' : 'cursor-default opacity-60'
          } ${connecting ? 'cursor-wait' : ''}`}
          style={cardStyle}
          aria-label={onboarded ? 'Start talking to Clara' : 'Complete setup to unlock'}
        >
          <div
            className={`w-14 h-14 rounded-full flex items-center justify-center mb-5 transition-colors duration-200 ${
              onboarded ? 'bg-primary/10 group-hover:bg-primary/20' : 'bg-muted'
            }`}
          >
            {onboarded ? (
              <Mic className="w-7 h-7 text-primary" />
            ) : (
              <Lock className="w-6 h-6 text-primary/60" />
            )}
          </div>

          <h2 className="font-display text-xl font-semibold text-foreground mb-2">I&apos;d like to have a chat</h2>
          <p className="font-body text-muted-foreground text-sm mb-6 sm:mb-8 leading-relaxed">
            {onboarded ? 'For Mum, Dad, or a loved one' : 'Complete setup via Open Dashboard first'}
          </p>

          <div className="flex-1 min-h-0 w-full" />

          <div
            className={`w-full flex flex-col items-center justify-center gap-2 sm:gap-3 font-bold transition-all duration-200 text-lg sm:text-2xl leading-snug rounded-lg ${
              connecting
                ? 'bg-primary/80 text-primary-foreground'
                : onboarded
                  ? 'bg-primary text-primary-foreground group-hover:bg-accent'
                  : 'bg-muted-foreground/30 text-primary-foreground'
            }`}
            style={{
              padding: 'clamp(1.25rem,4vw,2rem) clamp(1rem,3vw,1.5rem)',
              minHeight: '100px',
              borderRadius: '8px',
            }}
          >
            {connecting ? (
              <>
                <Loader2 className="w-7 h-7 sm:w-8 sm:h-8 animate-spin" aria-hidden />
                <span>Connecting</span>
                <span>to Clara…</span>
              </>
            ) : onboarded ? (
              <>
                <Mic className="w-7 h-7 sm:w-8 sm:h-8 mb-0.5" aria-hidden />
                <span>Start Talking</span>
                <span>to Clara</span>
              </>
            ) : (
              <>
                <Lock className="w-7 h-7 mb-1 opacity-70" aria-hidden />
                <span className="text-base font-semibold">Setup required</span>
              </>
            )}
          </div>
        </button>

        <div className="flex md:hidden items-center gap-3 w-full shrink-0 py-0.5" aria-hidden>
          <div className="h-px flex-1 bg-border" />
          <span className="text-sm font-semibold uppercase tracking-widest font-body text-alert shrink-0">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <div
          className="hidden md:flex flex-col items-center justify-center gap-3 flex-shrink-0 px-1 w-auto self-stretch min-h-[200px]"
          aria-hidden
        >
          <div className="w-px flex-1 bg-border min-h-[40px]" />
          <span className="text-sm font-semibold uppercase tracking-widest font-body text-alert">or</span>
          <div className="w-px flex-1 bg-border min-h-[40px]" />
        </div>

        <div className="cn-card flex-1 flex flex-col items-center text-center p-6 sm:p-8" style={cardStyle}>
          <div className="w-14 h-14 rounded-full flex items-center justify-center mb-5 bg-primary/10">
            <LayoutDashboard className="w-7 h-7 text-primary" />
          </div>

          <h2 className="font-display text-xl font-semibold text-foreground mb-2">I&apos;m supporting a family member</h2>
          <p className="font-body text-muted-foreground text-sm mb-6 leading-relaxed">
            {onboarded ? 'View the family summary and next steps' : 'Start here to set up your profile'}
          </p>

          <ul className="text-left w-full space-y-3 mb-6 sm:mb-8 flex-1">
            {(onboarded
              ? ['See what Clara has captured', 'Track what still needs doing', 'Share with family']
              : ['Enter your details', 'Review and agree to terms', 'Unlock Start Talking to Clara']
            ).map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm font-body text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-primary" aria-hidden />
                {item}
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={handleOpenDashboard}
            className="w-full min-h-[48px] flex items-center justify-center gap-3 bg-primary text-primary-foreground font-body font-semibold text-base transition-colors duration-200 hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg py-4 px-6"
          >
            <LayoutDashboard className="w-5 h-5 flex-shrink-0" />
            {onboarded ? 'Open Dashboard' : 'Get Started'}
          </button>
        </div>
      </div>

      <p className="mt-6 sm:mt-8 text-base text-muted-foreground text-center max-w-md leading-relaxed font-body px-1">
        ClearNest never stores your information on our servers. Everything stays with your family.
      </p>

      <footer className="mt-6 mb-2 text-center font-body max-w-md px-1">
        <p className="text-xs text-muted-foreground mb-1">
          Not legal or financial advice. ClearNest is an organisational tool only.
        </p>
        <p className="text-xs text-muted-foreground">
          © 2026 Pannonl Ltd ·{' '}
          <a href="/admin" className="underline underline-offset-2 hover:opacity-80">
            Admin
          </a>
          {' '}·{' '}
          <Link to="/privacy" className="underline underline-offset-2 hover:opacity-80">
            Privacy Policy
          </Link>
          {' '}·{' '}
          <Link to="/terms" className="underline underline-offset-2 hover:opacity-80">
            Terms of Service
          </Link>
          {' '}·{' '}
          <Link to="/safeguarding" className="underline underline-offset-2 hover:opacity-80">
            Safeguarding
          </Link>
        </p>
      </footer>
    </div>
  );
};

export default Landing;
