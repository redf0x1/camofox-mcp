import { z } from "zod";

import { AppError } from "./errors.js";
import type {
  ClickParams,
  ClickResponse,
  Config,
  CreateTabParams,
  HealthResponse,
  LinkResponse,
  NavigationActionResponse,
  NavigateResponse,
  PresetsResponse,
  SnapshotResponse,
  StatsResponse,
  TabResponse
  ,
  YouTubeTranscriptResponse
} from "./types.js";

interface ApiErrorPayload {
  error?: string;
  message?: string;
}

const ApiErrorPayloadSchema = z
  .object({
    error: z.string().optional(),
    message: z.string().optional()
  })
  .passthrough();

const HealthResponseSchema = z
  .object({
    ok: z.boolean(),
    running: z.boolean().optional(),
    browserConnected: z.boolean(),
    version: z.string().optional(),
    consecutiveFailures: z.number().optional(),
    activeOps: z.number().optional()
  })
  .passthrough();

const PresetInfoSchema = z
  .object({
    locale: z.string(),
    timezoneId: z.string(),
    geolocation: z
      .object({
        latitude: z.number(),
        longitude: z.number()
      })
      .optional()
  })
  .passthrough();

const PresetsResponseSchema = z
  .object({
    presets: z.record(z.string(), PresetInfoSchema)
  })
  .passthrough();

const CreateTabRawResponseSchema = z
  .object({
    tabId: z.string().optional(),
    id: z.string().optional(),
    tab: z
      .object({
        id: z.string().optional()
      })
      .optional(),
    url: z.string().optional(),
    title: z.string().optional()
  })
  .passthrough();

const NavigateRawResponseSchema = z
  .object({
    url: z.string().optional(),
    title: z.string().optional(),
    refsAvailable: z.boolean().optional()
  })
  .passthrough();

const ClickRawResponseSchema = z
  .object({
    success: z.boolean().optional(),
    navigated: z.boolean().optional(),
    refsAvailable: z.boolean().optional()
  })
  .passthrough();

const SnapshotRawResponseSchema = z
  .object({
    url: z.string().optional(),
    snapshot: z.string().optional(),
    refsCount: z.number().optional(),
    truncated: z.boolean().optional(),
    totalChars: z.number().optional(),
    hasMore: z.boolean().optional(),
    nextOffset: z.number().nullable().optional()
  })
  .passthrough();

const NavigationActionRawResponseSchema = z
  .object({
    url: z.string().optional(),
    title: z.string().optional(),
    refsAvailable: z.boolean().optional()
  })
  .passthrough();

const YouTubeTranscriptResponseSchema = z
  .object({
    status: z.string(),
    transcript: z.string().optional(),
    video_url: z.string().optional(),
    video_id: z.string(),
    video_title: z.string().optional(),
    language: z.string().optional(),
    total_words: z.number().optional(),
    available_languages: z
      .array(
        z
          .object({
            code: z.string(),
            name: z.string(),
            kind: z.string()
          })
          .passthrough()
      )
      .optional(),
    message: z.string().optional(),
    code: z.number().optional()
  })
  .passthrough();

const LinksRawResponseSchema = z
  .object({
    links: z
      .array(
        z
          .object({
            text: z.string().optional(),
            href: z.string().optional()
          })
          .passthrough()
      )
      .optional()
  })
  .passthrough();

const StatsResponseSchema = z
  .object({
    visitedUrls: z.array(z.string()).optional()
  })
  .passthrough();

const WaitForReadyResponseSchema = z.object({
  ready: z.boolean()
});

const ScrollPositionSchema = z
  .object({
    scrollTop: z.number(),
    scrollLeft: z.number(),
    scrollHeight: z.number(),
    clientHeight: z.number(),
    scrollWidth: z.number(),
    clientWidth: z.number()
  })
  .passthrough();

const ScrollElementResponseSchema = z
  .object({
    ok: z.boolean(),
    scrollPosition: ScrollPositionSchema
  })
  .passthrough();

const EvaluateResponseSchema = z
  .object({
    ok: z.boolean(),
    result: z.unknown().optional(),
    resultType: z.string().optional(),
    truncated: z.boolean().optional(),
    error: z.string().optional(),
    errorType: z.string().optional()
  })
  .passthrough();

