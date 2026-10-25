import { AppError } from "./errors.js";

const TEMPLATE_ERROR = "CAMOFOX_SEARCH_URL_TEMPLATE must be an absolute HTTP(S) URL with exactly one {query} in its path or query, and no credentials or fragment placeholder";

export function validateSearchUrlTemplate(template: string): string {
  try {
    // Inspect the raw authority too: URL parsing normalizes backslashes and whitespace.
    const parts = /^(https?):\/\/([^/?#]+)([^#]*)(?:#.*)?$/i.exec(template);
    if (!parts || /[\s\\]/.test(template) || /%(?![0-9a-f]{2})/i.test(template) ||
        template.split("{query}").length !== 2 || parts[2].includes("{query}") ||
        !parts[3].includes("{query}") || parts[2].includes("@")) throw new Error();
    const url = new URL(template.replace("{query}", "camofox-query"));
    if (!url.hostname || url.username || url.password) throw new Error();
    return template;
  } catch {
    // Never include the supplied URL: it may contain tokens or credentials.
    throw new AppError("VALIDATION_ERROR", TEMPLATE_ERROR);
  }
}

export function customSearchUrl(template: string | undefined, query: string): string {
  if (!template) {
    throw new AppError("VALIDATION_ERROR", "Set CAMOFOX_SEARCH_URL_TEMPLATE (for example https://search.example/search?q={query}) before using engine='custom'");
  }
  validateSearchUrlTemplate(template);
  try {
    return template.replace("{query}", encodeURIComponent(query));
  } catch {
    throw new AppError("VALIDATION_ERROR", "Search query must contain valid Unicode text");
  }
}
