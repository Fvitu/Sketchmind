import { createHmac, createHash, randomUUID, randomBytes, timingSafeEqual } from "node:crypto";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
import { createClient } from "@supabase/supabase-js";
import { OAuth2Client } from "google-auth-library";
import { Liveblocks } from "@liveblocks/node";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const entryFilePath = fileURLToPath(import.meta.url);
const rootDir = __dirname;
const distDir = path.join(rootDir, "dist");
const publicDir = path.join(rootDir, "public");
const envPath = path.join(rootDir, ".env");
const isProd = process.env.NODE_ENV === "production";
const port = Number(process.env.PORT || 8080);
const DEFAULT_BOARD_LIMIT = 12;
const SESSION_COOKIE_NAME = "sketchmind_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const BOARD_ASSET_BUCKET = "board-assets";
const ALLOWED_ASSET_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"]);
const MAX_ASSET_SIZE_BYTES = 10 * 1024 * 1024;

loadEnvFile(envPath);

const runtimeConfig = {
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  googleEnabled: Boolean(process.env.GOOGLE_CLIENT_ID),
  magicLinkEnabled: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM && process.env.AUTH_SECRET),
  siteUrl: trimTrailingSlash(process.env.NEXT_PUBLIC_SITE_URL || `http://localhost:${port}`),
};

const googleOAuthClient = createGoogleOAuthClient();
const supabase = createSupabaseClient();
const liveblocksClient = createLiveblocksClient();
let vite = null;

if (!isProd) {
  try {
    vite = await import("vite").then(({ createServer }) =>
      createServer({
        root: rootDir,
        appType: "spa",
        server: { middlewareMode: true },
      }),
    );
  } catch (error) {
    console.warn("Vite middleware mode is unavailable, serving the built app instead.");
    console.warn(error instanceof Error ? error.message : error);
  }
}

export async function handleRequest(req, res) {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || `localhost:${port}`}`);

    if (url.pathname === "/api/auth/runtime-config" && req.method === "GET") {
      return json(res, 200, runtimeConfig);
    }

    if (url.pathname === "/api/auth/magic-link" && req.method === "POST") {
      return await handleMagicLinkRequest(req, res);
    }

    if (url.pathname === "/api/auth/verify-magic-link" && req.method === "GET") {
      return await handleMagicLinkVerification(url, res);
    }

    if (url.pathname === "/api/auth/register-session" && req.method === "POST") {
      return await handleRegisterSessionRequest(req, res);
    }

    if (url.pathname === "/api/auth/session" && req.method === "GET") {
      return await handleSessionRequest(req, res);
    }

    if (url.pathname === "/api/auth/sign-out" && req.method === "POST") {
      return await handleSignOutRequest(res);
    }

    if (url.pathname === "/api/profile" && req.method === "PATCH") {
      return await handleProfileUpdate(req, res);
    }

    if (url.pathname === "/api/boards") {
      return await handleBoardsCollection(req, res);
    }

    if (url.pathname === "/api/liveblocks-auth" && req.method === "POST") {
      return await handleLiveblocksAuth(req, res);
    }

    const boardSharePathMatch = url.pathname.match(/^\/api\/boards\/([^/]+)\/share$/);
    if (boardSharePathMatch) {
      return await handleBoardShare(req, res, decodeURIComponent(boardSharePathMatch[1]));
    }

    const boardLeavePathMatch = url.pathname.match(/^\/api\/boards\/([^/]+)\/leave$/);
    if (boardLeavePathMatch) {
      return await handleBoardLeave(req, res, decodeURIComponent(boardLeavePathMatch[1]));
    }

    const boardJoinPathMatch = url.pathname.match(/^\/api\/boards\/join\/([^/]+)$/);
    if (boardJoinPathMatch) {
      return await handleBoardJoinLookup(req, res, decodeURIComponent(boardJoinPathMatch[1]));
    }

    const boardAssetsPathMatch = url.pathname.match(/^\/api\/boards\/([^/]+)\/assets$/);
	if (boardAssetsPathMatch) {
		return await handleBoardAssetUpload(req, res, decodeURIComponent(boardAssetsPathMatch[1]));
	}

    const boardDuplicatePathMatch = url.pathname.match(/^\/api\/boards\/([^/]+)\/duplicate$/);
	if (boardDuplicatePathMatch) {
		return await handleBoardDuplicate(req, res, decodeURIComponent(boardDuplicatePathMatch[1]));
	}

    const boardPathMatch = url.pathname.match(/^\/api\/boards\/([^/]+)$/);
    if (boardPathMatch) {
      return await handleBoardItem(req, res, decodeURIComponent(boardPathMatch[1]));
    }

    if (url.pathname.startsWith("/api/")) {
      return json(res, 404, { error: "Not found" });
    }

    if (!isProd && vite) {
      return vite.middlewares(req, res, () => {
        res.statusCode = 404;
        res.end("Not found");
      });
    }

    return await serveStatic(url.pathname, res);
  } catch (error) {
    if (error instanceof HttpError) {
      return json(res, error.statusCode, { error: error.message });
    }

    console.error(error);
    return json(res, 500, { error: "Internal server error" });
  }
}

const isDirectExecution = process.argv[1] && path.resolve(process.argv[1]) === entryFilePath;

if (isDirectExecution) {
  const server = http.createServer(handleRequest);
  server.listen(port, () => {
    console.log(`Sketchmind running at http://localhost:${port}`);
  });
}

