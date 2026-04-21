import { useEffect, useRef, useState } from "react";

/**
 * Renders a soft spotlight that follows the pointer inside its parent
 * (which must be position: relative). Uses mix-blend-mode: difference
 * so it dynamically contrasts with the underlying background.
 *
 * Hides the native cursor on the parent via the `cursor-spotlight` class.
 */
export const SpotlightCursor = () => {
  const pointerRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const parent = pointerRef.current?.parentElement;
    if (!parent) return;

    let raf = 0;
    let tx = 0;
    let ty = 0;
    let cx = 0;
    let cy = 0;
    let dx = 0;
    let dy = 0;

    const tick = () => {
      // Smoothly chase the pointer for the soft halo
      cx += (tx - cx) * 0.18;
      cy += (ty - cy) * 0.18;
      // Inner dot tracks faster
      dx += (tx - dx) * 0.45;
      dy += (ty - dy) * 0.45;

      if (pointerRef.current) {
        pointerRef.current.style.setProperty("--cx", `${cx}px`);
        pointerRef.current.style.setProperty("--cy", `${cy}px`);
      }
      if (dotRef.current) {
        dotRef.current.style.setProperty("--cx", `${dx}px`);
        dotRef.current.style.setProperty("--cy", `${dy}px`);
      }
      raf = requestAnimationFrame(tick);
    };

    const onMove = (e: PointerEvent) => {
      const r = parent.getBoundingClientRect();
      tx = e.clientX - r.left;
      ty = e.clientY - r.top;
      if (!visible) setVisible(true);
    };
    const onEnter = () => setVisible(true);
    const onLeave = () => setVisible(false);

    parent.addEventListener("pointermove", onMove);
    parent.addEventListener("pointerenter", onEnter);
    parent.addEventListener("pointerleave", onLeave);
    raf = requestAnimationFrame(tick);

    return () => {
      parent.removeEventListener("pointermove", onMove);
      parent.removeEventListener("pointerenter", onEnter);
      parent.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, [visible]);

  return (
    <>
      <div
        ref={pointerRef}
        className="cursor-spotlight-pointer"
        style={{ opacity: visible ? 1 : 0 }}
        aria-hidden
      />
      <div
        ref={dotRef}
        className="cursor-spotlight-dot"
        style={{ opacity: visible ? 1 : 0 }}
        aria-hidden
      />
    </>
  );
};
