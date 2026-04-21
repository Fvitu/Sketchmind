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

function openGoogleAuthPopup() {
	const width = 520;
	const height = 700;
	const dualScreenLeft = (window.screenLeft !== undefined ? window.screenLeft : window.screenX) ?? 0;
	const dualScreenTop = (window.screenTop !== undefined ? window.screenTop : window.screenY) ?? 0;
	const outerWidth = window.outerWidth ?? document.documentElement.clientWidth ?? screen.width;
	const outerHeight = window.outerHeight ?? document.documentElement.clientHeight ?? screen.height;

	const left = Math.round(dualScreenLeft + Math.max(0, (outerWidth - width) / 2));
	const top = Math.round(dualScreenTop + Math.max(0, (outerHeight - height) / 2));

	const features = `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable,scrollbars`;
	return window.open("about:blank", "sketchmind-google-signin", features);
}

function getOrigin(value: string): string | null {
	try {
		return new URL(value).origin;
	} catch {
		return null;
	}
}

function encodeGoogleState(openerOrigin: string): string {
	return window.btoa(JSON.stringify({ openerOrigin }));
}

function waitForGoogleTokenFromPopup(popup: Window, allowedOrigins: Set<string>): Promise<string> {
	return new Promise((resolve, reject) => {
		const timeout = window.setTimeout(() => {
			cleanup();
			reject(new Error("Google sign-in timed out"));
		}, 120000);

		const handleMessage = (event: MessageEvent) => {
			if (!allowedOrigins.has(event.origin)) {
				return;
			}

			if (!event.data || event.data.type !== "google-sign-in-code" || typeof event.data.code !== "string") {
				return;
			}

			cleanup();
			resolve(event.data.code);
		};

		const monitorClose = window.setInterval(() => {
			if (popup.closed) {
				cleanup();
				reject(new Error("Google sign-in was closed"));
			}
		}, 250);

		function cleanup() {
			window.clearTimeout(timeout);
			window.clearInterval(monitorClose);
			window.removeEventListener("message", handleMessage);
		}

		window.addEventListener("message", handleMessage);
	});
}

export async function signInWithGoogleClient(): Promise<string> {
	const popup = openGoogleAuthPopup();
	if (!popup) {
		throw new Error("Please allow popups to sign in with Google");
	}

	const config = await getRuntimeAuthConfig();
	if (!config.googleEnabled || !config.googleClientId) {
		popup.close();
		throw new Error("Google sign-in is not configured");
	}

	const configuredOrigin = getOrigin(config.siteUrl);
	const redirectBase = configuredOrigin || window.location.origin;
	const redirectUri = new URL("/login", redirectBase).href;
	const allowedOrigins = new Set<string>([window.location.origin]);
	const redirectOrigin = getOrigin(redirectUri);
	if (redirectOrigin) {
		allowedOrigins.add(redirectOrigin);
	}

	const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
	authUrl.searchParams.set("client_id", config.googleClientId);
	authUrl.searchParams.set("redirect_uri", redirectUri);
	authUrl.searchParams.set("response_type", "code");
	authUrl.searchParams.set("scope", "openid email profile");
	authUrl.searchParams.set("prompt", "select_account");
	authUrl.searchParams.set("include_granted_scopes", "true");
	authUrl.searchParams.set("state", encodeGoogleState(window.location.origin));

	popup.location.href = authUrl.href;

	try {
		return await waitForGoogleTokenFromPopup(popup, allowedOrigins);
	} catch (error) {
		popup.close();
		throw error;
	}
}
