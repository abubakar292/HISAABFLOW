import { supabase, supabaseAdmin } from './supabase';

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  isAnonymous: boolean;
  refreshToken?: string;
  reload: () => Promise<void>;
}

const ACTIVE_USER_STORAGE_KEY = 'hf_active_supabase_user_v1';
const authSubscribers = new Set<(user: User | null) => void>();

function notifyAuthSubscribers(user: User | null) {
  auth.currentUser = user;
  for (const cb of authSubscribers) {
    try {
      cb(user);
    } catch (e) {
      console.error('Auth subscriber error:', e);
    }
  }
}

function savePersistedUser(user: User | null) {
  try {
    if (!user || user.isAnonymous) {
      localStorage.removeItem(ACTIVE_USER_STORAGE_KEY);
      return;
    }
    localStorage.setItem(
      ACTIVE_USER_STORAGE_KEY,
      JSON.stringify({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL || null,
        refreshToken: user.refreshToken || user.uid,
      })
    );
  } catch {
    // ignore storage errors
  }
}

export function getPersistedUser(): User | null {
  try {
    const raw = localStorage.getItem(ACTIVE_USER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.uid) return null;
    return createUserObject({
      id: parsed.uid,
      email: parsed.email,
      user_metadata: {
        full_name: parsed.displayName,
        avatar_url: parsed.photoURL,
      },
      is_anonymous: false,
    }, parsed.refreshToken);
  } catch {
    return null;
  }
}

function createUserObject(sbUser: any, refreshToken?: string): User {
  const displayName =
    sbUser?.user_metadata?.full_name ||
    sbUser?.user_metadata?.display_name ||
    sbUser?.user_metadata?.name ||
    null;

  const userObj: User = {
    uid: sbUser.id,
    email: sbUser.email || null,
    displayName,
    photoURL: sbUser?.user_metadata?.avatar_url || null,
    isAnonymous: Boolean(sbUser.is_anonymous),
    refreshToken: refreshToken || sbUser.id,
    reload: async () => {
      const { data, error } = await supabaseAdmin.auth.admin.getUserById(sbUser.id);
      if (error || !data?.user) {
        const err: any = new Error('User not found in Supabase Authentication');
        err.code = 'auth/user-not-found';
        throw err;
      }
      userObj.email = data.user.email || userObj.email;
      userObj.displayName =
        data.user.user_metadata?.full_name ||
        data.user.user_metadata?.display_name ||
        data.user.user_metadata?.name ||
        userObj.displayName;
      savePersistedUser(userObj);
    },
  };

  return userObj;
}

export const auth = {
  currentUser: getPersistedUser(),
};

export function getAuth(_app?: any) {
  return auth;
}

export function onAuthStateChanged(
  _authInstance: any,
  callback: (user: User | null) => void
): () => void {
  authSubscribers.add(callback);

  // 1. Immediately emit persisted user if present so UI never gets stuck on login
  const persisted = getPersistedUser();
  if (persisted) {
    auth.currentUser = persisted;
    callback(persisted);
  }

  // 2. Check Supabase session in background
  supabase.auth.getSession().then(({ data }) => {
    if (!authSubscribers.has(callback)) return;
    if (data?.session?.user) {
      const mapped = createUserObject(data.session.user, data.session.refresh_token);
      savePersistedUser(mapped);
      auth.currentUser = mapped;
      callback(mapped);
    } else if (!getPersistedUser()) {
      auth.currentUser = null;
      callback(null);
    }
  });

  // 3. Listen to Supabase auth changes
  const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
    if (!authSubscribers.has(callback)) return;
    if (session?.user) {
      const mapped = createUserObject(session.user, session.refresh_token);
      savePersistedUser(mapped);
      auth.currentUser = mapped;
      callback(mapped);
    } else if (event === 'SIGNED_OUT' && !getPersistedUser()) {
      auth.currentUser = null;
      callback(null);
    }
  });

  return () => {
    authSubscribers.delete(callback);
    listener?.subscription?.unsubscribe();
  };
}

