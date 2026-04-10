import { useEffect, useState } from 'react';

const SESSION_KEY = 'kt_auth_session';
const SESSION_CHANGE_EVENT = 'kt-auth-change';

function readSession() {
  try {
    const rawSession = localStorage.getItem(SESSION_KEY);
    return rawSession ? JSON.parse(rawSession) : null;
  } catch (error) {
    return null;
  }
}

function syncSession(session) {
  if (session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }

  window.dispatchEvent(new Event(SESSION_CHANGE_EVENT));
}

export function getAuthSession() {
  return readSession();
}

export function getCurrentUser() {
  return getAuthSession()?.user || null;
}

export function getCurrentRole() {
  return getCurrentUser()?.role || 'viewer';
}

export function getAccessToken() {
  return getAuthSession()?.token || '';
}

export function saveAuthSession(session) {
  syncSession(session);
}

export function clearAuthSession() {
  syncSession(null);
}

export function useAuthSession() {
  const [session, setSession] = useState(getAuthSession);

  useEffect(() => {
    function syncFromStorage() {
      setSession(getAuthSession());
    }

    window.addEventListener('storage', syncFromStorage);
    window.addEventListener(SESSION_CHANGE_EVENT, syncFromStorage);

    return () => {
      window.removeEventListener('storage', syncFromStorage);
      window.removeEventListener(SESSION_CHANGE_EVENT, syncFromStorage);
    };
  }, []);

  return session;
}

export function useCurrentUser() {
  const session = useAuthSession();
  return session?.user || null;
}

export function useCurrentRole() {
  return useCurrentUser()?.role || 'viewer';
}
