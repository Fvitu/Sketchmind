// PresenceAvatars — shows avatar circles for all connected users.
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useOthers, useSelf } from "@liveblocks/react/suspense";
import { getUserColor } from "@/lib/colors";

interface PresenceAvatarsProps {
	self: any;
	others: readonly any[];
}

import { UserAvatar } from "@/components/ui/user-avatar";

function Avatar({
	name,
	email,
	color,
	avatar,
	isSelf,
}: {
	name: string;
	email?: string;
	color: string;
	avatar: string;
	isSelf: boolean;
}) {
	return (
		<Popover>
			<PopoverTrigger asChild>
				<button
					type="button"
					className={`relative flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold text-white shadow-sm transition-transform hover:scale-110 ${
						isSelf ? "ring-2 ring-background ring-offset-1" : ""
					}`}
					style={{ backgroundColor: color, borderColor: color }}
				>
					<UserAvatar 
						src={avatar} 
						name={name} 
						showInitials={true}
						className="h-full w-full bg-transparent border-none"
					/>
				</button>
			</PopoverTrigger>
			<PopoverContent side="bottom" align="center" className="w-64 p-4 shadow-xl z-[200]">
				<div className="flex items-center gap-3">
					<div
						className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border-2 text-lg font-semibold text-white shadow-sm"
						style={{ backgroundColor: color, borderColor: color }}
					>
						<UserAvatar 
							src={avatar} 
							name={name} 
							showInitials={true}
							className="h-full w-full bg-transparent border-none"
						/>
					</div>
					<div className="flex flex-col min-w-0">
						<span className="font-semibold text-foreground truncate">{name} {isSelf && "(you)"}</span>
						{email && <span className="text-xs text-muted-foreground truncate">{email}</span>}
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}

export function PresenceAvatars({ self, others }: PresenceAvatarsProps) {
	const MAX_SHOWN = 4;

	type AvatarEntry = {
		name: string;
		email?: string;
		color: string;
		avatar: string;
		isSelf: boolean;
		key: string;
	};

	const allUsers: AvatarEntry[] = [
		...(self?.info
			? [
					{
						name: self.presence?.name || self.info.name,
						email: self.info.email,
						color: self.presence?.color || getUserColor(self.connectionId),
						avatar: self.presence?.avatar || self.info.avatar,
						isSelf: true,
						key: "self",
					},
				]
			: []),
		...others.map((o) => ({
			name: o.presence?.name || o.info?.name || "Anonymous",
			email: o.info?.email,
			color: o.presence?.color || getUserColor(o.connectionId),
			avatar: o.presence?.avatar || o.info?.avatar || "",
			isSelf: false,
			key: String(o.connectionId),
		})),
	];

	const shown = allUsers.slice(0, MAX_SHOWN);
	const overflow = allUsers.length - MAX_SHOWN;

	return (
		<div className="flex items-center">
			<div className="flex -space-x-2">
				{shown.map((user) => (
					<Avatar
						key={user.key}
						name={user.name}
						email={user.email}
						color={user.color}
						avatar={user.avatar}
						isSelf={user.isSelf}
					/>
				))}
				{overflow > 0 && (
					<div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-secondary text-xs font-medium text-secondary-foreground shadow-sm">
						+{overflow}
					</div>
				)}
			</div>
		</div>
	);
}
