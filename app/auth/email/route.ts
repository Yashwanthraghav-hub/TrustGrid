import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { serverClient } from '@/lib/supabase/server';
import { appOrigin, configured } from '@/lib/env';
import { safeReturnPath } from '@/lib/auth/redirect';

const emailSchema = z.string().trim().email().max(254);

export async function POST(request: NextRequest) {
  const login = new URL('/login', request.url);
  if (!configured()) {
    login.searchParams.set('email_error', 'configuration');
    return NextResponse.redirect(login, 303);
  }

  try {
    const form = await request.formData();
    const parsed = emailSchema.safeParse(form.get('email'));
    if (!parsed.success) {
      login.searchParams.set('email_error', 'invalid');
      return NextResponse.redirect(login, 303);
    }

    const next = safeReturnPath(String(form.get('next') || '/dashboard'));
    const origin = appOrigin();
    const db = await serverClient();
    const { error } = await db.auth.signInWithOtp({
      email: parsed.data,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
        data: { display_name: parsed.data.split('@')[0] }
      }
    });
    if (error) throw error;

    login.searchParams.set('email_sent', '1');
    return NextResponse.redirect(login, 303);
  } catch {
    login.searchParams.set('email_error', 'send');
    return NextResponse.redirect(login, 303);
  }
}
