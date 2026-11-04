"use client";

import { useEffect } from "react";

// Revela una sola vez los elementos [data-reveal] del homepage al entrar al
// viewport. Un único IntersectionObserver, sin listeners de scroll; los estilos
// viven en globals.css (solo opacity/transform, sin animar con movimiento reducido).
export function ScrollReveal() {
  useEffect(() => {
    const root = document.documentElement;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!("IntersectionObserver" in window)) return;

    const elements = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const viewportHeight = window.innerHeight;

    // Lo que ya se ve al cargar queda revelado ANTES de activar el estado
    // inicial: evita que el contenido visible parpadee.
    const pending = elements.filter((el) => {
      if (el.getBoundingClientRect().top < viewportHeight * 0.92) {
        el.setAttribute("data-revealed", "");
        return false;
      }
      return true;
    });

    root.classList.add("mx-reveal-ready");
    if (pending.length === 0) return () => root.classList.remove("mx-reveal-ready");

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-revealed", "");
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
    );

    pending.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
      root.classList.remove("mx-reveal-ready");
    };
  }, []);

  return null;
}
