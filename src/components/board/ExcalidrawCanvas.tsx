import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Excalidraw, restore } from "@excalidraw/excalidraw";
import { HexAlphaColorPicker, HexColorInput } from "react-colorful";
import type {
  AppState,
  ExcalidrawElement,
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
  Theme,
} from "@excalidraw/excalidraw/types";
import { Check, Palette, Grid3X3 } from "lucide-react";
import "@excalidraw/excalidraw/index.css";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { CanvasData } from "@/types/canvas";

const DEFAULT_BACKGROUND_COLOR = "#0b1120";
const EXCALIDRAW_THEME: Theme = "dark";
const READABLE_FONT_FAMILY = 2;

const BACKGROUND_SWATCHES = [
  "#000000",
  "#0b1120",
  "#1f2937",
  "#3v sithwu 34155",
  "#475569",
  "#ffffff",
];

const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const RGB_COLOR_REGEX =
  /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0|1|0?\.\d+))?\s*\)$/i;

interface RGBAColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

function clampChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function clampAlpha(value: number) {
  return Math.max(0, Math.min(1, value));
}

function parseColor(color: string): RGBAColor | null {
  if (HEX_COLOR_REGEX.test(color)) {
    const value = color.slice(1);

    if (value.length === 3 || value.length === 4) {
      const [r, g, b, a = "f"] = value.split("");

      return {
        r: Number.parseInt(`${r}${r}`, 16),
        g: Number.parseInt(`${g}${g}`, 16),
        b: Number.parseInt(`${b}${b}`, 16),
        a: Number.parseInt(`${a}${a}`, 16),
      };
    }

    return {
      r: Number.parseInt(value.slice(0, 2), 16),
      g: Number.parseInt(value.slice(2, 4), 16),
      b: Number.parseInt(value.slice(4, 6), 16),
      a: value.length === 8 ? Number.parseInt(value.slice(6, 8), 16) : 255,
    };
  }

  const rgbMatch = color.match(RGB_COLOR_REGEX);

  if (!rgbMatch) {
    return null;
  }

  return {
    r: clampChannel(Number.parseInt(rgbMatch[1], 10)),
    g: clampChannel(Number.parseInt(rgbMatch[2], 10)),
    b: clampChannel(Number.parseInt(rgbMatch[3], 10)),
    a: Math.round(clampAlpha(rgbMatch[4] ? Number.parseFloat(rgbMatch[4]) : 1) * 255),
  };
}

function toHex(value: number) {
  return clampChannel(value).toString(16).padStart(2, "0");
}

function toCanonicalColor(color: string) {
  const parsed = parseColor(color);

  if (!parsed) {
    return DEFAULT_BACKGROUND_COLOR;
  }

  const baseColor = `#${toHex(parsed.r)}${toHex(parsed.g)}${toHex(parsed.b)}`;
  return parsed.a >= 255 ? baseColor : `${baseColor}${toHex(parsed.a)}`;
}

function normalizeColorInputValue(color: string) {
  return toCanonicalColor(color);
}

function normalizeSceneBackgroundColor(color?: string | null) {
  return normalizeColorInputValue(color ?? DEFAULT_BACKGROUND_COLOR);
}

function toPickerColor(color: string) {
  const parsed = parseColor(color);

  if (!parsed) {
    return `${DEFAULT_BACKGROUND_COLOR}ff`;
  }

  return `#${toHex(parsed.r)}${toHex(parsed.g)}${toHex(parsed.b)}${toHex(parsed.a)}`;
}

interface ExcalidrawCanvasProps {
  canEdit: boolean;
  initialCanvasData: CanvasData | null;
  onAPIReady: (api: ExcalidrawImperativeAPI) => void;
  onChange: (
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    files: CanvasData["files"],
  ) => void;
  theme: Theme;
}

