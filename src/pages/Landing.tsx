import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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

// ─── Themes (mirrors Dashboard.tsx THEME_COLORS keys) ────────────────────────
const THEME_KEY = 'cn-theme-v1';
export type Theme = 'default' | 'dark' | 'orange';

const THEMES: Record<Theme, {
  pageBg: string; greetingColor: string; blobs: [string, string, string];
  cardBg: string; cardBorder: string; cardShadow: string; cardHoverShadow: string;
  cardTextPrimary: string; cardTextSecondary: string;
  dashTextColor: string; dashIconColor: string;
  footerBg: string; footerText: string; swatchBg: string; swatchLabel: string;
}> = {
  default: {
    pageBg: '#e1f1fd',
    greetingColor: '#1e2d4f',
    blobs: ['rgba(70,99,172,0.14)', 'rgba(70,99,172,0.08)', 'rgba(70,99,172,0.07)'],
    cardBg: 'rgba(255,255,255,0.28)',
    cardBorder: 'rgba(255,255,255,0.58)',
    cardShadow: '0 14px 44px rgba(70,99,172,0.12),0 2px 8px rgba(70,99,172,0.06),inset 0 1.5px 0 rgba(255,255,255,0.72)',
    cardHoverShadow: '0 24px 64px rgba(70,99,172,0.20),inset 0 1.5px 0 rgba(255,255,255,0.78)',
    cardTextPrimary: 'rgba(30,45,79,0.92)',
    cardTextSecondary: 'rgba(46,62,107,0.52)',
    dashTextColor: 'rgba(30,45,79,0.88)',
    dashIconColor: 'rgba(30,45,79,0.65)',
    footerBg: 'rgba(200,217,237,0.72)',
    footerText: 'rgba(30,45,79,0.55)',
    swatchBg: '#4663ac',
    swatchLabel: 'Default',
  },
  orange: {
    pageBg: '#fdf0e8',
    greetingColor: '#5c2229',
    blobs: ['rgba(199,98,91,0.15)', 'rgba(240,143,92,0.10)', 'rgba(199,98,91,0.08)'],
    cardBg: 'rgba(255,255,255,0.30)',
    cardBorder: 'rgba(255,255,255,0.62)',
    cardShadow: '0 14px 44px rgba(156,55,66,0.12),0 2px 8px rgba(156,55,66,0.06),inset 0 1.5px 0 rgba(255,255,255,0.74)',
    cardHoverShadow: '0 24px 64px rgba(156,55,66,0.20),inset 0 1.5px 0 rgba(255,255,255,0.80)',
    cardTextPrimary: 'rgba(92,34,41,0.90)',
    cardTextSecondary: 'rgba(92,34,41,0.50)',
    dashTextColor: 'rgba(92,34,41,0.88)',
    dashIconColor: 'rgba(92,34,41,0.62)',
    footerBg: 'rgba(242,159,121,0.28)',
    footerText: 'rgba(92,34,41,0.60)',
    swatchBg: '#d87458',
    swatchLabel: 'Orange',
  },
  dark: {
    pageBg: '#0d0f1a',
    greetingColor: '#a78bfa',
    blobs: ['rgba(167,139,250,0.18)', 'rgba(94,207,207,0.09)', 'rgba(167,139,250,0.10)'],
    cardBg: 'rgba(255,255,255,0.055)',
    cardBorder: 'rgba(255,255,255,0.11)',
    cardShadow: '0 14px 44px rgba(0,0,0,0.42),0 2px 8px rgba(0,0,0,0.22),inset 0 1.5px 0 rgba(255,255,255,0.07)',
    cardHoverShadow: '0 24px 64px rgba(0,0,0,0.58),inset 0 1.5px 0 rgba(255,255,255,0.10)',
    cardTextPrimary: 'rgba(240,234,255,0.95)',
    cardTextSecondary: 'rgba(200,185,240,0.50)',
    dashTextColor: 'rgba(240,234,255,0.90)',
    dashIconColor: 'rgba(240,234,255,0.72)',
    footerBg: 'rgba(13,15,26,0.88)',
    footerText: 'rgba(167,139,250,0.55)',
    swatchBg: '#1a1c2e',
    swatchLabel: 'Dark',
  },
};

function loadTheme(): Theme {
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (t === 'default' || t === 'orange' || t === 'dark') return t;
  } catch { /* ignore */ }
  return 'default';
}

