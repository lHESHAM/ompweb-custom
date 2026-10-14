"use client";
import { useLayoutEffect, useState, type CSSProperties, type RefObject } from "react";

/** Keep an absolute menu inside both the viewport and its clipping ancestors. */
export function useAnchoredMenuPosition(open: boolean, anchorRef: RefObject<HTMLElement | null>, desiredWidth: number, desiredHeight: number): CSSProperties {
  const [placement, setPlacement] = useState<CSSProperties>({ visibility: "hidden" });
  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!open || !anchor) return;
    const update = () => {
      const scale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ui-scale")) || 1;
      const rect = anchor.getBoundingClientRect();
      let left = 8 * scale, right = window.innerWidth - 8 * scale;
      let top = 8 * scale, bottom = window.innerHeight - 8 * scale;
      for (let node = anchor.parentElement; node && node !== document.body && node !== document.documentElement; node = node.parentElement) {
        const style = getComputedStyle(node), bounds = node.getBoundingClientRect();
        if (/(hidden|clip|auto|scroll)/.test(style.overflowX)) { left = Math.max(left, bounds.left + 8 * scale); right = Math.min(right, bounds.right - 8 * scale); }
        if (/(hidden|clip|auto|scroll)/.test(style.overflowY)) { top = Math.max(top, bounds.top + 8 * scale); bottom = Math.min(bottom, bounds.bottom - 8 * scale); }
      }
      const width = Math.max(0, Math.min(desiredWidth, (right - left) / scale));
      // Near the right edge, align the right edges instead of overflowing right.
      const preferredLeft = rect.left + width * scale <= right ? rect.left : rect.right - width * scale;
      const x = Math.max(left, Math.min(preferredLeft, right - width * scale));
      const above = Math.max(0, (rect.top - top) / scale - 6);
      const below = Math.max(0, (bottom - rect.bottom) / scale - 6);
      const down = above < desiredHeight && below > above;
      const height = Math.min(desiredHeight, down ? below : above);
      const next: CSSProperties = { position: "absolute", left: (x - rect.left) / scale, right: "auto", width, maxWidth: width, maxHeight: height, overflowY: "auto", visibility: "visible", ...(down ? { top: "calc(100% + 6px)", bottom: "auto" } : { bottom: "calc(100% + 6px)", top: "auto" }) };
      setPlacement((previous) => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    };
    update();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    observer?.observe(anchor);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => { observer?.disconnect(); window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); };
  }, [open, anchorRef, desiredWidth, desiredHeight]);
  return placement;
}