export function ExcalidrawCanvas({
  canEdit,
  initialCanvasData,
  onAPIReady,
  onChange,
  theme: _theme,
}: ExcalidrawCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hintText, setHintText] = useState<string | null>(null);
  const excalidrawAPIRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const selectedBackgroundColorRef = useRef(DEFAULT_BACKGROUND_COLOR);
  const pendingSceneColorRef = useRef<string | null>(null);

  const initialData = useMemo<ExcalidrawInitialDataState>(() => {
    if (initialCanvasData) {
      const restored = restore(initialCanvasData, null, null);
      const normalizedElements = restored.elements.map((element) =>
        element.fontFamily === 4 ? { ...element, fontFamily: READABLE_FONT_FAMILY } : element,
      );

      return {
        elements: normalizedElements,
        files: restored.files,
        appState: {
          ...restored.appState,
          currentItemFontFamily:
            restored.appState.currentItemFontFamily === 4
              ? READABLE_FONT_FAMILY
              : restored.appState.currentItemFontFamily ?? READABLE_FONT_FAMILY,
          currentHoveredFontFamily:
            restored.appState.currentHoveredFontFamily === 4
              ? READABLE_FONT_FAMILY
              : restored.appState.currentHoveredFontFamily,
          theme: EXCALIDRAW_THEME,
          viewBackgroundColor:
            restored.appState.viewBackgroundColor ?? DEFAULT_BACKGROUND_COLOR,
        },
        scrollToContent: true,
      };
    }

    return {
      elements: [],
      files: {},
      appState: {
        currentItemFontFamily: READABLE_FONT_FAMILY,
        theme: EXCALIDRAW_THEME,
        viewBackgroundColor: DEFAULT_BACKGROUND_COLOR,
      },
      scrollToContent: false,
    };
  }, [initialCanvasData]);

  const initialBackgroundColor =
    initialData.appState?.viewBackgroundColor ?? DEFAULT_BACKGROUND_COLOR;

  const [selectedBackgroundColor, setSelectedBackgroundColor] = useState(
    normalizeColorInputValue(initialBackgroundColor),
  );
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isGridEnabled, setIsGridEnabled] = useState(() => {
    return localStorage.getItem("sketchmind_grid_enabled") === "true";
  });
  const gridCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    selectedBackgroundColorRef.current = selectedBackgroundColor;
  }, [selectedBackgroundColor]);

  useEffect(() => {
    localStorage.setItem("sketchmind_grid_enabled", isGridEnabled ? "true" : "false");
  }, [isGridEnabled]);

  useEffect(() => {
    const normalizedInitialBackgroundColor = normalizeColorInputValue(initialBackgroundColor);
    pendingSceneColorRef.current = null;
    setSelectedBackgroundColor(normalizedInitialBackgroundColor);
  }, [initialBackgroundColor]);

  useEffect(() => {
    const api = excalidrawAPIRef.current;

    if (!api) {
      return;
    }

    const currentSceneColor = normalizeSceneBackgroundColor(api.getAppState().viewBackgroundColor);

    if (currentSceneColor === selectedBackgroundColor) {
      pendingSceneColorRef.current = null;
      return;
    }

    pendingSceneColorRef.current = selectedBackgroundColor;
    api.updateScene({
      appState: {
        viewBackgroundColor: selectedBackgroundColor,
      },
    });
  }, [selectedBackgroundColor]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) return;

    // hide original Excalidraw hint viewer via CSS
    const styleEl = document.createElement("style");
    styleEl.textContent = ".sketchmind-canvas .HintViewer{display:none !important;}";
    container.appendChild(styleEl);

    const findAndObserve = () => {
      const hintEl = container.querySelector<HTMLElement>(".HintViewer");

      if (!hintEl) {
        setHintText(null);
        return null;
      }

      setHintText(hintEl.textContent?.trim() ?? null);

      const mo = new MutationObserver(() => {
        setHintText(hintEl.textContent?.trim() ?? null);
      });

      mo.observe(hintEl, { characterData: true, subtree: true, childList: true });
      return mo;
    };

    let observer = findAndObserve();

    // in case Excalidraw mounts later and injects the element, also observe container
    const containerMo = new MutationObserver(() => {
      if (!observer) {
        observer = findAndObserve();
      }
    });

    containerMo.observe(container, { childList: true, subtree: true });

    return () => {
      containerMo.disconnect();
      if (observer) observer.disconnect();
      styleEl.remove();
    };
  }, []);

  const handleBackgroundColorChange = useCallback(
    (nextColor: string) => {
      if (!canEdit) {
        return;
      }

      const normalizedColor = normalizeColorInputValue(nextColor);

      if (normalizedColor === selectedBackgroundColorRef.current) {
        return;
      }

      setSelectedBackgroundColor(normalizedColor);
    },
    [canEdit],
  );

  const colorInputValue = toPickerColor(selectedBackgroundColor);

  const handleSceneChange = useCallback(
    (
      elements: readonly ExcalidrawElement[],
      appState: AppState,
      files: CanvasData["files"],
    ) => {
      const gridCanvas = gridCanvasRef.current;
      if (gridCanvas && isGridEnabled && containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        if (gridCanvas.width !== width || gridCanvas.height !== height) {
          gridCanvas.width = width;
          gridCanvas.height = height;
        }
        
        const ctx = gridCanvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, width, height);

          const BASE_CELL_SIZE = 20;
          const { zoom, scrollX, scrollY } = appState;
          const cell = BASE_CELL_SIZE * zoom.value;
          
          if (cell >= 2) {
            const offsetX = (scrollX * zoom.value) % (cell * 5);
            const offsetY = (scrollY * zoom.value) % (cell * 5);

            ctx.beginPath();
            ctx.lineWidth = 0.5;
            ctx.strokeStyle = "rgba(255, 255, 255, 0.07)";
            for (let x = offsetX - cell * 5; x < width; x += cell) {
              ctx.moveTo(x, 0);
              ctx.lineTo(x, height);
            }
            for (let y = offsetY - cell * 5; y < height; y += cell) {
              ctx.moveTo(0, y);
              ctx.lineTo(width, y);
            }
            ctx.stroke();

            ctx.beginPath();
            ctx.lineWidth = 1;
            ctx.strokeStyle = "rgba(255, 255, 255, 0.13)";
            for (let x = offsetX - cell * 5; x < width; x += (cell * 5)) {
              ctx.moveTo(x, 0);
              ctx.lineTo(x, height);
            }
            for (let y = offsetY - cell * 5; y < height; y += (cell * 5)) {
              ctx.moveTo(0, y);
              ctx.lineTo(width, y);
            }
            ctx.stroke();
          }
        }
      } else if (gridCanvas && !isGridEnabled) {
        const ctx = gridCanvas.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
      }

      const sceneBackgroundColor = normalizeSceneBackgroundColor(appState.viewBackgroundColor);
      const pendingSceneColor = pendingSceneColorRef.current;

      if (pendingSceneColor) {
        if (sceneBackgroundColor === pendingSceneColor) {
          pendingSceneColorRef.current = null;
        } else {
          onChange(elements, appState, files);
          return;
        }
      }

      if (sceneBackgroundColor !== selectedBackgroundColorRef.current) {
        setSelectedBackgroundColor(sceneBackgroundColor);
      }

      onChange(elements, appState, files);
    },
    [onChange, isGridEnabled],
  );

  const handleAPIReady = useCallback(
    (api: ExcalidrawImperativeAPI) => {
      excalidrawAPIRef.current = api;
      onAPIReady(api);
    },
    [onAPIReady],
  );

  const selectedSwatch = normalizeColorInputValue(selectedBackgroundColor);

  return (
    <div ref={containerRef} className="sketchmind-canvas relative h-full w-full">
      <canvas
        ref={gridCanvasRef}
        className="pointer-events-none absolute inset-0 z-10 h-full w-full"
      />
      <div className="absolute right-3 top-1/2 z-20 -translate-y-1/2 sm:right-4">
        <div className="flex flex-col gap-2 rounded-[1.15rem] border border-primary/15 bg-[linear-gradient(180deg,hsl(213_28%_11%_/_0.94),hsl(213_30%_8%_/_0.96))] p-2 shadow-[0_18px_48px_-24px_hsl(0_0%_0%_/_0.5),inset_0_1px_0_hsl(0_0%_100%_/_0.06)] backdrop-blur-xl">
          {BACKGROUND_SWATCHES.map((color) => (
            <button
              key={color}
              type="button"
              title={`Set background ${color}`}
              aria-label={`Set background ${color}`}
              disabled={!canEdit}
              onClick={() => handleBackgroundColorChange(color)}
              className={cn(
                "relative h-8 w-8 rounded-full border border-white/10 transition duration-200 ease-out",
                !canEdit && "cursor-not-allowed opacity-60",
                canEdit && "cursor-pointer hover:scale-[1.18] hover:-rotate-12 active:scale-[0.85] active:rotate-[8deg]",
                selectedSwatch === normalizeColorInputValue(color)
                  ? "border-primary shadow-[0_0_0_1px_hsl(var(--border)_/_0.95),0_10px_18px_-14px_hsl(0_0%_0%_/_0.55)]"
                  : "border-border/70",
              )}
              style={{ backgroundColor: color }}
            >
              {selectedSwatch === normalizeColorInputValue(color) && (
                <span className="absolute inset-0 grid place-items-center rounded-full bg-black/12">
                  <Check className="h-3.5 w-3.5 text-white" />
                </span>
              )}
            </button>
          ))}
          <Popover open={isColorPickerOpen} onOpenChange={setIsColorPickerOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                title="Pick custom background color"
                aria-label="Pick custom background color"
                disabled={!canEdit}
                className={cn(
                  "relative grid h-8 w-8 place-items-center overflow-hidden rounded-full border border-white/10 bg-[conic-gradient(from_90deg,#7dd3fc,#38bdf8,#0ea5e9,#0284c7,#0369a1,#7dd3fc)] text-white shadow-[inset_0_0_0_1px_hsl(0_0%_100%_/_0.15)] transition duration-200 ease-out",
                  !canEdit && "cursor-not-allowed opacity-60",
                  canEdit && "cursor-pointer hover:scale-[1.18] hover:-rotate-12 active:scale-[0.85] active:rotate-[8deg]",
                )}
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-[3px] rounded-full border border-white/15"
                  style={{ backgroundColor: selectedBackgroundColor }}
                />
                <Palette className="relative h-3.5 w-3.5 drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="left"
              align="center"
              sideOffset={16}
              className="w-[280px] rounded-[1.25rem] border-primary/15 bg-[linear-gradient(180deg,hsl(213_28%_11%_/_0.98),hsl(213_30%_8%_/_0.98))] p-0 text-foreground shadow-[0_24px_80px_-28px_hsl(0_0%_0%_/_0.58),inset_0_1px_0_hsl(0_0%_100%_/_0.07)] backdrop-blur-xl"
            >
              <div className="space-y-4 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Canvas background</p>
                    <p className="text-xs text-muted-foreground">Hue, saturation, hex, and alpha.</p>
                  </div>
                  <div className="rounded-full border border-white/10 bg-background/60 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
                    Custom
                  </div>
                </div>

                <div className="rounded-[1rem] border border-white/8 bg-background/35 p-3 shadow-[inset_0_1px_0_hsl(0_0%_100%_/_0.04)]">
                  <HexAlphaColorPicker
                    color={colorInputValue}
                    onChange={handleBackgroundColorChange}
                    className="sketchmind-color-picker w-full"
                  />
                </div>

                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
                  <label className="space-y-1.5">
                    <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                      Hex + Alpha
                    </span>
                    <HexColorInput
                      color={colorInputValue}
                      onChange={handleBackgroundColorChange}
                      prefixed
                      alpha
                      className="flex h-10 w-full rounded-xl border border-white/10 bg-background/80 px-3 py-2 text-sm font-medium text-foreground outline-none transition focus:border-white/20 focus:ring-2 focus:ring-white/15"
                    />
                  </label>

                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 rounded-xl border-white/10 bg-background/65 px-3 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                    onClick={() => handleBackgroundColorChange(DEFAULT_BACKGROUND_COLOR)}
                  >
                    Reset
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <Excalidraw
        excalidrawAPI={handleAPIReady}
        initialData={initialData}
        onChange={handleSceneChange}
        theme={EXCALIDRAW_THEME}
        viewModeEnabled={!canEdit}
        renderTopRightUI={() => (
          <button
            type="button"
            className={cn(
              "p-2 rounded-md transition-colors",
              isGridEnabled ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
            onClick={() => setIsGridEnabled(prev => !prev)}
            title="Toggle Grid Overlay"
          >
            <Grid3X3 className="w-4 h-4" />
          </button>
        )}
        UIOptions={{
          tools: {
            image: false,
          },
          canvasActions: {
            changeViewBackgroundColor: false,
            export: false,
            loadScene: false,
            saveAsImage: false,
            saveToActiveFile: false,
            toggleTheme: false,
          },
        }}
      />

      {/* Bottom-center hint bar that mirrors Excalidraw hints */}
      <div
        aria-hidden={!hintText}
        className={cn(
          "pointer-events-none absolute left-1/2 bottom-6 z-50 -translate-x-1/2 rounded-xl px-4 py-2 text-sm text-muted-foreground transition-opacity",
          !hintText ? "opacity-0" : "opacity-100"
        )}
      >
        <div className="pointer-events-auto rounded-xl bg-background/70 px-3 py-1 shadow-md backdrop-blur">
          {hintText}
        </div>
      </div>
    </div>
  );
}