function saveTheme(t: Theme) {
  try { localStorage.setItem(THEME_KEY, t); } catch { /* ignore */ }
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
  const [theme, setTheme] = useState<Theme>(loadTheme);

  const t = THEMES[theme];

  const handleTheme = (next: Theme) => {
    setTheme(next);
    saveTheme(next);
  };

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
    <div style={{ minHeight: '100dvh', background: t.pageBg, position: 'relative', overflow: 'hidden', fontFamily: "'Figtree', system-ui, sans-serif", transition: 'background 0.4s ease' }}>
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
      `}</style>

      {/* Background blobs */}
      <div style={{ position: 'fixed', borderRadius: '50%', filter: 'blur(130px)', pointerEvents: 'none', zIndex: 0, width: 700, height: 700, background: t.blobs[0], top: -200, right: '15%', transition: 'background 0.4s ease' }} />
      <div style={{ position: 'fixed', borderRadius: '50%', filter: 'blur(130px)', pointerEvents: 'none', zIndex: 0, width: 500, height: 500, background: t.blobs[1], bottom: -100, right: '48%', transition: 'background 0.4s ease' }} />
      <div style={{ position: 'fixed', borderRadius: '50%', filter: 'blur(130px)', pointerEvents: 'none', zIndex: 0, width: 380, height: 380, background: t.blobs[2], top: '30%', left: 20, transition: 'background 0.4s ease' }} />

      {/* Modals */}
      {showOnboarding && (
        <OnboardingModal onComplete={handleOnboardingComplete} onClose={() => setShowOnboarding(false)} />
      )}
      {showClaraPrompt && (
        <ClaraPromptModal
          onStartClara={goToConversation}
          onDashboard={() => { setShowClaraPrompt(false); navigate('/dashboard'); }}
        />
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

      {/* Theme switcher — top right */}
      <div style={{
        position: 'fixed', top: 24, right: 28, zIndex: 10,
        display: 'flex', alignItems: 'center', gap: 8,
        animation: 'cnLandingFadeDown 0.5s cubic-bezier(0.22,1,0.36,1) 0.15s both',
      }}>
        {(['default', 'orange', 'dark'] as Theme[]).map(th => (
          <button
            key={th}
            type="button"
            onClick={() => handleTheme(th)}
            title={THEMES[th].swatchLabel}
            style={{
              width: 22, height: 22, borderRadius: '50%',
              background: THEMES[th].swatchBg,
              border: theme === th ? '2.5px solid rgba(255,255,255,0.90)' : '2.5px solid transparent',
              outline: theme === th ? `2.5px solid ${THEMES[th].swatchBg}` : 'none',
              outlineOffset: '2px',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              padding: 0,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.2)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
          />
        ))}
      </div>

      {/* Scene */}
      <div style={{
        position: 'relative', zIndex: 1,
        minHeight: '100dvh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'clamp(80px, 8vw, 120px) clamp(32px, 7vw, 140px) clamp(48px, 4vw, 80px)',
        gap: 'clamp(24px, 3vw, 48px)',
        flexWrap: 'wrap',
      }}>

        {/* Greeting */}
        <div style={{
          fontSize: 'clamp(72px, 10vw, 148px)',
          fontWeight: 900,
          lineHeight: 1.0,
          color: t.greetingColor,
          flex: '1 1 0',
          minWidth: 0,
          letterSpacing: '-3px',
          whiteSpace: 'pre-line',
          animation: 'cnLandingSlideLeft 0.7s cubic-bezier(0.22,1,0.36,1) 0.1s both',
          transition: 'color 0.4s ease',
        }}>
          {greeting}
        </div>

        {/* Cards column */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 20,
          flex: '1 1 0',
          minWidth: 'min(100%, 360px)',
          maxWidth: 520,
          animation: 'cnLandingSlideRight 0.7s cubic-bezier(0.22,1,0.36,1) 0.25s both',
        }}>

          {/* Clara card — crystal glass */}
          <div
            onClick={handleClaraCard}
            style={{
              position: 'relative',
              background: t.cardBg,
              backdropFilter: 'blur(32px) saturate(1.6)',
              WebkitBackdropFilter: 'blur(32px) saturate(1.6)',
              border: `1px solid ${t.cardBorder}`,
              borderRadius: 32, padding: '48px 28px 44px',
              overflow: 'hidden', cursor: connecting ? 'wait' : 'pointer',
              minHeight: 580,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              textAlign: 'center',
              boxShadow: t.cardShadow,
              transition: 'transform 0.22s cubic-bezier(0.22,1,0.36,1), box-shadow 0.22s ease, background 0.4s ease',
            }}
            onMouseEnter={e => {
              const d = e.currentTarget as HTMLDivElement;
              d.style.transform = 'translateY(-4px) scale(1.012)';
              d.style.boxShadow = t.cardHoverShadow;
            }}
            onMouseLeave={e => {
              const d = e.currentTarget as HTMLDivElement;
              d.style.transform = 'translateY(0) scale(1)';
              d.style.boxShadow = t.cardShadow;
            }}
          >
            {/* Decorative arcs */}
            <div style={{ position: 'absolute', top: -20, right: -20, width: 140, height: 140, pointerEvents: 'none' }}>
              {[
                { size: 118, color: 'rgba(94,207,207,0.40)', rot: -22 },
                { size: 82,  color: 'rgba(255,255,255,0.30)', rot: -8  },
                { size: 52,  color: 'rgba(200,180,255,0.45)', rot:  6  },
              ].map((arc, i) => (
                <div key={i} style={{
                  position: 'absolute',
                  width: arc.size, height: arc.size, borderRadius: '50%',
                  border: '4px solid transparent',
                  borderTopColor: arc.color, borderRightColor: arc.color,
                  top: (118 - arc.size) / 2 + 11, right: (118 - arc.size) / 2 + 11,
                  transform: `rotate(${arc.rot}deg)`,
                }} />
              ))}
            </div>

            <ClaraSphere size={160} />

            <div style={{ fontSize: 38, fontWeight: 900, lineHeight: 1.15, color: t.cardTextPrimary, marginTop: 20, marginBottom: 8, position: 'relative', zIndex: 1, transition: 'color 0.4s ease' }}>
              {connecting ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                  <Loader2 style={{ width: 28, height: 28, animation: 'spin 1s linear infinite' }} />
                  Connecting…
                </span>
              ) : (
                <><span style={{ color: '#5ECFCF' }}>Chat</span> to Clara</>
              )}
            </div>

            <div style={{ fontSize: 15, color: t.cardTextSecondary, fontWeight: 400, position: 'relative', zIndex: 1, transition: 'color 0.4s ease' }}>
              {claraSubtitle}
            </div>
          </div>

          {/* Dashboard — crystal glass */}
          <div
            onClick={handleDashboard}
            style={{
              position: 'relative',
              background: t.cardBg,
              backdropFilter: 'blur(32px) saturate(1.6)',
              WebkitBackdropFilter: 'blur(32px) saturate(1.6)',
              border: `1px solid ${t.cardBorder}`,
              borderRadius: 28, padding: '26px 32px',
              display: 'flex', alignItems: 'center', gap: 20,
              cursor: 'pointer',
              boxShadow: t.cardShadow,
              transition: 'transform 0.22s cubic-bezier(0.22,1,0.36,1), box-shadow 0.22s ease, background 0.4s ease',
            }}
            onMouseEnter={e => {
              const d = e.currentTarget as HTMLDivElement;
              d.style.transform = 'translateY(-3px) scale(1.012)';
              d.style.boxShadow = t.cardHoverShadow;
            }}
            onMouseLeave={e => {
              const d = e.currentTarget as HTMLDivElement;
              d.style.transform = 'translateY(0) scale(1)';
              d.style.boxShadow = t.cardShadow;
            }}
          >
            <div style={{ width: 34, height: 34, flexShrink: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
              {[0,1,2,3].map(i => (
                <span key={i} style={{ background: t.dashIconColor, borderRadius: 5, display: 'block', transition: 'background 0.4s ease' }} />
              ))}
            </div>
            <span style={{ fontSize: 22, fontWeight: 900, color: t.dashTextColor, letterSpacing: 1.5, transition: 'color 0.4s ease' }}>DASHBOARD</span>
          </div>

        </div>
      </div>

      {/* Footer */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 2,
        padding: '10px 24px', textAlign: 'center',
        background: t.footerBg, backdropFilter: 'blur(10px)',
        transition: 'background 0.4s ease',
      }}>
        <p style={{ fontSize: 11, color: t.footerText, margin: 0, transition: 'color 0.4s ease' }}>
          Not legal or financial advice. ClearNest is an organisational tool only. &nbsp;·&nbsp;
          <a href="/admin" style={{ color: 'inherit', textDecoration: 'underline' }}>Admin</a>
          &nbsp;·&nbsp;
          <Link to="/privacy" style={{ color: 'inherit', textDecoration: 'underline' }}>Privacy</Link>
          &nbsp;·&nbsp;
          <Link to="/terms" style={{ color: 'inherit', textDecoration: 'underline' }}>Terms</Link>
          &nbsp;·&nbsp;
          <Link to="/safeguarding" style={{ color: 'inherit', textDecoration: 'underline' }}>Safeguarding</Link>
        </p>
      </div>
    </div>
  );
};

export default Landing;
