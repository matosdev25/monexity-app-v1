"use client";

import { useSyncExternalStore } from "react";

// Tema automático por hora LOCAL del dispositivo (Date#getHours, nunca UTC):
//   07:00–18:59 → claro · 19:00–06:59 → oscuro
export const AUTO_LIGHT_START_HOUR = 7;
export const AUTO_DARK_START_HOUR = 19;

export type ThemePreference = "light" | "dark" | "auto";
export type ResolvedTheme = "light" | "dark";

export function resolveAutoTheme(date = new Date()): ResolvedTheme {
  const hour = date.getHours();
  return hour >= AUTO_LIGHT_START_HOUR && hour < AUTO_DARK_START_HOUR ? "light" : "dark";
}

export function resolveTheme(preference: string | null | undefined, date = new Date()): ResolvedTheme {
  if (preference === "light" || preference === "dark") return preference;
  return resolveAutoTheme(date);
}

// Milisegundos hasta el próximo cambio automático (07:00 o 19:00 locales).
export function msUntilNextAutoChange(date = new Date()) {
  const next = new Date(date);
  const hour = date.getHours();
  if (hour < AUTO_LIGHT_START_HOUR) {
    next.setHours(AUTO_LIGHT_START_HOUR, 0, 0, 0);
  } else if (hour < AUTO_DARK_START_HOUR) {
    next.setHours(AUTO_DARK_START_HOUR, 0, 0, 0);
  } else {
    next.setDate(next.getDate() + 1);
    next.setHours(AUTO_LIGHT_START_HOUR, 0, 0, 0);
  }
  return Math.max(next.getTime() - date.getTime(), 1_000);
}

// Única fuente de la clase light/dark del <html>.
export function applyResolvedTheme(theme: ResolvedTheme) {
  const root = document.documentElement;
  if (root.classList.contains(theme) && !root.classList.contains(theme === "dark" ? "light" : "dark")) {
    root.style.colorScheme = theme;
    return;
  }
  root.classList.remove("light", "dark", "auto");
  root.classList.add(theme);
  root.style.colorScheme = theme;
}

// Script previo al primer pintado: misma regla, sin depender de React.
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem("theme")||"auto";if(p==="system"){p="auto";localStorage.setItem("theme","auto");}var h=new Date().getHours();var t=p==="light"||p==="dark"?p:(h>=${AUTO_LIGHT_START_HOUR}&&h<${AUTO_DARK_START_HOUR}?"light":"dark");var r=document.documentElement;r.classList.remove("light","dark","auto");r.classList.add(t);r.style.colorScheme=t;}catch(e){}})();`;

// Tema realmente aplicado (lee la clase del <html>): sirve para toggles y gráficos,
// incluido el cambio automático sin recargar.
function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

function getSnapshot(): ResolvedTheme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function getServerSnapshot(): ResolvedTheme | null {
  return null;
}

export function useResolvedTheme(): ResolvedTheme | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
