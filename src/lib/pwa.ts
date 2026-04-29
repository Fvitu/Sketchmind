/**
 * PWA Utilities & Global Event Capturing
 *
 * Captures the 'beforeinstallprompt' event as early as possible so that
 * the install prompt can be shown even if the user navigates after the
 * event has already fired.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let deferredPrompt: any = null;
const listeners = new Set<(prompt: any) => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
    // Notify all active listeners
    listeners.forEach((l) => l(e));
  });
}

export const pwaStore = {
  getDeferredPrompt() {
    return deferredPrompt;
  },
  subscribe(callback: (prompt: any) => void) {
    listeners.add(callback);
    // Immediately call with current value
    callback(deferredPrompt);
    return () => {
      listeners.delete(callback);
    };
  },
  clear() {
    deferredPrompt = null;
    listeners.forEach((l) => l(null));
  },
};