const CookieExportSchema = z
  .object({
    name: z.string(),
    value: z.string(),
    domain: z.string(),
    path: z.string(),
    expires: z.number().optional(),
    httpOnly: z.boolean().optional(),
    secure: z.boolean().optional(),
    sameSite: z.enum(["Strict", "Lax", "None"]).optional()
  })
  .passthrough();

// Response can be array of cookies or {cookies: [...]}
const CookieExportResponseSchema = z.union([
  z.array(CookieExportSchema),
  z
    .object({
      cookies: z.array(CookieExportSchema)
    })
    .passthrough()
]);

export class CamofoxClient {
  private readonly baseUrl: string;

  private readonly timeout: number;

  private readonly apiKey?: string;

  constructor(config: Config) {
    this.baseUrl = config.camofoxUrl.replace(/\/$/, "");
    this.timeout = config.timeout;
    this.apiKey = config.apiKey;
  }

  async healthCheck(): Promise<HealthResponse> {
    return this.requestJson("/health", { method: "GET" }, HealthResponseSchema);
  }

  async listPresets(): Promise<PresetsResponse> {
    try {
      return await this.requestJson("/presets", { method: "GET" }, PresetsResponseSchema);
    } catch (error) {
      // The CamoFox API currently maps all 404s to TAB_NOT_FOUND. If /presets
      // isn't supported by the camofox-browser server (v2.0.0+), degrade
      // gracefully by returning an empty preset list.
      if (error instanceof AppError && error.code === "TAB_NOT_FOUND" && error.status === 404) {
        return { presets: {} };
      }

      throw error;
    }
  }

  async createTab(params: CreateTabParams): Promise<TabResponse> {
    const response = await this.requestJson("/tabs", {
      method: "POST",
      body: JSON.stringify(params)
    }, CreateTabRawResponseSchema);

    const tabId =
      response.tabId ??
      response.id ??
      response.tab?.id;

    if (!tabId) {
      throw new AppError("INTERNAL_ERROR", "CamoFox did not return a valid tab ID");
    }

    return {
      tabId,
      url: response.url ?? params.url ?? "about:blank",
      title: response.title
    };
  }

  async closeTab(tabId: string, userId: string): Promise<void> {
    await this.requestNoContent(`/tabs/${encodeURIComponent(tabId)}`, {
      method: "DELETE",
      body: JSON.stringify({ userId })
    });
  }

  async navigate(tabId: string, url: string, userId: string): Promise<NavigateResponse> {
    const response = await this.requestJson(`/tabs/${encodeURIComponent(tabId)}/navigate`, {
      method: "POST",
      body: JSON.stringify({ url, userId })
    }, NavigateRawResponseSchema);

    return {
      url: response.url ?? url,
      title: response.title,
      refsAvailable: response.refsAvailable
    };
  }

  async navigateMacro(tabId: string, macro: string, query: string, userId: string): Promise<NavigateResponse> {
    const response = await this.requestJson(`/tabs/${encodeURIComponent(tabId)}/navigate`, {
      method: "POST",
      body: JSON.stringify({ macro, query, userId })
    }, NavigateRawResponseSchema);

    return {
      url: response.url ?? "",
      title: response.title,
      refsAvailable: response.refsAvailable
    };
  }

  async goBack(tabId: string, userId: string): Promise<NavigationActionResponse> {
    const response = await this.requestJson(`/tabs/${encodeURIComponent(tabId)}/back`, {
      method: "POST",
      body: JSON.stringify({ userId })
    }, NavigationActionRawResponseSchema);

    return {
      url: response.url ?? "",
      title: response.title,
      refsAvailable: response.refsAvailable
    };
  }

  async goForward(tabId: string, userId: string): Promise<NavigationActionResponse> {
    const response = await this.requestJson(`/tabs/${encodeURIComponent(tabId)}/forward`, {
      method: "POST",
      body: JSON.stringify({ userId })
    }, NavigationActionRawResponseSchema);

    return {
      url: response.url ?? "",
      title: response.title,
      refsAvailable: response.refsAvailable
    };
  }

