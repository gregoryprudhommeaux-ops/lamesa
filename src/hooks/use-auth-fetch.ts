"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { useCallback } from "react";

export function useAuthFetch() {
  const { getIdToken } = useAuth();

  return useCallback(
    async (input: string, init: RequestInit = {}) => {
      const token = await getIdToken();
      const headers = new Headers(init.headers);
      if (token) headers.set("Authorization", `Bearer ${token}`);
      if (init.body && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
      return fetch(input, { ...init, headers });
    },
    [getIdToken],
  );
}
