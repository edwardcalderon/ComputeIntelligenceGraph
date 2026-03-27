import type {
  BootstrapCompletePayload,
  GraphRefinementRequest,
  GraphSource,
  SendChatMessagePayload,
} from "@cig/sdk";
import { getDashboardClient } from "./cigClient";

export type {
  BootstrapCompletePayload,
  BootstrapCompleteResponse,
  BootstrapStatus,
  ChatAttachmentContextItem,
  ChatAttachmentUploadResponse,
  ChatCodeSnippetContextItem,
  ChatContextItem,
  ChatMessage,
  ChatResponse,
  ChatSessionDetailResponse,
  ChatSessionListResponse,
  ChatSessionSummary,
  ChatResourceLinkContextItem,
  ChatTranscriptContextItem,
  ChatTranscriptionResponse,
  CostBreakdown,
  CostBreakdownEntry,
  CostEntry,
  CostSummary,
  CostTrendPeriod,
  CostsResponse,
  DeviceAuthRequest,
  DeviceAuthResponse,
  DeviceSession,
  HealthResponse,
  DiscoveryStatus,
  EnrollmentTokenResponse,
  GraphStats,
  GraphRefinementRequest,
  GraphRefinementResponse,
  GraphSource,
  GraphSnapshot,
  ManagedTarget,
  PagedResources,
  Relationship,
  Resource,
  ResourceCostEntry,
  ResourceDependencies,
  SecurityFinding,
  SecurityFindingsResponse,
  SecurityScanResult,
  SecurityScore,
  SendChatMessagePayload,
  SessionListResponse,
  TargetsResponse,
} from "@cig/sdk";

function getClient() {
  return getDashboardClient();
}

export const getResourcesPaged = (params?: string, source?: GraphSource) =>
  getClient().getResourcesPaged(params, source);

export const searchResources = (query: string, params?: string, source?: GraphSource) =>
  getClient().searchResources(query, params, source);

export const getDiscoveryStatus = () => getClient().getDiscoveryStatus();

export const getHealth = () => getClient().getHealth();

export const triggerDiscovery = () => getClient().triggerDiscovery();

export const getGraphSnapshot = (source?: GraphSource) =>
  getClient().getGraphSnapshot(source);

export const getResource = (id: string, source?: GraphSource) =>
  getClient().getResource(id, source);

export const getResourceDependencies = (id: string, source?: GraphSource) =>
  getClient().getResourceDependencies(id, source);

export const getResourceDependents = (id: string, source?: GraphSource) =>
  getClient().getResourceDependents(id, source);

export const getRelationships = (limit?: number) =>
  getClient().getRelationships(limit);

export const getResourceCost = (resourceId: string) =>
  getClient().getResourceCost(resourceId);

export const getCostSummary = () => getClient().getCostSummary();

export const getCostBreakdown = () => getClient().getCostBreakdown();

export const getResourceSecurityFindings = (resourceId: string) =>
  getClient().getResourceSecurityFindings(resourceId);

export const getSecurityFindings = (resourceId?: string) =>
  getClient().getSecurityFindings(resourceId);

export const getSecurityScore = () => getClient().getSecurityScore();

export const getChatSessions = () => getClient().getChatSessions();

export const getChatSessionMessages = (sessionId: string) =>
  getClient().getChatSessionMessages(sessionId);

export const deleteChatSession = (sessionId: string) =>
  getClient().deleteChatSession(sessionId);

export const renameChatSession = (sessionId: string, title: string) =>
  getClient().renameChatSession(sessionId, { title });

export const uploadChatAttachment = (file: Blob, filename?: string) =>
  getClient().uploadChatAttachment(file, filename);

export const transcribeChatAudio = (
  file: Blob,
  options?: { filename?: string; durationMs?: number; mode?: "review" | "auto-send" },
) => getClient().transcribeChatAudio(file, options);

export const sendChatMessage = (payload: SendChatMessagePayload) =>
  getClient().sendChatMessage(payload);

export const refineGraph = (payload: GraphRefinementRequest) =>
  getClient().refineGraph(payload);

export const getTargets = () => getClient().getTargets();

export const deleteTarget = (id: string) => getClient().deleteTarget(id);

export const createEnrollmentToken = () => getClient().createEnrollmentToken();

export const getBootstrapStatus = () => getClient().getBootstrapStatus();

export const validateBootstrapToken = (token: string) =>
  getClient().validateBootstrapToken(token);

export const completeBootstrap = (payload: BootstrapCompletePayload) =>
  getClient().completeBootstrap(payload);

export const getPendingDeviceRequests = () =>
  getClient().getPendingDeviceRequests();

export const approveDevice = (userCode: string) =>
  getClient().approveDevice(userCode);

export const denyDevice = (userCode: string) =>
  getClient().denyDevice(userCode);

export const getSessions = () => getClient().getSessions();

export const revokeSession = (sessionId: string) =>
  getClient().revokeSession(sessionId);
