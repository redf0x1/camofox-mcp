import { chmod, mkdir, readdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import type { Profile, ProfileCookie, ProfileMetadata } from "./types.js";
import { AppError } from "./errors.js";

const PROFILE_ID_REGEX = /^[a-zA-Z0-9_][a-zA-Z0-9._-]{0,63}$/;

export type AutoResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: "timeout" }
  | { ok: false; reason: "error"; error: unknown };

export async function withAutoTimeout<T>(promise: Promise<T>, ms: number): Promise<AutoResult<T>> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    const timeoutResult = new Promise<AutoResult<T>>((resolve) => {
      timeoutId = setTimeout(() => resolve({ ok: false, reason: "timeout" }), ms);
    });

    const settledPromise = Promise.resolve(promise)
      .then((value) => ({ ok: true as const, value }))
      .catch((error: unknown) => ({ ok: false as const, reason: "error" as const, error }));

    return await Promise.race([settledPromise, timeoutResult]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

class Mutex {
  private locked = false;

  private readonly waiters: Array<() => void> = [];

  async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (!this.locked) {
      this.locked = true;
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.waiters.push(resolve);
    });
  }

  private release(): void {
    const next = this.waiters.shift();
    if (next) {
      next();
      return;
    }

    this.locked = false;
  }
}

const saveProfileMutexByPath = new Map<string, Mutex>();

function getSaveProfileMutex(filePath: string): Mutex {
  const existing = saveProfileMutexByPath.get(filePath);
  if (existing) return existing;
  const created = new Mutex();
  saveProfileMutexByPath.set(filePath, created);
  return created;
}

const ProfileCookieSchema = z
  .object({
    name: z.string(),
    value: z.string(),
    domain: z.string(),
    path: z.string(),
    expires: z.number().optional(),
    httpOnly: z.boolean().optional(),
    secure: z.boolean().optional(),
    sameSite: z.string().optional()
  })
  .passthrough();

const ProfileMetadataSchema = z.object({
  createdAt: z.string(),
  updatedAt: z.string(),
  lastUrl: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  cookieCount: z.number()
});

const ProfileSchema = z.object({
  version: z.literal(1),
  profileId: z.string(),
  userId: z.string(),
  cookies: z.array(ProfileCookieSchema),
  metadata: ProfileMetadataSchema
});

const ErrnoErrorSchema = z
  .object({
    code: z.string().optional()
  })
  .passthrough();

export function validateProfileId(profileId: string): void {
  if (!PROFILE_ID_REGEX.test(profileId)) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Invalid profile ID "${profileId}". Use 1-64 chars: letters, numbers, dots, hyphens, underscores. Must start with alphanumeric or underscore.`
    );
  }
}

export async function ensureProfilesDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await chmod(dir, 0o700);
}

function profilePath(dir: string, profileId: string): string {
  return join(dir, `${profileId}.json`);
}

export async function saveProfile(
  dir: string,
  profileId: string,
  userId: string,
  cookies: unknown[],
  options?: { description?: string; lastUrl?: string }
): Promise<Profile> {
  validateProfileId(profileId);
  await ensureProfilesDir(dir);

  const cookiesParsed = z.array(ProfileCookieSchema).safeParse(cookies);
  if (!cookiesParsed.success) {
    throw new AppError(
      "PROFILE_ERROR",
      `Failed to save profile "${profileId}": invalid cookies format: ${cookiesParsed.error.issues
        .map((issue) => issue.message)
        .join(", ")}`
    );
  }

  const now = new Date().toISOString();
  const filePath = profilePath(dir, profileId);

  return await getSaveProfileMutex(filePath).runExclusive(async () => {
    const tmpPath = `${filePath}.tmp`;

    // Try to load existing profile for createdAt
    let createdAt = now;
    try {
      const existing = await loadProfile(dir, profileId);
      createdAt = existing.metadata.createdAt;
    } catch {
      // New profile or corrupt existing — use current time
    }

    const profile: Profile = {
      version: 1,
      profileId,
      userId,
      cookies: cookiesParsed.data,
      metadata: {
        createdAt,
        updatedAt: now,
        lastUrl: options?.lastUrl,
        description: options?.description,
        cookieCount: cookiesParsed.data.length
      }
    };

    // Atomic write: tmp → rename
    const data = JSON.stringify(profile, null, 2);
    await writeFile(tmpPath, data, { encoding: "utf-8", mode: 0o600 });
    await rename(tmpPath, filePath);

    return profile;
  });
}

export async function loadProfile(dir: string, profileId: string): Promise<Profile> {
  validateProfileId(profileId);
  const filePath = profilePath(dir, profileId);

  let raw: string;
  try {
    raw = await readFile(filePath, "utf-8");
  } catch (error) {
    const parsedError = ErrnoErrorSchema.safeParse(error);
    if (parsedError.success && parsedError.data.code === "ENOENT") {
      throw new AppError("PROFILE_NOT_FOUND", `Profile "${profileId}" not found`);
    }
    throw new AppError(
      "PROFILE_ERROR",
      `Failed to read profile "${profileId}": ${error instanceof Error ? error.message : String(error)}`
    );
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new AppError("PROFILE_ERROR", `Profile "${profileId}" contains invalid JSON`);
  }

  const parsed = ProfileSchema.safeParse(json);
  if (!parsed.success) {
    throw new AppError(
      "PROFILE_ERROR",
      `Profile "${profileId}" has invalid format: ${parsed.error.issues.map((i) => i.message).join(", ")}`
    );
  }

  if (parsed.data.profileId !== profileId) {
    throw new AppError(
      "PROFILE_ERROR",
      `Profile file mismatch: expected "${profileId}" but file contains "${parsed.data.profileId}"`
    );
  }

  return parsed.data;
}

export async function listProfiles(dir: string): Promise<Array<{ profileId: string } & ProfileMetadata>> {
  await ensureProfilesDir(dir);

  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return [];
  }

  const profiles: Array<{ profileId: string } & ProfileMetadata> = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const profileId = file.replace(/\.json$/, "");
    try {
      const profile = await loadProfile(dir, profileId);
      profiles.push({ profileId, ...profile.metadata });
    } catch {
      /* skip corrupt files */
    }
  }

  return profiles;
}

export async function deleteProfile(dir: string, profileId: string): Promise<void> {
  validateProfileId(profileId);
  const filePath = profilePath(dir, profileId);

  try {
    await unlink(filePath);
  } catch (error) {
    const parsedError = ErrnoErrorSchema.safeParse(error);
    if (parsedError.success && parsedError.data.code === "ENOENT") {
      throw new AppError("PROFILE_NOT_FOUND", `Profile "${profileId}" not found`);
    }
    throw new AppError(
      "PROFILE_ERROR",
      `Failed to delete profile "${profileId}": ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
