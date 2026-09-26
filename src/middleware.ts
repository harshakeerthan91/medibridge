import createMiddleware from 'next-intl/middleware';
import {routing} from '@/lib/i18n/routing';
import {NextResponse} from 'next/server';
import type {NextRequest} from 'next/server';
import {createServerClient} from '@supabase/ssr';

// next-intl middleware for locale routing
const intlMiddleware = createMiddleware(routing);

export async function middleware(request: NextRequest) {
  const {pathname} = request.nextUrl;

  // Allow all API routes — auth callback must not be blocked
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Static assets and Next.js internals are excluded by the matcher below

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // Without Supabase config just run i18n routing
  if (!supabaseUrl || !supabaseKey) {
    return intlMiddleware(request);
  }

  // 1. Run next-intl middleware first so we get locale-aware response headers
  let response = intlMiddleware(request);

  // 2. Create Supabase server client that reads/writes cookies on request + response
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Write to both the request (for downstream middleware) and the response
        cookiesToSet.forEach(({name, value}) => request.cookies.set(name, value));
        // Re-run intlMiddleware with updated cookies so the response has the right headers
        response = intlMiddleware(request);
        cookiesToSet.forEach(({name, value, options}) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // 3. Validate session server-side.
  // getUser() verifies the JWT with Supabase Auth server — not just trusting the cookie.
  // getSession() only reads from the cookie and would see a stale/missing session.
  const { data: { user } } = await supabase.auth.getUser();

  // 4. Parse locale and path
  const localeMatch = pathname.match(/^\/(en|te|hi)(\/.*)?$/);
  const locale = localeMatch ? localeMatch[1] : 'en';
  const pathAfterLocale = localeMatch ? (localeMatch[2] || '/') : pathname;

  // Auth routes: login, signup, reset, verify
  const isAuthRoute = ['/login', '/signup', '/reset', '/verify'].some(r =>
    pathAfterLocale.startsWith(r)
  );

  const isRootPath = pathAfterLocale === '/';

  // 5. Unauthenticated user trying to access a protected route
  if (!user && !isAuthRoute && !isRootPath) {
    const loginUrl = new URL(`/${locale}/login`, request.url);
    // Preserve the intended destination as `next` so we can redirect back after login
    // Only pass safe internal paths
    const safePath = `/${locale}${pathAfterLocale}`;
    loginUrl.searchParams.set('next', safePath);
    const redirectResponse = NextResponse.redirect(loginUrl);
    // Forward any cookie updates from Supabase refresh onto the redirect
    response.cookies.getAll().forEach(cookie => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    return redirectResponse;
  }

  // 6. Authenticated user hitting an auth page → send to dashboard
  if (user && isAuthRoute) {
    // Special case: allow /verify with type=recovery even when authenticated
    if (
      pathAfterLocale.startsWith('/verify') &&
      request.nextUrl.searchParams.get('type') === 'recovery'
    ) {
      return response;
    }
    const homeUrl = new URL(`/${locale}/home`, request.url);
    const redirectResponse = NextResponse.redirect(homeUrl);
    response.cookies.getAll().forEach(cookie => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    return redirectResponse;
  }

  // 7. Root path: redirect to dashboard or login
  if (isRootPath) {
    const target = user ? `/${locale}/home` : `/${locale}/login`;
    const redirectResponse = NextResponse.redirect(new URL(target, request.url));
    response.cookies.getAll().forEach(cookie => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    return redirectResponse;
  }

  // 8. Authenticated user on a protected page — pass through with refreshed cookies
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, and any path with a file extension
     * - Vercel system paths
     */
    '/((?!_next/static|_next/image|favicon\\.ico|_vercel|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot)$).*)',
  ],
};
