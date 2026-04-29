'use client';
/**
 * InstallPrompt
 * Shows a native-feeling install banner for Android/Desktop (using the
 * Web Install API `beforeinstallprompt` event) and a manual instruction
 * overlay for iOS Safari (where the native API is unavailable).
 *
 * Mount this component ONLY inside the dashboard shell — never inside
 * the canvas editor.
 */

import { useEffect, useState } from 'react';
import { X, Download, Share } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { pwaStore } from '@/lib/pwa';

type Platform = 'android' | 'ios' | 'desktop' | null;

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  const isIOS =
    /iphone|ipad|ipod/i.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
  const isAndroid = /android/i.test(ua);
  if (isIOS) return 'ios';
  if (isAndroid) return 'android';
  return 'desktop';
}

function isInStandaloneMode(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

const DISMISSED_KEY = 'sketchmind_install_dismissed';
const DISMISS_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

export function InstallPrompt() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [deferredPrompt, setDeferredPrompt] = useState<any>(pwaStore.getDeferredPrompt());
  const [platform, setPlatform] = useState<Platform>(null);
  const [visible, setVisible] = useState(false);
  const [iosExpanded, setIosExpanded] = useState(false);

  useEffect(() => {
    // Already installed — never show
    if (isInStandaloneMode()) return;

    // Already dismissed within the TTL — skip
    const dismissed = localStorage.getItem(DISMISSED_KEY);
    if (dismissed && Date.now() - Number(dismissed) < DISMISS_TTL) return;

    const p = detectPlatform();
    setPlatform(p);

    // ── iOS: No native API — show manual instructions after 5s ──────────
    let iosTimeout: ReturnType<typeof setTimeout> | null = null;
    if (p === 'ios') {
      iosTimeout = setTimeout(() => setVisible(true), 5000);
      return () => {
        if (iosTimeout) clearTimeout(iosTimeout);
      };
    }

    // ── Android / Desktop: Use global store ──────────────────────────────
    let showTimeout: ReturnType<typeof setTimeout> | null = null;
    
    const unsubscribe = pwaStore.subscribe((prompt) => {
      setDeferredPrompt(prompt);
      if (prompt && !visible) {
        // Show after a small delay so the user has had time to engage
        showTimeout = setTimeout(() => setVisible(true), 3000);
      }
    });

    return () => {
      unsubscribe();
      if (showTimeout) clearTimeout(showTimeout);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setVisible(false);
      pwaStore.clear();
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
  };

  const base =
    'fixed bottom-[calc(var(--nav-pill-height,72px)+16px)] left-4 right-4 z-50 ' +
    'rounded-2xl border border-white/10 shadow-2xl overflow-hidden ' +
    'bg-[rgba(18,18,18,0.96)] backdrop-blur-xl';

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className={[
            base,
            // Stick to the right from sm (640px) onwards
            'sm:right-6 sm:left-auto sm:translate-x-0 sm:w-auto sm:max-w-[520px]',
          ].join(' ')}
        >
          {platform === 'ios' ? (
            <>
              {/* Header row */}
              <div className="flex items-center gap-3 p-4">
                <img
                  src="/icons/apple-touch-icon.png"
                  alt="Sketchmind"
                  width={44}
                  height={44}
                  className="rounded-[14px] flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold leading-snug">
                    Add Sketchmind to your Home Screen
                  </p>
                  <p className="text-white/50 text-xs mt-0.5">
                    For the best experience, install the app.
                  </p>
                </div>
                <button
                  aria-label="Dismiss install prompt"
                  onClick={handleDismiss}
                  className="text-white/40 hover:text-white/70 p-1 transition-colors flex-shrink-0"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Expandable instructions toggle */}
              <button
                onClick={() => setIosExpanded((v) => !v)}
                className="w-full text-left px-4 pb-3 text-cyan-400 hover:text-cyan-300 text-xs font-medium transition-colors"
              >
                {iosExpanded ? 'Hide instructions ↑' : 'How to install ↓'}
              </button>

              {iosExpanded && (
                <div className="border-t border-white/5 px-4 pt-3 pb-4 space-y-3">
                  {[
                    {
                      icon: <Share size={13} />,
                      text: (
                        <>
                          Tap the <strong>Share</strong> button in Safari&apos;s toolbar
                        </>
                      ),
                    },
                    {
                      icon: <span className="text-[11px] font-bold leading-none">+</span>,
                      text: (
                        <>
                          Scroll down and tap <strong>&quot;Add to Home Screen&quot;</strong>
                        </>
                      ),
                    },
                    {
                      icon: <span className="text-[11px] font-bold leading-none">✓</span>,
                      text: (
                        <>
                          Tap <strong>&quot;Add&quot;</strong> in the top-right corner
                        </>
                      ),
                    },
                  ].map((step, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-cyan-500/15 flex items-center justify-center text-cyan-400 flex-shrink-0 mt-0.5">
                        {step.icon}
                      </div>
                      <p className="text-white/70 text-xs leading-relaxed">{step.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-3 p-4">
              <img
                src="/icons/icon-192x192.png"
                alt="Sketchmind"
                width={44}
                height={44}
                className="rounded-xl flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold leading-snug">
                  Install Sketchmind
                </p>
                <p className="text-white/50 text-xs mt-0.5">
                  Add to your {platform === 'desktop' ? 'desktop' : 'home screen'} for quick access.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <motion.button
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  aria-label="Dismiss"
                  onClick={handleDismiss}
                  className="text-white/40 hover:text-white/70 p-1 transition-colors"
                >
                  <X size={16} />
                </motion.button>
                <motion.button
                  whileHover="hover"
                  whileTap="tap"
                  onClick={() => void handleInstall()}
                  className="group/install flex items-center gap-2 px-4 py-2 rounded-xl
                             bg-gradient-brand text-primary-foreground
                             hover:opacity-95 transition-all
                             hover:scale-[1.03] active:scale-95
                             font-semibold text-xs shadow-soft"
                >
                  <motion.div
                    variants={{
                      hover: { y: [0, -3, 0], transition: { repeat: Infinity, duration: 0.6 } },
                      tap: { scale: 0.85 },
                    }}
                  >
                    <Download size={14} strokeWidth={2.5} />
                  </motion.div>
                  <span>Install</span>
                </motion.button>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
