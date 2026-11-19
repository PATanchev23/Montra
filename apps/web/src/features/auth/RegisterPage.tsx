import {
  AUTH_ERROR_CODES,
  emailSchema,
  PASSWORD_MIN_LENGTH,
  registerRequestSchema,
} from '@montra/shared';
import { Loader2 } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { ApiError, errorMessage } from '../../api/client';
import { useRegister } from '../../api/auth';
import { Button } from '../../components/ui/Button';
import { useMessages } from '../../i18n';
import { showToast } from '../../stores/toasts';
import { firstName } from './access';
import { FormNotice, PasswordField, TextField } from './AuthFields';
import { AuthHeading, AuthSwitch } from './AuthLayout';
import { authMessages } from './messages';
import { useSchemaForm } from './useSchemaForm';

export function RegisterPage() {
  const location = useLocation();
  const register = useRegister();
  const t = useMessages(authMessages);
  const m = t.register;
  const form = useSchemaForm(registerRequestSchema, { name: '', email: '', password: '' });

  // "Email taken" belongs to the email field, and only while it still holds that address.
  const emailTaken =
    register.error instanceof ApiError &&
    register.error.code === AUTH_ERROR_CODES.EMAIL_TAKEN &&
    register.variables?.email === emailSchema.safeParse(form.values.email).data;
  const formError = register.error && !emailTaken ? errorMessage(register.error) : null;

  const submit = form.handleSubmit((account) => {
    // GuestOnly moves on to business setup once the session and profile are loaded.
    register
      .mutateAsync(account)
      .then((me) =>
        showToast({
          tone: 'positive',
          title: m.created,
          body: m.welcome(firstName(me.user.name)),
        }),
      )
      .catch(() => {
        // Shown from register.error below.
      });
  });

  const remaining = PASSWORD_MIN_LENGTH - form.values.password.length;

  return (
    <>
      <AuthHeading title={m.title} description={m.description} />

      <form
        noValidate
        onSubmit={submit}
        className="flex flex-col gap-5"
        aria-busy={register.isPending}
      >
        {formError && <FormNotice tone="negative">{formError}</FormNotice>}

        <TextField
          label={m.fullName}
          autoComplete="name"
          placeholder={m.namePlaceholder}
          error={form.errors.name}
          {...form.register('name')}
        />
        <TextField
          label={t.email}
          type="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={t.emailPlaceholder}
          error={form.errors.email ?? (emailTaken ? m.emailTaken : undefined)}
          {...form.register('email')}
        />
        <PasswordField
          label={t.password}
          autoComplete="new-password"
          hint={
            remaining > 0 && remaining < PASSWORD_MIN_LENGTH
              ? m.remaining(remaining)
              : m.passwordHint(PASSWORD_MIN_LENGTH)
          }
          error={form.errors.password}
          {...form.register('password')}
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={register.isPending}
          className="mt-2 h-13 w-full"
        >
          {register.isPending && <Loader2 className="animate-spin" />}
          {register.isPending ? m.submitting : m.submit}
        </Button>
      </form>

      <AuthSwitch>
        {m.haveAccount}{' '}
        <Link
          to="/login"
          state={location.state}
          className="font-medium text-ink underline decoration-1 underline-offset-4 hover:decoration-2"
        >
          {m.signIn}
        </Link>
      </AuthSwitch>
    </>
  );
}
