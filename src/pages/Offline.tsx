/**
 * Offline fallback page — shown by the service worker when a navigation
 * request fails and there is no cached version of the requested page.
 * Styled to match Sketchmind's dark theme.
 */
export default function OfflinePage() {
  const handleRetry = () => window.location.reload();

  return (
    <div
      style={{
        minHeight: "100svh",
        backgroundColor: "#0a0a0a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1.5rem",
        padding: "0 1.5rem",
        textAlign: "center",
        fontFamily:
          "Inter, 'Segoe UI', system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Logo */}
      <img
        src="/icons/icon-192x192.png"
        alt="Sketchmind"
        width={72}
        height={72}
        style={{ opacity: 0.85, borderRadius: "20px" }}
      />

      {/* Headline */}
      <div>
        <h1
          style={{
            color: "#fff",
            fontSize: "1.25rem",
            fontWeight: 600,
            marginBottom: "0.5rem",
          }}
        >
          You're offline
        </h1>
        <p
          style={{
            color: "rgba(255,255,255,0.45)",
            fontSize: "0.875rem",
            maxWidth: "22rem",
            lineHeight: 1.6,
          }}
        >
          Sketchmind needs an internet connection to sync your boards and
          collaborate in real time. Connect to a network and try again.
        </p>
      </div>

      {/* Retry button */}
      <button
        onClick={handleRetry}
        style={{
          marginTop: "0.5rem",
          padding: "0.625rem 1.25rem",
          borderRadius: "9999px",
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "#fff",
          fontSize: "0.875rem",
          fontWeight: 500,
          cursor: "pointer",
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.background =
            "rgba(255,255,255,0.13)")
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.background =
            "rgba(255,255,255,0.08)")
        }
      >
        Try again
      </button>
    </div>
  );
}
