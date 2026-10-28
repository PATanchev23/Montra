import { loginRequestSchema } from '@montra/shared';
import { Loader2 } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { useLogin } from '../../api/auth';
import { useSession } from '../../api/session';
import { Button } from '../../components/ui/Button';
import { showToast } from '../../stores/toasts';
import { firstName } from './access';
import { FormNotice, PasswordField, TextField } from './AuthFields';
import { AuthHeading } from './AuthLayout';
import { useSchemaForm } from './useSchemaForm';

const signOutNotices = {
  expired: { tone: 'warning', text: 'Your session has ended. Sign in again to continue.' },
  'signed-out': { tone: 'neutral', text: 'You’ve signed out.' },
} as const;

export function LoginPage() {
  const location = useLocation();
  const { signOutReason } = useSession();
  const login = useLogin();
  const form = useSchemaForm(loginRequestSchema, { email: '', password: '' });
  const notice = signOutReason && signOutNotices[signOutReason];

  const submit = form.handleSubmit((credentials) => {
    // GuestOnly navigates away once the session and profile are loaded.
    login
      .mutateAsync(credentials)
      .then((me) =>
        showToast({ tone: 'positive', title: `Welcome back, ${firstName(me.user.name)}` }),
      )
      .catch(() => {
        // Shown from login.error below.
      });
  });

  return (
    <>
      <AuthHeading
        title="Sign in to Montra"
        description="Welcome back. Your cash flow picks up where you left it."
      />

      <form
        noValidate
        onSubmit={submit}
        className="flex flex-col gap-5"
        aria-busy={login.isPending}
      >
        {login.error ? (
          <FormNotice tone="negative">{login.error.message}</FormNotice>
        ) : (
          notice && <FormNotice tone={notice.tone}>{notice.text}</FormNotice>
        )}

        <TextField
          label="Email"
          type="email"
          autoComplete="username"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="you@yourstore.com"
          error={form.errors.email}
          {...form.register('email')}
        />
        <PasswordField
          label="Password"
          autoComplete="current-password"
          error={form.errors.password}
          {...form.register('password')}
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={login.isPending}
          className="mt-1 w-full"
        >
          {login.isPending && <Loader2 className="animate-spin" />}
          {login.isPending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <p className="mt-7 text-center text-[13px] text-muted">
        New to Montra?{' '}
        <Link
          to="/register"
          state={location.state}
          className="font-medium text-accent underline-offset-4 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </>
  );
}
