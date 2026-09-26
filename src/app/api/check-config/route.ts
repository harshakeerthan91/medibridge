import {NextResponse} from 'next/server';

/**
 * Config check endpoint — returns which AI providers are configured.
 * Does NOT expose keys or values, only presence/absence.
 * Safe to call from authenticated frontend for graceful feature degradation.
 */
export async function GET() {
  const config = {
    supabase: !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
    gemini: !!(process.env.GEMINI_API_KEY && process.env.GEMINI_DOCUMENT_MODEL),
    groq: !!(process.env.GROQ_API_KEY && process.env.GROQ_CHAT_MODEL),
  };

  const allConfigured = config.supabase && config.gemini && config.groq;
  const missing: string[] = [];

  if (!config.supabase) missing.push('NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  if (!config.gemini) missing.push('GEMINI_API_KEY', 'GEMINI_DOCUMENT_MODEL');
  if (!config.groq) missing.push('GROQ_API_KEY', 'GROQ_CHAT_MODEL');

  return NextResponse.json({
    configured: allConfigured,
    providers: config,
    missing_keys: missing,
    note: 'Key values are never exposed by this endpoint.',
  });
}
