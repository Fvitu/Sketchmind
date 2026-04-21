import { useEffect } from "react";

/**
 * Tracks the global pointer and updates CSS variables on every
 * [data-reactive-glow] element so they can render a luminous border
 * that intensifies as the cursor approaches.
 *
 * Variables set per element:
 *   --glow-x, --glow-y  pointer position relative to element (px)
 *   --glow-d            0..1 closeness factor (1 = pointer on element)
 */
export const useReactiveGlow = () => {
  useEffect(() => {
    const RANGE = 160; // px from element bounds where effect starts
    let raf = 0;
    let lastX = 0;
    let lastY = 0;
    const root = document.documentElement;

    const update = () => {
		raf = 0;
		const els = document.querySelectorAll<HTMLElement>("[data-reactive-glow]");
		let maxCloseness = 0;

		els.forEach((el) => {
			const r = el.getBoundingClientRect();
			if (r.width === 0 || r.height === 0) return;

			const x = lastX - r.left;
			const y = lastY - r.top;

			// Distance from pointer to nearest edge (0 if inside)
			const dx = Math.max(r.left - lastX, 0, lastX - r.right);
			const dy = Math.max(r.top - lastY, 0, lastY - r.bottom);
			const dist = Math.hypot(dx, dy);

			const closeness = Math.max(0, 1 - dist / RANGE);
			maxCloseness = Math.max(maxCloseness, closeness);

			el.style.setProperty("--glow-x", `${x}px`);
			el.style.setProperty("--glow-y", `${y}px`);
			el.style.setProperty("--glow-d", closeness.toFixed(3));
		});

		// Do not update page-level glow variables to avoid a background
		// reflection that follows the cursor. Per-element glow remains.
	};

    const onMove = (e: PointerEvent) => {
      lastX = e.clientX;
      lastY = e.clientY;
      if (!raf) raf = requestAnimationFrame(update);
    };

    const onLeave = () => {
		// no-op for page glow — keep per-element glow behavior
	};

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave, { passive: true });

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
};
