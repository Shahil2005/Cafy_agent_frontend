import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  signOut,
} from 'firebase/auth';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { auth } from '../../services/firebase';
import { useBilling } from '../../hooks/useBilling';
import {
  ACCOUNT_DELETE_CONFIRM_PHRASE,
  deleteMyAccount,
} from '../../services/accountService';

function getModalRoot(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return document.getElementById('modal-root') ?? document.body;
}

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function DeleteAccountModal({ open, onClose }: Props) {
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const [phrase, setPhrase] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { billing } = useBilling();

  const user = auth.currentUser;
  const isPasswordUser = Boolean(
    user?.providerData.some((p) => p.providerId === 'password')
  );
  const hasPaidSubscription = Boolean(
    billing?.isFullPremium ||
      billing?.isPremium ||
      billing?.isJobsPremium ||
      billing?.isPartTimePremium ||
      (billing?.status === 'active' &&
        billing?.plan &&
        billing.plan !== 'free')
  );

  useEffect(() => {
    setRoot(getModalRoot());
  }, []);

  useEffect(() => {
    if (!open) {
      setPhrase('');
      setPassword('');
      setError('');
      setBusy(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose, busy]);

  const phraseOk = phrase === ACCOUNT_DELETE_CONFIRM_PHRASE;

  const handleDelete = async () => {
    if (!user || !phraseOk || busy) return;
    setError('');
    setBusy(true);
    try {
      if (isPasswordUser) {
        if (!password.trim()) {
          setError('Enter your password to confirm.');
          setBusy(false);
          return;
        }
        if (!user.email) {
          setError('Missing email on this account.');
          setBusy(false);
          return;
        }
        const credential = EmailAuthProvider.credential(user.email, password);
        await reauthenticateWithCredential(user, credential);
      } else {
        const provider = new GoogleAuthProvider();
        await reauthenticateWithPopup(user, provider);
      }

      await deleteMyAccount(phrase);
      await signOut(auth);
      window.location.assign('/');
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      const message = err instanceof Error ? err.message : 'Delete failed.';
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('Password incorrect. Try again.');
      } else if (code === 'auth/popup-closed-by-user') {
        setError('Re-authentication was cancelled.');
      } else if (code === 'LEGAL_HOLD') {
        setError(message);
      } else {
        setError(message || 'Could not delete account. Contact admin@cafy.careers.');
      }
      setBusy(false);
    }
  };

  if (!root || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-account-title"
    >
      <div
        className="absolute inset-0 bg-slate-900/60"
        aria-hidden
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <div className="relative z-10 flex w-full max-w-lg max-h-[90vh] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pt-6 pb-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 ring-1 ring-red-100">
            <Trash2 size={22} />
          </div>
          <div>
            <h2 id="delete-account-title" className="text-lg font-bold text-slate-900">
              Delete your account
            </h2>
            <p className="mt-1 text-sm text-slate-600 leading-relaxed">
              This permanently removes your Cafy account data. This cannot be undone.
            </p>
          </div>
        </div>

        {hasPaidSubscription ? (
          <div className="mt-5 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900 space-y-2">
            <p className="font-bold flex items-center gap-2">
              <AlertTriangle size={16} className="shrink-0" />
              Active subscription
            </p>
            <ul className="list-disc pl-5 space-y-1 font-medium">
              <li>Your subscription will be cancelled immediately (not at period end).</li>
              <li>You will lose paid access right away.</li>
              <li>
                No refund for the unused part of the current billing period when you delete
                your account this way.
              </li>
            </ul>
          </div>
        ) : null}

        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 space-y-3">
          <p className="font-semibold text-slate-900 flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-600" />
            Removed now
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Profile, preferences, and login session</li>
            <li>Uploaded CVs and files in Cafy storage</li>
            <li>Job tracker applications and saved career tools data</li>
            <li>AI / communications history we host for your account</li>
            {hasPaidSubscription ? (
              <li>
                Paid subscription — cancelled immediately; no refund for remaining time
              </li>
            ) : (
              <li>Any active Stripe subscription (cancelled immediately; no refund)</li>
            )}
          </ul>
          <p className="font-semibold text-slate-900 pt-1">Kept (disclosed)</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Your email on a deleted-users list (blocks new signup with this email for 10 days)</li>
            <li>Stripe invoices and payment records (tax and disputes)</li>
            <li>Short-lived infrastructure backups until they expire</li>
            <li>Data already sent to employers or third-party sites</li>
          </ul>
        </div>

        {isPasswordUser ? (
          <label className="mt-5 block text-sm font-medium text-slate-700">
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              disabled={busy}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-cafy-500 focus:outline-none focus:ring-2 focus:ring-cafy-100"
            />
          </label>
        ) : (
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 space-y-2">
            <p className="font-semibold text-slate-900">Confirm with Google</p>
            <p>
              You signed up with Google, so there is no Cafy password to type. Google must
              confirm it is you before we permanently delete the account — this stops someone
              with an unlocked laptop from wiping your data.
            </p>
          </div>
        )}

        <label className="mt-4 block text-sm font-medium text-slate-700">
          Type <span className="font-mono text-red-700">{ACCOUNT_DELETE_CONFIRM_PHRASE}</span> to
          confirm
          <input
            type="text"
            value={phrase}
            disabled={busy}
            onChange={(e) => setPhrase(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
            placeholder={ACCOUNT_DELETE_CONFIRM_PHRASE}
            autoComplete="off"
          />
        </label>

        {error ? (
          <p className="mt-3 text-sm font-medium text-rose-600" role="alert">
            {error}
          </p>
        ) : null}
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-3 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || !phraseOk}
            onClick={() => void handleDelete()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {busy ? 'Deleting…' : 'Delete account'}
          </button>
        </div>
      </div>
    </div>,
    root
  );
}
