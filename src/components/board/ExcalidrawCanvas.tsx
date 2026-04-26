import { createElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Excalidraw, restore } from "@excalidraw/excalidraw";
import { HexAlphaColorPicker, HexColorInput } from "react-colorful";
import { renderToStaticMarkup } from "react-dom/server";
import type { AppState, ExcalidrawImperativeAPI, ExcalidrawInitialDataState } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement, Theme } from "@excalidraw/excalidraw/element/types";
import {
	ArrowDown,
	ArrowUp,
	BookMarked,
	BoxSelect,
	BringToFront,
	Check,
	ChevronRight,
	Clipboard,
	Copy,
	CopyPlus,
	FlipHorizontal,
	FlipVertical,
	Grid3X3,
	Group,
	Link as LinkIcon,
	Lock,
	Palette,
	Pencil,
	Scissors,
	SendToBack,
	Trash2,
	Ungroup,
	Unlock,
} from "lucide-react";
import "@excalidraw/excalidraw/index.css";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { CanvasData } from "@/types/canvas";

const DEFAULT_BACKGROUND_COLOR = "#ffffff";
const EXCALIDRAW_THEME: Theme = "dark";
const READABLE_FONT_FAMILY = 2;

const BACKGROUND_SWATCHES = ["#ffffff", "#0b1120", "#1f2937", "#334155", "#475569", "#000000"];

const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const RGB_COLOR_REGEX = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0|1|0?\.\d+))?\s*\)$/i;
const CONTEXT_MENU_DECORATED_ATTRIBUTE = "data-sketchmind-context-menu";
const CONTEXT_MENU_ICON_CLASS = "sketchmind-context-menu-icon";
const CONTEXT_MENU_DANGER_ICON_CLASS = "sketchmind-context-menu-icon--danger";
const CONTEXT_MENU_SEPARATOR_CLASS = "sketchmind-context-menu-separator";
const HIDDEN_CONTEXT_MENU_PATTERNS = [/^wrap selection in frame$/i, /^add link$/i, /^copy link to object$/i, /^zen mode$/i];
const INTERACTIVE_CONTEXT_PATCHED_ATTRIBUTE = "data-sketchmind-interactive-context-patched";
const MOBILE_GRID_TOGGLE_ATTRIBUTE = "data-sketchmind-mobile-grid-toggle";
const MOBILE_MAIN_MENU_SELECTOR = "button.dropdown-menu-button.main-menu-trigger.zen-mode-transition.dropdown-menu-button--mobile";
const MOBILE_BOTTOM_ACTIONS_SELECTOR = ".App-toolbar-content";

const CONTEXT_MENU_ICON_RULES = [
	{ pattern: /^(cut)$/i, Icon: Scissors },
	{ pattern: /^(copy)$/i, Icon: Copy },
	{ pattern: /^(paste|paste as plaintext|paste charts)$/i, Icon: Clipboard },
	{ pattern: /^(duplicate|duplicate selection)$/i, Icon: CopyPlus },
	{ pattern: /^(delete|remove)$/i, Icon: Trash2 },
	{ pattern: /^(select all)$/i, Icon: BoxSelect },
	{ pattern: /^(group|group selection)$/i, Icon: Group },
	{ pattern: /^(ungroup|ungroup selection)$/i, Icon: Ungroup },
	{ pattern: /^(bring to front)$/i, Icon: BringToFront },
	{ pattern: /^(send to back)$/i, Icon: SendToBack },
	{ pattern: /^(bring forward)$/i, Icon: ArrowUp },
	{ pattern: /^(send backward)$/i, Icon: ArrowDown },
	{ pattern: /^(flip horizontal)$/i, Icon: FlipHorizontal },
	{ pattern: /^(flip vertical)$/i, Icon: FlipVertical },
	{ pattern: /^(lock)$/i, Icon: Lock },
	{ pattern: /^(unlock)$/i, Icon: Unlock },
	{ pattern: /^(add to library)$/i, Icon: BookMarked },
	{ pattern: /^(link|edit link|add link)$/i, Icon: LinkIcon },
	{ pattern: /^(edit text)$/i, Icon: Pencil },
];

const EXCALIDRAW_UI_OPTIONS = {
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
};

interface RGBAColor {
	r: number;
	g: number;
	b: number;
	a: number;
}

function getContextMenuIconMarkup(label: string) {
	const Icon = CONTEXT_MENU_ICON_RULES.find((rule) => rule.pattern.test(label))?.Icon ?? ChevronRight;

	return renderToStaticMarkup(
		createElement(Icon, {
			"aria-hidden": "true",
			size: 14,
			strokeWidth: 2,
		}),
	);
}

