// Client
export { api, setTokenProvider, AuthError, ApiRequestError } from "./client";

// SSE
export { streamGeneration } from "./sse-client";

// Hooks
export { useGeneration } from "./hooks/useGeneration";
export { useMyApps, useMyAppsInfinite, useApp, useDeleteApp, useUpdateAppMessages } from "./hooks/useMyApps";
export { useTemplates } from "./hooks/useTemplates";
export {
  useAppTemplates,
  useAppTemplateCategories,
  useAppTemplateDetail,
} from "./hooks/useAppTemplates";
export {
  useGenerateTheme,
  useMyThemes,
  useTheme,
  useDeleteTheme,
} from "./hooks/useThemes";
export {
  useCredentialsStatus,
  usePasteCredentials,
  useRevokeCredentials,
  usePublishApp,
  usePublishStatus,
  IN_FLIGHT_PUBLISH_STATUSES,
} from "./hooks/useConvexPublish";

// Types
export type {
  SSEEventType,
  SSEEvent,
  GenerationEvent,
  AgentTurnEvent,
  ToolCallEvent,
  AgentTextEvent,
  PreviewReadyEvent,
  CompleteEvent,
  ErrorEvent,
  StatusEvent,
  PlanEvent,
  CritiqueEvent,
  LintEvent,
  PreviewUploadEvent,
  App,
  Template,
  AppTemplate,
  AppTemplateDetail,
  PaginatedResponse,
  GenerateRequest,
  ApiError,
  Persona,
  WcagReport,
  GenerateThemeRequest,
  GenerateThemeResponse,
  SavedTheme,
  ThemeListResponse,
  PasteCredentialsRequest,
  CredentialsStatusResponse,
  PublishStatus,
  PublishStatusResponse,
} from "./types";
