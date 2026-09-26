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
  // Reject anything with a protocol or host
  if (next.startsWith('http://') || next.startsWith('https://') || next.startsWith('//')) return false;
  // Must start with /
  if (!next.startsWith('/')) return false;
  // Parse the locale segment: /{locale}/{path}
  const parts = next.split('/').filter(Boolean); // ['en', 'home']
  if (parts.length < 2) return false;
  const [locale, ...rest] = parts;
  if (!ALLOWED_LOCALES.has(locale)) return false;
  const pathSegment = '/' + rest[0];
  return ALLOWED_POST_AUTH_PATHS.has(pathSegment);
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const nextParam = searchParams.get('next');

  // Validate the next param — fall back to /en/home if unsafe
  const next = isSafeNext(nextParam) ? nextParam! : '/en/home';

  if (code) {
    const cookieStore = await cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

    if (!supabaseUrl || !supabaseKey) {
      console.error('Auth callback: Supabase environment variables are missing.');
      return NextResponse.redirect(new URL('/en/login?error=config', origin));
    }

    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from Server Component context — safe to ignore
          }
        },
      },
    });

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Ensure the user has a profile (for Google OAuth new users)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Upsert profile — ignore_duplicates on id conflict so we never overwrite patient data
        const preferredLanguage = next.split('/')[1] as string; // extract locale from next path
        const locale = ALLOWED_LOCALES.has(preferredLanguage) ? preferredLanguage : 'en';

        // Only set full_name and preferred_language if profile doesn't exist yet
        await supabase.from('profiles').upsert(
          {
            id: user.id,
            full_name: user.user_metadata?.full_name || user.user_metadata?.name || '',
            preferred_language: locale,
          },
          {
            onConflict: 'id',
            ignoreDuplicates: true, // Never overwrite existing patient-entered data
          }
        );
      }

      return NextResponse.redirect(new URL(next, origin));
    }

    // Log the error server-side but do not expose details to client
    console.error('Auth callback exchangeCodeForSession error:', error.message);

    if (error.message.toLowerCase().includes('code verifier') ||
        error.message.toLowerCase().includes('pkce')) {
      // PKCE flow issue — likely user cancelled or reused link
      return NextResponse.redirect(new URL('/en/login?error=oauth_cancelled', origin));
    }
  }

  // Missing code or exchange failed — redirect back to login with a safe error indicator
  return NextResponse.redirect(new URL('/en/login?error=auth', origin));
}
