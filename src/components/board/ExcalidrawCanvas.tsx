import { createElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { Excalidraw, restore, loadSceneOrLibraryFromBlob } from "@excalidraw/excalidraw";
import { HexAlphaColorPicker, HexColorInput } from "react-colorful";
import { renderToStaticMarkup } from "react-dom/server";
import { toast } from "sonner";
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
import { useImageUpload } from "@/hooks/useImageUpload";

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
const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024; // 8MB per image limit


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
		image: true,
	},
	canvasActions: {
		changeViewBackgroundColor: false,
		export: false,
		loadScene: false,
		saveAsImage: false,
		saveToActiveFile: false,
		toggleTheme: false,
	},
} as const;

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
	boardId: string;
	canEdit: boolean;
	initialCanvasData: CanvasData | null;
	onAPIReady: (api: ExcalidrawImperativeAPI) => void;
	onChange: (elements: readonly ExcalidrawElement[], appState: AppState, files: CanvasData["files"]) => void;
	theme: Theme;
}

export function ExcalidrawCanvas({ boardId, canEdit, initialCanvasData, onAPIReady, onChange, theme: _theme }: ExcalidrawCanvasProps) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const [hintText, setHintText] = useState<string | null>(null);
	const [isGridEnabled, setIsGridEnabled] = useState(false);
	const [isSmallScreen, setIsSmallScreen] = useState(false);
	const excalidrawAPIRef = useRef<ExcalidrawImperativeAPI | null>(null);
	const gridEnabledRef = useRef(false);
	const selectedBackgroundColorRef = useRef(DEFAULT_BACKGROUND_COLOR);
	const pendingSceneColorRef = useRef<string | null>(null);
	const [mobileMiscToolsEl, setMobileMiscToolsEl] = useState<HTMLElement | null>(null);
	const { upload } = useImageUpload(boardId);
	const uploadingFilesRef = useRef<Set<string>>(new Set());

	useEffect(() => {
		const container = containerRef.current;
		if (!container || !isSmallScreen) {
			setMobileMiscToolsEl(null);
			return;
		}

		const syncEl = () => {
			const layerUI = container.querySelector<HTMLElement>(".layer-ui__wrapper");
			if (!layerUI) return;

			let el = layerUI.querySelector<HTMLElement>(".mobile-misc-tools-container");
			if (!el) {
				el = document.createElement("div");
				el.className = "mobile-misc-tools-container";
				layerUI.appendChild(el);
			}

			if (el && el !== mobileMiscToolsEl) {
				setMobileMiscToolsEl(el);
			}
		};

		syncEl();
		const observer = new MutationObserver(syncEl);
		observer.observe(container, { childList: true, subtree: true });
		return () => observer.disconnect();
	}, [isSmallScreen, mobileMiscToolsEl]);

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
					collaborators: new Map(),
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
				collaborators: new Map(),
			},
			scrollToContent: false,
		};
	}, [initialCanvasData]);

	const initialBackgroundColor = initialData.appState?.viewBackgroundColor ?? DEFAULT_BACKGROUND_COLOR;

	const [selectedBackgroundColor, setSelectedBackgroundColor] = useState(normalizeColorInputValue(initialBackgroundColor));
	const [isMobilePickerOpen, setIsMobilePickerOpen] = useState(false);
	const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);

	useEffect(() => {
		if (isSmallScreen) {
			(window as any).__toggleSketchmindMobileBG = () => setIsMobilePickerOpen((prev) => !prev);
		}
		return () => {
			delete (window as any).__toggleSketchmindMobileBG;
		};
	}, [isSmallScreen]);

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

		const mediaQuery = window.matchMedia("(max-width: 730px)");
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

			// Handle image uploads: identify files that are local dataURLs and upload them to Supabase.
			// This keeps the files object small and allows real-time sync via Liveblocks storage.
			let filteredFiles = files;
			const largeFileIds = Object.entries(files)
				.filter(([_, file]) => {
					// dataURL is base64, so it's roughly 1.37x the binary size
					// If it's already a URL, we skip this check (it's already been validated or came from DB)
					if (!file.dataURL.startsWith("data:")) return false;
					return file.dataURL.length > MAX_IMAGE_SIZE_BYTES * 1.37;
				})
				.map(([id]) => id);

			if (largeFileIds.length > 0) {
				toast.error("Some images are too large (max 8MB) and will not be saved.");
				filteredFiles = { ...files };
				largeFileIds.forEach((id) => {
					delete (filteredFiles as any)[id];
				});
				// Elements referencing these files will show a 'broken image' in Excalidraw
				// which is an acceptable way to show the limit was exceeded.
			}

			const filesToUpload = Object.entries(filteredFiles).filter(([id, file]) => {
				return file.dataURL.startsWith("data:") && !uploadingFilesRef.current.has(id);
			});

			if (filesToUpload.length > 0 && canEdit) {
				filesToUpload.forEach(async ([id, file]) => {
					uploadingFilesRef.current.add(id);
					try {
						// Convert dataURL to File/Blob for upload
						const response = await fetch(file.dataURL);
						const blob = await response.blob();
						const imageFile = new File([blob], `image-${id}`, { type: file.mimeType });
						
						const url = await upload(imageFile);
						
						// Update the scene with the new remote URL.
						// This will trigger another onChange with the URL, skipping this check next time.
						excalidrawAPIRef.current?.updateScene({
							files: {
								[id]: {
									...file,
									dataURL: url,
								},
							},
						});
					} catch (err) {
						console.error("[ExcalidrawCanvas] Image upload failed:", err);
						// Keep it in the uploading set to avoid retry loops, but we might want a timeout
						// or a retry limit in a production app.
					}
				});
			}

			onChange(elements, appState, filteredFiles);
		},
		[onChange, upload, canEdit],
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

		const currentGridMode = api.getAppState().gridModeEnabled;
		const nextGridMode = !currentGridMode;

		gridEnabledRef.current = nextGridMode;
		setIsGridEnabled(nextGridMode);
		
		api.updateScene({
			appState: {
				gridModeEnabled: nextGridMode,
				objectsSnapModeEnabled: false,
			},
		});
	}, []);

	const handleDrop = useCallback(async (event: React.DragEvent<HTMLDivElement>) => {
		if (!canEdit) return;
		
		const file = event.dataTransfer.files[0];
		if (!file) return;

		const api = excalidrawAPIRef.current;
		if (!api) return;

		// Check if it's an excalidraw file or if the canvas is empty
		// In an empty canvas, we try to restore the scene from any dropped image (if it has embedded data)
		const isExcalidrawFile = file.name.endsWith(".excalidraw") || file.type === "application/vnd.excalidraw+json";
		const isEmpty = api.getSceneElements().length === 0;

		if (isExcalidrawFile || isEmpty) {
			try {
				const contents = await loadSceneOrLibraryFromBlob(file, null, null);
				if (contents.type === "application/vnd.excalidraw+json") {
					api.updateScene({
						elements: contents.data.elements,
						appState: {
							...contents.data.appState,
							viewBackgroundColor: contents.data.appState?.viewBackgroundColor ?? api.getAppState().viewBackgroundColor,
						},
						files: contents.data.files,
						commitToHistory: true,
					});
					toast.success("Scene restored from file");
					// Stop propagation if we handled it as a scene
					event.preventDefault();
					event.stopPropagation();
				}
			} catch (err) {
				// Not a scene file, let default behavior handle it (e.g. insert as image)
				console.log("🎨 Sketchmind: Dropped file is not a scene, falling back to default behavior");
			}
		}
	}, [canEdit]);

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

		const syncMobileToolbarLayout = () => {
			const topToolbarStack = container.querySelector<HTMLElement>(".App-menu_top .App-toolbar:not(.App-toolbar--mobile) > .Stack");
			const miscTools = container.querySelector<HTMLElement>(".mobile-misc-tools-container");

			if (miscTools) {
				let bgPickerBtn = miscTools.querySelector<HTMLElement>("[data-sketchmind-bg-trigger=\"true\"]");
				if (!bgPickerBtn) {
					console.log("🎨 Sketchmind: Injecting mobile background trigger");
					bgPickerBtn = document.createElement("button");
					bgPickerBtn.type = "button";
					bgPickerBtn.className = "ToolIcon ToolIcon_size_medium is-mobile";
					bgPickerBtn.setAttribute("title", "Canvas Background");
					bgPickerBtn.setAttribute("data-sketchmind-bg-trigger", "true");
					bgPickerBtn.style.cursor = "pointer";
					bgPickerBtn.style.background = "none";
					bgPickerBtn.style.border = "none";
					bgPickerBtn.style.padding = "0";
					bgPickerBtn.innerHTML = `
						<div class="ToolIcon__icon">
							${renderToStaticMarkup(<Palette className="h-5 w-5" />)}
						</div>
					`;
					miscTools.appendChild(bgPickerBtn);
				}
				
				// Always re-attach or update the handler to be safe
				bgPickerBtn.onclick = (e) => {
					e.preventDefault();
					e.stopPropagation();
					console.log("🎨 Sketchmind: Mobile background trigger clicked");
					if ((window as any).__toggleSketchmindMobileBG) {
						(window as any).__toggleSketchmindMobileBG();
					}
				};
				
				// Update active state
				bgPickerBtn.classList.toggle("active", isMobilePickerOpen);
			}

			if (topToolbarStack && miscTools) {
				const buttons = Array.from(miscTools.querySelectorAll<HTMLElement>(".ToolIcon"));
				buttons.forEach((btn) => {
					if (!topToolbarStack.contains(btn)) {
						topToolbarStack.appendChild(btn);
					}
				});
			}
		};

		syncMobileGridToggle();
		syncMobileToolbarLayout();

		const observer = new MutationObserver(() => {
			if (rafId !== null) {
				cancelAnimationFrame(rafId);
			}

			rafId = requestAnimationFrame(() => {
				syncMobileGridToggle();
				syncMobileToolbarLayout();
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
	}, [handleToggleNativeGrid, isSmallScreen]);

	const renderBackgroundColorPicker = (isMobile = false) => {
		const selectedSwatch = normalizeColorInputValue(selectedBackgroundColor);

		const swatchesList = (
			<div
				className={cn(
					"flex flex-col gap-1.5 p-1 shadow-2xl backdrop-blur-2xl",
					"rounded-full border border-white/10 bg-[#0c0c0cf5]",
					isMobile && "items-center",
				)}>
				{BACKGROUND_SWATCHES.map((color) => (
					<button
						key={color}
						type="button"
						title={`Set background ${color}`}
						aria-label={`Set background ${color}`}
						disabled={!canEdit}
						onClick={() => {
							handleBackgroundColorChange(color);
							if (isMobile) setIsMobilePickerOpen(false);
						}}
						className={cn(
							"relative h-[30px] w-[30px] shrink-0 rounded-full border transition-all duration-200 ease-out",
							!canEdit && "cursor-not-allowed opacity-40",
							canEdit && "cursor-pointer hover:scale-105 active:scale-95",
							selectedSwatch === normalizeColorInputValue(color)
								? "border-primary/50 bg-primary/20 shadow-[0_0_10px_-2px_rgba(34,211,238,0.4)]"
								: "border-white/10 bg-white/[0.08] hover:border-white/20 hover:bg-white/[0.15]",
						)}
						style={{ backgroundColor: color }}>
						{selectedSwatch === normalizeColorInputValue(color) && (
							<span className="absolute inset-0 grid place-items-center rounded-full">
								<Check className="h-3 w-3 text-white drop-shadow-sm" />
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
								"relative grid h-[30px] w-[30px] shrink-0 place-items-center overflow-hidden rounded-full border border-white/10 bg-[conic-gradient(from_90deg,#7dd3fc,#38bdf8,#0ea5e9,#0284c7,#0369a1,#7dd3fc)] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)] transition-all duration-200 ease-out",
								!canEdit && "cursor-not-allowed opacity-40",
								canEdit && "cursor-pointer hover:scale-105 active:scale-95",
							)}>
							<span
								aria-hidden="true"
								className="absolute inset-[2.5px] rounded-full border border-white/25"
								style={{ backgroundColor: selectedBackgroundColor }}
							/>
							<Palette className="relative h-3 w-3 drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]" />
						</button>
					</PopoverTrigger>
					<PopoverContent
						side={isMobile ? "bottom" : "left"}
						align="center"
						sideOffset={12}
						container={isMobile ? undefined : mobileMiscToolsEl}
						className="w-[280px] rounded-[1.25rem] border-white/10 bg-[#0c0c0cf5] p-0 text-foreground shadow-[0_24px_80px_-28px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl">
						<div className="space-y-4 p-4">
							<div className="flex items-center justify-between gap-3">
								<div>
									<p className="text-sm font-semibold text-foreground">Canvas background</p>
									<p className="text-xs text-muted-foreground">Hue, saturation, hex, and alpha.</p>
								</div>
								<div className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
									Custom
								</div>
							</div>

							<div className="rounded-[1rem] border border-white/8 bg-white/[0.02] p-3 shadow-inner">
								<HexAlphaColorPicker color={colorInputValue} onChange={handleBackgroundColorChange} className="sketchmind-color-picker w-full" />
							</div>

							<div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
								<label className="space-y-1.5">
									<span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Hex + Alpha</span>
									<HexColorInput
										color={colorInputValue}
										onChange={handleBackgroundColorChange}
										prefixed
										alpha
										className="flex h-10 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-medium text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
									/>
								</label>

								<Button
									type="button"
									variant="outline"
									className="h-10 rounded-xl border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-muted-foreground hover:bg-white/12 hover:text-foreground"
									onClick={() => handleBackgroundColorChange(DEFAULT_BACKGROUND_COLOR)}>
									Reset
								</Button>
							</div>
						</div>
					</PopoverContent>
				</Popover>
			</div>
		);

		return swatchesList;
	};

	return (
		<div 
			ref={containerRef} 
			className="sketchmind-canvas relative h-full w-full"
			onDrop={handleDrop}
			onDragOver={(e) => e.preventDefault()}
		>
			<style>
				{`
					.sketchmind-canvas .HintViewer { display: none !important; }
					.sketchmind-canvas .layer-ui__wrapper .collaborators { display: none !important; }
					.sketchmind-canvas .layer-ui__wrapper .user-list { display: none !important; }
					.sketchmind-canvas .layer-ui__wrapper .user-list-container { display: none !important; }
					.sketchmind-canvas .layer-ui__wrapper .FixedSideContainer.top-right { display: none !important; }
					.sketchmind-canvas .layer-ui__wrapper .FixedSideContainer.right { display: none !important; }
					.sketchmind-canvas .layer-ui__wrapper .App-menu_right { display: none !important; }
					.sketchmind-canvas .layer-ui__wrapper .sidebar-right { display: none !important; }
					.sketchmind-canvas .layer-ui__wrapper .UserList__wrapper { display: none !important; }
					.sketchmind-canvas .layer-ui__wrapper { z-index: 100 !important; }
				`}
			</style>

			{/* Desktop background picker rendered as usual. Mobile trigger is injected manually. */}

			{!isSmallScreen && (
				<div className="absolute right-4 top-1/2 z-50 -translate-y-1/2">
					{renderBackgroundColorPicker(false)}
				</div>
			)}

			<Excalidraw
				excalidrawAPI={handleAPIReady}
				initialData={initialData}
				onChange={handleSceneChange}
				theme={EXCALIDRAW_THEME}
				viewModeEnabled={!canEdit}

				UIOptions={EXCALIDRAW_UI_OPTIONS}
			/>

			{/* Mobile Color Picker Overlay - Positioned in the middle of the screen on the right */}
			<AnimatePresence>
				{isSmallScreen && isMobilePickerOpen && (
					<motion.div
						initial={{ opacity: 0, scale: 0.92, x: 10, y: "-50%" }}
						animate={{ opacity: 1, scale: 1, x: 0, y: "-50%" }}
						exit={{ opacity: 0, scale: 0.92, x: 10, y: "-50%" }}
						transition={{ type: "spring", stiffness: 400, damping: 30 }}
						className="fixed top-1/2 right-4 z-[99999] flex flex-col items-end gap-2"
					>
						{/* Transparent invisible backdrop for closing without blur/dimming */}
						<div 
							className="fixed inset-0 z-[-1]" 
							onClick={() => setIsMobilePickerOpen(false)}
						/>
						<div className="rounded-full border border-white/10 bg-[#0c0c0cf5]/90 p-1 shadow-2xl shadow-black/40 backdrop-blur-xl">
							{renderBackgroundColorPicker(true)}
						</div>
					</motion.div>
				)}
			</AnimatePresence>

			{/* Bottom-center hint bar that mirrors Excalidraw hints - Hidden on mobile to avoid blocking interactions */}
			{!isSmallScreen && hintText && (
				<div
					aria-hidden="true"
					className="pointer-events-none absolute left-1/2 bottom-6 z-50 -translate-x-1/2 rounded-xl px-4 py-2 text-sm text-muted-foreground transition-opacity opacity-100"
				>
					<div className="pointer-events-auto rounded-xl bg-background/70 px-3 py-1 shadow-md backdrop-blur" style={{ textAlign: "center" }}>
						{hintText}
					</div>
				</div>
			)}
		</div>
	);
}
