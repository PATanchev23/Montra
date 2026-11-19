import { loginRequestSchema } from '@montra/shared';
import { Loader2 } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { useLogin } from '../../api/auth';
import { useSession } from '../../api/session';
import { Button } from '../../components/ui/Button';
import { errorMessage } from '../../api/client';
import { useMessages } from '../../i18n';
import { showToast } from '../../stores/toasts';
import { firstName } from './access';
import { FormNotice, PasswordField, TextField } from './AuthFields';
import { AuthHeading, AuthSwitch } from './AuthLayout';
import { authMessages } from './messages';
import { useSchemaForm } from './useSchemaForm';

const signOutNotices = {
  expired: { tone: 'warning', text: 'expired' },
  'signed-out': { tone: 'neutral', text: 'signedOut' },
  deleted: { tone: 'neutral', text: 'accountDeleted' },
} as const;

export function LoginPage() {
  const location = useLocation();
  const { signOutReason } = useSession();
  const login = useLogin();
  const t = useMessages(authMessages);
  const m = t.login;
  const form = useSchemaForm(loginRequestSchema, { email: '', password: '' });
  const notice = signOutReason && signOutNotices[signOutReason];

  const submit = form.handleSubmit((credentials) => {
    // GuestOnly navigates away once the session and profile are loaded.
    login
      .mutateAsync(credentials)
      .then((me) => showToast({ tone: 'positive', title: m.welcomeBack(firstName(me.user.name)) }))
      .catch(() => {
        // Shown from login.error below.
      });
  });

  return (
    <>
      <AuthHeading title={m.title} description={m.description} />

      <form
        noValidate
        onSubmit={submit}
        className="flex flex-col gap-5"
        aria-busy={login.isPending}
      >
        {login.error ? (
          <FormNotice tone="negative">{errorMessage(login.error)}</FormNotice>
        ) : (
          notice && <FormNotice tone={notice.tone}>{m[notice.text]}</FormNotice>
        )}

        <TextField
          label={t.email}
          type="email"
          autoComplete="username"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={t.emailPlaceholder}
          error={form.errors.email}
          {...form.register('email')}
        />
        <PasswordField
          label={t.password}
          autoComplete="current-password"
          placeholder={m.passwordPlaceholder}
          error={form.errors.password}
          {...form.register('password')}
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={login.isPending}
          className="mt-2 h-13 w-full"
        >
          {login.isPending && <Loader2 className="animate-spin" />}
          {login.isPending ? m.submitting : m.submit}
        </Button>
      </form>

      <AuthSwitch>
        {m.newHere}{' '}
        <Link
          to="/register"
          state={location.state}
          className="font-medium text-ink underline decoration-1 underline-offset-4 hover:decoration-2"
        >
          {m.createAccount}
        </Link>
      </AuthSwitch>
    </>
  );
}
