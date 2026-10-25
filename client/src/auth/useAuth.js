import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';

const USERNAME_PATTERN = /^[A-Za-z0-9_\-. ]{2,20}$/;

// Escapes the wildcard characters of a LIKE pattern so usernames are compared literally
function escapeLikePattern(text) {
  return text.replace(/[\\%_]/g, character => `\\${character}`);
}

/**
 * Login state of the current browser.
 * user: { id, email, username } when logged in, otherwise null.
 */
export function useAuth() {
  const [session, setSession] = useState(null);
  const [username, setUsername] = useState(null);
  const [isLoading, setIsLoading] = useState(Boolean(supabase));

  // Load the stored session and follow logins/logouts (also from other tabs)
  useEffect(() => {
    if (!supabase) return undefined;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => setSession(newSession));
    return () => data.subscription.unsubscribe();
  }, []);

  // Username lives in the profiles table
  const userId = session?.user?.id;
  useEffect(() => {
    if (!supabase || !userId) {
      setUsername(null);
      return;
    }
    let isCurrent = true;
    supabase
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (isCurrent) setUsername(data?.username || null);
      });
    return () => {
      isCurrent = false;
    };
  }, [userId]);

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      return { error: error.message === 'Invalid login credentials' ? 'Wrong email or password' : error.message };
    }
    return { error: null };
  }, []);

  const signUp = useCallback(async (email, password, desiredUsername) => {
    const trimmedUsername = desiredUsername.trim();
    if (!USERNAME_PATTERN.test(trimmedUsername)) {
      return { error: 'Username: 2–20 characters (letters, numbers, space, _ - .)' };
    }
    if (password.length < 6) return { error: 'Password needs at least 6 characters' };

    // Check the username first to give a clear message (the database enforces it as well)
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .ilike('username', escapeLikePattern(trimmedUsername))
      .limit(1);
    if (existing && existing.length > 0) return { error: 'Username already taken' };

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { username: trimmedUsername } }
    });
    if (error) {
      // The profile trigger fails if the username was taken in the meantime
      if (error.message.includes('Database error')) return { error: 'Username already taken' };
      return { error: error.message };
    }
    // With "Confirm email" enabled there is no session until the link in the mail was clicked
    if (!data.session) return { error: null, needsConfirmation: true };
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  // Fresh token for the game server (supabase refreshes it automatically when needed)
  const getAccessToken = useCallback(async () => {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  }, []);

  const user = session?.user ? { id: session.user.id, email: session.user.email, username } : null;

  return { user, isLoading, signIn, signUp, signOut, getAccessToken };
}