async function handleMagicLinkRequest(req, res) {
  if (!runtimeConfig.magicLinkEnabled) {
    return json(res, 503, { error: "Magic link auth is not configured" });
  }

  const body = await readJson(req);
  const email = normalizeEmail(body?.email);

  if (!email) {
    return json(res, 400, { error: "Enter a valid email address" });
  }

  const token = signMagicToken(email);
  const loginUrl = new URL("/login", runtimeConfig.siteUrl);
  loginUrl.searchParams.set("magic_token", token);
  const emailContent = buildMagicLinkEmail({
    url: loginUrl.href,
    host: loginUrl.host,
    email,
  });

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM,
      to: [email],
      subject: "Sign in to Sketchmind",
      html: emailContent.html,
      text: emailContent.text,
    }),
  });

  const resendJson = await resendResponse.json().catch(() => ({}));
  if (!resendResponse.ok) {
    return json(res, resendResponse.status, {
      error: resendJson?.message || resendJson?.error || "Couldn't send magic link",
    });
  }

  return json(res, 200, { ok: true });
}

async function handleMagicLinkVerification(url, res) {
  const token = url.searchParams.get("token");
  if (!token) {
    return json(res, 400, { error: "Missing magic link token" });
  }

  const email = verifyMagicToken(token);
  if (!email) {
    return json(res, 401, { error: "Magic link is invalid or expired" });
  }

  const identity = {
    id: createHash("sha256").update(email).digest("hex"),
    email,
    display_name: email.split("@")[0] || "Student",
    avatar_url: null,
  };

  const user = await registerSessionForIdentity(identity, res);
  return json(res, 200, { user });
}

async function handleRegisterSessionRequest(req, res) {
  const body = await readJson(req);
  const idToken = typeof body?.id_token === "string" ? body.id_token.trim() : "";
  const code = typeof body?.code === "string" ? body.code.trim() : "";

  if (!idToken && !code) {
		return json(res, 400, { error: "Missing Google ID token or authorization code" });
  }

  const identity = idToken ? await verifyGoogleIdToken(idToken) : await verifyGoogleAuthorizationCode(code);

  const user = await registerSessionForIdentity(identity, res);
  return json(res, 200, { user });
}

async function handleSessionRequest(req, res) {
  const userId = getSessionUserId(req);
  if (!userId) {
    return json(res, 401, { error: "Not signed in" });
  }

  const user = await getUserProfileById(userId);
  if (!user) {
    appendSetCookie(res, buildClearedSessionCookie());
    return json(res, 401, { error: "Session expired" });
  }

  return json(res, 200, { user });
}

async function handleSignOutRequest(res) {
  appendSetCookie(res, buildClearedSessionCookie());
  return json(res, 200, { ok: true });
}

async function handleProfileUpdate(req, res) {
  const userId = getSessionUserId(req);
  if (!userId) {
    return json(res, 401, { error: "Not signed in" });
  }

  const body = await readJson(req);
  const patch = {};

  if ("display_name" in body) {
    if (typeof body.display_name !== "string") {
      return json(res, 400, { error: "Display name must be a string" });
    }

    const displayName = body.display_name.trim();
    if (!displayName) {
      return json(res, 400, { error: "Display name can't be empty" });
    }

    if (displayName.length > 60) {
      return json(res, 400, { error: "Keep it under 60 characters" });
    }

    patch.display_name = displayName;
  }

  if ("avatar_url" in body) {
    if (body.avatar_url === null || body.avatar_url === "") {
      patch.avatar_url = null;
    } else if (typeof body.avatar_url === "string") {
      const avatar = body.avatar_url.trim();
      if (!/^https?:\/\//i.test(avatar)) {
        return json(res, 400, { error: "Avatar must be a valid URL" });
      }

      patch.avatar_url = avatar;
    } else {
      return json(res, 400, { error: "Avatar must be a valid URL" });
    }
  }

  if (Object.keys(patch).length === 0) {
    const current = await getUserProfileById(userId);
    if (!current) {
      return json(res, 404, { error: "User not found" });
    }

    return json(res, 200, { user: current });
  }

  const client = getSupabaseClient();
  const { data, error } = await client
    .from("profiles")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", userId)
    .select("id,email,display_name,avatar_url,created_at")
    .maybeSingle();

  if (error) {
    throw new HttpError(500, userFacingDatabaseError(error.message));
  }

  if (!data) {
    return json(res, 404, { error: "User not found" });
  }

  return json(res, 200, { user: mapUserRow(data) });
}

async function handleBoardsCollection(req, res) {
  const userId = getSessionUserId(req);
  if (!userId) {
    return json(res, 401, { error: "Not signed in" });
  }

  if (req.method === "GET") {
    const boards = await listBoardsForUser(userId);
    return json(res, 200, { boards });
  }

  if (req.method === "POST") {
    const body = await readJson(req);
    const created = await createBoardForUser(userId, body?.title, body?.id, body);
    return json(res, 200, { board: created });
  }

  return json(res, 405, { error: "Method not allowed" });
}

