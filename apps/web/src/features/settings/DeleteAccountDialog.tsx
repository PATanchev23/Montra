import { AlertDialog } from 'radix-ui';
import { useState, type FormEvent } from 'react';
import { useDeleteAccount } from '../../api/auth';
import { errorMessage } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { useMessages } from '../../i18n';
import { common } from '../../i18n/common';
import { PasswordField } from '../auth/AuthFields';
import { settingsMessages } from './messages';

/**
 * Asks for the password before deleting the account. On success the session
 * ends in every tab and the guards take the user to sign-in, so this dialog
 * only ever closes itself on cancel.
 */
export function DeleteAccountDialog({
  open,
  onOpenChange,
  consequence,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What else goes with the account, e.g. the business they own. */
  consequence: string;
}) {
  const m = useMessages(settingsMessages).deleteAccount;
  const c = useMessages(common);
  const deletion = useDeleteAccount();
  const [password, setPassword] = useState('');
  const [missing, setMissing] = useState(false);
  const busy = deletion.isPending;

  function close(next: boolean) {
    if (busy) return;
    if (!next) {
      setPassword('');
      setMissing(false);
      deletion.reset();
    }
    onOpenChange(next);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!password) {
      setMissing(true);
      return;
    }
    deletion.mutate({ password });
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={close}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-[60] bg-overlay data-[state=closed]:animate-[fade-out_120ms_ease-in_forwards] data-[state=open]:animate-[fade-in_160ms_ease-out]" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-[60] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-panel border border-line bg-raised p-6 shadow-pop outline-none data-[state=closed]:animate-[pop-out_120ms_ease-in_forwards] data-[state=open]:animate-[pop-in_160ms_var(--ease-out-soft)]">
          <form noValidate onSubmit={submit} aria-busy={busy}>
            <AlertDialog.Title className="text-[16px] font-semibold text-ink">
              {m.dialogTitle}
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-[13px] leading-relaxed text-muted">
              {consequence} {m.irreversible}
            </AlertDialog.Description>

            <div className="mt-5">
              <PasswordField
                label={m.password}
                hint={m.passwordHint}
                error={missing ? m.passwordMissing : undefined}
                autoComplete="current-password"
                autoFocus
                value={password}
                disabled={busy}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setMissing(false);
                }}
                className="h-10 text-body-sm"
              />
            </div>

            {deletion.error && (
              <p role="alert" className="mt-3 text-[13px] text-negative">
                {errorMessage(deletion.error)}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <AlertDialog.Cancel asChild>
                <Button disabled={busy}>{c.cancel}</Button>
              </AlertDialog.Cancel>
              <Button
                type="submit"
                variant="primary"
                className="bg-negative text-surface hover:bg-negative hover:brightness-110"
                disabled={busy}
              >
                {busy ? m.deleting : m.confirm}
              </Button>
            </div>
          </form>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
