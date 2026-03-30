import { useContext } from 'react';

/**
 * Shared useAuth hook.
 * Each app provides its own AuthContext; this hook reads from whichever
 * AuthContext is in scope and throws a helpful error if called outside one.
 *
 * Usage:
 *   import { useAuth } from '../../packages/hooks/useAuth';
 *
 * Or simply use the local context/AuthContext.jsx useAuth in each app
 * (those already re-export the same interface).
 */

let _AuthContext = null;

/** Called once at app startup to register the app's AuthContext object */
export function registerAuthContext(ctx) {
  _AuthContext = ctx;
}

export function useAuth() {
  if (!_AuthContext) {
    throw new Error('AuthContext has not been registered. Call registerAuthContext first.');
  }
  const ctx = useContext(_AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside an <AuthProvider>');
  }
  return ctx;
}

export default useAuth;