async function handleBoardDuplicate(req, res, boardId) {
	const userId = getSessionUserId(req);
	if (!userId) {
		return json(res, 401, { error: "Not signed in" });
	}

	if (req.method !== "POST") {
		return json(res, 405, { error: "Method not allowed" });
	}

	const duplicated = await duplicateBoardForUser(userId, boardId);
	return json(res, 200, { board: duplicated });
}

async function handleBoardItem(req, res, boardId) {
  const userId = getSessionUserId(req);
  if (!userId) {
    return json(res, 401, { error: "Not signed in" });
  }

  if (req.method === "GET") {
    const board = await getBoardForUser(userId, boardId);
    if (!board) {
      return json(res, 404, { error: "Board not found" });
    }

    return json(res, 200, { board });
  }

  if (req.method === "PATCH") {
    const body = await readJson(req);
    const updated = await updateBoardForUser(userId, boardId, body);
	return json(res, 200, { board: updated });
  }

  if (req.method === "DELETE") {
    await deleteBoardForUser(userId, boardId);
    return json(res, 200, { ok: true });
  }

  return json(res, 405, { error: "Method not allowed" });
}

async function handleBoardAssetUpload(req, res, boardId) {
	const userId = getSessionUserId(req);
	if (!userId) {
		return json(res, 401, { error: "Not signed in" });
	}

	if (req.method !== "POST") {
		return json(res, 405, { error: "Method not allowed" });
	}

	const access = await getBoardAccessForUser(userId, boardId);
	if (!access) {
		return json(res, 404, { error: "Board not found" });
	}

	if (access.role === "viewer") {
		return json(res, 403, { error: "You do not have permission to upload assets" });
	}

	const formData = await readFormData(req);
	const file = formData.get("file");

	if (!(file instanceof File)) {
		return json(res, 400, { error: "No file provided" });
	}

	if (!ALLOWED_ASSET_MIME_TYPES.has(file.type)) {
		return json(res, 400, { error: "File type not allowed" });
	}

	if (file.size > MAX_ASSET_SIZE_BYTES) {
		return json(res, 400, { error: "File too large (max 10MB)" });
	}

	const extension = safeFileExtension(file);
	const storagePath = `${boardId}/${userId}/${Date.now()}-${randomUUID()}.${extension}`;
	const buffer = Buffer.from(await file.arrayBuffer());
	const client = getSupabaseClient();

	const { error: uploadError } = await client.storage.from(BOARD_ASSET_BUCKET).upload(storagePath, buffer, {
		contentType: file.type,
		upsert: false,
	});

	if (uploadError) {
		throw new HttpError(500, uploadError.message);
	}

	const { data: publicUrlData } = client.storage.from(BOARD_ASSET_BUCKET).getPublicUrl(storagePath);

	const { error: dbError } = await client.from("assets").insert({
		board_id: boardId,
		uploader_id: userId,
		storage_path: storagePath,
		public_url: publicUrlData.publicUrl,
		mime_type: file.type,
		size_bytes: file.size,
	});

	if (dbError) {
		throw new HttpError(500, userFacingDatabaseError(dbError.message));
	}

	return json(res, 200, {
		ok: true,
		url: publicUrlData.publicUrl,
		path: storagePath,
	});
}

async function registerSessionForIdentity(identity, res) {
  const user = await persistUserProfile(identity);
  const token = signSessionToken(user.id);
  appendSetCookie(res, buildSessionCookie(token));
  return user;
}

async function getUserProfileByEmail(email) {
	const client = getSupabaseClient();
  const { data, error } = await client.from("profiles").select("*").eq("email", email).maybeSingle();

	if (error) {
		throw new HttpError(500, userFacingDatabaseError(error.message));
	}

	if (!data) {
		return null;
	}

	return mapUserRow(data);
}

function normalizeIncomingUser(input) {
  if (!input || typeof input !== "object") {
    return null;
  }

  const email = normalizeEmail(input.email);
  if (!email) {
    return null;
  }

  const id = typeof input.id === "string" && input.id.trim() ? input.id.trim() : createHash("sha256").update(email).digest("hex");
  const display_name =
    typeof input.display_name === "string" && input.display_name.trim()
      ? input.display_name.trim().slice(0, 60)
      : email.split("@")[0] || "Student";
  const avatar_url =
    typeof input.avatar_url === "string" && /^https?:\/\//i.test(input.avatar_url.trim()) ? input.avatar_url.trim() : null;

  return {
    id,
    email,
    display_name,
    avatar_url,
  };
}

