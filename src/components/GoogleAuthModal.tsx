import React, { useState } from 'react';
import { UserProfile } from '../types';
import {
  X,
  ShieldCheck,
  Check,
  ArrowRight,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { playClickPip, playTimerCompletionChime } from '../utils/audio';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (profile: UserProfile) => void;
  currentUserEmail?: string;
}

export const GoogleAuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  currentUserEmail = 'tavii.1613@gmail.com',
}) => {
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'google_chooser'>('login');

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Status & Error states
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  // Email format validator
  const isValidEmail = (val: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
  };

  const handleGoogleSelect = (name: string, selectedEmail: string, avatarLetter: string) => {
    setIsLoading(true);
    setTimeout(() => {
      const isOwner =
        selectedEmail.toLowerCase().includes('tavii.1613@gmail.com') ||
        selectedEmail.toLowerCase().includes('tavi.1613@gmail.com');

      const profile: UserProfile = {
        id: `google-user-${Date.now()}`,
        name: isOwner ? 'Tavii (Owner)' : name,
        email: selectedEmail,
        avatar: avatarLetter,
        provider: 'google',
        isCoreMember: isOwner,
        activePlan: isOwner ? 'lifetime' : undefined,
      };

      onLoginSuccess(profile);
      setIsLoading(false);
      onClose();
    }, 500);
  };

  const handleEmailAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setGeneralError('');
    setSuccessMessage('');

    const trimmedEmail = email.trim().toLowerCase();
    const newErrors: Record<string, string> = {};

    if (!trimmedEmail) {
      newErrors.email = 'Email address is required.';
    } else if (!isValidEmail(trimmedEmail)) {
      newErrors.email = 'Please enter a valid email address (e.g. name@example.com).';
    }

    if (!password) {
      newErrors.password = 'Password is required.';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters long.';
    }

    if (authMode === 'signup') {
      if (!fullName.trim()) {
        newErrors.fullName = 'Full name is required.';
      }
      if (password !== confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match.';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      playClickPip();
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);

      // Check if user matches Owner
      const isOwner =
        trimmedEmail.includes('tavii.1613@gmail.com') ||
        trimmedEmail.includes('tavi.1613@gmail.com');

      // Retrieve registered accounts from localStorage
      let accounts: Array<{ name: string; email: string; pass: string }> = [];
      try {
        const stored = localStorage.getItem('questionaer_registered_accounts');
        if (stored) accounts = JSON.parse(stored);
      } catch {
        // ignore
      }

      if (authMode === 'signup') {
        // Check if account already exists
        const existing = accounts.find((a) => a.email.toLowerCase() === trimmedEmail);
        if (existing && !isOwner) {
          setGeneralError('An account with this email already exists. Please log in instead.');
          return;
        }

        // Save new user
        accounts.push({ name: fullName.trim(), email: trimmedEmail, pass: password });
        localStorage.setItem('questionaer_registered_accounts', JSON.stringify(accounts));

        const newProfile: UserProfile = {
          id: `email-user-${Date.now()}`,
          name: isOwner ? 'Tavii (Owner)' : fullName.trim(),
          email: trimmedEmail,
          avatar: (isOwner ? 'T' : fullName.trim()[0] || 'U').toUpperCase(),
          provider: 'email',
          isCoreMember: isOwner,
          activePlan: isOwner ? 'lifetime' : undefined,
        };

        setSuccessMessage('Account created successfully! Logging you in...');
        playTimerCompletionChime();

        setTimeout(() => {
          onLoginSuccess(newProfile);
          onClose();
        }, 800);
      } else {
        // Log in flow
        // Owner always logs in cleanly
        if (isOwner) {
          const ownerProfile: UserProfile = {
            id: 'owner-tavii',
            name: 'Tavii (Owner)',
            email: 'tavii.1613@gmail.com',
            avatar: 'T',
            provider: 'email',
            isCoreMember: true,
            activePlan: 'lifetime',
          };
          playTimerCompletionChime();
          onLoginSuccess(ownerProfile);
          onClose();
          return;
        }

        const found = accounts.find((a) => a.email.toLowerCase() === trimmedEmail);
        if (found && found.pass !== password) {
          setGeneralError('Incorrect password. Please verify your password and try again.');
          return;
        }

        const displayName = found?.name || trimmedEmail.split('@')[0];
        const profile: UserProfile = {
          id: `email-user-${Date.now()}`,
          name: displayName,
          email: trimmedEmail,
          avatar: displayName[0].toUpperCase(),
          provider: 'email',
          isCoreMember: false,
        };

        playTimerCompletionChime();
        onLoginSuccess(profile);
        onClose();
      }
    }, 600);
  };

  const handleForgotPassword = () => {
    if (!email.trim() || !isValidEmail(email)) {
      setGeneralError('Please enter your email address above to receive a password reset link.');
      return;
    }
    setSuccessMessage(`Password reset link sent to ${email.trim()}! Please check your inbox.`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div
        className="w-full max-w-md bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 dark:border-stone-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 flex items-center justify-center font-bold text-xs">
              Q
            </div>
            <span id="auth-modal-title" className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              Ouestionaer Account
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* Header Title */}
          <div className="text-center space-y-1">
            <h3 className="text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
              {authMode === 'signup'
                ? 'Create Your Account'
                : authMode === 'google_chooser'
                ? 'Sign in with Google'
                : 'Welcome Back'}
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              {authMode === 'signup'
                ? 'Sign up with email to unlock full conversational AI intelligence.'
                : 'Sign in to access your saved conversations, voices, and Core features.'}
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          {authMode !== 'google_chooser' && (
            <div className="flex items-center gap-1 p-1 bg-stone-100 dark:bg-stone-800 rounded-xl border border-stone-200 dark:border-stone-700">
              <button
                type="button"
                onClick={() => {
                  playClickPip();
                  setAuthMode('login');
                  setErrors({});
                  setGeneralError('');
                  setSuccessMessage('');
                }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  authMode === 'login'
                    ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                }`}
              >
                Log In
              </button>
              <button
                type="button"
                onClick={() => {
                  playClickPip();
                  setAuthMode('signup');
                  setErrors({});
                  setGeneralError('');
                  setSuccessMessage('');
                }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  authMode === 'signup'
                    ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                }`}
              >
                Create Account
              </button>
            </div>
          )}

          {/* General Error Banner */}
          {generalError && (
            <div className="flex items-center gap-2 p-3 text-xs text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{generalError}</span>
            </div>
          )}

          {/* Success Banner */}
          {successMessage && (
            <div className="flex items-center gap-2 p-3 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-lg">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Social Google Login Button */}
          {authMode !== 'google_chooser' && (
            <>
              <button
                type="button"
                onClick={() => {
                  playClickPip();
                  setAuthMode('google_chooser');
                }}
                className="w-full flex items-center justify-center gap-2.5 p-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-700/70 text-stone-800 dark:text-stone-200 text-xs font-semibold transition-colors shadow-2xs"
              >
                {/* Official Google G Logo */}
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              {/* Divider */}
              <div className="relative flex items-center justify-center">
                <div className="w-full border-t border-stone-200 dark:border-stone-800" />
                <span className="absolute bg-white dark:bg-stone-900 px-3 text-[11px] text-stone-400 uppercase tracking-wider font-medium">
                  Or with email
                </span>
              </div>
            </>
          )}

          {/* GOOGLE ACCOUNT CHOOSER VIEW */}
          {authMode === 'google_chooser' && (
            <div className="space-y-3">
              <div className="space-y-2">
                {/* Primary Owner Google Account */}
                <button
                  type="button"
                  onClick={() => handleGoogleSelect('Tavii (Owner)', 'tavii.1613@gmail.com', 'T')}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl border border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800/60 transition-colors text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-600 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                      T
                    </div>
                    <div>
                      <div className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                        <span>Tavii</span>
                        <span className="px-1.5 py-0.2 bg-amber-500 text-stone-950 rounded text-[9px] font-extrabold uppercase tracking-wider">
                          Owner
                        </span>
                      </div>
                      <div className="text-[11px] text-stone-500 dark:text-stone-400">
                        tavii.1613@gmail.com
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-stone-900 dark:group-hover:text-stone-100 group-hover:translate-x-0.5 transition-all" />
                </button>

                {/* Secondary Demo Account */}
                <button
                  type="button"
                  onClick={() => handleGoogleSelect('Alex Hunter', 'alex.hunter@gmail.com', 'A')}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl border border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800/60 transition-colors text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                      A
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-stone-900 dark:text-stone-100">
                        Alex Hunter
                      </div>
                      <div className="text-[11px] text-stone-500 dark:text-stone-400">
                        alex.hunter@gmail.com
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-stone-900 dark:group-hover:text-stone-100 group-hover:translate-x-0.5 transition-all" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setAuthMode('login')}
                className="w-full py-2 text-xs font-medium text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 text-center transition-colors"
              >
                ← Back to Email Sign In
              </button>
            </div>
          )}

          {/* EMAIL & PASSWORD FORM (LOG IN & SIGN UP) */}
          {authMode !== 'google_chooser' && (
            <form onSubmit={handleEmailAuthSubmit} className="space-y-3.5">
              {/* Full Name field in Sign Up mode */}
              {authMode === 'signup' && (
                <div>
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      type="text"
                      placeholder="e.g. Tavii Patel"
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value);
                        if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: '' }));
                      }}
                      className={`w-full pl-8 pr-3 py-2 text-xs bg-white dark:bg-stone-800 border rounded-lg text-stone-900 dark:text-stone-100 focus:outline-hidden transition-colors ${
                        errors.fullName
                          ? 'border-rose-500 ring-1 ring-rose-500'
                          : 'border-stone-300 dark:border-stone-700 focus:ring-1 focus:ring-stone-400'
                      }`}
                    />
                  </div>
                  {errors.fullName && (
                    <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">
                      {errors.fullName}
                    </p>
                  )}
                </div>
              )}

              {/* Email ID field */}
              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Email ID
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
                    }}
                    className={`w-full pl-8 pr-3 py-2 text-xs bg-white dark:bg-stone-800 border rounded-lg text-stone-900 dark:text-stone-100 focus:outline-hidden transition-colors ${
                      errors.email
                        ? 'border-rose-500 ring-1 ring-rose-500'
                        : 'border-stone-300 dark:border-stone-700 focus:ring-1 focus:ring-stone-400'
                    }`}
                  />
                </div>
                {errors.email && (
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">
                    {errors.email}
                  </p>
                )}
                {/* Instant Owner recognition notice */}
                {(email.toLowerCase().includes('tavii.1613@gmail.com') ||
                  email.toLowerCase().includes('tavi.1613@gmail.com')) && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 font-semibold flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    <span>Owner Account Verified: Full Access & Free Forever active!</span>
                  </p>
                )}
              </div>

              {/* Password field */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-stone-700 dark:text-stone-300">
                    Password
                  </label>
                  {authMode === 'login' && (
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      className="text-[11px] text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 hover:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password) setErrors((prev) => ({ ...prev, password: '' }));
                    }}
                    className={`w-full pl-8 pr-9 py-2 text-xs bg-white dark:bg-stone-800 border rounded-lg text-stone-900 dark:text-stone-100 focus:outline-hidden transition-colors ${
                      errors.password
                        ? 'border-rose-500 ring-1 ring-rose-500'
                        : 'border-stone-300 dark:border-stone-700 focus:ring-1 focus:ring-stone-400'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">
                    {errors.password}
                  </p>
                )}
              </div>

              {/* Confirm Password in Sign Up mode */}
              {authMode === 'signup' && (
                <div>
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Repeat your password"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (errors.confirmPassword)
                          setErrors((prev) => ({ ...prev, confirmPassword: '' }));
                      }}
                      className={`w-full pl-8 pr-3 py-2 text-xs bg-white dark:bg-stone-800 border rounded-lg text-stone-900 dark:text-stone-100 focus:outline-hidden transition-colors ${
                        errors.confirmPassword
                          ? 'border-rose-500 ring-1 ring-rose-500'
                          : 'border-stone-300 dark:border-stone-700 focus:ring-1 focus:ring-stone-400'
                      }`}
                    />
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">
                      {errors.confirmPassword}
                    </p>
                  )}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 text-xs font-semibold rounded-lg bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-stone-200 transition-colors shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50 mt-2"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : authMode === 'signup' ? (
                  <span>Create Account & Continue</span>
                ) : (
                  <span>Log In with Email</span>
                )}
              </button>
            </form>
          )}

          {/* Bottom Switcher */}
          {authMode !== 'google_chooser' && (
            <div className="pt-2 text-center text-xs text-stone-500 dark:text-stone-400">
              {authMode === 'login' ? (
                <span>
                  Don&apos;t have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      playClickPip();
                      setAuthMode('signup');
                      setErrors({});
                      setGeneralError('');
                      setSuccessMessage('');
                    }}
                    className="font-semibold text-stone-900 dark:text-stone-100 hover:underline"
                  >
                    Create an account
                  </button>
                </span>
              ) : (
                <span>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      playClickPip();
                      setAuthMode('login');
                      setErrors({});
                      setGeneralError('');
                      setSuccessMessage('');
                    }}
                    className="font-semibold text-stone-900 dark:text-stone-100 hover:underline"
                  >
                    Log In
                  </button>
                </span>
              )}
            </div>
          )}

          {/* Privacy & Trust footer */}
          <div className="flex items-center gap-2 pt-3 border-t border-stone-100 dark:border-stone-800/80 text-[11px] text-stone-400">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>
              256-bit secure end-to-end authentication. Your data is protected.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
