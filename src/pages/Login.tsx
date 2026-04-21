import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Loader2, Mail, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { auth, useAuthState } from "@/lib/store";

function parseGoogleStateOrigin(rawState: string | null): string | null {
	if (!rawState) return null;

	try {
		const decoded = JSON.parse(window.atob(rawState)) as { openerOrigin?: unknown };
		if (typeof decoded.openerOrigin !== "string" || !decoded.openerOrigin) {
			return null;
		}

		const origin = new URL(decoded.openerOrigin).origin;
		return /^https?:\/\//i.test(origin) ? origin : null;
	} catch {
		return null;
	}
}

const Login = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, runtimeConfig } = useAuthState();
  const [email, setEmail] = useState("");
  const [emailSentTo, setEmailSentTo] = useState("");
  const [emailStage, setEmailStage] = useState<"form" | "sent">("form");
  const [loading, setLoading] = useState<"email" | "google" | "magic" | null>(null);

  useEffect(() => {
    if (!authLoading && user) {
      navigate("/dashboard", { replace: true });
    }
  }, [authLoading, navigate, user]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const magicToken = params.get("magic_token");
    if (magicToken) {
      setLoading("magic");
      auth
        .completeMagicLink(magicToken)
        .then(() => {
          toast.success("Signed in");
          navigate("/dashboard", { replace: true });
        })
        .catch((error) => {
          toast.error(error instanceof Error ? error.message : "Magic link is invalid or expired");
        })
        .finally(() => {
          setLoading(null);
          const nextUrl = new URL(window.location.href);
          nextUrl.searchParams.delete("magic_token");
          window.history.replaceState({}, document.title, nextUrl.pathname + nextUrl.search);
        });
      return;
    }

    const errorDescription = params.get("error");
    if (!errorDescription) return;
    toast.error(decodeURIComponent(errorDescription.replace(/\+/g, " ")));
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete("error");
    window.history.replaceState({}, document.title, nextUrl.pathname + nextUrl.search);
  }, [navigate]);

	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		const code = params.get("code");
		if (!code) return;
		const popupTargetOrigin = parseGoogleStateOrigin(params.get("state")) || window.location.origin;

		if (window.opener && window.opener !== window) {
			window.opener.postMessage(
				{
					type: "google-sign-in-code",
					code,
				},
				popupTargetOrigin,
			);
			window.close();
			return;
		}

		setLoading("google");
		auth.signInWithGoogleCode(code)
			.then(() => {
				toast.success("Signed in with Google");
				navigate("/dashboard", { replace: true });
			})
			.catch((error) => {
				toast.error(error instanceof Error ? error.message : "Couldn't complete Google sign-in");
			})
			.finally(() => {
				setLoading(null);
				const nextUrl = new URL(window.location.href);
				nextUrl.searchParams.delete("code");
				nextUrl.searchParams.delete("state");
				window.history.replaceState({}, document.title, nextUrl.pathname + nextUrl.search);
			});
	}, [navigate]);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      toast.error("Enter a valid email");
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    setLoading("email");

    try {
      await auth.signInWithEmail(normalizedEmail);
      setEmailSentTo(normalizedEmail);
      setEmailStage("sent");
      toast.success("Magic link sent. Check your email.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't send magic link");
    } finally {
      setLoading(null);
    }
  };

	const handleGoogle = async () => {
		setLoading("google");

		try {
			await auth.signInWithGoogle();
			toast.success("Signed in with Google");
			navigate("/dashboard", { replace: true });
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Couldn't start Google sign-in");
			setLoading(null);
		}
	};

  if (authLoading) {
    return (
      <main className="min-h-screen grid place-items-center bg-background">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Restoring your session...
        </div>
      </main>
    );
  }

  return (
		<main className="min-h-screen grid lg:grid-cols-2 bg-background">
			<section className="hidden lg:flex relative overflow-hidden border-r border-border">
				<div className="absolute inset-0 bg-grid opacity-30" />
				<div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
				<div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-[hsl(280_70%_60%/0.2)] blur-3xl" />
				<div className="relative z-10 flex flex-col justify-between p-12 w-full">
					<Logo />
					<motion.div
						initial={{ opacity: 0, y: 16 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
						className="space-y-6 max-w-md">
						<h1 className="text-5xl font-semibold tracking-tight leading-[1.05]">
							A visual workspace
							<br />
							<span className="font-hand text-6xl text-gradient-brand leading-[1.15] inline-block pb-2 pr-1">for thinking out loud.</span>
						</h1>
						<p className="text-base text-muted-foreground leading-relaxed">
							Sketchmind is a modern dark-mode whiteboard built for students. Sketch ideas, organize study notes, and map knowledge visually.
						</p>
						<div className="flex flex-wrap gap-2 pt-2">
							{["Sketch & diagram", "Study maps", "Infinite canvas", "Cloud sync"].map((tag, index) => (
								<motion.span
									key={tag}
									initial={{ opacity: 0, y: 8 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: 0.3 + index * 0.08, duration: 0.4 }}
									className="text-xs rounded-full border border-border bg-card/60 px-3 py-1 text-muted-foreground">
									{tag}
								</motion.span>
							))}
						</div>
					</motion.div>
					<p className="text-xs text-muted-foreground">
						{runtimeConfig.googleEnabled || runtimeConfig.magicLinkEnabled ? "Created with ❤️ by Fvitu © 2026" : "Auth configuration incomplete"}
					</p>
				</div>
			</section>

			<section className="flex items-center justify-center p-6 sm:p-12">
				<motion.div
					initial={{ opacity: 0, y: 12 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5, ease: "easeOut" }}
					className="w-full max-w-sm space-y-8">
					<div className="lg:hidden">
						<Logo />
					</div>

					<div className="space-y-2">
						<h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
						<p className="text-sm text-muted-foreground">Sign in to open your boards.</p>
					</div>

					<AnimatePresence mode="wait" initial={false}>
						{emailStage === "form" ? (
							<motion.div
								key="email-form"
								initial={{ opacity: 0, y: 14 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -10 }}
								transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
								className="space-y-4">
								<form onSubmit={handleEmail} className="space-y-4">
									<div className="space-y-2">
										<Label htmlFor="email">Email</Label>
										<Input
											id="email"
											type="email"
											placeholder="you@school.edu"
											value={email}
											onChange={(e) => setEmail(e.target.value)}
											disabled={!!loading}
											autoComplete="email"
											className="h-11"
										/>
									</div>

									<Button
										type="submit"
										disabled={!!loading}
										className="w-full h-11 gap-2 bg-gradient-brand text-primary-foreground hover:opacity-90 shadow-glow-accent">
										{loading === "email" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
										Continue with email
									</Button>
								</form>

								<div className="flex items-center gap-3">
									<div className="h-px flex-1 bg-border" />
									<span className="text-xs text-muted-foreground">or</span>
									<div className="h-px flex-1 bg-border" />
								</div>

								<Button
									type="button"
									variant="outline"
									onClick={handleGoogle}
									disabled={!!loading}
									className="w-full h-11 gap-2.5 bg-card border-border hover:bg-accent">
									{loading === "google" ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										<svg className="h-4 w-4" viewBox="0 0 24 24">
											<path
												fill="#EA4335"
												d="M12 11v3.2h5.4c-.2 1.4-1.6 4.1-5.4 4.1-3.3 0-5.9-2.7-5.9-6s2.6-6 5.9-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.7 14.6 3 12 3 6.9 3 2.8 7.1 2.8 12.2S6.9 21.4 12 21.4c6.9 0 9.4-4.8 9.4-7.4 0-.5-.1-.9-.1-1.3H12z"
											/>
										</svg>
									)}
									Continue with Google
								</Button>
							</motion.div>
						) : (
							<motion.div
								key="email-sent"
								initial={{ opacity: 0, y: 14 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -10 }}
								transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
								className="rounded-2xl border border-border bg-card/70 p-5 sm:p-6 space-y-5">
								<motion.div
									initial={{ scale: 0.88, opacity: 0 }}
									animate={{ scale: 1, opacity: 1 }}
									transition={{ delay: 0.05, duration: 0.3, ease: "easeOut" }}
									className="mx-auto h-14 w-14 rounded-2xl bg-gradient-brand grid place-items-center shadow-glow-accent">
									<MailCheck className="h-6 w-6 text-primary-foreground" />
								</motion.div>

								<div className="space-y-2 text-center">
									<h3 className="text-lg font-semibold tracking-tight">Check your inbox</h3>
									<p className="text-sm text-muted-foreground leading-relaxed">
										We sent a magic link to <span className="text-foreground font-medium">{emailSentTo}</span>. Open the email and use the
										link to log in.
									</p>
								</div>

								<Button type="button" variant="outline" onClick={() => setEmailStage("form")} className="w-full h-11 gap-2">
									<ArrowLeft className="h-4 w-4" />
									Back
								</Button>
							</motion.div>
						)}
					</AnimatePresence>

					<p className="text-xs text-muted-foreground text-center leading-relaxed">
						By continuing you agree to our terms. <br />
						<span className="opacity-70">
							{!runtimeConfig.magicLinkEnabled
								? "Magic links are unavailable until the server auth keys are configured."
								: "We’ll email you a one-time magic link."}
						</span>
					</p>
				</motion.div>
			</section>
		</main>
  );
};

export default Login;
