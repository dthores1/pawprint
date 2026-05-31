import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Input, Label } from '../components/ui/Forms';
import { Button } from '../components/ui/Button';
import { LogoHero } from '../components/ui/Logo';

// Minimum password length for sign-up. Mirror this with the Supabase Dashboard
// setting (Authentication → Providers → Email → "Minimum password length") so
// the client-side check and the server-side policy stay in sync. No additional
// character-class requirements are enforced (dashboard requirements = "None").
const MIN_PASSWORD_LENGTH = 8;

// Inline Google "G" so we don't pull in a brand-icon dependency.
function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 18 18" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62Z" />

      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />

      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />

      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A8.96 8.96 0 0 0 9 0 9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />

    </svg>);

}

// Password input with a show/hide eye toggle. Visibility is controlled by the
// parent so the password + confirm fields reveal together. The toggle is
// type="button" so it never submits the form.
function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  show,
  onToggleShow,
  hint
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  show: boolean;
  onToggleShow: () => void;
  hint?: string;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pr-10"
          required />

        <button
          type="button"
          onClick={onToggleShow}
          tabIndex={-1}
          aria-label={show ? 'Hide password' : 'Show password'}
          aria-pressed={show}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-text-secondary hover:text-text-primary transition-colors">

          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {hint &&
      <p className="mt-1.5 text-xs text-text-secondary">{hint}</p>
      }
    </div>);

}

export function Login() {
  const { signInWithGoogle, signInWithPassword, signUpWithPassword } =
  useAuth();
  // When arriving from an invite link (AcceptInvitePage), prefill the invited
  // email and start in sign-up mode — most invitees are creating a new account.
  const location = useLocation();
  const inviteState = location.state as
  { email?: string; fromInvite?: boolean } | null;
  // Self-service sign-up is disabled during the beta — accounts can only create
  // value via an org, and org creation is gated. So the email sign-up path is
  // offered ONLY to people coming from a valid invite. We detect that via the
  // nav state OR a stashed pending invite token (the latter survives a refresh
  // of /login, where nav state would be lost). Everyone else gets sign-in +
  // "Request access". Google sign-in stays available to all (a cold Google
  // sign-up with no org just lands on the honest no-access screen).
  const hasPendingInvite =
  typeof localStorage !== 'undefined' &&
  !!localStorage.getItem('whiskerville.pendingInviteToken');
  const canSignUp = Boolean(inviteState?.fromInvite) || hasPendingInvite;
  const [mode, setMode] = useState<'signin' | 'signup'>(
    canSignUp ? 'signup' : 'signin'
  );
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState(inviteState?.email ?? '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    if (mode === 'signin') {
      const { error } = await signInWithPassword(email, password);
      if (error) setError(error);
    } else {
      if (password.length < MIN_PASSWORD_LENGTH) {
        setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
        setBusy(false);
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords don't match.");
        setBusy(false);
        return;
      }
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
      const { error, needsConfirmation } = await signUpWithPassword(
        email,
        password,
        fullName || undefined
      );
      if (error) setError(error);
      else if (needsConfirmation) setConfirmSent(true);
      // If confirmation is disabled, the session arrives and the gate advances.
    }
    setBusy(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <LogoHero className="w-44" />
        </div>

        <div className="bg-card rounded-2xl shadow-soft-lg border border-border p-7">
          {confirmSent ?
          <div className="text-center py-4">
              <h1 className="text-xl font-heading font-bold text-text-primary mb-2">
                Check your email
              </h1>
              <p className="text-sm text-text-secondary">
                We sent a confirmation link to{' '}
                <span className="font-medium text-text-primary">{email}</span>.
                Confirm it, then come back and sign in.
              </p>
              <button
              onClick={() => {
                setConfirmSent(false);
                setMode('signin');
              }}
              className="mt-5 text-sm font-medium text-primary hover:underline">

                Back to sign in
              </button>
            </div> :

          <>
              <h1 className="text-xl font-heading font-bold text-text-primary mb-1">
                {mode === 'signin' ? 'Welcome back' : 'Create your account'}
              </h1>
              <p className="text-sm text-text-secondary mb-6">
                {mode === 'signin' ?
              'Sign in to manage your rescue.' :
              'Get started with Whiskerville.'}
              </p>

              <Button
              type="button"
              variant="outline"
              onClick={signInWithGoogle}
              className="w-full gap-2.5">

                <GoogleGlyph className="w-4 h-4" />
                Continue with Google
              </Button>

              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-text-secondary uppercase tracking-wider">
                  or
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'signup' &&
                <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="login_first">First name</Label>
                      <Input
                      id="login_first"
                      autoComplete="given-name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required />

                    </div>
                    <div>
                      <Label htmlFor="login_last">Last name</Label>
                      <Input
                      id="login_last"
                      autoComplete="family-name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required />

                    </div>
                  </div>
                }
                <div>
                  <Label htmlFor="login_email">Email</Label>
                  <Input
                  id="login_email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required />

                </div>
                <PasswordField
                  id="login_password"
                  label="Password"
                  value={password}
                  onChange={setPassword}
                  autoComplete={
                  mode === 'signin' ? 'current-password' : 'new-password'
                  }
                  show={showPassword}
                  onToggleShow={() => setShowPassword((s) => !s)}
                  hint={
                  mode === 'signup' ?
                  `Must be at least ${MIN_PASSWORD_LENGTH} characters.` :
                  undefined
                  } />

                {mode === 'signup' &&
                <PasswordField
                  id="login_confirm_password"
                  label="Confirm password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  autoComplete="new-password"
                  show={showConfirmPassword}
                  onToggleShow={() => setShowConfirmPassword((s) => !s)} />
                }
                {error &&
              <p className="text-sm text-[#9B3A3A]">{error}</p>
              }
                <Button type="submit" disabled={busy} className="w-full">
                  {busy ?
                'Please wait…' :
                mode === 'signin' ?
                'Sign In' :
                'Sign Up'}
                </Button>
              </form>

              {canSignUp ?
            <p className="text-sm text-text-secondary text-center mt-5">
                  {mode === 'signin' ?
              "Don't have an account? " :
              'Already have an account? '}
                  <button
                onClick={() => {
                  setMode(mode === 'signin' ? 'signup' : 'signin');
                  setError(null);
                  setConfirmPassword('');
                }}
                className="font-medium text-primary hover:underline">

                    {mode === 'signin' ? 'Sign up' : 'Sign in'}
                  </button>
                </p> :

            // Self-service sign-up is gated during the beta — prospective
            // rescues request access instead of creating an account/org.
            <p className="text-sm text-text-secondary text-center mt-5">
                  Want to use Whiskerville for your rescue?{' '}
                  <Link
                to="/request-access"
                className="font-medium text-primary hover:underline">

                    Request access
                  </Link>
                </p>
            }
            </>
          }
        </div>

        <p className="text-xs text-text-secondary text-center mt-5">
          <Link to="/terms" className="hover:underline">
            Terms of Service
          </Link>
          {' · '}
          <Link to="/privacy" className="hover:underline">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>);

}
