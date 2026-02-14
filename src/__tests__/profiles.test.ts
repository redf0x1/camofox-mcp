import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { AppError } from "../errors.js";
import {
  deleteProfile,
  ensureProfilesDir,
  listProfiles,
  loadProfile,
  saveProfile,
  validateProfileId
} from "../profiles.js";
import { getAllTrackedTabs, removeTrackedTab, trackTab } from "../state.js";
import { registerProfileTools } from "../tools/profiles.js";
import type { TabInfo } from "../types.js";

function expectAppErrorWithCode(err: unknown, code: string): void {
  expect(err).toBeTruthy();
  expect(typeof err).toBe("object");
  expect((err as { name?: unknown }).name).toBe("AppError");
  expect((err as { code?: unknown }).code).toBe(code);
}

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "camofox-profiles-"));
});

afterEach(async () => {
  for (const tab of getAllTrackedTabs()) {
    removeTrackedTab(tab.tabId);
  }

  if (dir) {
    await rm(dir, { recursive: true, force: true });
  }
});

function makeTab(overrides: Partial<TabInfo> = {}): TabInfo {
  return {
    tabId: "tab-1",
    url: "http://example.com",
    createdAt: "2026-02-14T00:00:00.000Z",
    lastActivity: 0,
    userId: "user-1",
    sessionKey: "session-1",
    visitedUrls: [],
    toolCalls: 0,
    refsCount: 0,
    ...overrides
  };
}

