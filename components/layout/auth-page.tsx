import Link from 'next/link';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { PublicHeader, PublicFooter } from '@/components/layout/public';
import { Logo } from '@/components/ui/core';

export function AuthPage({ register = false, emailSent = false, emailError }: { register?: boolean; emailSent?: boolean; emailError?: string }) {
  return <>
    <PublicHeader />
    <main id="main" className="auth-wrap">
      <section className="panel auth-card">
        <Logo compact />
        <div className="eyebrow" style={{ marginTop: 28 }}>A SHARED PLACE TO COORDINATE</div>
        <h1>{register ? 'Start with your community.' : 'Welcome back.'}</h1>
        <p>{register ? 'Create your account to report needs, offer supplies, or apply to volunteer. Your organization determines your workspace access.' : 'Sign in to view your requests, coordinate support, and pick up where you left off.'}</p>

        {emailSent ? <div className="notice success" role="status" style={{ margin: '20px 0' }}><ShieldCheck size={18} /><span>Check your email and open the TrustGrid sign-in link in this browser. The link expires for your protection.</span></div> : null}
        {emailError ? <div className="notice danger" role="alert" style={{ margin: '20px 0' }}><span>{emailError === 'invalid' ? 'Enter a valid email address.' : 'The sign-in email could not be sent. Please wait a moment and try again.'}</span></div> : null}

        <form method="post" action="/auth/email" className="stack auth-email-form">
          <input type="hidden" name="next" value="/dashboard" />
          <label htmlFor="auth-email">Email address</label>
          <input id="auth-email" name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" />
          <button className="button primary" type="submit">Email me a secure sign-in link<ArrowRight size={17} /></button>
        </form>

        <div className="auth-divider"><span>or</span></div>
        <a className="button secondary auth-google" href="/auth/login?next=/dashboard" aria-label="Continue with Google">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.8 3-4.3 3-7.4ZM12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22ZM6.4 14a6 6 0 0 1 0-4V7.4H3.1a10 10 0 0 0 0 9.2L6.4 10c.8-2.3 3-4.1 5.6-4.1Z" /></svg>
          Continue with Google
        </a>
        <p className="disclaimer">A sign-in establishes your account. It does not verify a report or grant a volunteer or coordinator role.</p>
        <div className="notice" style={{ marginTop: 24 }}><ShieldCheck size={18} /><span>Your reports are scoped to your authorized organization. <Link className="text-link" href="/privacy">Read about data use</Link></span></div>
        <p className="small" style={{ textAlign: 'center', marginTop: 24 }}><Link href="/demo" className="text-link">Explore the demo first</Link></p>
      </section>
    </main>
    <div className="public-main"><PublicFooter /></div>
  </>;
}
