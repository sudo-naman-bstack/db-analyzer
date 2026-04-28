"use client";

import { useEffect } from "react";

/**
 * On mount and on hashchange, find the element matching the URL hash and,
 * if it's a <details>, open it and scroll it into view. Used by the
 * customers page so deep-linking to /customers#HBF auto-expands HBF.
 */
export function ExpandOnHash() {
  useEffect(() => {
    const apply = () => {
      const raw = window.location.hash.slice(1);
      if (!raw) return;
      const id = decodeURIComponent(raw);
      const el = document.getElementById(id);
      if (!el) return;
      if (el.tagName.toLowerCase() === "details") {
        (el as HTMLDetailsElement).open = true;
      }
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);
  return null;
}