  async refresh(tabId: string, userId: string): Promise<NavigationActionResponse> {
    const response = await this.requestJson(`/tabs/${encodeURIComponent(tabId)}/refresh`, {
      method: "POST",
      body: JSON.stringify({ userId })
    }, NavigationActionRawResponseSchema);

    return {
      url: response.url ?? "",
      title: response.title,
      refsAvailable: response.refsAvailable
    };
  }

  async click(tabId: string, params: ClickParams, userId: string): Promise<ClickResponse> {
    const response = await this.requestJson(`/tabs/${encodeURIComponent(tabId)}/click`, {
      method: "POST",
      body: JSON.stringify({ ...params, userId })
    }, ClickRawResponseSchema);

    return {
      success: response.success ?? true,
      navigated: response.navigated ?? false,
      refsAvailable: response.refsAvailable
    };
  }

  async typeText(tabId: string, locator: { ref?: string; selector?: string }, text: string, userId: string): Promise<void> {
    await this.requestNoContent(`/tabs/${encodeURIComponent(tabId)}/type`, {
      method: "POST",
      body: JSON.stringify({ ...locator, text, userId })
    });
  }

  async pressKey(tabId: string, key: string, userId: string): Promise<void> {
    await this.requestNoContent(`/tabs/${encodeURIComponent(tabId)}/press`, {
      method: "POST",
      body: JSON.stringify({ key, userId })
    });
  }

  async scroll(tabId: string, direction: string, amount: number | undefined, userId: string): Promise<void> {
    await this.requestNoContent(`/tabs/${encodeURIComponent(tabId)}/scroll`, {
      method: "POST",
      body: JSON.stringify({ direction, amount, userId })
    });
  }

  async scrollElement(
    tabId: string,
    params: {
      selector?: string;
      ref?: string;
      deltaX?: number;
      deltaY?: number;
      scrollTo?: { top?: number; left?: number };
    },
    userId: string
  ): Promise<{
    ok: boolean;
    scrollPosition: {
      scrollTop: number;
      scrollLeft: number;
      scrollHeight: number;
      clientHeight: number;
      scrollWidth: number;
      clientWidth: number;
    };
  }> {
    const response = await this.requestJson(`/tabs/${encodeURIComponent(tabId)}/scroll-element`, {
      method: "POST",
      body: JSON.stringify({ ...params, userId })
    }, ScrollElementResponseSchema);

    return {
      ok: response.ok,
      scrollPosition: response.scrollPosition
    };
  }

  async evaluate(
    tabId: string,
    expression: string,
    userId: string,
    timeout?: number
  ): Promise<{
    ok: boolean;
    result?: unknown;
    resultType?: string;
    truncated?: boolean;
    error?: string;
    errorType?: string;
  }> {
    const response = await this.requestJson(`/tabs/${encodeURIComponent(tabId)}/evaluate`, {
      method: "POST",
      body: JSON.stringify({
        expression,
        userId,
        ...(timeout !== undefined ? { timeout } : {})
      }),
      requireApiKey: true
    }, EvaluateResponseSchema);

    return {
      ok: response.ok,
      result: response.result,
      resultType: response.resultType,
      truncated: response.truncated,
      error: response.error,
      errorType: response.errorType
    };
  }

  async waitForReady(tabId: string, userId: string, timeout?: number, waitForNetwork?: boolean): Promise<{ ready: boolean }> {
    return this.requestJson(`/tabs/${encodeURIComponent(tabId)}/wait`, {
      method: "POST",
      body: JSON.stringify({
        userId,
        timeout: timeout ?? 10000,
        waitForNetwork: waitForNetwork ?? true
      })
    }, WaitForReadyResponseSchema);
  }

  async hover(tabId: string, params: { ref?: string; selector?: string }, userId: string): Promise<void> {
    await this.requestJson("/act", {
      method: "POST",
      body: JSON.stringify({
        kind: "hover",
        targetId: tabId,
        userId,
        ...(params.ref ? { ref: params.ref } : {}),
        ...(params.selector ? { selector: params.selector } : {})
      })
    }, z.unknown());
  }

