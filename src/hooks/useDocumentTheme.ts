import { useEffect, useState } from "react";

type CanvasTheme = "light" | "dark";

function readTheme(): CanvasTheme {
  if (typeof document === "undefined") {
    return "dark";
  }

  const root = document.documentElement;
  const dataTheme = root.dataset.theme;

  if (root.classList.contains("light") || dataTheme === "light") {
    return "light";
  }

  return "dark";
}

export function useDocumentTheme(): CanvasTheme {
  const [theme, setTheme] = useState<CanvasTheme>(() => readTheme());

  useEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => setTheme(readTheme());
    const observer = new MutationObserver(syncTheme);

    observer.observe(root, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });

    syncTheme();

    return () => observer.disconnect();
  }, []);

  return theme;
}
