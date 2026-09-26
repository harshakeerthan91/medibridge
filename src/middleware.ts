import createMiddleware from 'next-intl/middleware';
import {routing} from '@/lib/i18n/routing';
import {NextResponse} from 'next/server';
import type {NextRequest} from 'next/server';
import {createServerClient} from '@supabase/ssr';

// next-intl middleware for locale routing
const intlMiddleware = createMiddleware(routing);

export async function middleware(request: NextRequest) {
  const {pathname} = request.nextUrl;

  // Allow public API routes
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // 1. Run next-intl middleware first to get the initial response
  let response = intlMiddleware(request);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (supabaseUrl && supabaseKey) {
    // 2. Wrap it with Supabase to refresh auth
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({name, value, options}) => {
             request.cookies.set(name, value);
             response.cookies.set(name, value, options);
          });
        },
      },
    });

    const {data: {session}} = await supabase.auth.getSession();
    
    // Extract locale from path: /{locale}/...
    const localeMatch = pathname.match(/^\/(en|te|hi)(\/.*)?$/);
    const locale = localeMatch ? localeMatch[1] : 'en';
    const pathAfterLocale = localeMatch ? (localeMatch[2] || '/') : pathname;
    
    // Auth routes: login, signup, reset, verify
    const isAuthRoute = ['/login', '/signup', '/reset', '/verify'].some(r => 
      pathAfterLocale.startsWith(r)
    );
    
    // Protected routes: everything except auth
    const isRootPath = pathAfterLocale === '/';
    
    if (!session && !isAuthRoute && !isRootPath) {
      const loginUrl = new URL(`/${locale}/login`, request.url);
      return NextResponse.redirect(loginUrl);
    }

    // Redirect authenticated users away from auth pages
    if (session && isAuthRoute) {
      // Allow the verify page if they are recovering a password
      if (pathAfterLocale.startsWith('/verify') && request.nextUrl.searchParams.get('type') === 'recovery') {
        return response;
      }
      const homeUrl = new URL(`/${locale}/home`, request.url);
      return NextResponse.redirect(homeUrl);
    }

    // Redirect root to appropriate page
    if (isRootPath) {
      const target = session ? `/${locale}/home` : `/${locale}/login`;
      return NextResponse.redirect(new URL(target, request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Match all paths except static files
    '/((?!_next|_vercel|.*\\..*).*)',
  ],
};