  async waitForText(tabId: string, userId: string, text: string, timeoutMs?: number): Promise<void> {
    const timeout = timeoutMs ?? 10000;
    const pollInterval = 500;
    const startedAt = Date.now();
    const targetText = text.toLowerCase();

    while (Date.now() - startedAt < timeout) {
      try {
        const snapshot = await this.snapshot(tabId, userId);
        if (snapshot.snapshot.toLowerCase().includes(targetText)) {
          return;
        }
      } catch {
        // Continue polling until timeout
      }

      await new Promise<void>((resolve) => {
        setTimeout(resolve, pollInterval);
      });
    }

    throw new AppError("TIMEOUT", `Text \"${text}\" not found within ${timeout}ms`);
  }

  async closeSession(userId: string): Promise<void> {
    await this.requestNoContent(`/sessions/${encodeURIComponent(userId)}`, {
      method: "DELETE"
    });
  }

  async snapshot(tabId: string, userId: string, offset?: number): Promise<SnapshotResponse> {
    const params = new URLSearchParams({ userId });
    if (offset !== undefined) {
      params.set("offset", String(offset));
    }

    const response = await this.requestJson(
      `/tabs/${encodeURIComponent(tabId)}/snapshot?${params.toString()}`,
      {
      method: "GET"
      }
    , SnapshotRawResponseSchema);

    return {
      url: response.url ?? "",
      snapshot: response.snapshot ?? "",
      refsCount: response.refsCount ?? 0,
      truncated: response.truncated,
      totalChars: response.totalChars,
      hasMore: response.hasMore,
      nextOffset: response.nextOffset
    };
  }

  async youtubeTranscript(url: string, languages?: string[]): Promise<YouTubeTranscriptResponse> {
    return this.requestJson(
      "/youtube/transcript",
      {
        method: "POST",
        body: JSON.stringify({
          url,
          languages: languages || ["en"]
        })
      },
      YouTubeTranscriptResponseSchema
    );
  }

  async screenshot(tabId: string, userId: string): Promise<Buffer> {
    const binary = await this.requestBinary(
      `/tabs/${encodeURIComponent(tabId)}/screenshot?userId=${encodeURIComponent(userId)}`,
      {
      method: "GET"
      }
    );
    return Buffer.from(binary);
  }

  async getLinks(tabId: string, userId: string): Promise<LinkResponse> {
    return this.getLinksWithOptions(tabId, userId);
  }

  async getLinksWithOptions(
    tabId: string,
    userId: string,
    options?: { scope?: string; extension?: string; downloadOnly?: boolean }
  ): Promise<LinkResponse> {
    const params = new URLSearchParams();
    params.set("userId", userId);

    if (options?.scope) {
      params.set("scope", options.scope);
    }

    if (options?.extension) {
      params.set("extension", options.extension);
    }

    if (options?.downloadOnly !== undefined) {
      params.set("downloadOnly", options.downloadOnly ? "true" : "false");
    }

    const response = await this.requestJson(
      `/tabs/${encodeURIComponent(tabId)}/links?${params.toString()}`,
      {
        method: "GET"
      },
      LinksRawResponseSchema
    );

    const links = response.links ?? [];
    return {
      links: links.map((item) => ({
        text: item.text ?? "",
        href: item.href ?? ""
      }))
    };
  }

