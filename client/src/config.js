/**
 * Public client configuration.
 *
 * The Supabase URL and the publishable key are meant to be public (they end up
 * in every browser anyway). Access is protected by row level security in the
 * database. The secret key is only used by the server and never appears here.
 *
 * Values can be overridden at build time with REACT_APP_* environment variables.
 */

export const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || 'https://fhewqgwcipvgtdlgquuz.supabase.co';

export const SUPABASE_PUBLISHABLE_KEY =
  process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_ZvaTtAJ7KuarY1LIqwtnYQ_AF-pMow1';