async function persistUserProfile(identity) {
  const client = getSupabaseClient();
  const now = new Date().toISOString();

  const existing = await getUserProfileByEmail(identity.email);
  if (existing) {
		const { data, error } = await client
			.from("profiles")
			.update({
				email: identity.email,
				display_name: identity.display_name,
				avatar_url: identity.avatar_url,
				updated_at: now,
			})
			.eq("id", existing.id)
			.select("*")
			.single();

		if (error || !data) {
			throw new HttpError(500, userFacingDatabaseError(error?.message || "Couldn't save your account"));
		}

		return mapUserRow(data);
  }

  const { data, error } = await client
		.from("profiles")
		.insert({
			id: identity.id,
			email: identity.email,
			display_name: identity.display_name,
			avatar_url: identity.avatar_url,
			created_at: now,
			updated_at: now,
		})
		.select("*")
		.single();

  if (error || !data) {
    if (error?.code === "23505") {
		const fallback = await getUserProfileByEmail(identity.email);
		if (fallback) {
			const { data: updatedData, error: updateError } = await client
				.from("profiles")
				.update({
					email: identity.email,
					display_name: identity.display_name,
					avatar_url: identity.avatar_url,
					updated_at: now,
				})
				.eq("id", fallback.id)
				.select("*")
				.single();

			if (!updateError && updatedData) {
				return mapUserRow(updatedData);
			}
		}
	}

    throw new HttpError(500, userFacingDatabaseError(error?.message || "Couldn't save your account"));
  }

  return mapUserRow(data);
}

async function getUserProfileById(userId) {
  const client = getSupabaseClient();
  const { data, error } = await client.from("profiles").select("*").eq("id", userId).maybeSingle();

  if (error) {
    throw new HttpError(500, userFacingDatabaseError(error.message));
  }

  if (!data) {
    return null;
  }

  return mapUserRow(data);
}

async function listBoardsForUser(userId) {
  const client = getSupabaseClient();
  const boardFields = "id,owner_id,title,description,visibility,thumbnail_path,canvas_state,created_at,last_edited_at";

  const { data: ownedBoards, error: ownedError } = await client
    .from("boards")
    .select(boardFields)
    .eq("owner_id", userId)
    .order("last_edited_at", { ascending: false });

  if (ownedError) {
    throw new HttpError(500, userFacingDatabaseError(ownedError.message));
  }

  const { data: memberships } = await client
    .from("board_members")
    .select("board_id, role, is_shared_with_me")
    .eq("user_id", userId)
    .eq("is_shared_with_me", true);

  const sharedBoardIds = (memberships ?? []).map((m) => m.board_id);
  let sharedBoards = [];

  if (sharedBoardIds.length > 0) {
    const { data: shared } = await client
      .from("boards")
      .select(boardFields)
      .in("id", sharedBoardIds)
      .order("last_edited_at", { ascending: false });

    const roleMap = {};
    for (const m of memberships ?? []) {
      roleMap[m.board_id] = m.role;
    }

    sharedBoards = (shared ?? []).map((b) => ({ ...b, role: roleMap[b.id] ?? "editor" }));
  }

  const owned = (ownedBoards ?? []).map((b) => ({ ...b, role: "owner" }));
  return [...owned, ...sharedBoards];
}

async function getBoardForUser(userId, boardId) {
  const access = await getBoardAccessForUser(userId, boardId);
  if (!access) {
		return null;
  }

  const client = getSupabaseClient();
  const { data, error } = await client
		.from("boards")
		.select("id,owner_id,title,description,visibility,thumbnail_path,canvas_state,created_at,last_edited_at")
		.eq("id", boardId)
		.maybeSingle();

  if (error) {
    throw new HttpError(500, userFacingDatabaseError(error.message));
  }

  if (!data) {
		return null;
  }

  return {
		...data,
		role: access.role,
  };
}

async function createBoardForUser(userId, rawTitle, rawId, template = null) {
	const client = getSupabaseClient();
	const profile = await getUserProfileById(userId);
	const boardLimit = profile?.board_limit ?? DEFAULT_BOARD_LIMIT;
	const title =
		typeof rawTitle === "string" && rawTitle.trim()
			? rawTitle.trim().slice(0, 80)
			: template?.title
				? `Copy of ${template.title}`.slice(0, 80)
				: "Untitled board";
	const id = typeof rawId === "string" && rawId.trim() ? rawId.trim() : randomUUID();

	const { count, error: countError } = await client.from("boards").select("id", { count: "exact", head: true }).eq("owner_id", userId);

	if (countError) {
		throw new HttpError(500, userFacingDatabaseError(countError.message));
	}

	if ((count || 0) >= boardLimit) {
		throw new HttpError(409, `You've reached the database-defined limit of ${boardLimit} boards. Delete one to create another.`);
	}

	const now = new Date().toISOString();
	const { data, error } = await client
		.from("boards")
		.insert({
			id,
			owner_id: userId,
			title,
			description: template?.description ?? null,
			visibility: template?.visibility ?? "private",
			thumbnail_path: template?.thumbnail_path ?? null,
			canvas_state: template?.canvas_state ?? null,
			created_at: now,
			last_edited_at: now,
		})
		.select("id,owner_id,title,description,visibility,thumbnail_path,canvas_state,created_at,last_edited_at")
		.single();

	if (error || !data) {
		throw new HttpError(500, userFacingDatabaseError(error?.message || "Couldn't create board"));
	}

	return data;
}

async function duplicateBoardForUser(userId, boardId) {
	const source = await getBoardForUser(userId, boardId);
	if (!source) {
		throw new HttpError(404, "Board not found");
	}

	const clonedCanvasState = source.canvas_state ? JSON.parse(JSON.stringify(source.canvas_state)) : null;

	return await createBoardForUser(userId, `Copy of ${source.title}`, randomUUID(), {
		description: source.description,
		visibility: source.visibility,
		thumbnail_path: source.thumbnail_path,
		canvas_state: clonedCanvasState,
	});
}