  // Download management
  async listTabDownloads(
    tabId: string,
    userId: string,
    filters?: {
      status?: string;
      extension?: string;
      mimeType?: string;
      minSize?: number;
      maxSize?: number;
      sort?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<any> {
    const params = new URLSearchParams();
    params.set("userId", userId);

    if (filters?.status) params.set("status", filters.status);
    if (filters?.extension) params.set("extension", filters.extension);
    if (filters?.mimeType) params.set("mimeType", filters.mimeType);
    if (filters?.minSize !== undefined) params.set("minSize", String(filters.minSize));
    if (filters?.maxSize !== undefined) params.set("maxSize", String(filters.maxSize));
    if (filters?.sort) params.set("sort", filters.sort);
    if (filters?.limit !== undefined) params.set("limit", String(filters.limit));
    if (filters?.offset !== undefined) params.set("offset", String(filters.offset));

    return this.requestJson(
      `/tabs/${encodeURIComponent(tabId)}/downloads?${params.toString()}`,
      { method: "GET" },
      z.unknown()
    );
  }

  async listUserDownloads(
    userId: string,
    filters?: {
      status?: string;
      extension?: string;
      mimeType?: string;
      minSize?: number;
      maxSize?: number;
      sort?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<any> {
    const params = new URLSearchParams();

    if (filters?.status) params.set("status", filters.status);
    if (filters?.extension) params.set("extension", filters.extension);
    if (filters?.mimeType) params.set("mimeType", filters.mimeType);
    if (filters?.minSize !== undefined) params.set("minSize", String(filters.minSize));
    if (filters?.maxSize !== undefined) params.set("maxSize", String(filters.maxSize));
    if (filters?.sort) params.set("sort", filters.sort);
    if (filters?.limit !== undefined) params.set("limit", String(filters.limit));
    if (filters?.offset !== undefined) params.set("offset", String(filters.offset));

    const query = params.toString();
    return this.requestJson(
      `/users/${encodeURIComponent(userId)}/downloads${query ? `?${query}` : ""}`,
      { method: "GET" },
      z.unknown()
    );
  }

  async getDownload(downloadId: string, userId: string): Promise<any> {
    const params = new URLSearchParams();
    params.set("userId", userId);
    return this.requestJson(
      `/downloads/${encodeURIComponent(downloadId)}?${params.toString()}`,
      { method: "GET" },
      z.unknown()
    );
  }

  async getDownloadContent(downloadId: string, userId: string): Promise<Buffer> {
    const params = new URLSearchParams();
    params.set("userId", userId);
    const binary = await this.requestBinary(
      `/downloads/${encodeURIComponent(downloadId)}/content?${params.toString()}`,
      { method: "GET" }
    );
    return Buffer.from(binary);
  }

  async deleteDownload(downloadId: string, userId: string): Promise<any> {
    return this.requestJson(
      `/downloads/${encodeURIComponent(downloadId)}`,
      {
        method: "DELETE",
        body: JSON.stringify({ userId })
      },
      z.unknown()
    );
  }

  // Resource extraction
  async extractResources(
    tabId: string,
    params: {
      userId: string;
      selector?: string;
      ref?: string;
      types?: string[];
      extensions?: string[];
      resolveBlobs?: boolean;
      triggerLazyLoad?: boolean;
      maxDepth?: number;
    }
  ): Promise<any> {
    return this.requestJson(
      `/tabs/${encodeURIComponent(tabId)}/extract-resources`,
      {
        method: "POST",
        body: JSON.stringify(params)
      },
      z.unknown()
    );
  }

  async batchDownload(
    tabId: string,
    params: {
      userId: string;
      selector?: string;
      ref?: string;
      types?: string[];
      extensions?: string[];
      resolveBlobs?: boolean;
      concurrency?: number;
      maxFiles?: number;
    }
  ): Promise<any> {
    return this.requestJson(
      `/tabs/${encodeURIComponent(tabId)}/batch-download`,
      {
        method: "POST",
        body: JSON.stringify(params)
      },
      z.unknown()
    );
  }

  async resolveBlobs(tabId: string, userId: string, urls: string[]): Promise<any> {
    return this.requestJson(
      `/tabs/${encodeURIComponent(tabId)}/resolve-blobs`,
      {
        method: "POST",
        body: JSON.stringify({ userId, urls })
      },
      z.unknown()
    );
  }

  async getStats(tabId: string, userId: string): Promise<StatsResponse> {
    return this.requestJson(
      `/tabs/${encodeURIComponent(tabId)}/stats?userId=${encodeURIComponent(userId)}`,
      {
        method: "GET"
      }
    , StatsResponseSchema);
  }

  async exportCookies(tabId: string, userId: string): Promise<unknown[]> {
    const response = await this.requestJson(
      `/tabs/${encodeURIComponent(tabId)}/cookies?userId=${encodeURIComponent(userId)}`,
      { method: "GET" },
      CookieExportResponseSchema
    );

    return Array.isArray(response) ? response : response.cookies;
  }

  async importCookies(userId: string, cookies: unknown[], tabId?: string): Promise<void> {
    const MAX_COOKIES_PER_REQUEST = 500;

    if (cookies.length <= MAX_COOKIES_PER_REQUEST) {
      await this.requestNoContent(`/sessions/${encodeURIComponent(userId)}/cookies`, {
        method: "POST",
        body: JSON.stringify({ cookies, ...(tabId && { tabId }) }),
        requireApiKey: true
      });
      return;
    }

    for (let i = 0; i < cookies.length; i += MAX_COOKIES_PER_REQUEST) {
      const batch = cookies.slice(i, i + MAX_COOKIES_PER_REQUEST);
      await this.requestNoContent(`/sessions/${encodeURIComponent(userId)}/cookies`, {
        method: "POST",
        body: JSON.stringify({ cookies: batch, ...(tabId && { tabId }) }),
        requireApiKey: true
      });
    }
  }

  private async requestJson<T>(
    path: string,
    init: RequestInit & { requireApiKey?: boolean },
    schema: z.ZodType<T>
  ): Promise<T> {
    const response = await this.request(path, init);
    const rawBody = await response.text();

    if (!rawBody || rawBody.trim().length === 0) {
      throw new AppError(
        "INTERNAL_ERROR",
        `Expected JSON response from ${path} but received empty body (status ${response.status})`
      );
    }

    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch {
      throw new AppError(
        "INTERNAL_ERROR",
        `Expected JSON response from ${path} but received non-JSON body (status ${response.status})`
      );
    }

    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new AppError(
        "INTERNAL_ERROR",
        `Unexpected response from CamoFox API: ${parsed.error.issues.map((issue) => issue.message).join(", ")}`
      );
    }

    return parsed.data;
  }

  private async requestBinary(path: string, init: RequestInit & { requireApiKey?: boolean }): Promise<ArrayBuffer> {
    const response = await this.request(path, init);
    return response.arrayBuffer();
  }

  private async requestNoContent(path: string, init: RequestInit & { requireApiKey?: boolean }): Promise<void> {
    await this.request(path, init);
  }

  private async request(path: string, init: RequestInit & { requireApiKey?: boolean }): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const headers = new Headers();
      headers.set("content-type", "application/json");

      if (this.apiKey) {
        headers.set("x-api-key", this.apiKey);
        headers.set("authorization", `Bearer ${this.apiKey}`);
      }

      if (init.headers) {
        const extra = new Headers(init.headers);
        extra.forEach((value, key) => {
          headers.set(key, value);
        });
      }

      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers,
        signal: controller.signal
      });

      if (!response.ok) {
        throw await this.buildHttpError(response);
      }

      return response;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new AppError("TIMEOUT", `CamoFox API request timed out after ${this.timeout}ms`);
      }

