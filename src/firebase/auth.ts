import {
  signInAnonymously,
  signInWithPopup,
  GoogleAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  signOut as fbSignOut,
  onAuthStateChanged,
  linkWithPopup,
  User as FirebaseUser,
  IdTokenResult,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './config';
import { AppUser, UserRole } from '../types';
import { ADMIN_EMAIL_ALLOWLIST } from '../config/platformConfig';

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

let recaptchaVerifierInstance: RecaptchaVerifier | null = null;

/**
 * Checks if a user is an authorized administrator via custom claims,
 * bootstrapped admin email, or Firestore /admins/{uid} document.
 */
export async function checkIsUserAdmin(user: FirebaseUser): Promise<boolean> {
  try {
    const tokenResult = await user.getIdTokenResult();
    if (
      tokenResult.claims.role === 'super_admin' ||
      tokenResult.claims.role === 'ops_admin' ||
      tokenResult.claims.role === 'founder_admin' ||
      tokenResult.claims.admin === true
    ) {
      return true;
    }

    if (
      user.email &&
      user.emailVerified &&
      ADMIN_EMAIL_ALLOWLIST.includes(user.email.toLowerCase())
    ) {
      return true;
    }

    const adminSnap = await getDoc(doc(db, 'admins', user.uid));
    if (adminSnap.exists()) {
      return true;
    }
  } catch {
    // Fallback to email allowlist check if Firestore read is offline
    if (user.email && ADMIN_EMAIL_ALLOWLIST.includes(user.email.toLowerCase())) {
      return true;
    }
  }
  return false;
}

/**
 * Extracts and maps Firebase User to Application User with role and admin flag
 */
export async function mapFirebaseUser(user: FirebaseUser | null): Promise<AppUser | null> {
  if (!user) return null;

  let role: UserRole = 'customer';
  let merchantId: string | undefined = undefined;
  let isAdmin = false;

  try {
    const tokenResult: IdTokenResult = await user.getIdTokenResult();
    role = (tokenResult.claims.role as UserRole) || 'customer';
    merchantId = tokenResult.claims.merchantId as string | undefined;
    isAdmin = await checkIsUserAdmin(user);
    if (isAdmin && role === 'customer') {
      role = 'super_admin';
    }
  } catch {
    if (user.email && ADMIN_EMAIL_ALLOWLIST.includes(user.email.toLowerCase())) {
      isAdmin = true;
      role = 'super_admin';
    }
  }

  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    phone: user.phoneNumber,
    isAnonymous: user.isAnonymous,
    role,
    isAdmin,
    merchantId,
  };
}

/**
 * Initializes invisible reCAPTCHA verifier for Firebase Phone Auth (SMS OTP)
 */
export function initPhoneRecaptcha(containerId: string): RecaptchaVerifier {
  if (recaptchaVerifierInstance) {
    try {
      recaptchaVerifierInstance.clear();
    } catch {
      // ignore cleanup error
    }
    recaptchaVerifierInstance = null;
  }

  recaptchaVerifierInstance = new RecaptchaVerifier(auth, containerId, {
    size: 'invisible',
  });
  return recaptchaVerifierInstance;
}

/**
 * Sends SMS OTP via Firebase Phone Auth
 */
export async function sendFirebasePhoneOtp(
  phoneE164: string,
  containerId: string
): Promise<ConfirmationResult> {
  const verifier = initPhoneRecaptcha(containerId);
  return await signInWithPhoneNumber(auth, phoneE164, verifier);
}

/**
 * Anonymous sign-in for guest browsing
 */
export async function signInAsGuest(): Promise<AppUser> {
  const cred = await signInAnonymously(auth);
  const appUser = await mapFirebaseUser(cred.user);
  if (!appUser) throw new Error('Failed to initialize guest session');
  return appUser;
}

/**
 * Google Sign-In for store merchants and platform admins
 */
export async function signInWithGoogle(): Promise<AppUser> {
  const cred = await signInWithPopup(auth, googleProvider);
  const appUser = await mapFirebaseUser(cred.user);
  if (!appUser) throw new Error('Failed to sign in with Google');
  return appUser;
}

/**
 * Link an anonymous guest account with Google credentials
 */
export async function linkGuestWithGoogle(): Promise<AppUser> {
  if (!auth.currentUser) throw new Error('No active user to link');
  if (!auth.currentUser.isAnonymous) {
    throw new Error('Current user is not anonymous');
  }
  const cred = await linkWithPopup(auth.currentUser, googleProvider);
  const appUser = await mapFirebaseUser(cred.user);
  if (!appUser) throw new Error('Failed to link account');
  return appUser;
}

/**
 * Sign out current session
 */
export async function signOutUser(): Promise<void> {
  await fbSignOut(auth);
}

/**
 * Subscribe to authentication state changes
 */
export function onAuthChange(callback: (user: AppUser | null) => void): () => void {
  return onAuthStateChanged(auth, async (firebaseUser) => {
    try {
      const appUser = await mapFirebaseUser(firebaseUser);
      callback(appUser);
    } catch {
      callback(null);
    }
  });
}