async function renameBoardForUser(userId, boardId, rawTitle) {
  if (typeof rawTitle !== "string") {
    throw new HttpError(400, "Title is required");
  }

  const title = rawTitle.trim();
  if (!title) {
    throw new HttpError(400, "Title can't be empty");
  }

  const client = getSupabaseClient();
  const { data, error } = await client
    .from("boards")
    .update({
      title: title.slice(0, 80),
      last_edited_at: new Date().toISOString(),
    })
    .eq("id", boardId)
    .eq("owner_id", userId)
    .select("id,owner_id,title,description,visibility,thumbnail_path,canvas_state,created_at,last_edited_at")
    .maybeSingle();

  if (error) {
    throw new HttpError(500, userFacingDatabaseError(error.message));
  }

  if (!data) {
    throw new HttpError(404, "Board not found");
  }

  return data;
}

async function updateBoardForUser(userId, boardId, body) {
	const access = await getBoardAccessForUser(userId, boardId);
	if (!access) {
		throw new HttpError(404, "Board not found");
	}

	if (typeof body?.title === "string") {
		return await renameBoardForUser(userId, boardId, body.title);
	}

	if (access.role === "viewer") {
		throw new HttpError(403, "You do not have permission to edit this board");
	}

	const patch = {
		last_edited_at: new Date().toISOString(),
	};

	if (Object.prototype.hasOwnProperty.call(body ?? {}, "canvas_state")) {
		patch.canvas_state = body.canvas_state ?? null;
	}

	if (typeof body?.thumbnail_path === "string") {
		patch.thumbnail_path = body.thumbnail_path.trim() || null;
	} else if (body?.thumbnail_path === null) {
		patch.thumbnail_path = null;
	}

	if (Object.keys(patch).length === 1) {
		const current = await getBoardForUser(userId, boardId);
		if (!current) {
			throw new HttpError(404, "Board not found");
		}

		return current;
	}

	const client = getSupabaseClient();
	const { data, error } = await client
		.from("boards")
		.update(patch)
		.eq("id", boardId)
		.select("id,owner_id,title,description,visibility,thumbnail_path,canvas_state,created_at,last_edited_at")
		.maybeSingle();

	if (error) {
		throw new HttpError(500, userFacingDatabaseError(error.message));
	}

	if (!data) {
		throw new HttpError(404, "Board not found");
	}

	return {
		...data,
		role: access.role,
	};
}

async function deleteBoardForUser(userId, boardId) {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("boards")
    .delete()
    .eq("id", boardId)
    .eq("owner_id", userId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new HttpError(500, userFacingDatabaseError(error.message));
  }

  if (!data) {
    throw new HttpError(404, "Board not found");
  }
}

async function getBoardAccessForUser(userId, boardId) {
	const client = getSupabaseClient();
	const { data: board, error } = await client.from("boards").select("id,owner_id").eq("id", boardId).maybeSingle();

	if (error) {
		throw new HttpError(500, userFacingDatabaseError(error.message));
	}

	if (!board) {
		return null;
	}

	if (board.owner_id === userId) {
		return { role: "owner" };
	}

	const { data: membership, error: membershipError } = await client
		.from("board_members")
		.select("role")
		.eq("board_id", boardId)
		.eq("user_id", userId)
		.maybeSingle();

	if (membershipError) {
		throw new HttpError(500, userFacingDatabaseError(membershipError.message));
	}

	if (!membership) {
		return null;
	}

	return { role: membership.role };
}

function mapUserRow(row) {
  return {
		id: row.id,
		email: row.email,
		display_name: row.display_name,
		avatar_url: row.avatar_url,
		board_limit: typeof row.board_limit === "number" && row.board_limit > 0 ? row.board_limit : DEFAULT_BOARD_LIMIT,
		created_at: row.created_at,
  };
}

async function verifyGoogleIdToken(idToken) {
  const client = getGoogleOAuthClient();
  const ticket = await client.verifyIdToken({
    idToken,
    audience: runtimeConfig.googleClientId,
  });

  const payload = ticket.getPayload();
  if (!payload) {
    throw new HttpError(401, "Google sign-in response is missing required fields");
  }

  if (payload.email_verified === false) {
    throw new HttpError(401, "Google email address is not verified");
  }

  const identity = normalizeIncomingUser({
    id: payload.sub,
    email: payload.email,
    display_name: payload.name,
    avatar_url: payload.picture,
  });

  if (!identity) {
    throw new HttpError(401, "Google sign-in response is missing required fields");
  }

  return identity;
}

async function verifyGoogleAuthorizationCode(code) {
	const client = getGoogleOAuthClient();
	const redirectUri = `${runtimeConfig.siteUrl}/login`;
	let tokens;

	try {
		({ tokens } = await client.getToken({
			code,
			redirect_uri: redirectUri,
		}));
	} catch (error) {
		const message = extractGoogleOAuthError(error);
		if (/redirect_uri_mismatch/i.test(message)) {
			throw new HttpError(400, `Google OAuth redirect mismatch. Add ${redirectUri} to Authorized redirect URIs for this OAuth client.`);
		}

		if (/invalid_grant/i.test(message)) {
			throw new HttpError(401, "Google sign-in failed. Try again.");
		}

		throw new HttpError(401, "Couldn't verify Google sign-in");
	}

	if (!tokens?.id_token) {
		throw new HttpError(401, "Google sign-in response is missing required fields");
	}

	return await verifyGoogleIdToken(tokens.id_token);
}