      if (error instanceof Error) {
        throw new AppError("CONNECTION_REFUSED", `Failed to connect to CamoFox API: ${error.message}`);
      }

      throw new AppError("INTERNAL_ERROR", "Unknown error while calling CamoFox API");
    } finally {
      clearTimeout(timer);
    }
  }

  private async buildHttpError(response: Response): Promise<AppError> {
    let message = `CamoFox API request failed with ${response.status}`;

    const rawBody = await response.text();
    if (rawBody) {
      try {
        const json: unknown = JSON.parse(rawBody);
        const parsed = ApiErrorPayloadSchema.safeParse(json);
        if (parsed.success) {
          const body: ApiErrorPayload = parsed.data;
          message = body.error ?? body.message ?? rawBody;
        } else {
          message = rawBody;
        }
      } catch {
        message = rawBody;
      }
    }

    if (response.status === 404) {
      return new AppError("TAB_NOT_FOUND", message, response.status);
    }

    if (response.status === 401 || response.status === 403) {
      const hint = "CAMOFOX_API_KEY is required for this operation";
      const combined = message.toLowerCase().includes("camofox_api_key")
        ? message
        : `${hint} (${response.status}): ${message}`;
      return new AppError("API_KEY_REQUIRED", combined, response.status);
    }

    if (response.status === 400 && /element|ref|selector/i.test(message)) {
      return new AppError("ELEMENT_NOT_FOUND", message, response.status);
    }

    if (response.status >= 500) {
      return new AppError("NAVIGATION_FAILED", message, response.status);
    }

    return new AppError("INTERNAL_ERROR", message, response.status);
  }
}
