// Demo mode: no Supabase configured. Data lives in a local file and there is no login.
// Use it to try the app or record a demo. Never put client documents in demo mode.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
export const DEMO_MODE = !SUPABASE_URL || !SUPABASE_ANON_KEY;

export const MEMO_MODEL = process.env.ALLOCRA_MEMO_MODEL || "claude-opus-5-5";
export const CHANGES_MODEL = process.env.ALLOCRA_CHANGES_MODEL || "claude-sonnet-5-5";
export const HAS_AI_KEY = !!process.env.ANTHROPIC_API_KEY;
export const DOC_MODEL = process.env.ALLOCRA_DOC_MODEL || "claude-sonnet-5-5";
export const FILING_MODEL = process.env.ALLOCRA_FILING_MODEL || "claude-haiku-5-5";
export const CHAT_MODEL = process.env.ALLOCRA_CHAT_MODEL || "claude-sonnet-5-5";
export const OCR_MODEL = process.env.ALLOCRA_OCR_MODEL || "claude-sonnet-5-5";