function createGoogleOAuthClient() {
	if (!runtimeConfig.googleClientId) {
		return null;
	}

	return new OAuth2Client(runtimeConfig.googleClientId, process.env.GOOGLE_CLIENT_SECRET || undefined);
}

function extractGoogleOAuthError(error) {
	if (error && typeof error === "object") {
		if ("response" in error && error.response && typeof error.response === "object") {
			const response = error.response;
			if ("data" in response && response.data && typeof response.data === "object") {
				const data = response.data;
				if ("error" in data && typeof data.error === "string") {
					return data.error;
				}
				if ("error_description" in data && typeof data.error_description === "string") {
					return data.error_description;
				}
			}
		}

		if ("message" in error && typeof error.message === "string") {
			return error.message;
		}
	}

	return "Google OAuth request failed";
}

function getGoogleOAuthClient() {
  if (!googleOAuthClient) {
    throw new HttpError(503, "Google sign-in is not configured");
  }

  return googleOAuthClient;
}

function createSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function createLiveblocksClient() {
  const secret = process.env.LIVEBLOCKS_SECRET_KEY || "";
  if (!secret) {
    return null;
  }
  return new Liveblocks({ secret });
}

function getLiveblocksClient() {
  if (!liveblocksClient) {
    throw new HttpError(503, "Liveblocks is not configured. Add LIVEBLOCKS_SECRET_KEY to .env.");
  }
  return liveblocksClient;
}

const COLLABORATOR_COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#6366F1",
];

function getUserColor(userId) {
  const hash = userId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return COLLABORATOR_COLORS[hash % COLLABORATOR_COLORS.length];
}

async function handleLiveblocksAuth(req, res) {
  const userId = getSessionUserId(req);
  if (!userId) {
    return json(res, 401, { error: "Unauthorized" });
  }

  const body = await readJson(req);
  const { room } = body;
  if (!room || typeof room !== "string" || !room.startsWith("board-")) {
    return json(res, 400, { error: "Invalid room ID" });
  }

  const boardId = room.replace("board-", "");
  const client = getSupabaseClient();

  // Check the user has access to this board (owner or member)
  const access = await getBoardAccessForUser(userId, boardId);
  if (!access) {
    // Check if the board is shared via link (visibility = 'shared')
    const { data: board } = await client.from("boards").select("id, visibility").eq("id", boardId).maybeSingle();
    if (!board || board.visibility !== "shared") {
      return json(res, 403, { error: "Forbidden" });
    }
  }

  // Get the user's profile
  const profile = await getUserProfileById(userId);
  const userName = profile?.display_name ?? "Anonymous";
  const userAvatar = profile?.avatar_url ?? "";
  const userColor = getUserColor(userId);

  const liveblocks = getLiveblocksClient();
  const session = liveblocks.prepareSession(userId, {
    userInfo: {
      name: userName,
      email: profile?.email ?? "",
      avatar: userAvatar,
      color: userColor,
    },
  });

  session.allow(room, session.FULL_ACCESS);

  const { status, body: responseBody } = await session.authorize();
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(responseBody);
}

async function handleBoardShare(req, res, boardId) {
  const userId = getSessionUserId(req);
  if (!userId) {
    return json(res, 401, { error: "Not signed in" });
  }

  const client = getSupabaseClient();

  if (req.method === "POST") {
    // Generate share link — owner only
    const { data: board, error } = await client
      .from("boards")
      .select("id, owner_id, share_token")
      .eq("id", boardId)
      .eq("owner_id", userId)
      .maybeSingle();

    if (error || !board) {
      return json(res, 404, { error: "Board not found or not owner" });
    }

    let token = board.share_token;
    if (!token) {
      token = randomBytes(16).toString("hex");
      const { error: updateError } = await client
        .from("boards")
        .update({ share_token: token, visibility: "shared" })
        .eq("id", boardId);

      if (updateError) {
        return json(res, 500, { error: "Failed to generate share token" });
      }
    }

    return json(res, 200, { token, shareUrl: `/join/${token}` });
  }

  if (req.method === "DELETE") {
    // Revoke share link — owner only
    const { error } = await client
      .from("boards")
      .update({ share_token: null, visibility: "private" })
      .eq("id", boardId)
      .eq("owner_id", userId);

    if (error) {
      return json(res, 500, { error: "Failed to revoke share link" });
    }

    return json(res, 200, { ok: true });
  }

  return json(res, 405, { error: "Method not allowed" });
}

async function handleBoardLeave(req, res, boardId) {
  if (req.method !== "DELETE") {
    return json(res, 405, { error: "Method not allowed" });
  }

  const userId = getSessionUserId(req);
  if (!userId) {
    return json(res, 401, { error: "Not signed in" });
  }

  const client = getSupabaseClient();
  const { error } = await client
    .from("board_members")
    .delete()
    .eq("board_id", boardId)
    .eq("user_id", userId);

  if (error) {
    return json(res, 500, { error: "Failed to leave board" });
  }

  return json(res, 200, { ok: true });
}

