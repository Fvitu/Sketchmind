import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { auth, useAuthUser } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { toast } from "sonner";
import { Loader2, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Profile = () => {
  const user = useAuthUser();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.display_name ?? "");
  const [avatar, setAvatar] = useState(user?.avatar_url ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.display_name);
      setAvatar(user.avatar_url ?? "");
    }
  }, [user]);

  if (!user) return null;

  const dirty = name.trim() !== user.display_name || (avatar || null) !== (user.avatar_url || null);

  const handleSignOut = async () => {
		try {
			await auth.signOut();
			navigate("/login", { replace: true });
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Couldn't sign out");
		}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = name.trim();
    if (!cleaned) return toast.error("Display name can't be empty");
    if (cleaned.length > 60) return toast.error("Keep it under 60 characters");
    if (avatar && !/^https?:\/\//i.test(avatar)) return toast.error("Avatar must be a valid URL");

    setSaving(true);
    try {
      await auth.updateProfile({ display_name: cleaned, avatar_url: avatar.trim() || null });
      toast.success("Profile updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
		<motion.div
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.4, ease: "easeOut" }}
			className="space-y-8 max-w-2xl mx-auto">
			<header className="text-center">
				<h1 className="text-3xl font-semibold tracking-tight">
					Your <span className="font-hand text-4xl text-gradient-brand leading-[1.2] inline-block pb-1.5 pr-1">profile</span>
				</h1>
				<p className="mt-1 text-sm text-muted-foreground">How you appear in Sketchmind.</p>
			</header>

			<div className="rounded-2xl border border-border bg-gradient-card p-6 sm:p-8 shadow-soft">
				<div className="flex flex-col items-center text-center gap-4">
					<Avatar className="h-20 w-20 ring-2 ring-border">
						{avatar && <AvatarImage src={avatar} alt={name} />}
						<AvatarFallback className="bg-gradient-brand text-primary-foreground text-lg font-semibold">
							{initials(name || user.email)}
						</AvatarFallback>
					</Avatar>
					<div className="min-w-0">
						<p className="font-medium truncate">{name || "—"}</p>
						<p className="text-sm text-muted-foreground truncate">{user.email}</p>
					</div>
				</div>

				<form onSubmit={handleSubmit} className="mt-8 space-y-5">
					<div className="space-y-2">
						<Label htmlFor="name">Display name</Label>
						<Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Alex Student" />
					</div>

					<div className="space-y-2">
						<Label htmlFor="avatar">
							Avatar URL <span className="text-muted-foreground font-normal">(optional)</span>
						</Label>
						<Input id="avatar" value={avatar} onChange={(e) => setAvatar(e.target.value)} placeholder="https://…" />
					</div>

					<div className="space-y-2">
						<Label>Email</Label>
						<Input value={user.email} disabled className="opacity-70" />
						<p className="text-xs text-muted-foreground">Email comes from your sign-in provider.</p>
					</div>

					<div className="pt-2 flex justify-center">
						<Button
							type="submit"
							disabled={!dirty || saving}
							data-reactive-glow
							className="reactive-glow gap-2 bg-gradient-brand text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:shadow-none">
							{saving && <Loader2 className="h-4 w-4 animate-spin" />}
							Save changes
						</Button>
					</div>
				</form>

				<div className="mt-8 pt-8 border-t border-border">
					<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
						<div>
							<p className="font-medium text-sm">Sign out</p>
							<p className="text-xs text-muted-foreground">Sign out of Sketchmind on this device.</p>
						</div>
						<Button variant="destructive" className="gap-2" onClick={handleSignOut}>
							<LogOut className="h-4 w-4" />
							Sign out
						</Button>
					</div>
				</div>
			</div>
		</motion.div>
  );
};

export default Profile;
