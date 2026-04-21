export type RuntimeAuthConfig = {
  googleClientId: string;
  googleEnabled: boolean;
  magicLinkEnabled: boolean;
  siteUrl: string;
};

let configPromise: Promise<RuntimeAuthConfig> | null = null;

export function getRuntimeAuthConfig() {
  if (!configPromise) {
    configPromise = fetch("/api/auth/runtime-config")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Couldn't load auth configuration");
        }
        return (await response.json()) as RuntimeAuthConfig;
      })
      .catch(() => ({
        googleClientId: "",
        googleEnabled: false,
        magicLinkEnabled: false,
        siteUrl: window.location.origin,
      }));
  }

  return configPromise;
}

let googleScriptPromise: Promise<void> | null = null;

function loadGoogleScript() {
  if (!googleScriptPromise) {
    googleScriptPromise = new Promise((resolve, reject) => {
      if (window.google?.accounts?.id) {
        resolve();
        return;
      }

      const existing = document.querySelector<HTMLScriptElement>('script[data-google-sdk="true"]');
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("Couldn't load Google SDK")), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.dataset.googleSdk = "true";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Couldn't load Google SDK"));
      document.head.appendChild(script);
    });
  }

  return googleScriptPromise;
}

export async function signInWithGoogleClient(): Promise<string> {
  const config = await getRuntimeAuthConfig();
  if (!config.googleEnabled || !config.googleClientId) {
    throw new Error("Google sign-in is not configured");
  }

  await loadGoogleScript();

  const idToken = await new Promise<string>((resolve, reject) => {
    const origin = window.location.origin;
    const authMisconfiguredError = import.meta.env.DEV
      ? `Google sign-in is misconfigured for ${origin}. Add this exact origin to Authorized JavaScript origins in your Google OAuth client, not only Authorized redirect URIs.`
      : "Google sign-in is misconfigured. Check your Google Cloud OAuth client configuration.";

    window.google.accounts.id.initialize({
      client_id: config.googleClientId,
      callback: (response) => {
        if (!response?.credential) {
          reject(new Error("Google sign-in failed"));
          return;
        }
        resolve(response.credential);
      },
      auto_select: false,
      cancel_on_tap_outside: false,
    });

    window.google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        reject(new Error(authMisconfiguredError));
      }
    });
  });

  return idToken;
}
