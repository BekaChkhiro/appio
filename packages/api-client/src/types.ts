import type { Persona } from "@appio/themes";

export type { Persona };

/** WCAG accessibility report returned alongside a generated theme */
export interface WcagReport {
  passes: boolean;
  warnings: string[];
  errors: string[];
}

/** Request body for POST /api/v1/themes/generate */
export interface GenerateThemeRequest {
  /** Exactly one of prompt, image_url, or image_base64 must be provided */
  prompt?: string;
  image_url?: string;
  image_base64?: string;
  name?: string;
}

/** Response from POST /api/v1/themes/generate */
export interface GenerateThemeResponse {
  theme_id: string;
  persona: Persona;
  cost_usd: number;
  wcag: WcagReport;
}

/** A theme saved in the user_themes table */
export interface SavedTheme {
  id: string;
  name: string;
  source_kind: "text" | "image";
  source_prompt: string | null;
  source_image_url: string | null;
  persona: Persona;
  cost_usd: number | null;
  created_at: string;
  updated_at: string;
}

/** Paginated list response for GET /api/v1/themes/ */
export interface ThemeListResponse {
  items: SavedTheme[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}

/** SSE event types from the agent generation pipeline */
export type SSEEventType =
  | "agent_turn"
  | "tool_call"
  | "agent_text"
  | "preview_ready"
  | "complete"
  | "error"
  | "status"
  | "plan"
  | "critique"
  | "lint"
  | "preview_upload";

/** Generic SSE event wrapper */
export interface SSEEvent {
  type: SSEEventType;
  data: unknown;
}

export interface AgentTurnEvent {
  type: "agent_turn";
  data: { iteration?: number; iterations?: number; cost_usd?: number; message?: string };
}

export interface ToolCallEvent {
  type: "tool_call";
  data: { tool_name: string; tool?: string; message?: string };
}

export interface AgentTextEvent {
  type: "agent_text";
  data: { text: string; message?: string };
}

export interface PreviewReadyEvent {
  type: "preview_ready";
  data: { url: string; message?: string };
}

export interface CompleteEvent {
  type: "complete";
  data: {
    public_url: string;
    generation_id?: string;
    slug?: string;
    version?: number;
    cost_usd?: number;
    iterations?: number;
    tokens?: Record<string, unknown>;
    build?: Record<string, unknown>;
    message?: string;
  };
}

export interface ErrorEvent {
  type: "error";
  data: { message: string; code?: string };
}

export interface StatusEvent {
  type: "status";
  data: { message: string };
}

export interface PlanEvent {
  type: "plan";
  data: {
    message?: string;
    app_name?: string;
    theme_color?: string;
    screens?: number;
    steps?: number;
    cost_usd?: number;
  };
}

export interface CritiqueEvent {
  type: "critique";
  data: {
    message?: string;
    score?: number;
    summary?: string;
    issue_count?: number;
    cost_usd?: number;
  };
}

export interface LintEvent {
  type: "lint";
  data: { message?: string; warnings?: string };
}

export interface PreviewUploadEvent {
  type: "preview_upload";
  data: { generation_id: string; turn: number };
}

export type GenerationEvent =
  | AgentTurnEvent
  | ToolCallEvent
  | AgentTextEvent
  | PreviewReadyEvent
  | CompleteEvent
  | ErrorEvent
  | StatusEvent
  | PlanEvent
  | CritiqueEvent
  | LintEvent
  | PreviewUploadEvent;

/** API response types */
export interface App {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  url: string | null;
  status: "draft" | "building" | "ready" | "published" | "failed";
  theme_color: string | null;
  current_version: number;
  install_count: number;
  created_at: string;
  updated_at: string;
}

export interface Template {
  id: string;
  name: string;
  display_name: string;
  category: string;
  description: string;
  is_active: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}

export interface GenerateRequest {
  prompt: string;
  /** Build-skeleton template id (`templates.id`) — rarely set by client. */
  template_id?: string;
  app_id?: string;
  /** Marketplace template slug the user started from — bumps use_count. */
  template_slug?: string;
  idempotency_key?: string;
}

export interface AppTemplate {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  preview_screenshots: string[] | null;
  is_featured: boolean;
  use_count: number;
}

export interface AppTemplateDetail extends AppTemplate {
  canonical_prompt: string;
  template_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiError {
  detail: string;
  code?: string;
}

export interface PasteCredentialsRequest {
  deploy_key: string;
  deployment_url: string;
}

export interface CredentialsStatusResponse {
  has_credentials: boolean;
  deployment_url: string | null;
  team_slug: string | null;
  last_used_at: string | null;
}

export type PublishStatus =
  | "pending" | "provisioning" | "pushing_schema" | "pushing_functions"
  | "copying_data" | "rewriting_config" | "rebuilding" | "published" | "failed";
export interface PublishStatusResponse {
  migration_id: string;
  status: PublishStatus;
  current_step: string | null;
  message: string | null;
  deployment_url: string | null;
  started_at: string | null;
  completed_at: string | null;
}