export async function signInWithEmailAndPassword(
  _authInstance: any,
  email: string,
  password: string
): Promise<{ user: User }> {
  const cleanEmail = email.trim().toLowerCase();

  let { data, error } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password,
  });

  // If the account exists in Supabase Auth with an unconfirmed email, auto-confirm via Admin API and retry
  if (error && error.message?.toLowerCase().includes('email not confirmed')) {
    const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
    const target = listData?.users?.find((u: any) => (u.email || '').toLowerCase() === cleanEmail);
    if (target) {
      await supabaseAdmin.auth.admin.updateUserById(target.id, { email_confirm: true });
      const retry = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      data = retry.data;
      error = retry.error;
    }
  }

  if (error || !data?.user) {
    const err: any = new Error(error?.message || 'Invalid email or password.');
    err.code = 'auth/invalid-credential';
    throw err;
  }

  const mapped = createUserObject(data.user, data.session?.refresh_token);
  savePersistedUser(mapped);
  notifyAuthSubscribers(mapped);
  return { user: mapped };
}

export async function createUserWithEmailAndPassword(
  _authInstance: any,
  email: string,
  password: string
): Promise<{ user: User }> {
  const cleanEmail = email.trim().toLowerCase();

  if (!password || password.length < 6) {
    const err: any = new Error('Password must be at least 6 characters.');
    err.code = 'auth/weak-password';
    throw err;
  }

  // Create user via Supabase Admin API with email_confirm: true so shop owners can log in immediately
  const { data: createdData, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: cleanEmail,
    password,
    email_confirm: true,
  });

  if (createError) {
    const msg = createError.message?.toLowerCase() || '';
    const err: any = new Error(createError.message || 'Could not create account.');
    if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
      err.code = 'auth/email-already-in-use';
    } else if (msg.includes('password')) {
      err.code = 'auth/weak-password';
    } else {
      err.code = 'auth/invalid-email';
    }
    throw err;
  }

  // Sign in immediately to establish the active browser session
  const { data: signInData } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password,
  });

  const sbUser = signInData?.user || createdData.user;
  if (!sbUser) {
    const err: any = new Error('Account created, please sign in.');
    err.code = 'auth/invalid-credential';
    throw err;
  }

  const mapped = createUserObject(sbUser, signInData?.session?.refresh_token);
  savePersistedUser(mapped);
  notifyAuthSubscribers(mapped);
  return { user: mapped };
}

export async function updateProfile(
  user: User,
  profile: { displayName?: string | null; photoURL?: string | null }
): Promise<void> {
  if (profile.displayName !== undefined) {
    user.displayName = profile.displayName;
  }
  if (profile.photoURL !== undefined) {
    user.photoURL = profile.photoURL;
  }

  savePersistedUser(user);
  notifyAuthSubscribers(user);

  try {
    await supabaseAdmin.auth.admin.updateUserById(user.uid, {
      user_metadata: {
        full_name: user.displayName,
        display_name: user.displayName,
        name: user.displayName,
        avatar_url: user.photoURL,
      },
    });
  } catch (e) {
    console.warn('Supabase updateProfile warning:', e);
  }
}

export async function signOut(_authInstance?: any): Promise<void> {
  savePersistedUser(null);
  notifyAuthSubscribers(null);
  await supabase.auth.signOut().catch(() => {});
}

export async function signInAnonymously(_authInstance?: any): Promise<{ user: User }> {
  const anonUser: User = {
    uid: 'anon_' + Date.now(),
    email: null,
    displayName: 'Anonymous',
    isAnonymous: true,
    reload: async () => {},
  };
  return { user: anonUser };
}

export class GoogleAuthProvider {
  private scopes: string[] = [];
  private customParams: Record<string, string> = {};

  addScope(scope: string) {
    this.scopes.push(scope);
  }

  setCustomParameters(params: Record<string, string>) {
    this.customParams = { ...this.customParams, ...params };
  }

  static credentialFromResult(result: any): { accessToken?: string } | null {
    if (result?.credential?.accessToken) {
      return { accessToken: result.credential.accessToken };
    }
    if (result?.session?.provider_token) {
      return { accessToken: result.session.provider_token };
    }
    return null;
  }
}

export async function signInWithPopup(
  _authInstance: any,
  _provider: GoogleAuthProvider
): Promise<{ user: User; credential?: { accessToken?: string } }> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
      skipBrowserRedirect: false,
    },
  });

  if (error) {
    const err: any = new Error(error.message || 'Google Sign-In is not configured in Supabase Auth Providers.');
    err.code = 'auth/operation-not-allowed';
    throw err;
  }

  return new Promise((_resolve, reject) => {
    setTimeout(() => {
      if (!data?.url) {
        reject(new Error('Google Sign-In could not be started.'));
      }
    }, 3000);
  });
}
