import React, { FormEvent, useState } from 'react';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  Fingerprint,
  Landmark,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react';
import { suvidhaApi, LoginResult } from '../../../services/apiClient';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { FormField } from '../../forms/FormField';

interface LoginPageProps {
  onAuthenticated: (session: LoginResult) => void;
}

const portals = [
  { role: 'ADMIN', label: 'Administration', detail: 'Governance & revenue control' },
  { role: 'OFFICER', label: 'Revenue officer', detail: 'Reviews & reconciliation' },
  { role: 'AGENT', label: 'Field collection', detail: 'Mobile-first collections' },
  { role: 'CITIZEN', label: 'Citizen services', detail: 'Dues, payments & receipts' },
];

const demoAccounts = [
  {
    role: 'ADMIN',
    label: 'Admin',
    loginIdentifier: 'admin.kulkarni',
    password: 'Suvidha@Admin2026',
    detail: 'Full ERP control',
  },
  {
    role: 'OFFICER',
    label: 'Revenue officer',
    loginIdentifier: 'ro.rajeshwari',
    password: 'Suvidha@Officer2026',
    detail: 'Approvals & reconciliation',
  },
  {
    role: 'AGENT',
    label: 'Field agent',
    loginIdentifier: 'AG-104',
    password: 'Suvidha@Agent2026',
    detail: 'Collections & receipts',
  },
  {
    role: 'CITIZEN',
    label: 'Citizen',
    loginIdentifier: '9811452310',
    password: 'Suvidha@Citizen2026',
    detail: 'Self-service dues & payment',
  },
] as const;

export const LoginPage: React.FC<LoginPageProps> = ({ onAuthenticated }) => {
  const [loginIdentifier, setLoginIdentifier] = useState('AG-104');
  const [password, setPassword] = useState('Suvidha@Agent2026');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleUseDemoAccount = (account: (typeof demoAccounts)[number]) => {
    setLoginIdentifier(account.loginIdentifier);
    setPassword(account.password);
    setErrorMessage('');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage('');
    const response = await suvidhaApi.login(loginIdentifier.trim(), password);
    setIsSubmitting(false);

    if (!response.success || !response.data) {
      setErrorMessage(response.error?.message || 'Sign-in failed. Check your details and try again.');
      return;
    }
    onAuthenticated(response.data);
  };

  return (
    <main className="min-h-screen bg-[#f4f7fb] text-slate-900 lg:grid lg:grid-cols-[1.08fr_0.92fr]">
      <section className="relative hidden min-h-screen overflow-hidden bg-[#0b2545] px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between xl:px-20">
        <div className="absolute -right-40 -top-32 h-[34rem] w-[34rem] rounded-full border border-white/10" />
        <div className="absolute -right-20 -top-12 h-[25rem] w-[25rem] rounded-full border border-white/10" />
        <div className="absolute -bottom-48 -left-32 h-[38rem] w-[38rem] rounded-full bg-[#134074]/60 blur-3xl" />

        <a href="/" className="relative z-10 flex w-fit items-center gap-3" aria-label="SuvidhaPay home">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-white text-[#0b2545] shadow-lg">
            <Landmark className="h-6 w-6" />
          </span>
          <span>
            <span className="block font-display text-xl font-bold tracking-tight">SuvidhaPay</span>
            <span className="block text-xs text-blue-100/75">Municipal services platform</span>
          </span>
        </a>

        <div className="relative z-10 max-w-2xl py-12">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-teal-200/20 bg-teal-200/10 px-3 py-1.5 text-xs font-semibold text-teal-100">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-300" />
            Noida Municipal Corporation
          </div>
          <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
            Public services,
            <br />
            <span className="text-teal-200">with accountability built in.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-blue-100/80">
            One secure place for municipal collections, revenue operations and citizen services.
            Every role gets a workspace tailored to its responsibilities.
          </p>

          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            {portals.map((portal) => (
              <div key={portal.role} className="rounded-xl border border-white/10 bg-white/[0.06] p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{portal.label}</span>
                  <CheckCircle2 className="h-4 w-4 text-teal-200" />
                </div>
                <p className="mt-1 text-xs text-blue-100/65">{portal.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-2 text-xs text-blue-100/65">
          <ShieldCheck className="h-4 w-4 text-teal-200" />
          Secure access protected by server-side role permissions
        </div>
      </section>

      <section className="flex min-h-screen flex-col justify-center px-5 py-8 sm:px-10 lg:px-12 xl:px-20">
        <div className="mx-auto w-full max-w-md">
          <a href="/" className="mb-10 flex w-fit items-center gap-2.5 lg:hidden" aria-label="SuvidhaPay home">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#0b2545] text-white">
              <Landmark className="h-5 w-5" />
            </span>
            <span className="font-display text-lg font-bold text-[#0b2545]">SuvidhaPay</span>
          </a>

          <div className="mb-8">
            <p className="text-sm font-semibold text-teal-800">Welcome back</p>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-slate-950">
              Sign in to your account
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Use your registered municipal account. We’ll open the workspace assigned to your role.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <FormField label="Username, agent ID or registered mobile" htmlFor="login-identifier">
              <Input
                id="login-identifier"
                name="username"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                value={loginIdentifier}
                onChange={(event) => setLoginIdentifier(event.target.value)}
                placeholder="Enter your login ID"
                startAdornment={<Fingerprint className="h-4 w-4" />}
              />
            </FormField>

            <FormField label="Password" htmlFor="login-password">
              <Input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                startAdornment={<LockKeyhole className="h-4 w-4" />}
                endAdornment={
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#134074]"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
              />
            </FormField>

            {errorMessage && (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {errorMessage}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={isSubmitting}
              disabled={!loginIdentifier.trim() || !password}
            >
              {isSubmitting ? 'Signing in…' : 'Sign in securely'}
              {!isSubmitting && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
            </Button>
          </form>

          <div className="mt-5">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Demo accounts
            </p>
            <div className="grid grid-cols-2 gap-2">
              {demoAccounts.map((account) => (
                <button
                  key={account.role}
                  type="button"
                  onClick={() => handleUseDemoAccount(account)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-[#134074] hover:bg-blue-50/50 "
                >
                  <span className="block text-[11px] font-semibold text-slate-800">{account.label}</span>
                  <span className="mt-1 block truncate font-mono text-[10px] text-slate-500">{account.loginIdentifier}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="my-7 flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            <span>Municipal access</span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-700">
                <Building2 className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-800">Noida Municipal Corporation</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Access is monitored and protected. Your role and permissions are verified by the server.
                </p>
              </div>
            </div>
          </div>

          <p className="mt-8 text-center text-xs text-slate-500">
            Need help signing in? Contact your municipal administrator.
          </p>
        </div>

        <footer className="mx-auto mt-auto w-full max-w-md pt-10 text-center text-[11px] text-slate-400">
          Transparent Collections. Trusted Governance.
        </footer>
      </section>
    </main>
  );
};

