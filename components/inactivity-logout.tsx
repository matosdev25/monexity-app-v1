"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
const ACTIVITY_EVENTS = ["mousemove", "keydown", "click", "scroll", "touchstart"] as const;

export function useInactivityLogout() {
  const router = useRouter();
  const timeoutRef = useRef<number | null>(null);
  const signingOutRef = useRef(false);

  useEffect(() => {
    const supabase = createClient();

    const clearLogoutTimer = () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };

    const logoutByInactivity = async () => {
      if (signingOutRef.current) return;
      signingOutRef.current = true;

      await supabase.auth.signOut();
      router.replace("/auth/login?expired=inactive");
      router.refresh();
    };

    const resetLogoutTimer = () => {
      clearLogoutTimer();
      timeoutRef.current = window.setTimeout(
        logoutByInactivity,
        INACTIVITY_TIMEOUT_MS
      );
    };

    const listenerOptions: AddEventListenerOptions = {
      capture: true,
      passive: true,
    };

    resetLogoutTimer();

    ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, resetLogoutTimer, listenerOptions);
    });

    return () => {
      clearLogoutTimer();
      ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, resetLogoutTimer, listenerOptions);
      });
    };
  }, [router]);
}

export function InactivityLogout() {
  useInactivityLogout();

  return null;
}