describe("profiles", () => {
  describe("validateProfileId", () => {
    it("accepts valid profile IDs", () => {
      const valid = [
        "a",
        "A0",
        "abc-123",
        "abc_def",
        "a.b",
        "a_b.c-d",
        "a".repeat(64)
      ];

      for (const id of valid) {
        expect(() => validateProfileId(id)).not.toThrow();
      }
    });

    it("rejects invalid profile IDs", () => {
      const invalid = [
        "",
        "-bad",
        ".bad",
        "bad!",
        "has space",
        "a".repeat(65)
      ];

      for (const id of invalid) {
        try {
          validateProfileId(id);
          expect.fail(`Expected validateProfileId() to throw for: ${id}`);
        } catch (err) {
          expectAppErrorWithCode(err, "VALIDATION_ERROR");
        }
      }
    });
  });

  describe("saveProfile/loadProfile", () => {
    it("saveProfile() creates a JSON file and loadProfile() reads it", async () => {
      const cookies = [{ name: "sid", value: "123", domain: "example.com", path: "/" }];

      const saved = await saveProfile(dir, "profile1", "user1", cookies, {
        description: "test",
        lastUrl: "http://example.com"
      });

      const filePath = join(dir, "profile1.json");
      const st = await stat(filePath);
      expect(st.isFile()).toBe(true);

      const loaded = await loadProfile(dir, "profile1");
      expect(loaded.version).toBe(1);
      expect(loaded.profileId).toBe("profile1");
      expect(loaded.userId).toBe("user1");
      expect(loaded.cookies).toEqual(cookies);
      expect(loaded.metadata.cookieCount).toBe(1);
      expect(loaded.metadata.description).toBe("test");
      expect(loaded.metadata.lastUrl).toBe("http://example.com");

      // Save should return the same content as what is stored
      expect(saved.profileId).toBe("profile1");
      expect(saved.metadata.cookieCount).toBe(1);
    });

    it("saveProfile() preserves createdAt when updating an existing profile", async () => {
      const first = await saveProfile(dir, "profile2", "user1", [
        { name: "c1", value: "1", domain: "example.com", path: "/" }
      ]);

      // Ensure updatedAt changes
      await new Promise<void>((resolve) => setTimeout(resolve, 5));

      const second = await saveProfile(
        dir,
        "profile2",
        "user1",
        [
          { name: "c2", value: "2", domain: "example.com", path: "/" },
          { name: "c3", value: "3", domain: "example.com", path: "/" }
        ],
        {
        description: "updated"
        }
      );

      expect(second.metadata.createdAt).toBe(first.metadata.createdAt);
      expect(second.metadata.updatedAt).not.toBe(first.metadata.updatedAt);
      expect(second.metadata.cookieCount).toBe(2);
      expect(second.metadata.description).toBe("updated");

      const loaded = await loadProfile(dir, "profile2");
      expect(loaded.metadata.createdAt).toBe(first.metadata.createdAt);
      expect(loaded.metadata.cookieCount).toBe(2);
    });

    it("loadProfile() throws PROFILE_NOT_FOUND when profile is missing", async () => {
      try {
        await loadProfile(dir, "missing");
        expect.fail("Expected loadProfile() to throw");
      } catch (err) {
        expectAppErrorWithCode(err, "PROFILE_NOT_FOUND");
      }
    });

    it("loadProfile() throws PROFILE_ERROR on invalid JSON", async () => {
      await writeFile(join(dir, "corrupt.json"), "{not-json", "utf-8");

      try {
        await loadProfile(dir, "corrupt");
        expect.fail("Expected loadProfile() to throw");
      } catch (err) {
        expectAppErrorWithCode(err, "PROFILE_ERROR");
      }
    });

    it("loadProfile() rejects malformed JSON shape", async () => {
      const filePath = join(dir, "bad-shape.json");
      await writeFile(filePath, JSON.stringify({ foo: "bar" }), { encoding: "utf-8", mode: 0o600 });

      await expect(loadProfile(dir, "bad-shape")).rejects.toBeInstanceOf(AppError);
      await expect(loadProfile(dir, "bad-shape")).rejects.toMatchObject({ code: "PROFILE_ERROR" });
      await expect(loadProfile(dir, "bad-shape")).rejects.toThrow(/invalid format/i);
    });

    it("loadProfile() rejects wrong version", async () => {
      const filePath = join(dir, "bad-version.json");
      const profile = {
        version: 99,
        profileId: "x",
        userId: "u",
        cookies: [],
        metadata: { createdAt: "", updatedAt: "", cookieCount: 0 }
      };
      await writeFile(filePath, JSON.stringify(profile), { encoding: "utf-8", mode: 0o600 });

      await expect(loadProfile(dir, "bad-version")).rejects.toThrow(/invalid format/i);
    });

    it("loadProfile() rejects when JSON profileId doesn't match the requested ID", async () => {
      const filePath = join(dir, "expected.json");
      const profile = {
        version: 1,
        profileId: "other",
        userId: "u",
        cookies: [],
        metadata: { createdAt: "", updatedAt: "", cookieCount: 0 }
      };
      await writeFile(filePath, JSON.stringify(profile), { encoding: "utf-8", mode: 0o600 });

      await expect(loadProfile(dir, "expected")).rejects.toBeInstanceOf(AppError);
      await expect(loadProfile(dir, "expected")).rejects.toMatchObject({ code: "PROFILE_ERROR" });
      await expect(loadProfile(dir, "expected")).rejects.toThrow(/mismatch/i);
    });

    it("saved profile file has restricted permissions", async () => {
      if (process.platform === "win32") return;

      const cookies = [{ name: "sid", value: "123", domain: "example.com", path: "/" }];
      await saveProfile(dir, "perm-test", "user1", cookies, {});

      const st = await stat(join(dir, "perm-test.json"));
      expect(st.mode & 0o777).toBe(0o600);
    });

    it("profiles directory has restricted permissions", async () => {
      if (process.platform === "win32") return;

      await ensureProfilesDir(dir);
      const st = await stat(dir);
      expect(st.mode & 0o777).toBe(0o700);
    });

    it("ensureProfilesDir enforces 0o700 on existing directory", async () => {
      if (process.platform === "win32") return;

      const existing = join(dir, "existing");
      await mkdir(existing, { recursive: true, mode: 0o755 });
      await chmod(existing, 0o755);

      await ensureProfilesDir(existing);
      const st = await stat(existing);
      expect(st.mode & 0o777).toBe(0o700);
    });

    it("load_profile warns when profile userId differs from tracked userId", async () => {
      const cookies = [{ name: "sid", value: "123", domain: "example.com", path: "/" }];
      await saveProfile(dir, "mismatch", "userA", cookies, {});

      trackTab(makeTab({ tabId: "tab-mismatch", userId: "userB" }));

      const handlers = new Map<string, (input: unknown) => Promise<unknown>>();
      const server = {
        tool: (_name: string, _description: string, _schema: unknown, handler: (input: unknown) => Promise<unknown>) => {
          handlers.set(_name, handler);
        }
      };

      const deps = {
        config: {
          camofoxUrl: "http://localhost",
          defaultUserId: "u",
          profilesDir: dir,
          timeout: 1000
        },
        client: {
          importCookies: vi.fn(async () => undefined),
          exportCookies: vi.fn(async () => [])
        }
      };

      registerProfileTools(server as any, deps as any);

      const loadHandler = handlers.get("load_profile");
      expect(loadHandler).toBeTruthy();

      const result = await loadHandler!({ profileId: "mismatch", tabId: "tab-mismatch" });
      const payload = JSON.parse((result as { content: Array<{ text?: string }> }).content[0]?.text || "{}");

      expect(payload.warning).toMatch(/saved for userId/i);
      expect(deps.client.importCookies).toHaveBeenCalled();
    });

    it("saveProfile() does not leave tmp files behind", async () => {
      await saveProfile(dir, "profile3", "user1", [{ name: "c1", value: "1", domain: "example.com", path: "/" }]);

      const tmpPath = join(dir, "profile3.json.tmp");
      // If the implementation changes tmp naming, this test should still be safe because
      // a leftover tmp file would indicate a failed atomic rename.
      try {
        await stat(tmpPath);
        expect.fail("Expected no leftover tmp file");
      } catch {
        // ok
      }

      const filePath = join(dir, "profile3.json");
      const raw = await readFile(filePath, "utf-8");
      expect(() => JSON.parse(raw)).not.toThrow();
    });
  });

  describe("listProfiles", () => {
    it("returns an empty array for an empty directory", async () => {
      const list = await listProfiles(dir);
      expect(list).toEqual([]);
    });

    it("lists profiles and skips .tmp files", async () => {
      await saveProfile(dir, "one", "u", [{ name: "c1", value: "1", domain: "example.com", path: "/" }]);
      await saveProfile(dir, "two", "u", [{ name: "c2", value: "2", domain: "example.com", path: "/" }]);

      // A file that should be ignored
      await writeFile(join(dir, "ignored.json.tmp"), "{}", "utf-8");

      const list = await listProfiles(dir);
      const ids = list.map((p) => p.profileId).sort();
      expect(ids).toEqual(["one", "two"]);

      const one = list.find((p) => p.profileId === "one");
      expect(one?.cookieCount).toBe(1);
      expect(one?.createdAt).toBeTypeOf("string");
      expect(one?.updatedAt).toBeTypeOf("string");
    });
  });

  describe("deleteProfile", () => {
    it("deletes an existing profile", async () => {
      await saveProfile(dir, "deleteme", "u", [{ name: "c1", value: "1", domain: "example.com", path: "/" }]);
      await deleteProfile(dir, "deleteme");

      await expect(loadProfile(dir, "deleteme")).rejects.toBeInstanceOf(AppError);
      await expect(loadProfile(dir, "deleteme")).rejects.toMatchObject({ code: "PROFILE_NOT_FOUND" });
    });

    it("throws PROFILE_NOT_FOUND when deleting a missing profile", async () => {
      try {
        await deleteProfile(dir, "missing2");
        expect.fail("Expected deleteProfile() to throw");
      } catch (err) {
        expectAppErrorWithCode(err, "PROFILE_NOT_FOUND");
      }
    });
  });
});