function getGridToggleIconMarkup() {
	return renderToStaticMarkup(
		createElement(Grid3X3, {
			"aria-hidden": "true",
			size: 18,
			strokeWidth: 2,
		}),
	);
}

function getContextMenuGroup(label: string) {
	if (/^(cut|copy|paste)$/i.test(label)) {
		return "clipboard-core";
	}

	if (/^(copy to clipboard as png|copy to clipboard as svg|copy styles|paste styles|add to library)$/i.test(label)) {
		return "clipboard-extended";
	}

	if (/^(send backward|bring forward|send to back|bring to front|flip horizontal|flip vertical)$/i.test(label)) {
		return "arrange";
	}

	if (/^(duplicate|lock|unlock|delete|remove)$/i.test(label)) {
		return "selection";
	}

	return "misc";
}

function rebuildContextMenuSeparators(menu: HTMLElement) {
	menu.querySelectorAll(`.${CONTEXT_MENU_SEPARATOR_CLASS}, .context-menu-item-separator`).forEach((separator) => {
		separator.remove();
	});

	const buttons = Array.from(menu.querySelectorAll<HTMLButtonElement>("button.context-menu-item"));
	let previousGroup: string | null = null;

	buttons.forEach((button) => {
		const label = button.querySelector<HTMLElement>(".context-menu-item__label")?.textContent?.trim() ?? "";
		const nextGroup = getContextMenuGroup(label);

		if (previousGroup && nextGroup !== previousGroup) {
			const separator = document.createElement("div");
			separator.className = CONTEXT_MENU_SEPARATOR_CLASS;
			separator.setAttribute("aria-hidden", "true");
			button.before(separator);
		}

		previousGroup = nextGroup;
	});
}

function remapInteractiveHandleColor(value: unknown) {
	if (typeof value !== "string") {
		return value;
	}

	switch (value.trim().toLowerCase()) {
		case "rgba(105, 101, 219, 0.4)":
			return "rgba(34, 211, 238, 0.4)";
		case "#5e5ad8":
			return "#22d3ee";
		case "rgba(134, 131, 226, 0.9)":
			return "rgba(34, 211, 238, 0.92)";
		case "rgba(177, 151, 252, 0.7)":
			return "rgba(125, 211, 252, 0.72)";
		default:
			return value;
	}
}

function patchInteractiveCanvasContext(canvas: HTMLCanvasElement) {
	if (canvas.getAttribute(INTERACTIVE_CONTEXT_PATCHED_ATTRIBUTE) === "true") {
		return;
	}

	const context = canvas.getContext("2d");

	if (!context) {
		return;
	}

	const contextPrototype = Object.getPrototypeOf(context) as CanvasRenderingContext2D;
	const fillStyleDescriptor = Object.getOwnPropertyDescriptor(contextPrototype, "fillStyle");
	const strokeStyleDescriptor = Object.getOwnPropertyDescriptor(contextPrototype, "strokeStyle");

	if (!fillStyleDescriptor?.get || !fillStyleDescriptor?.set || !strokeStyleDescriptor?.get || !strokeStyleDescriptor?.set) {
		return;
	}

	Object.defineProperty(context, "fillStyle", {
		configurable: true,
		enumerable: true,
		get() {
			return fillStyleDescriptor.get?.call(this);
		},
		set(value) {
			fillStyleDescriptor.set?.call(this, remapInteractiveHandleColor(value));
		},
	});

	Object.defineProperty(context, "strokeStyle", {
		configurable: true,
		enumerable: true,
		get() {
			return strokeStyleDescriptor.get?.call(this);
		},
		set(value) {
			strokeStyleDescriptor.set?.call(this, remapInteractiveHandleColor(value));
		},
	});

	canvas.setAttribute(INTERACTIVE_CONTEXT_PATCHED_ATTRIBUTE, "true");
}

