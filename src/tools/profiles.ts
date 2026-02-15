import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { okResult, toErrorResult } from "../errors.js";
import { getTrackedTab, incrementToolCall } from "../state.js";
import { deleteProfile, listProfiles, loadProfile, saveProfile } from "../profiles.js";
import type { ToolDeps } from "../server.js";

export function registerProfileTools(server: McpServer, deps: ToolDeps): void {
  server.tool(
    "save_profile",
    "Save browser cookies from an active tab to a named profile on disk. Enables session persistence across restarts. Use after login to save authenticated state.",
    {
      tabId: z.string().min(1).describe("Tab ID to export cookies from"),
      profileId: z.string().min(1).describe("Profile name (alphanumeric, hyphens, underscores, dots, 1-64 chars)"),
      description: z.string().optional().describe("Optional description for this profile")
    },
    async (input: unknown) => {
      try {
        const parsed = z
          .object({
            tabId: z.string().min(1),
            profileId: z.string().min(1),
            description: z.string().optional()
          })
          .parse(input);

        const tracked = getTrackedTab(parsed.tabId);
        incrementToolCall(parsed.tabId);

        // Export cookies from the active tab
        const cookies = await deps.client.exportCookies(parsed.tabId, tracked.userId);

        // Save to disk
        const profile = await saveProfile(deps.config.profilesDir, parsed.profileId, tracked.userId, cookies, {
          description: parsed.description,
          lastUrl: tracked.url
        });

        return okResult({
          profileId: profile.profileId,
          cookieCount: profile.metadata.cookieCount,
          savedAt: profile.metadata.updatedAt,
          path: deps.config.profilesDir
        });
      } catch (error) {
        return toErrorResult(error);
      }
    }
  );

  server.tool(
    "load_profile",
    "Load a saved profile's cookies into an active browser tab. Restores login sessions without re-authentication. Use after create_tab to restore saved state.",
    {
      profileId: z.string().min(1).describe("Profile name to load"),
      tabId: z.string().min(1).describe("Tab ID to load cookies into")
    },
    async (input: unknown) => {
      try {
        const parsed = z
          .object({
            profileId: z.string().min(1),
            tabId: z.string().min(1)
          })
          .parse(input);

        const tracked = getTrackedTab(parsed.tabId);
        incrementToolCall(parsed.tabId);

        // Read profile from disk
        const profile = await loadProfile(deps.config.profilesDir, parsed.profileId);

        const userMismatch = profile.userId !== tracked.userId;

        // Import cookies into the session
        await deps.client.importCookies(tracked.userId, profile.cookies);

        return okResult({
          profileId: profile.profileId,
          cookieCount: profile.metadata.cookieCount,
          lastSaved: profile.metadata.updatedAt,
          description: profile.metadata.description,
          ...(userMismatch
            ? {
                warning: `Profile was saved for userId "${profile.userId}" but loaded into "${tracked.userId}"`
              }
            : {})
        });
      } catch (error) {
        return toErrorResult(error);
      }
    }
  );

  server.tool(
    "list_profiles",
    "List all saved browser profiles with metadata. Shows profile names, cookie counts, save dates, and descriptions.",
    {},
    async () => {
      try {
        const profiles = await listProfiles(deps.config.profilesDir);
        return okResult({
          profilesDir: deps.config.profilesDir,
          count: profiles.length,
          profiles
        });
      } catch (error) {
        return toErrorResult(error);
      }
    }
  );

  server.tool(
    "delete_profile",
    "Delete a saved browser profile from disk. Removes the profile's cookie data permanently.",
    {
      profileId: z.string().min(1).describe("Profile name to delete")
    },
    async (input: unknown) => {
      try {
        const parsed = z
          .object({
            profileId: z.string().min(1)
          })
          .parse(input);

        await deleteProfile(deps.config.profilesDir, parsed.profileId);
        return okResult({ deleted: parsed.profileId });
      } catch (error) {
        return toErrorResult(error);
      }
    }
  );
}
