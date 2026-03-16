/**
 * WebSocket server for real-time updates
 * Requirements: 9.10
 */
import { FastifyInstance } from 'fastify';
export type WsEventType = 'resource_updated' | 'discovery_complete' | 'discovery_failed' | 'discovery_progress';
export interface WsMessage {
    type: WsEventType | 'ping' | 'pong';
    data?: unknown;
    timestamp: string;
}
/**
 * Broadcast an event to all connected WebSocket clients.
 */
export declare function broadcastEvent(type: WsEventType, data: unknown): void;
export declare function registerWebSocket(app: FastifyInstance): Promise<void>;
//# sourceMappingURL=websocket.d.ts.map