function decorateContextMenus(container: HTMLElement) {
	const buttons = container.querySelectorAll<HTMLButtonElement>("button.context-menu-item");

	let hasChanges = false;

	buttons.forEach((button) => {
		if (button.getAttribute(CONTEXT_MENU_DECORATED_ATTRIBUTE) === "true") {
			return;
		}

		const labelElement = button.querySelector<HTMLElement>(".context-menu-item__label");

		if (!labelElement) {
			return;
		}

		const label = labelElement.textContent?.trim() ?? "";

		if (HIDDEN_CONTEXT_MENU_PATTERNS.some((pattern) => pattern.test(label))) {
			button.remove();
			hasChanges = true;
			return;
		}

		const icon = document.createElement("span");
		icon.className = CONTEXT_MENU_ICON_CLASS;
		icon.innerHTML = getContextMenuIconMarkup(label);

		if (/^(delete|remove)$/i.test(label) || button.classList.contains("dangerous")) {
			icon.classList.add(CONTEXT_MENU_DANGER_ICON_CLASS);
		}

		button.insertBefore(icon, labelElement);
		button.setAttribute(CONTEXT_MENU_DECORATED_ATTRIBUTE, "true");
		hasChanges = true;
	});

	if (!hasChanges) {
		return;
	}

	const menus = container.querySelectorAll<HTMLElement>(".context-menu");
	menus.forEach((menu) => {
		rebuildContextMenuSeparators(menu);
	});
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

function toCanonicalColor(color: string, fallback = DEFAULT_BACKGROUND_COLOR) {
	const parsed = parseColor(color);

	if (!parsed) {
		return fallback;
	}

	const baseColor = `#${toHex(parsed.r)}${toHex(parsed.g)}${toHex(parsed.b)}`;
	return parsed.a >= 255 ? baseColor : `${baseColor}${toHex(parsed.a)}`;
}

function normalizeColorInputValue(color: string, fallback = DEFAULT_BACKGROUND_COLOR) {
	return toCanonicalColor(color, fallback);
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
	onChange: (elements: readonly ExcalidrawElement[], appState: AppState, files: CanvasData["files"]) => void;
	theme: Theme;
}

export function ExcalidrawCanvas({ canEdit, initialCanvasData, onAPIReady, onChange, theme: _theme }: ExcalidrawCanvasProps) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const [hintText, setHintText] = useState<string | null>(null);
	const [isGridEnabled, setIsGridEnabled] = useState(false);
	const [isSmallScreen, setIsSmallScreen] = useState(false);
	const excalidrawAPIRef = useRef<ExcalidrawImperativeAPI | null>(null);
	const gridEnabledRef = useRef(false);
	const selectedBackgroundColorRef = useRef(DEFAULT_BACKGROUND_COLOR);
	const pendingSceneColorRef = useRef<string | null>(null);

	const initialData = useMemo<ExcalidrawInitialDataState>(() => {
		if (initialCanvasData) {
			const restored = restore(initialCanvasData, null, null);
			const normalizedElements = restored.elements.map((element) =>
				"fontFamily" in element && element.fontFamily === 4 ? { ...element, fontFamily: READABLE_FONT_FAMILY } : element,
			);

			return {
				elements: normalizedElements,
				files: restored.files,
				appState: {
					...restored.appState,
					currentItemFontFamily:
						restored.appState.currentItemFontFamily === 4
							? READABLE_FONT_FAMILY
							: (restored.appState.currentItemFontFamily ?? READABLE_FONT_FAMILY),
					currentHoveredFontFamily:
						restored.appState.currentHoveredFontFamily === 4 ? READABLE_FONT_FAMILY : restored.appState.currentHoveredFontFamily,
					theme: EXCALIDRAW_THEME,
					viewBackgroundColor: restored.appState.viewBackgroundColor ?? DEFAULT_BACKGROUND_COLOR,
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

	const initialBackgroundColor = initialData.appState?.viewBackgroundColor ?? DEFAULT_BACKGROUND_COLOR;

	const [selectedBackgroundColor, setSelectedBackgroundColor] = useState(normalizeColorInputValue(initialBackgroundColor));
	const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);

	useEffect(() => {
		selectedBackgroundColorRef.current = selectedBackgroundColor;
	}, [selectedBackgroundColor]);

	useEffect(() => {
		const normalizedInitialBackgroundColor = normalizeColorInputValue(initialBackgroundColor);
		pendingSceneColorRef.current = null;
		setSelectedBackgroundColor(normalizedInitialBackgroundColor);
	}, [initialBackgroundColor]);

	useEffect(() => {
		const nextGridMode = Boolean(initialData.appState?.gridModeEnabled);
		gridEnabledRef.current = nextGridMode;
		setIsGridEnabled(nextGridMode);
	}, [initialData]);

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
		if (typeof window === "undefined") {
			return;
		}

		const mediaQuery = window.matchMedia("(max-width: 639px)");
		const syncViewport = (event?: MediaQueryListEvent) => {
			setIsSmallScreen(event?.matches ?? mediaQuery.matches);
		};

		syncViewport();
		mediaQuery.addEventListener("change", syncViewport);

		return () => {
			mediaQuery.removeEventListener("change", syncViewport);
		};
	}, []);

	useEffect(() => {
		const container = containerRef.current;

		if (!container) return;

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

			let rafId: number | null = null;

			const mo = new MutationObserver(() => {
				if (rafId !== null) {
					cancelAnimationFrame(rafId);
				}

				rafId = requestAnimationFrame(() => {
					setHintText(hintEl.textContent?.trim() ?? null);
					rafId = null;
				});
			});

			mo.observe(hintEl, { characterData: true, subtree: true, childList: true });
			return mo;
		};

		let observer = findAndObserve();

		let rafId: number | null = null;

		const containerMo = new MutationObserver(() => {
			if (!observer) {
				if (rafId !== null) {
					cancelAnimationFrame(rafId);
				}

				rafId = requestAnimationFrame(() => {
					observer = findAndObserve();
					rafId = null;
				});
			}
		});

		containerMo.observe(container, { childList: true, subtree: true });

		return () => {
			containerMo.disconnect();
			if (observer) observer.disconnect();
			if (rafId !== null) {
				cancelAnimationFrame(rafId);
			}
			styleEl.remove();
		};
	}, []);

	useEffect(() => {
		const container = containerRef.current;

		if (!container) {
			return;
		}

		decorateContextMenus(container);

		let rafId: number | null = null;

		const observer = new MutationObserver(() => {
			if (rafId !== null) {
				cancelAnimationFrame(rafId);
			}

			rafId = requestAnimationFrame(() => {
				decorateContextMenus(container);
				rafId = null;
			});
		});

		observer.observe(container, { childList: true, subtree: true });

		return () => {
			observer.disconnect();
			if (rafId !== null) {
				cancelAnimationFrame(rafId);
			}
		};
	}, []);

	useEffect(() => {
		const container = containerRef.current;

		if (!container) {
			return;
		}

		let rafId: number | null = null;

		const patchCanvas = () => {
			const interactiveCanvas = container.querySelector<HTMLCanvasElement>("canvas.excalidraw__canvas.interactive");

			if (interactiveCanvas) {
				patchInteractiveCanvasContext(interactiveCanvas);
			}
		};

		patchCanvas();

		const observer = new MutationObserver(() => {
			if (rafId !== null) {
				cancelAnimationFrame(rafId);
			}

			rafId = requestAnimationFrame(() => {
				patchCanvas();
				rafId = null;
			});
		});

		observer.observe(container, { childList: true, subtree: true });

		return () => {
			observer.disconnect();
			if (rafId !== null) {
				cancelAnimationFrame(rafId);
			}
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
		(elements: readonly ExcalidrawElement[], appState: AppState, files: CanvasData["files"]) => {
			const sceneBackgroundColor = normalizeSceneBackgroundColor(appState.viewBackgroundColor);
			const pendingSceneColor = pendingSceneColorRef.current;
			const nextGridMode = Boolean(appState.gridModeEnabled);
			gridEnabledRef.current = nextGridMode;
			setIsGridEnabled(nextGridMode);

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
		[onChange],
	);

	const handleAPIReady = useCallback(
		(api: ExcalidrawImperativeAPI) => {
			excalidrawAPIRef.current = api;
			onAPIReady(api);
		},
		[onAPIReady],
	);

	const selectedSwatch = normalizeColorInputValue(selectedBackgroundColor);
	const handleToggleNativeGrid = useCallback(() => {
		const api = excalidrawAPIRef.current;

		if (!api) {
			return;
		}

		const nextGridMode = !gridEnabledRef.current;
		gridEnabledRef.current = nextGridMode;
		setIsGridEnabled(nextGridMode);
		api.updateScene({
			appState: {
				gridModeEnabled: nextGridMode,
				objectsSnapModeEnabled: false,
			},
		});
	}, []);

	useEffect(() => {
		const container = containerRef.current;

		if (!container || !isSmallScreen) {
			return;
		}

		let rafId: number | null = null;

		const syncMobileGridToggle = () => {
			const api = excalidrawAPIRef.current;
			const bottomBar = container.querySelector<HTMLElement>(MOBILE_BOTTOM_ACTIONS_SELECTOR);

			if (!bottomBar) {
				return;
			}

			const mainMenuButton = bottomBar.querySelector<HTMLButtonElement>(MOBILE_MAIN_MENU_SELECTOR);
			if (mainMenuButton) {
				mainMenuButton.style.display = "none";
				mainMenuButton.setAttribute("aria-hidden", "true");
				mainMenuButton.tabIndex = -1;
			}

			let gridButton = bottomBar.querySelector<HTMLButtonElement>(`button[${MOBILE_GRID_TOGGLE_ATTRIBUTE}="true"]`);

			if (!gridButton) {
				gridButton = document.createElement("button");
				gridButton.type = "button";
				gridButton.className = "dropdown-menu-button zen-mode-transition dropdown-menu-button--mobile sketchmind-mobile-grid-toggle";
				gridButton.setAttribute(MOBILE_GRID_TOGGLE_ATTRIBUTE, "true");
				gridButton.setAttribute("aria-label", "Toggle Grid Overlay");
				gridButton.setAttribute("title", "Toggle Grid Overlay");
				gridButton.innerHTML = getGridToggleIconMarkup();
				gridButton.addEventListener("click", handleToggleNativeGrid);
				const anchor = mainMenuButton?.nextElementSibling;
				if (anchor) {
					anchor.before(gridButton);
				} else {
					bottomBar.appendChild(gridButton);
				}
			}

			const isActive = api ? Boolean(api.getAppState().gridModeEnabled) : isGridEnabled;
			gridButton.classList.toggle("active", isActive);
			gridButton.setAttribute("aria-pressed", String(isActive));
		};

		syncMobileGridToggle();

		const observer = new MutationObserver(() => {
			if (rafId !== null) {
				cancelAnimationFrame(rafId);
			}

			rafId = requestAnimationFrame(() => {
				syncMobileGridToggle();
				rafId = null;
			});
		});

		observer.observe(container, { childList: true, subtree: true });

		return () => {
			observer.disconnect();
			if (rafId !== null) {
				cancelAnimationFrame(rafId);
			}

			const gridButton = container.querySelector<HTMLButtonElement>(`button[${MOBILE_GRID_TOGGLE_ATTRIBUTE}="true"]`);
			gridButton?.removeEventListener("click", handleToggleNativeGrid);
		};
	}, [handleToggleNativeGrid, isGridEnabled, isSmallScreen]);

	return (
		<div ref={containerRef} className="sketchmind-canvas relative h-full w-full">
			<style>
				{`
					.sketchmind-canvas .HintViewer { display: none !important; }
					.sketchmind-canvas .layer-ui__wrapper .collaborators { display: none !important; }
					.sketchmind-canvas .layer-ui__wrapper .user-list { display: none !important; }
					.sketchmind-canvas .layer-ui__wrapper .user-list-container { display: none !important; }
					.sketchmind-canvas .layer-ui__wrapper .FixedSideContainer.top-right { display: none !important; }
					.sketchmind-canvas .layer-ui__wrapper .UserList__wrapper { display: none !important; }
				`}
			</style>
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
							style={{ backgroundColor: color }}>
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
								)}>
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
							className="w-[280px] rounded-[1.25rem] border-primary/15 bg-[linear-gradient(180deg,hsl(213_28%_11%_/_0.98),hsl(213_30%_8%_/_0.98))] p-0 text-foreground shadow-[0_24px_80px_-28px_hsl(0_0%_0%_/_0.58),inset_0_1px_0_hsl(0_0%_100%_/_0.07)] backdrop-blur-xl">
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
										<span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Hex + Alpha</span>
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
										onClick={() => handleBackgroundColorChange(DEFAULT_BACKGROUND_COLOR)}>
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
				renderTopRightUI={useCallback((_isMobile: boolean, appState: AppState) =>
					isSmallScreen ? null : (
						<button
							type="button"
							className={cn(
								"p-2 rounded-md transition-colors",
								appState.gridModeEnabled ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
							)}
							onClick={handleToggleNativeGrid}
							title="Toggle Grid Overlay">
							<Grid3X3 className="h-4 w-4" />
						</button>
					)
				, [isSmallScreen, handleToggleNativeGrid])}
				UIOptions={EXCALIDRAW_UI_OPTIONS}
			/>

			{/* Bottom-center hint bar that mirrors Excalidraw hints */}
			<div
				aria-hidden={!hintText || isSmallScreen}
				className={cn(
					"pointer-events-none absolute left-1/2 bottom-6 z-50 -translate-x-1/2 rounded-xl px-4 py-2 text-sm text-muted-foreground transition-opacity",
					!hintText || isSmallScreen ? "opacity-0" : "opacity-100",
				)}>
				<div className="pointer-events-auto rounded-xl bg-background/70 px-3 py-1 shadow-md backdrop-blur">{hintText}</div>
			</div>
		</div>
	);
}
