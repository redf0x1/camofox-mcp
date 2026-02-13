import { AppError } from "./errors.js";
import type {
  ClickParams,
  ClickResponse,
  Config,
  CreateTabParams,
  HealthResponse,
  LinkResponse,
  NavigateResponse,
  SnapshotResponse,
  StatsResponse,
  TabResponse
} from "./types.js";

interface ApiErrorPayload {
  error?: string;
  message?: string;
}

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
    return this.requestJson<HealthResponse>("/health", { method: "GET" });
  }

  async createTab(params: CreateTabParams): Promise<TabResponse> {
    const response = await this.requestJson<Record<string, unknown>>("/tabs", {
      method: "POST",
      body: JSON.stringify(params)
    });

    const tabId =
      (response.tabId as string | undefined) ??
      (response.id as string | undefined) ??
      ((response.tab as { id?: string } | undefined)?.id ?? undefined);

    if (!tabId) {
      throw new AppError("INTERNAL_ERROR", "CamoFox did not return a valid tab ID");
    }

    return {
      tabId,
      url: (response.url as string | undefined) ?? params.url ?? "about:blank",
      title: response.title as string | undefined
    };
  }

  async closeTab(tabId: string, userId: string): Promise<void> {
    await this.requestNoContent(`/tabs/${encodeURIComponent(tabId)}`, {
      method: "DELETE",
      body: JSON.stringify({ userId })
    });
  }

  async navigate(tabId: string, url: string, userId: string): Promise<NavigateResponse> {
    const response = await this.requestJson<Record<string, unknown>>(`/tabs/${encodeURIComponent(tabId)}/navigate`, {
      method: "POST",
      body: JSON.stringify({ url, userId })
    });

    return {
      url: (response.url as string | undefined) ?? url,
      title: response.title as string | undefined
    };
  }

  async navigateMacro(tabId: string, macro: string, query: string, userId: string): Promise<NavigateResponse> {
    const response = await this.requestJson<Record<string, unknown>>(`/tabs/${encodeURIComponent(tabId)}/navigate`, {
      method: "POST",
      body: JSON.stringify({ macro, query, userId })
    });

    return {
      url: (response.url as string | undefined) ?? "",
      title: response.title as string | undefined
    };
  }

  async goBack(tabId: string, userId: string): Promise<void> {
    await this.requestNoContent(`/tabs/${encodeURIComponent(tabId)}/back`, {
      method: "POST",
      body: JSON.stringify({ userId })
    });
  }

  async goForward(tabId: string, userId: string): Promise<void> {
    await this.requestNoContent(`/tabs/${encodeURIComponent(tabId)}/forward`, {
      method: "POST",
      body: JSON.stringify({ userId })
    });
  }

  async refresh(tabId: string, userId: string): Promise<void> {
    await this.requestNoContent(`/tabs/${encodeURIComponent(tabId)}/refresh`, {
      method: "POST",
      body: JSON.stringify({ userId })
    });
  }

  async click(tabId: string, params: ClickParams, userId: string): Promise<ClickResponse> {
    const response = await this.requestJson<Record<string, unknown>>(`/tabs/${encodeURIComponent(tabId)}/click`, {
      method: "POST",
      body: JSON.stringify({ ...params, userId })
    });

    return {
      success: (response.success as boolean | undefined) ?? true,
      navigated: response.navigated as boolean | undefined
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

  async waitForReady(tabId: string, userId: string, timeout?: number, waitForNetwork?: boolean): Promise<{ ready: boolean }> {
    return this.requestJson<{ ready: boolean }>(`/tabs/${encodeURIComponent(tabId)}/wait`, {
      method: "POST",
      body: JSON.stringify({
        userId,
        timeout: timeout ?? 10000,
        waitForNetwork: waitForNetwork ?? true
      })
    });
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
    });
  }

  async waitForText(tabId: string, userId: string, text: string, timeoutMs?: number): Promise<void> {
    await this.requestJson("/act", {
      method: "POST",
      body: JSON.stringify({
        kind: "wait",
        targetId: tabId,
        userId,
        text,
        ...(timeoutMs ? { timeMs: timeoutMs } : {})
      })
    });
  }

  async closeSession(userId: string): Promise<void> {
    await this.requestNoContent(`/sessions/${encodeURIComponent(userId)}`, {
      method: "DELETE"
    });
  }

  async snapshot(tabId: string, userId: string): Promise<SnapshotResponse> {
    const response = await this.requestJson<Record<string, unknown>>(
      `/tabs/${encodeURIComponent(tabId)}/snapshot?userId=${encodeURIComponent(userId)}`,
      {
      method: "GET"
      }
    );

    return {
      url: (response.url as string | undefined) ?? "",
      snapshot: (response.snapshot as string | undefined) ?? "",
      refsCount: (response.refsCount as number | undefined) ?? 0
    };
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
    const response = await this.requestJson<Record<string, unknown>>(
      `/tabs/${encodeURIComponent(tabId)}/links?userId=${encodeURIComponent(userId)}`,
      {
      method: "GET"
      }
    );

    const links = Array.isArray(response.links) ? response.links : [];
    return {
      links: links.map((item) => ({
        text: String((item as Record<string, unknown>).text ?? ""),
        href: String((item as Record<string, unknown>).href ?? "")
      }))
    };
  }

  async getStats(tabId: string, userId: string): Promise<StatsResponse> {
    return this.requestJson<StatsResponse>(
      `/tabs/${encodeURIComponent(tabId)}/stats?userId=${encodeURIComponent(userId)}`,
      {
        method: "GET"
      }
    );
  }

  async importCookies(userId: string, cookies: string): Promise<void> {
    await this.requestNoContent(`/sessions/${encodeURIComponent(userId)}/cookies`, {
      method: "POST",
      body: JSON.stringify({ cookies }),
      requireApiKey: true
    });
  }

  private async requestJson<T>(path: string, init: RequestInit & { requireApiKey?: boolean }): Promise<T> {
    const response = await this.request(path, init);
    if (response.status === 204) {
      return {} as T;
    }
    return (await response.json()) as T;
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
      if (init.requireApiKey && !this.apiKey) {
        throw new AppError("API_KEY_REQUIRED", "CAMOFOX_API_KEY is required for this operation");
      }

      const headers: Record<string, string> = {
        "content-type": "application/json"
      };

      if (this.apiKey) {
        headers["x-api-key"] = this.apiKey;
        headers.authorization = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          ...headers,
          ...(init.headers as Record<string, string> | undefined)
        },
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

      if (error instanceof DOMException && error.name === "AbortError") {
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
        const body = JSON.parse(rawBody) as ApiErrorPayload;
        message = body.error ?? body.message ?? rawBody;
      } catch {
        message = rawBody;
      }
    }

    if (response.status === 404) {
      return new AppError("TAB_NOT_FOUND", message, response.status);
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
