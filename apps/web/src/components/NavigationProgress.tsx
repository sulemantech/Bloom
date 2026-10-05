"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * A thin bar at the top of the screen from the moment an internal link is clicked until the new
 * page is shown, so a slow page never looks like a dead button. Runs in the browser, so it shows
 * even while the server is still working (or, in development, compiling the page).
 */
export function NavigationProgress({ label }: { label: string }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const here = `${pathname}?${search}`;
  const hereRef = useRef(here);
  // The URL we were on when a link was clicked; the bar shows until the URL changes.
  const [leaving, setLeaving] = useState<string | null>(null);

  useEffect(() => {
    hereRef.current = here;
  }, [here]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.("a");
      if (!link || (link.target && link.target !== "_self") || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      setLeaving(hereRef.current);
    }
    // Capture phase: Next's Link cancels the click's default action, so a bubbling listener can't tell it apart.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  if (leaving === null || leaving !== here) return null;
  return (
    <div role="progressbar" aria-label={label} className="pointer-events-none fixed inset-x-0 top-0 z-50 h-1 print:hidden">
      <div className="nav-progress h-full rounded-r-full bg-gradient-to-r from-lime to-cyan" />
    </div>
  );
}
