export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
}
export interface RAGPipelineLike {
    assembleContext(query: string, history: ChatMessage[], topK?: number): Promise<string>;
}
export interface OpenClawResponse {
    answer: string;
    cypher?: string;
    needsClarification: boolean;
    clarifyingQuestion?: string;
}
export declare class ConversationContext {
    private messages;
    private readonly maxTurns;
    addMessage(role: 'user' | 'assistant', content: string): void;
    getHistory(): ChatMessage[];
    clear(): void;
}
export declare class OpenClawAgent {
    private ragPipeline;
    private llm;
    private sessions;
    constructor(ragPipeline?: RAGPipelineLike | null);
    private getSession;
    query(input: string, sessionId?: string): Promise<OpenClawResponse>;
    generateCypher(naturalLanguage: string): Promise<string>;
}
//# sourceMappingURL=openclaw.d.ts.map