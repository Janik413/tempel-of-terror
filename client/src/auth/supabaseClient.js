import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../config';

// null if accounts are not configured -> the app runs in guest-only mode
export const supabase =
  SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY) : null;

export const accountsAvailable = supabase !== null;
