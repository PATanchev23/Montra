import {
  AUTH_ERROR_CODES,
  emailSchema,
  PASSWORD_MIN_LENGTH,
  registerRequestSchema,
} from '@montra/shared';
import { Loader2 } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { ApiError } from '../../api/client';
import { useRegister } from '../../api/auth';
import { Button } from '../../components/ui/Button';
import { showToast } from '../../stores/toasts';
import { firstName } from './access';
import { FormNotice, PasswordField, TextField } from './AuthFields';
import { AuthHeading } from './AuthLayout';
import { useSchemaForm } from './useSchemaForm';

export function RegisterPage() {
  const location = useLocation();
  const register = useRegister();
  const form = useSchemaForm(registerRequestSchema, { name: '', email: '', password: '' });

  // "Email taken" belongs to the email field, and only while it still holds that address.
  const emailTaken =
    register.error instanceof ApiError &&
    register.error.code === AUTH_ERROR_CODES.EMAIL_TAKEN &&
    register.variables?.email === emailSchema.safeParse(form.values.email).data;
  const formError = register.error && !emailTaken ? register.error.message : null;

  const submit = form.handleSubmit((account) => {
    // GuestOnly moves on to business setup once the session and profile are loaded.
    register
      .mutateAsync(account)
      .then((me) =>
        showToast({
          tone: 'positive',
          title: 'Account created',
          body: `Welcome to Montra, ${firstName(me.user.name)}.`,
        }),
      )
      .catch(() => {
        // Shown from register.error below.
      });
  });

  const remaining = PASSWORD_MIN_LENGTH - form.values.password.length;

  return (
    <>
      <AuthHeading
        title="Create your account"
        description="Start with your sign-in details. You’ll set up your business next."
      />

      <form
        noValidate
        onSubmit={submit}
        className="flex flex-col gap-5"
        aria-busy={register.isPending}
      >
        {formError && <FormNotice tone="negative">{formError}</FormNotice>}

        <TextField
          label="Full name"
          autoComplete="name"
          placeholder="Ana Petrova"
          error={form.errors.name}
          {...form.register('name')}
        />
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="you@yourstore.com"
          error={
            form.errors.email ??
            (emailTaken ? 'An account with this email already exists.' : undefined)
          }
          {...form.register('email')}
        />
        <PasswordField
          label="Password"
          autoComplete="new-password"
          hint={
            remaining > 0 && remaining < PASSWORD_MIN_LENGTH
              ? `${remaining} more character${remaining === 1 ? '' : 's'} to go.`
              : `At least ${PASSWORD_MIN_LENGTH} characters. A short phrase works well.`
          }
          error={form.errors.password}
          {...form.register('password')}
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={register.isPending}
          className="mt-1 w-full"
        >
          {register.isPending && <Loader2 className="animate-spin" />}
          {register.isPending ? 'Creating account…' : 'Create account'}
        </Button>
      </form>

      <p className="mt-7 text-center text-[13px] text-muted">
        Already have an account?{' '}
        <Link
          to="/login"
          state={location.state}
          className="font-medium text-accent underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </>
  );
}
