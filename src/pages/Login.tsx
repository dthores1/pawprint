import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Input, Label } from '../components/ui/Forms';
import { Button } from '../components/ui/Button';
import { PawPrintIcon } from 'lucide-react';

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

export function Login() {
  const { signInWithGoogle, signInWithPassword, signUpWithPassword } =
  useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
        <div className="flex items-center justify-center gap-2 text-primary mb-6">
          <PawPrintIcon className="w-9 h-9" />
          <span className="font-heading font-bold text-3xl tracking-tight">
            Pawprint
          </span>
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
              'Get started with Pawprint.'}
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
                <div>
                  <Label htmlFor="login_password">Password</Label>
                  <Input
                  id="login_password"
                  type="password"
                  autoComplete={
                  mode === 'signin' ? 'current-password' : 'new-password'
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required />

                </div>
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

              <p className="text-sm text-text-secondary text-center mt-5">
                {mode === 'signin' ?
              "Don't have an account? " :
              'Already have an account? '}
                <button
                onClick={() => {
                  setMode(mode === 'signin' ? 'signup' : 'signin');
                  setError(null);
                }}
                className="font-medium text-primary hover:underline">

                  {mode === 'signin' ? 'Sign up' : 'Sign in'}
                </button>
              </p>
            </>
          }
        </div>
      </div>
    </div>);

}
