import { useEffect, useState, useRef } from "react";
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
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setName(user.display_name);
    }
  }, [user]);

  if (!user) return null;

  const dirty = name.trim() !== user.display_name;

  const handleSignOut = async () => {
		try {
			await auth.signOut();
			navigate("/login", { replace: true });
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Couldn't sign out");
		}
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      return toast.error("File must be smaller than 5MB");
    }

    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!validTypes.includes(file.type)) {
      return toast.error("Only JPG, PNG, WebP, and GIF images are allowed");
    }

    setUploadingAvatar(true);
    try {
      // Process image: resize to 256x256, convert to WebP, and sanitize
      const processedBlob = await processImage(file);
      const processedFile = new File([processedBlob], "avatar.webp", { type: "image/webp" });
      
      await auth.uploadAvatar(processedFile);
      toast.success("Avatar updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't upload avatar");
    } finally {
      setUploadingAvatar(false);
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const processImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) return reject(new Error("Canvas context failed"));

          // Set dimensions (256x256 square)
          canvas.width = 256;
          canvas.height = 256;

          // Crop to square if needed
          const size = Math.min(img.width, img.height);
          const offsetX = (img.width - size) / 2;
          const offsetY = (img.height - size) / 2;

          ctx.drawImage(img, offsetX, offsetY, size, size, 0, 0, 256, 256);

          canvas.toBlob(
            (blob) => {
              if (blob) resolve(blob);
              else reject(new Error("Image conversion failed"));
            },
            "image/webp",
            0.8
          );
        };
        img.onerror = () => reject(new Error("Invalid image file"));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error("File reading failed"));
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = name.trim();
    if (!cleaned) return toast.error("Display name can't be empty");
    if (cleaned.length > 60) return toast.error("Keep it under 60 characters");

    setSaving(true);
    try {
      await auth.updateProfile({ display_name: cleaned });
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
					<div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
						<Avatar className={`h-24 w-24 ring-2 ring-border transition-opacity ${uploadingAvatar ? "opacity-50" : "group-hover:opacity-80"}`}>
							{user.avatar_url && <AvatarImage src={user.avatar_url} alt={name} className="object-cover" />}
							<AvatarFallback className="bg-gradient-brand text-primary-foreground text-2xl font-semibold">
								{initials(name || user.email)}
							</AvatarFallback>
						</Avatar>
						<div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
							{uploadingAvatar ? <Loader2 className="h-6 w-6 text-white animate-spin" /> : <span className="text-white text-xs font-medium">Change</span>}
						</div>
						<input 
							type="file" 
							ref={fileInputRef} 
							onChange={handleAvatarUpload} 
							accept="image/jpeg,image/png,image/webp,image/gif" 
							className="hidden" 
						/>
					</div>
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