async function handleBoardJoinLookup(req, res, token) {
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  const userId = getSessionUserId(req);
  if (!userId) {
    return json(res, 401, { error: "Not signed in" });
  }

  const client = getSupabaseClient();

  // Find board by share token
  const { data: board, error } = await client
    .from("boards")
    .select("id, owner_id, visibility, title")
    .eq("share_token", token)
    .maybeSingle();

  if (error || !board || board.visibility !== "shared") {
    return json(res, 404, { error: "Invalid or expired share link" });
  }

  // Add to board_members if not already owner
  if (board.owner_id !== userId) {
    // Check current member count (max 5 collaborators including owner)
    const { count } = await client
      .from("board_members")
      .select("user_id", { count: "exact", head: true })
      .eq("board_id", board.id);

    if ((count ?? 0) >= 4) {
      return json(res, 409, { error: "This board has reached the maximum of 5 collaborators" });
    }

    // Upsert — if already member, this is a no-op
    await client
      .from("board_members")
      .upsert(
        {
          board_id: board.id,
          user_id: userId,
          role: "editor",
          is_shared_with_me: true,
        },
        { onConflict: "board_id,user_id", ignoreDuplicates: true },
      );
  }

  return json(res, 200, { boardId: board.id, boardTitle: board.title });
}

function getSupabaseClient() {
  if (!supabase) {
    throw new HttpError(503, "Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.");
  }

  return supabase;
}

function userFacingDatabaseError(message) {
  if (/relation .* does not exist/i.test(message)) {
    return "Database tables are missing. Run the Supabase migration first.";
  }

  return message || "Database request failed";
}

function getSessionUserId(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  const token = cookies[SESSION_COOKIE_NAME];
  if (!token) {
    return null;
  }

  return verifySessionToken(token);
}

function signSessionToken(userId) {
  if (!process.env.AUTH_SECRET) {
    throw new HttpError(503, "AUTH_SECRET is required for session cookies");
  }

  const payload = {
    uid: userId,
    exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", process.env.AUTH_SECRET).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
}

function verifySessionToken(token) {
  if (!process.env.AUTH_SECRET) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const expected = createHmac("sha256", process.env.AUTH_SECRET).update(encodedPayload).digest();
  const received = Buffer.from(signature, "base64url");
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return null;
  }

  const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  if (typeof payload?.uid !== "string" || typeof payload?.exp !== "number" || payload.exp < Date.now()) {
    return null;
  }

  return payload.uid;
}

