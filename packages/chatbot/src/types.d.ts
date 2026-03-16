export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
}
export interface ChatSession {
    id: string;
    messages: ChatMessage[];
    createdAt: Date;
}
//# sourceMappingURL=types.d.ts.map