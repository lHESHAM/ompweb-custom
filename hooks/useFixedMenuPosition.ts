"use client";

import { useLayoutEffect, useState, type RefObject } from "react";

const GAP = 4;
const VIEWPORT_PAD = 8;

/** Viewport position for a `position: fixed` menu below `triggerRef`, so the
 * menu escapes clipping ancestors such as the compact top-bar overflow strip.
 * Tracks scroll and resize while open. Returns null while closed. */
export function useFixedMenuPosition(
  open: boolean,
  triggerRef: RefObject<HTMLElement | null>,
  menuWidth: number,
  menuHeight = 420,
): { top?: number; bottom?: number; left: number; width: number; maxHeight: number } | null {
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number; width: number; maxHeight: number } | null>(null);

  useLayoutEffect(() => {
    const trigger = triggerRef.current;
    if (!open || !trigger) {
      setPos(null);
      return;
    }
    const update = () => {
      // --ui-scale zooms <html>: the rect is in painted pixels, while fixed
      // coordinates are zoomed again, so convert to unscaled CSS pixels.
      const scale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ui-scale")) || 1;
      const rect = trigger.getBoundingClientRect();
      const width = Math.min(menuWidth, window.innerWidth / scale - VIEWPORT_PAD * 2);
      const maxLeft = window.innerWidth / scale - width - VIEWPORT_PAD;
      const viewportHeight = window.innerHeight / scale;
      const above = Math.max(0, rect.top / scale - GAP - VIEWPORT_PAD);
      const below = Math.max(0, viewportHeight - rect.bottom / scale - GAP - VIEWPORT_PAD);
      const flip = below < menuHeight && above > below;
      setPos({ ...(flip ? { bottom: viewportHeight - rect.top / scale + GAP } : { top: rect.bottom / scale + GAP }), left: Math.max(VIEWPORT_PAD, Math.min(rect.left / scale, maxLeft)), width, maxHeight: Math.min(menuHeight, flip ? above : below) });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, triggerRef, menuWidth, menuHeight]);

  return pos;
}
