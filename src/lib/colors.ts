// We use Excalidraw's exact internal color hashing algorithm
// to ensure perfect consistency between our UI (tooltips, avatars)
// and Excalidraw's native canvas elements (cursors, selections).
// Excalidraw ignores custom color overrides for remote cursors,
// so we must adopt its deterministic hsl() palette.

function hashToInteger(id: string) {
	let hash = 0;
	if (id.length === 0) return hash;
	for (let i = 0; i < id.length; i++) {
		const char = id.charCodeAt(i);
		hash = (hash << 5) - hash + char;
	}
	return hash;
}

export function getUserColor(userId: number | string) {
	const hash = Math.abs(hashToInteger(String(userId)));
	// Use a prime multiplier (13) to spread sequential IDs (like connectionId 1, 2, 3)
	// across the 37 possible hues (0, 10, ... 360) in the Excalidraw-style palette.
	const hue = ((hash * 13) % 37) * 10;
	// Excalidraw hardcodes saturation to 100% and lightness to 83%
	return `hsl(${hue}, 100%, 83%)`;
}
