import { describe, expect, it } from "vitest";
import { loadConfig } from "../config.js";
import { customSearchUrl, validateSearchUrlTemplate } from "../search-template.js";

describe("custom search URL templates", () => {
  it.each(["https://search.example/search?q={query}&lang=en", "http://search.example/find/{query}"])("encodes Unicode and separators in %s", template => {
    const query = "cà phê & x=/雪?#%";
    const result = customSearchUrl(template, query);
    expect(result).toBe(template.replace("{query}", encodeURIComponent(query)));
    expect(new URL(result).hostname).toBe("search.example");
  });
  it.each([
    "", "/search?q={query}", "javascript:{query}", "ftp://example.com/{query}",
    "https://{query}.example/search", "https://user:{query}@example.com/",
    "https://user:secret@example.com/?q={query}", "https://example.com/search",
    "https://example.com/{query}?q={query}", "https://example.com/#q={query}",
    "https://example.com/?q=%7Bquery%7D", "https://example.com/%zz?q={query}",
    "https://example.com/\\evil?q={query}", " https://example.com/?q={query}",
    "https://example.com:bad/?q={query}", "https://example.com/?token=secret#q={query}"
  ])("rejects malformed template without reflecting secrets: %s", template => {
    expect(() => validateSearchUrlTemplate(template)).toThrow(/CAMOFOX_SEARCH_URL_TEMPLATE must/);
    try { validateSearchUrlTemplate(template); } catch (error) {
      expect((error as Error).message).not.toContain("secret");
      expect((error as Error).message).not.toContain(template || "never-matches");
    }
    expect(() => loadConfig([], { CAMOFOX_SEARCH_URL_TEMPLATE: template })).toThrow(/CAMOFOX_SEARCH_URL_TEMPLATE must/);
  });
  it("requires configuration and does not silently fall back", () => {
    expect(() => customSearchUrl(undefined, "test")).toThrow(/Set CAMOFOX_SEARCH_URL_TEMPLATE/);
  });
  it("keeps private-network decisions at the browser boundary", () => {
    expect(customSearchUrl("http://127.0.0.1:8888/search?q={query}", "test"))
      .toBe("http://127.0.0.1:8888/search?q=test");
  });
});
