export interface Config {
  camofoxUrl: string;
  apiKey?: string;
  defaultUserId: string;
  profilesDir: string;
  timeout: number;
  autoSave: boolean;
  transport: "stdio" | "http";
  httpPort: number;
  httpHost: string;
  httpRateLimit: number;
}

export interface HealthResponse {
  ok: boolean;
  running?: boolean;
  browserConnected: boolean;
  version?: string;
}

export interface CreateTabParams {
  userId: string;
  sessionKey: string;
  url?: string;
  preset?: string;
  locale?: string;
  timezoneId?: string;
  geolocation?: { latitude: number; longitude: number };
  viewport?: { width: number; height: number };
}

export interface PresetInfo {
  locale: string;
  timezoneId: string;
  geolocation?: { latitude: number; longitude: number };
}

export interface PresetsResponse {
  presets: Record<string, PresetInfo>;
}

export interface TabResponse {
  tabId: string;
  url: string;
  title?: string;
}

export interface NavigateResponse {
  url: string;
  title?: string;
}

export interface ClickParams {
  ref?: string;
  selector?: string;
}

export interface ClickResponse {
  success: boolean;
  navigated?: boolean;
}

export interface SnapshotResponse {
  url: string;
  snapshot: string;
  refsCount: number;
}

export interface LinkItem {
  text: string;
  href: string;
}

export interface LinkResponse {
  links: LinkItem[];
}

export interface StatsResponse {
  visitedUrls?: string[];
  [key: string]: unknown;
}

export interface TabInfo {
  tabId: string;
  url: string;
  createdAt: string;
  lastActivity: number;
  userId: string;
  sessionKey: string;
  visitedUrls: string[];
  toolCalls: number;
  refsCount: number;
}

export type SearchEngine =
  | "google"
  | "youtube"
  | "amazon"
  | "bing"
  | "duckduckgo"
  | "reddit"
  | "github"
  | "stackoverflow"
  | "wikipedia"
  | "twitter"
  | "linkedin"
  | "facebook"
  | "instagram"
  | "tiktok";

export interface ProfileCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
  [key: string]: unknown;
}

export interface ProfileMetadata {
  createdAt: string;
  updatedAt: string;
  lastUrl?: string | null;
  description?: string | null;
  cookieCount: number;
}

export interface Profile {
  version: 1;
  profileId: string;
  userId: string;
  cookies: ProfileCookie[];
  metadata: ProfileMetadata;
}
