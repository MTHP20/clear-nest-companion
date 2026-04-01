import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { ClearNestLogo } from '@/components/ClearNestLogo';
import { Eye, EyeOff, LogIn, KeyRound } from 'lucide-react';

type Stage = 'login' | 'change_password';

const AdminLogin = () => {
  const navigate = useNavigate();

  // If already authenticated, skip login and go straight to blog
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) window.location.href = '/blog.html';
    });
  }, [navigate]);

  const [stage, setStage]               = useState<Stage>('login');
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [newPassword, setNewPassword]   = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass]         = useState(false);
  const [showNew, setShowNew]           = useState(false);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);

  // ── Step 1: Sign in ────────────────────────────────────────────────────────
  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;

      const forcedChange = data.user?.user_metadata?.force_password_change === true;
      if (forcedChange) {
        setStage('change_password');
      } else {
        window.location.href = '/blog.html';
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Set new password ───────────────────────────────────────────────
  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
        data: { force_password_change: false },
      });
      if (updateError) throw updateError;
      window.location.href = '/blog.html';
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="mb-8">
        <ClearNestLogo />
      </div>

      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg border border-border p-8">

        {stage === 'login' ? (
          <>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <LogIn className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="font-display text-xl font-semibold text-foreground">Admin login</h1>
                <p className="text-xs text-muted-foreground font-body">ClearNest content management</p>
              </div>
            </div>

            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground font-body" htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@clearnest.com"
                  className="w-full border border-border rounded-lg px-3 py-2.5 text-sm font-body bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground font-body" htmlFor="password">Password</label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPass ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full border border-border rounded-lg px-3 py-2.5 pr-10 text-sm font-body bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPass ? 'Hide password' : 'Show password'}
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-600 font-body bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-accent text-white font-semibold font-body py-2.5 rounded-lg hover:bg-primary transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <LogIn className="w-4 h-4" />
                )}
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <KeyRound className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h1 className="font-display text-xl font-semibold text-foreground">Set a new password</h1>
                <p className="text-xs text-muted-foreground font-body">Required on first login</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground font-body mb-6 leading-relaxed">
              For your security, please choose a new password before continuing.
            </p>

            <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground font-body" htmlFor="new-password">New password</label>
                <div className="relative">
                  <input
                    id="new-password"
                    type={showNew ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    className="w-full border border-border rounded-lg px-3 py-2.5 pr-10 text-sm font-body bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showNew ? 'Hide password' : 'Show password'}
                  >
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground font-body" htmlFor="confirm-password">Confirm password</label>
                <input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full border border-border rounded-lg px-3 py-2.5 text-sm font-body bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 font-body bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-accent text-white font-semibold font-body py-2.5 rounded-lg hover:bg-primary transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <KeyRound className="w-4 h-4" />
                )}
                {loading ? 'Saving…' : 'Set password & continue'}
              </button>
            </form>
          </>
        )}
      </div>

      <p className="mt-6 text-xs text-muted-foreground font-body text-center">
        Admin access only · <button onClick={() => navigate('/')} className="underline underline-offset-2 hover:opacity-70">Back to home</button>
      </p>
    </div>
  );
};

export default AdminLogin;
