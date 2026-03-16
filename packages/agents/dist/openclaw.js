"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenClawAgent = exports.ConversationContext = void 0;
const openai_1 = require("@langchain/openai");
const messages_1 = require("@langchain/core/messages");
const SYSTEM_PROMPT = `You are OpenClaw, an AI assistant specialized in infrastructure resource analysis and graph traversal.

You help users query and understand their infrastructure resources stored in a Neo4j knowledge graph.

When answering:
- Answer questions about infrastructure resources clearly and concisely
- When asked about relationships, dependencies, or graph traversal, generate a Neo4j Cypher query
- If a query is ambiguous or lacks necessary details, ask a clarifying question
- Always respond with valid JSON in this exact format:
  {
    "answer": "your natural language answer",
    "cypher": "MATCH ... RETURN ... (only if graph traversal is needed)",
    "needsClarification": false,
    "clarifyingQuestion": "question if needsClarification is true"
  }

Cypher guidelines:
- Use node labels like :Resource, :Service, :Database, :Network
- Use relationship types like :DEPENDS_ON, :CONNECTS_TO, :HOSTS
- Always include RETURN clause
- Keep queries efficient with LIMIT when appropriate`;
class ConversationContext {
    messages = [];
    maxTurns = 5;
    addMessage(role, content) {
        this.messages.push({ role, content, timestamp: new Date() });
        // Keep only last maxTurns * 2 messages (each turn = user + assistant)
        if (this.messages.length > this.maxTurns * 2) {
            this.messages = this.messages.slice(-this.maxTurns * 2);
        }
    }
    getHistory() {
        return [...this.messages];
    }
    clear() {
        this.messages = [];
    }
}
exports.ConversationContext = ConversationContext;
class OpenClawAgent {
    ragPipeline;
    llm;
    sessions = new Map();
    constructor(ragPipeline = null) {
        this.ragPipeline = ragPipeline;
        this.llm = new openai_1.ChatOpenAI({
            model: 'gpt-4o-mini',
            temperature: 0.1,
            apiKey: process.env['OPENAI_API_KEY'],
        });
    }
    getSession(sessionId) {
        if (!this.sessions.has(sessionId)) {
            this.sessions.set(sessionId, new ConversationContext());
        }
        return this.sessions.get(sessionId);
    }
    async query(input, sessionId = 'default') {
        const session = this.getSession(sessionId);
        const history = session.getHistory();
        let contextBlock = '';
        if (this.ragPipeline) {
            try {
                contextBlock = await this.ragPipeline.assembleContext(input, history);
            }
            catch {
                // RAG unavailable — proceed without context
            }
        }
        const systemContent = contextBlock
            ? `${SYSTEM_PROMPT}\n\n${contextBlock}`
            : SYSTEM_PROMPT;
        const langchainMessages = [
            new messages_1.SystemMessage(systemContent),
            ...history.map((m) => m.role === 'user' ? new messages_1.HumanMessage(m.content) : new messages_1.AIMessage(m.content)),
            new messages_1.HumanMessage(input),
        ];
        const response = await this.llm.invoke(langchainMessages);
        const raw = typeof response.content === 'string'
            ? response.content
            : JSON.stringify(response.content);
        let parsed;
        try {
            // Strip markdown code fences if present
            const cleaned = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
            parsed = JSON.parse(cleaned);
        }
        catch {
            parsed = { answer: raw, needsClarification: false };
        }
        session.addMessage('user', input);
        session.addMessage('assistant', parsed.answer);
        return parsed;
    }
    async generateCypher(naturalLanguage) {
        const messages = [
            new messages_1.SystemMessage("You are a Neo4j Cypher expert. Convert the user's natural language request into a valid Cypher query. Return ONLY the Cypher query, no explanation."),
            new messages_1.HumanMessage(naturalLanguage),
        ];
        const response = await this.llm.invoke(messages);
        const cypher = typeof response.content === 'string'
            ? response.content
            : JSON.stringify(response.content);
        return cypher.trim();
    }
}
exports.OpenClawAgent = OpenClawAgent;
//# sourceMappingURL=openclaw.js.map