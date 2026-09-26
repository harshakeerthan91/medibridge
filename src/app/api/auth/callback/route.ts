import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const ALLOWED_POST_AUTH_PATHS = new Set([
  '/home', '/records', '/ask', '/schedule', '/diary',
  '/trends', '/questions', '/visit-brief', '/settings',
  '/verify',
]);

const ALLOWED_LOCALES = new Set(['en', 'te', 'hi']);

/**
 * Validates the `next` parameter to prevent open redirects.
 * Only allows relative paths within our locale-prefixed app routes.
 */
function isSafeNext(next: string | null): boolean {
  if (!next) return false;
  if (next.startsWith('http://') || next.startsWith('https://') || next.startsWith('//')) return false;
  if (!next.startsWith('/')) return false;
  const parts = next.split('/').filter(Boolean);
  if (parts.length < 2) return false;
  const [locale, ...rest] = parts;
  if (!ALLOWED_LOCALES.has(locale)) return false;
  const pathSegment = '/' + rest[0];
  return ALLOWED_POST_AUTH_PATHS.has(pathSegment);
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const { searchParams, origin } = requestUrl;
  const code = searchParams.get('code');
  const nextParam = searchParams.get('next');

  // Validate the next param — fall back to /en/home if unsafe
  const next = isSafeNext(nextParam) ? nextParam! : '/en/home';

  if (!code) {
    console.error('Auth callback: no code parameter received');
    return NextResponse.redirect(new URL('/en/login?error=auth', origin));
  }

  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Auth callback: Supabase environment variables are missing.');
    return NextResponse.redirect(new URL('/en/login?error=config', origin));
  }

  // Build the redirect response FIRST so we can set cookies on it directly
  const redirectUrl = new URL(next, origin);
  const response = NextResponse.redirect(redirectUrl);

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      // Write cookies to BOTH the cookieStore AND our redirect response
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          try {
            cookieStore.set(name, value, options);
          } catch {
            // Server component context — ignore
          }
          // Critical: also set on the actual response that the browser receives
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('Auth callback exchangeCodeForSession error:', error.message);

    if (
      error.message.toLowerCase().includes('code verifier') ||
      error.message.toLowerCase().includes('pkce') ||
      error.message.toLowerCase().includes('invalid')
    ) {
      return NextResponse.redirect(new URL('/en/login?error=oauth_cancelled', origin));
    }
    return NextResponse.redirect(new URL('/en/login?error=auth', origin));
  }

  // Ensure the user has a profile row (handles Google OAuth new users safely)
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const parts = next.split('/').filter(Boolean);
      const localeCandidate = parts[0] ?? 'en';
      const locale = ALLOWED_LOCALES.has(localeCandidate) ? localeCandidate : 'en';

      // upsert with ignoreDuplicates — never overwrites existing patient-entered data
      await supabase.from('profiles').upsert(
        {
          id: user.id,
          full_name: user.user_metadata?.full_name || user.user_metadata?.name || '',
          preferred_language: locale,
        },
        {
          onConflict: 'id',
          ignoreDuplicates: true,
        }
      );
    }
  } catch (profileErr) {
    // Profile creation is best-effort — do not block the login
    console.error('Auth callback: profile upsert failed (non-fatal):', profileErr);
  }

  // Return the redirect response with the auth cookies already attached
  return response;
}
