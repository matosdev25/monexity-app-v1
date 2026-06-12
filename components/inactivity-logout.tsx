"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
const ACTIVITY_EVENTS = ["click", "keydown", "mousemove", "scroll", "touchstart", "focus"] as const;

export function useInactivityLogout() {
  const router = useRouter();
  const timeoutRef = useRef<number | null>(null);
  const lastActivityRef = useRef(0);
  const signingOutRef = useRef(false);

  useEffect(() => {
    const supabase = createClient();
    lastActivityRef.current = Date.now();

    const clearLogoutTimer = () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };

    const logoutByInactivity = async () => {
      if (signingOutRef.current) return;
      signingOutRef.current = true;

      clearLogoutTimer();
      await supabase.auth.signOut();
      document.cookie = "active_company_id=; Max-Age=0; path=/";
      router.replace("/auth/login?expired=inactive");
      router.refresh();
    };

    const scheduleLogoutTimer = () => {
      clearLogoutTimer();
      const elapsed = Date.now() - lastActivityRef.current;
      const remaining = Math.max(0, INACTIVITY_TIMEOUT_MS - elapsed);

      timeoutRef.current = window.setTimeout(() => {
        const inactiveFor = Date.now() - lastActivityRef.current;

        if (inactiveFor >= INACTIVITY_TIMEOUT_MS) {
          void logoutByInactivity();
          return;
        }

        scheduleLogoutTimer();
      }, remaining);
    };

    const resetLogoutTimer = () => {
      if (signingOutRef.current) return;
      const inactiveFor = Date.now() - lastActivityRef.current;

      if (inactiveFor >= INACTIVITY_TIMEOUT_MS) {
        void logoutByInactivity();
        return;
      }

      lastActivityRef.current = Date.now();
      scheduleLogoutTimer();
    };

    const checkElapsedInactivity = () => {
      if (signingOutRef.current) return;
      const inactiveFor = Date.now() - lastActivityRef.current;

      if (inactiveFor >= INACTIVITY_TIMEOUT_MS) {
        void logoutByInactivity();
        return;
      }

      scheduleLogoutTimer();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkElapsedInactivity();
      }
    };

    const listenerOptions: AddEventListenerOptions = {
      capture: true,
      passive: true,
    };

    scheduleLogoutTimer();

    ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, resetLogoutTimer, listenerOptions);
    });
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearLogoutTimer();
      ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, resetLogoutTimer, listenerOptions);
      });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [router]);
}

export function InactivityLogout() {
  useInactivityLogout();

  return null;
}