function buildSessionCookie(token) {
  const parts = [
    `${SESSION_COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
  ];

  if (isProd) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

function buildClearedSessionCookie() {
  const parts = [`${SESSION_COOKIE_NAME}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (isProd) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

function appendSetCookie(res, value) {
  const existing = res.getHeader("Set-Cookie");
  if (!existing) {
    res.setHeader("Set-Cookie", value);
    return;
  }

  if (Array.isArray(existing)) {
    res.setHeader("Set-Cookie", [...existing, value]);
    return;
  }

  res.setHeader("Set-Cookie", [existing, value]);
}

function parseCookies(rawCookie) {
  const result = {};
  for (const part of rawCookie.split(";")) {
    const segment = part.trim();
    if (!segment) continue;

    const separatorIndex = segment.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = segment.slice(0, separatorIndex).trim();
    const value = segment.slice(separatorIndex + 1).trim();
    result[key] = value;
  }

  return result;
}

async function serveStatic(pathname, res) {
  const normalizedPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.join(
    normalizedPath.startsWith("/assets/")
      ? distDir
      : normalizedPath.startsWith("/favicon") || normalizedPath.startsWith("/og-image")
        ? publicDir
        : distDir,
    normalizedPath.replace(/^\/+/, ""),
  );

  try {
    const file = await fs.readFile(filePath);
    res.writeHead(200, { "Content-Type": contentType(filePath) });
    res.end(file);
  } catch {
    const indexHtml = await fs.readFile(path.join(distDir, "index.html"));
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(indexHtml);
  }
}

function loadEnvFile(filePath) {
  try {
    const raw = fsSync.readFileSync(filePath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^(?!#)\s*([^=]+)=["']?(.*?)["']?\s*$/);
      if (!match) continue;
      const [, key, value] = match;
      if (!(key in process.env)) {
        process.env[key.trim()] = value;
      }
    }
  } catch {
  }
}

async function readFormData(req) {
	const host = req.headers.host || `localhost:${port}`;
	const url = new URL(req.url || "/", `http://${host}`);
	const headers = new Headers();

	for (const [key, value] of Object.entries(req.headers)) {
		if (Array.isArray(value)) {
			for (const entry of value) {
				headers.append(key, entry);
			}
			continue;
		}

		if (typeof value === "string") {
			headers.set(key, value);
		}
	}

	const request = new Request(url, {
		method: req.method,
		headers,
		body: req,
		duplex: "half",
	});

	return await request.formData();
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function safeFileExtension(file) {
	const fromName = typeof file.name === "string" && file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() : "";

	if (fromName && /^[a-z0-9]+$/i.test(fromName)) {
		return fromName;
	}

	switch (file.type) {
		case "image/jpeg":
			return "jpg";
		case "image/png":
			return "png";
		case "image/gif":
			return "gif";
		case "image/webp":
			return "webp";
		case "image/svg+xml":
			return "svg";
		default:
			return "bin";
	}
}

function normalizeEmail(value) {
  if (typeof value !== "string") return "";
  const email = value.trim().toLowerCase();
  return /^\S+@\S+\.\S+$/.test(email) ? email : "";
}

function signMagicToken(email) {
  const payload = {
    email,
    exp: Date.now() + 1000 * 60 * 15,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", process.env.AUTH_SECRET).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
}

function verifyMagicToken(token) {
  if (!process.env.AUTH_SECRET) return null;

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const expected = createHmac("sha256", process.env.AUTH_SECRET).update(encodedPayload).digest();
  const received = Buffer.from(signature, "base64url");
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return null;
  }

  const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  if (typeof payload?.email !== "string" || typeof payload?.exp !== "number" || payload.exp < Date.now()) {
    return null;
  }

  return normalizeEmail(payload.email);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildMagicLinkEmail({ url, host, email }) {
  const safeUrl = escapeHtml(url);
  const safeHost = escapeHtml(host);
  const safeEmail = escapeHtml(email);
  const year = new Date().getFullYear();

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Sign in to Sketchmind</title>
  </head>
  <body style="margin: 0; background-color: #0a1018; background-image: radial-gradient(ellipse 80% 52% at 14% 18%, rgba(102, 223, 255, 0.14) 0%, transparent 70%), radial-gradient(ellipse 70% 50% at 86% 84%, rgba(122, 162, 255, 0.14) 0%, transparent 65%); padding: 40px 16px; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;">
    <div style="display: none; max-height: 0; overflow: hidden; opacity: 0; color: transparent;">
      Sign in to Sketchmind on ${safeHost}. No password needed.
    </div>
    <div style="margin: 0 auto; max-width: 560px;">
      <div style="margin-bottom: 24px; text-align: center;">
        <a href="https://${safeHost}" target="_blank" style="text-decoration: none; display: inline-block;">
          <div style="margin: 0 auto 12px; width: 52px; height: 52px; border-radius: 14px; background: linear-gradient(135deg, #66dfff, #7aa2ff); box-shadow: 0 0 0 1px rgba(102, 223, 255, 0.3), 0 8px 26px rgba(102, 223, 255, 0.35); color: #0a1c2a; font-size: 24px; line-height: 52px; font-weight: 700;">S</div>
        </a>
        <div style="margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.01em; color: #ecf3fb;">Sketchmind</div>
      </div>

      <div style="background: linear-gradient(160deg, #111a23, #0d161f); border: 1px solid #263342; border-radius: 16px; padding: 36px 32px; box-shadow: 0 0 0 1px rgba(102, 223, 255, 0.12), 0 18px 42px -24px rgba(0, 0, 0, 0.9);">
        <h1 style="margin: 0 0 8px; font-size: 20px; font-weight: 600; color: #ecf3fb;">Sign in to your account</h1>
        <p style="margin: 0 0 28px; font-size: 14px; line-height: 1.6; color: #95a7bb;">Click the button below to continue to Sketchmind. No password needed.</p>

        <a href="${safeUrl}" style="display: block; margin-bottom: 28px; border-radius: 10px; background: linear-gradient(135deg, #66dfff, #7aa2ff); padding: 14px 24px; text-align: center; text-decoration: none; letter-spacing: 0.01em; font-size: 15px; font-weight: 700; color: #0a1a2a;">Open Sketchmind</a>

        <hr style="margin: 0 0 24px; border: none; border-top: 1px solid #263342;" />

        <div style="margin-bottom: 8px; font-size: 12px; color: #7f94a9;">Or copy and paste this link into your browser:</div>
        <div style="border: 1px solid #2c3a4a; border-radius: 8px; background-color: #0c141d; padding: 10px 12px;">
          <div style="word-break: break-all; font-family: 'Courier New', monospace; font-size: 11px; color: #b2c1d2;">${safeUrl}</div>
        </div>

        <p style="margin: 20px 0 0; font-size: 12px; color: #e36a6a;">This sign-in link expires in 15 minutes and can only be used once.</p>
      </div>

      <div style="margin-top: 24px; text-align: center;">
        <div style="font-size: 12px; color: #71869c;">If you did not request this email, you can safely ignore it.</div>
        <div style="margin-top: 8px; font-size: 11px; color: #5e7185;">&copy; ${year} Sketchmind &middot; Sent to ${safeEmail}</div>
      </div>
    </div>
  </body>
</html>`;

  const text = `Sign in to Sketchmind
--------------------

Click the link below to sign in. No password needed.

${url}

This link expires in 15 minutes and can only be used once.

If you did not request this, ignore this email.`;

  return { html, text };
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function contentType(filePath) {
  if (filePath.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".ico")) return "image/x-icon";
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  return "application/octet-stream";
}

function json(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}
