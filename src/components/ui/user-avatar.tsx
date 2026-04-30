import * as React from "react";
import { User as UserIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials as getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";

interface UserAvatarProps extends React.ComponentPropsWithoutRef<typeof Avatar> {
	src?: string | null;
	name?: string | null;
	showInitials?: boolean;
	fallbackClassName?: string;
}

// Global cache to keep signed URLs stable during the session.
// This prevents re-fetching the same image when the backend re-signs the URL with a new token.
const avatarCache = new Map<string, string>();

function getStableSrc(src: string | null | undefined): string | null | undefined {
	if (!src || !src.includes(".supabase.co") || !src.includes("token=")) {
		return src;
	}

	try {
		const url = new URL(src);
		// The "base" URL is everything except the token/signature query params.
		// For Supabase, 'token' is the main one that changes on re-signing.
		const baseUrl = url.origin + url.pathname;
		
		const cached = avatarCache.get(baseUrl);
		if (cached) return cached;

		avatarCache.set(baseUrl, src);
		return src;
	} catch {
		return src;
	}
}

export const UserAvatar = React.forwardRef<React.ElementRef<typeof Avatar>, UserAvatarProps>(
	({ src, name, showInitials = true, fallbackClassName, className, ...props }, ref) => {
		const stableSrc = React.useMemo(() => getStableSrc(src), [src]);

		return (
			<Avatar ref={ref} className={cn("bg-muted", className)} {...props}>
				{stableSrc && (
					<AvatarImage
						key={stableSrc}
						src={stableSrc}
						alt={name || "User"}
						className="object-cover"
						referrerPolicy="no-referrer"
					/>
				)}
				<AvatarFallback
					className={cn(
						"flex h-full w-full items-center justify-center rounded-full font-medium text-muted-foreground",
						fallbackClassName,
					)}
				>
					{(showInitials && name && getInitials(name)) || <UserIcon className="h-1/2 w-1/2" />}
				</AvatarFallback>
			</Avatar>
		);
	},
);

UserAvatar.displayName = "UserAvatar";
