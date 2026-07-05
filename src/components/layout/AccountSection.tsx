// "Account" block in My Preferences: change the login email and password. Email
// changes are verified (Supabase mails a confirmation link to the new address);
// password changes re-verify the current password when the account has one.
// Rendered only on real Supabase auth (the caller gates out demo mode).
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Forms';

type Msg = { ok: boolean; text: string } | null;

export function AccountSection() {
  const { user, updateEmail, updatePassword } = useAuth();
  // Whether the account already has an email/password identity (vs. OAuth-only).
  const hasPassword = !!user?.identities?.some((i) => i.provider === 'email');

  const [emailOpen, setEmailOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMsg, setEmailMsg] = useState<Msg>(null);

  const [pwOpen, setPwOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<Msg>(null);

  const resetPw = () => {
    setPwOpen(false);
    setCurrentPw('');
    setNewPw('');
    setConfirmPw('');
  };

  const submitEmail = async () => {
    setEmailBusy(true);
    setEmailMsg(null);
    const { error } = await updateEmail(newEmail);
    setEmailBusy(false);
    if (error) {
      setEmailMsg({ ok: false, text: error });
      return;
    }
    setEmailMsg({
      ok: true,
      text: `Verification link sent to ${newEmail.trim()}. Open it from that inbox to finish the change — your current email keeps working until then.`
    });
    setEmailOpen(false);
    setNewEmail('');
  };

  const submitPassword = async () => {
    if (newPw !== confirmPw) {
      setPwMsg({ ok: false, text: 'The new passwords don’t match.' });
      return;
    }
    setPwBusy(true);
    setPwMsg(null);
    const { error } = await updatePassword(
      newPw,
      hasPassword ? currentPw : undefined
    );
    setPwBusy(false);
    if (error) {
      setPwMsg({ ok: false, text: error });
      return;
    }
    setPwMsg({ ok: true, text: hasPassword ? 'Password updated.' : 'Password set.' });
    resetPw();
  };

  return (
    <div>
      <p className="text-sm font-medium text-text-primary mb-1">Account</p>
      <p className="text-xs text-text-secondary mb-3">
        Your sign-in email and password.
      </p>

      {/* Login email */}
      <div className="rounded-lg border border-border px-3 py-2.5 mb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-text-secondary">Login email</p>
            <p className="text-sm text-text-primary truncate">
              {user?.email ?? '—'}
            </p>
          </div>
          {!emailOpen &&
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEmailOpen(true);
              setEmailMsg(null);
            }}>

              Change
            </Button>
          }
        </div>
        {emailOpen &&
        <div className="mt-3 space-y-2">
            <Input
            type="email"
            placeholder="New email address"
            autoComplete="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)} />

            <div className="flex justify-end gap-2">
              <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEmailOpen(false);
                setNewEmail('');
              }}>

                Cancel
              </Button>
              <Button
              size="sm"
              onClick={submitEmail}
              disabled={emailBusy || !newEmail.trim()}>

                {emailBusy ? 'Sending…' : 'Send verification'}
              </Button>
            </div>
          </div>
        }
        {emailMsg &&
        <p
          className={`text-xs mt-2 ${
          emailMsg.ok ? 'text-[#3E7B52]' : 'text-[#9B3A3A]'}`
          }>

            {emailMsg.text}
          </p>
        }
      </div>

      {/* Password */}
      <div className="rounded-lg border border-border px-3 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-text-secondary">Password</p>
            <p className="text-sm text-text-primary">
              {hasPassword ? '••••••••' : 'Not set'}
            </p>
          </div>
          {!pwOpen &&
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setPwOpen(true);
              setPwMsg(null);
            }}>

              {hasPassword ? 'Change' : 'Set password'}
            </Button>
          }
        </div>
        {pwOpen &&
        <div className="mt-3 space-y-2">
            {hasPassword &&
          <Input
            type="password"
            placeholder="Current password"
            autoComplete="current-password"
            value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)} />
          }
            <Input
            type="password"
            placeholder="New password (min 8 characters)"
            autoComplete="new-password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)} />

            <Input
            type="password"
            placeholder="Confirm new password"
            autoComplete="new-password"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)} />

            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={resetPw}>
                Cancel
              </Button>
              <Button
              size="sm"
              onClick={submitPassword}
              disabled={
              pwBusy ||
              newPw.length < 8 ||
              !confirmPw ||
              hasPassword && !currentPw
              }>

                {pwBusy ? 'Saving…' : 'Save password'}
              </Button>
            </div>
          </div>
        }
        {pwMsg &&
        <p
          className={`text-xs mt-2 ${
          pwMsg.ok ? 'text-[#3E7B52]' : 'text-[#9B3A3A]'}`
          }>

            {pwMsg.text}
          </p>
        }
      </div>
    </div>);

}
