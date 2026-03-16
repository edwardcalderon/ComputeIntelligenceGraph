import { ActionExecutor } from './openfang.js';
export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
}
export interface RAGPipelineLike {
    assembleContext(query: string, history: ChatMessage[], topK?: number): Promise<string>;
}
export interface ActionIntent {
    type: string;
    resourceId: string;
    params: Record<string, unknown>;
}
export interface OpenClawResponse {
    answer: string;
    cypher?: string;
    needsClarification: boolean;
    clarifyingQuestion?: string;
    action?: ActionIntent;
}
export declare class ConversationContext {
    private messages;
    private readonly maxTurns;
    private pendingAction?;
    addMessage(role: 'user' | 'assistant', content: string): void;
    getHistory(): ChatMessage[];
    setPendingAction(action: ActionIntent): void;
    getPendingAction(): ActionIntent | undefined;
    clearPendingAction(): void;
    clear(): void;
}
export declare class OpenClawAgent {
    private ragPipeline;
    private actionExecutor;
    private userId;
    private llm;
    private sessions;
    constructor(ragPipeline?: RAGPipelineLike | null, actionExecutor?: ActionExecutor | null, userId?: string);
    private fetchCostContext;
    private fetchSecurityContext;
    private getSession;
    query(input: string, sessionId?: string): Promise<OpenClawResponse>;
    generateCypher(naturalLanguage: string): Promise<string>;
}
//# sourceMappingURL=openclaw.d.ts.map