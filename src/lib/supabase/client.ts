'use client';

import {createBrowserClient} from '@supabase/ssr';
import type {Database} from '@/lib/supabase/types';

let client: ReturnType<typeof createBrowserClient<any>> | null = null;

export function createSupabaseBrowserClient() {
  if (client) return client;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Supabase configuration missing. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.'
    );
  }

  client = createBrowserClient<any>(supabaseUrl, supabaseKey);
  return client;
}
