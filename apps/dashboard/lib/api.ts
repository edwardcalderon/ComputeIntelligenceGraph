import type { BootstrapCompletePayload } from "@cig/sdk";
import { getDashboardClient } from "./cigClient";

export type {
  BootstrapCompletePayload,
  BootstrapCompleteResponse,
  BootstrapStatus,
  ChatMessage,
  ChatResponse,
  ChatSessionDetailResponse,
  ChatSessionListResponse,
  ChatSessionSummary,
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
  SessionListResponse,
  TargetsResponse,
} from "@cig/sdk";

function getClient() {
  return getDashboardClient();
}

export const getResourcesPaged = (params?: string) =>
  getClient().getResourcesPaged(params);

export const searchResources = (query: string, params?: string) =>
  getClient().searchResources(query, params);

export const getDiscoveryStatus = () => getClient().getDiscoveryStatus();

export const getHealth = () => getClient().getHealth();

export const triggerDiscovery = () => getClient().triggerDiscovery();

export const getResource = (id: string) => getClient().getResource(id);

export const getResourceDependencies = (id: string) =>
  getClient().getResourceDependencies(id);

export const getResourceDependents = (id: string) =>
  getClient().getResourceDependents(id);

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

export const sendChatMessage = (message: string, sessionId?: string) =>
  getClient().sendChatMessage(message, sessionId);

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
