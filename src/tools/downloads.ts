import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { binaryResult, okResult, toErrorResult } from "../errors.js";
import { getTrackedTab, incrementToolCall } from "../state.js";
import type { ToolDeps } from "../server.js";

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

const MAX_INLINE_NON_IMAGE_BYTES = 256 * 1024;
const MAX_INLINE_IMAGE_BYTES = 10 * 1024 * 1024;

export function registerDownloadTools(server: McpServer, deps: ToolDeps): void {
  server.tool(
    "list_downloads",
    "List downloaded files with optional filtering by tab, status, extension, MIME type, and size range",
    {
      tabId: z.string().min(1).optional().describe("Filter by specific tab. If omitted, lists all user downloads."),
      userId: z.string().min(1).optional().describe("User ID (default: CAMOFOX_DEFAULT_USER_ID or tracked tab userId)"),
      status: z.string().min(1).optional().describe("Filter by status: pending, completed, failed, canceled"),
      extension: z.string().min(1).optional().describe("Filter by file extension, comma-separated: 'pdf,zip,jpg'"),
      mimeType: z.string().min(1).optional().describe("Filter by MIME type prefix: 'image/', 'application/pdf'"),
      minSize: z.number().int().nonnegative().optional().describe("Minimum file size in bytes"),
      maxSize: z.number().int().nonnegative().optional().describe("Maximum file size in bytes"),
      sort: z
        .enum(["createdAt:asc", "createdAt:desc"])
        .optional()
        .describe("Sort order: 'createdAt:asc' or 'createdAt:desc' (default)"),
      limit: z.number().int().positive().optional().default(50).describe("Max results to return"),
      offset: z.number().int().nonnegative().optional().default(0).describe("Result offset")
    },
    async (input: unknown) => {
      try {
        const parsed = z
          .object({
            tabId: z.string().min(1).optional().describe("Filter by specific tab. If omitted, lists all user downloads."),
            userId: z.string().min(1).optional().describe("User ID (default: CAMOFOX_DEFAULT_USER_ID or tracked tab userId)"),
            status: z.string().min(1).optional().describe("Filter by status: pending, completed, failed, canceled"),
            extension: z.string().min(1).optional().describe("Filter by file extension, comma-separated: 'pdf,zip,jpg'"),
            mimeType: z.string().min(1).optional().describe("Filter by MIME type prefix: 'image/', 'application/pdf'"),
            minSize: z.number().int().nonnegative().optional().describe("Minimum file size in bytes"),
            maxSize: z.number().int().nonnegative().optional().describe("Maximum file size in bytes"),
            sort: z
              .enum(["createdAt:asc", "createdAt:desc"])
              .optional()
              .describe("Sort order: 'createdAt:asc' or 'createdAt:desc' (default)"),
            limit: z.number().int().positive().optional().default(50).describe("Max results to return"),
            offset: z.number().int().nonnegative().optional().default(0).describe("Result offset")
          })
          .refine(
            (data) => {
              if (data.minSize !== undefined && data.maxSize !== undefined) {
                return data.minSize <= data.maxSize;
              }
              return true;
            },
            { message: "minSize must be <= maxSize" }
          )
          .parse(input);

        if (parsed.tabId) {
          const tracked = getTrackedTab(parsed.tabId);
          const userId = parsed.userId ?? tracked.userId;
          const response = await deps.client.listTabDownloads(parsed.tabId, userId, {
            status: parsed.status,
            extension: parsed.extension,
            mimeType: parsed.mimeType,
            minSize: parsed.minSize,
            maxSize: parsed.maxSize,
            sort: parsed.sort,
            limit: parsed.limit,
            offset: parsed.offset
          });
          incrementToolCall(parsed.tabId);
          return okResult(response);
        }

        const userId = parsed.userId ?? deps.config.defaultUserId;
        const response = await deps.client.listUserDownloads(userId, {
          status: parsed.status,
          extension: parsed.extension,
          mimeType: parsed.mimeType,
          minSize: parsed.minSize,
          maxSize: parsed.maxSize,
          sort: parsed.sort,
          limit: parsed.limit,
          offset: parsed.offset
        });
        return okResult(response);
      } catch (error) {
        return toErrorResult(error);
      }
    }
  );

  server.tool(
    "get_download",
    "Get a downloaded file. Images are always returned as viewable images. Set includeContent=true to get non-image file content as base64 (max 256KB). Otherwise returns metadata only.",
    {
      downloadId: z.string().min(1).describe("ID of the download"),
      includeContent: z.boolean().optional().default(false).describe("Whether to include file content for non-image files"),
      userId: z.string().min(1).optional().describe("User ID (default: CAMOFOX_DEFAULT_USER_ID)")
    },
    async (input: unknown) => {
      try {
        const parsed = z
          .object({
            downloadId: z.string().min(1).describe("ID of the download"),
            includeContent: z.boolean().optional().default(false).describe("Whether to include file content for non-image files"),
            userId: z.string().min(1).optional().describe("User ID (default: CAMOFOX_DEFAULT_USER_ID)")
          })
          .parse(input);

        const userId = parsed.userId ?? deps.config.defaultUserId;
        const payload = await deps.client.getDownload(parsed.downloadId, userId);
        const download = (payload && typeof payload === "object" && "download" in payload)
          ? (payload as { download?: unknown }).download
          : payload;

        const downloadMeta = download && typeof download === "object" ? (download as any) : { download };

        const mimeType = typeof (download as any)?.mimeType === "string" ? String((download as any).mimeType) : "";
        const size = toNumber((download as any)?.size);

        if (mimeType.startsWith("image/")) {
          const status = typeof (download as any)?.status === "string" ? (download as any).status : "";
          if (status !== "completed") {
            return okResult({
              ...downloadMeta,
              note: `Cannot render image: download status is '${status}'`
            });
          }

          if (size === undefined || size === null || size === 0 || Number.isNaN(size) || size > MAX_INLINE_IMAGE_BYTES) {
            return okResult({
              ...downloadMeta,
              note:
                !size || Number.isNaN(size)
                  ? "Image content omitted: file size unknown. Use the download URL or re-check later."
                  : `Image content omitted: file exceeds 10MB (${size} bytes).`
            });
          }

          const buffer = await deps.client.getDownloadContent(parsed.downloadId, userId);
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  downloadId: parsed.downloadId,
                  ...downloadMeta,
                  note: "Image rendered below"
                })
              },
              { type: "image" as const, data: buffer.toString("base64"), mimeType }
            ]
          };
        }

        if (parsed.includeContent && typeof size === "number" && size > 0 && size <= MAX_INLINE_NON_IMAGE_BYTES) {
          const buffer = await deps.client.getDownloadContent(parsed.downloadId, userId);
          return okResult({ ...downloadMeta, content: buffer.toString("base64") });
        }

        return okResult(downloadMeta);
      } catch (error) {
        return toErrorResult(error);
      }
    }
  );

  server.tool(
    "delete_download",
    "Delete a downloaded file from disk and registry",
    {
      downloadId: z.string().min(1).describe("ID of the download to delete"),
      userId: z.string().min(1).optional().describe("User ID (default: CAMOFOX_DEFAULT_USER_ID)")
    },
    async (input: unknown) => {
      try {
        const parsed = z
          .object({
            downloadId: z.string().min(1).describe("ID of the download to delete"),
            userId: z.string().min(1).optional().describe("User ID (default: CAMOFOX_DEFAULT_USER_ID)")
          })
          .parse(input);

        const userId = parsed.userId ?? deps.config.defaultUserId;
        const result = await deps.client.deleteDownload(parsed.downloadId, userId);
        return okResult(result);
      } catch (error) {
        return toErrorResult(error);
      }
    }
  );
}
