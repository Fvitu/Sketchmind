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

export const UserAvatar = React.forwardRef<
  React.ElementRef<typeof cAvatar>,
  UserAvatarProps
>(({ src, name, showInitials = true, fallbackClassName, className, ...props }, ref) => {
  return (
    <Avatar ref={ref} className={cn("bg-muted", className)} {...props}>
      {src && (
        <AvatarImage 
          key={src}
          src={src} 
          alt={name || "User"} 
          className="object-cover" 
          referrerPolicy="no-referrer"
        />
      )}
      <AvatarFallback className={cn("flex h-full w-full items-center justify-center rounded-full font-medium text-muted-foreground", fallbackClassName)}>
        {(showInitials && name && getInitials(name)) || (
          <UserIcon className="h-1/2 w-1/2" />
        )}
      </AvatarFallback>
    </Avatar>
  );
});

UserAvatar.displayName = "UserAvatar";
