"use client";

import { useState, useEffect } from "react";

export interface AuthUser {
  id: string;
  displayName: string;
  image?: string;
}

export interface AuthState {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: AuthUser | null;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ isLoaded: false, isSignedIn: false, user: null });

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((data: { user: AuthUser | null }) => {
        setState({ isLoaded: true, isSignedIn: !!data.user, user: data.user ?? null });
      })
      .catch(() => {
        setState({ isLoaded: true, isSignedIn: false, user: null });
      });
  }, []);

  return state;
}
