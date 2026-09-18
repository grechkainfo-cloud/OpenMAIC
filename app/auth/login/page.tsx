'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, LoaderCircle, LockKeyhole } from 'lucide-react';

import { useBrand } from '@/lib/brand/brand-context';
import { useI18n } from '@/lib/hooks/use-i18n';

/**
 * Sign-in screen.
 *
 * Reachable only when an identity provider is configured; the middleware sends
 * unauthenticated requests here and lets this path through. It deliberately
 * mirrors the access-code screen: same background, same card, so a deployment
 * that switches from a shared code to real accounts does not look like a
 * different product.
 */
export default function LoginPage() {
  const { t } = useI18n();
  const brand = useBrand();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    usernameRef.current?.focus();
  }, []);

  /**
   * Where to go after a successful sign-in.
   *
   * Only a path from this origin is accepted. `?next=https://elsewhere` would
   * otherwise turn the login screen into an open redirect, which is exactly the
   * shape phishing wants: a real link to a real login on the real domain that
   * lands somewhere else. A protocol-relative `//host` is a path to
   * `URLSearchParams` but an absolute URL to the browser, so it is rejected too.
   */
  function redirectTarget(): string {
    if (typeof window === 'undefined') return '/';
    const next = new URLSearchParams(window.location.search).get('next');
    if (!next || !next.startsWith('/') || next.startsWith('//')) return '/';
    return next;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!username || !password || loading) return;
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        // A full navigation, not a router push: the session cookie has to be
        // attached to the next document request, and every server component on
        // the target page must render with the new identity rather than with
        // whatever was cached for an anonymous visitor.
        window.location.assign(redirectTarget());
        return;
      }

      setError(response.status === 429 ? t('auth.rateLimited') : t('auth.error'));
      setPassword('');
    } catch {
      setError(t('auth.error'));
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = Boolean(username && password) && !loading;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-background">
        <div
          className="absolute inset-0 opacity-30 dark:opacity-20"
          style={{
            backgroundImage: `
              radial-gradient(ellipse 80% 60% at 20% 40%, var(--primary) 0%, transparent 60%),
              radial-gradient(ellipse 60% 80% at 80% 20%, oklch(0.6 0.15 280) 0%, transparent 50%),
              radial-gradient(ellipse 50% 50% at 60% 80%, oklch(0.5 0.12 300) 0%, transparent 50%)
            `,
          }}
        />
      </div>

      <motion.div
        className="relative z-10 mx-4 w-full max-w-sm"
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="rounded-2xl border border-border/50 bg-card/80 p-8 shadow-xl shadow-black/5 backdrop-blur-xl dark:bg-card/60 dark:shadow-black/20">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <LockKeyhole className="h-7 w-7 text-primary" strokeWidth={1.5} />
          </div>

          <h1 className="mb-1 text-center text-lg font-semibold tracking-tight text-foreground">
            {t('auth.title')}
          </h1>
          <p className="mb-6 text-center text-sm text-muted-foreground">{brand.productName}</p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label htmlFor="auth-username" className="sr-only">
                {t('auth.username')}
              </label>
              <input
                id="auth-username"
                ref={usernameRef}
                name="username"
                type="text"
                autoComplete="username"
                placeholder={t('auth.username')}
                value={username}
                onChange={(event) => {
                  setUsername(event.target.value);
                  if (error) setError('');
                }}
                disabled={loading}
                className="w-full rounded-xl border border-border/60 bg-background/60 px-4 py-3 text-sm outline-none transition-all duration-200 placeholder:text-muted-foreground/50 focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
              />
            </div>

            <div className="relative">
              <label htmlFor="auth-password" className="sr-only">
                {t('auth.password')}
              </label>
              <input
                id="auth-password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder={t('auth.password')}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (error) setError('');
                }}
                disabled={loading}
                className={`w-full rounded-xl border bg-background/60 px-4 py-3 pr-12 text-sm outline-none transition-all duration-200 placeholder:text-muted-foreground/50 focus:border-primary/40 focus:ring-2 focus:ring-primary/10 ${
                  error
                    ? 'border-destructive/50 focus:border-destructive/50 focus:ring-destructive/10'
                    : 'border-border/60'
                }`}
              />
              <button
                type="submit"
                aria-label={t('auth.submit')}
                disabled={!canSubmit}
                className={`absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg transition-all duration-200 ${
                  canSubmit
                    ? 'cursor-pointer bg-primary text-primary-foreground hover:opacity-90'
                    : 'cursor-default text-muted-foreground/30'
                }`}
              >
                {loading ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
              </button>
            </div>

            {/* aria-live so a screen reader announces the failure; the field
                keeps focus, so a silent colour change would be the only signal. */}
            <p className="min-h-5 text-center text-sm text-destructive" role="alert">
              {error}
            </p>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
