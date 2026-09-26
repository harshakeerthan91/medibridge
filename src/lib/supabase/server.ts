import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';
import type {Database} from '@/lib/supabase/types';

/**
 * Create a Supabase client for use in server components / route handlers.
 * Uses the user's session from cookies — no privileged service key.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Supabase configuration missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.'
    );
  }

  return createServerClient<any>(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({name, value, options}) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server component: cannot set cookies
        }
      },
    },
  });
}

/**
 * Get the current authenticated user's session.
 * Returns null if not authenticated.
 */
export async function getSession() {
  const supabase = await createSupabaseServerClient();
  const {data: {session}, error} = await supabase.auth.getSession();
  if (error) return null;
  return session;
}

/**
 * Get the current user or throw if not authenticated.
 */
export async function requireAuth() {
  const session = await getSession();
  if (!session?.user) {
    throw new Error('Not authenticated');
  }
  return session.user;
}
