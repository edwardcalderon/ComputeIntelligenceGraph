"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenClawAgent = exports.ConversationContext = void 0;
const openai_1 = require("@langchain/openai");
const messages_1 = require("@langchain/core/messages");
const openfang_js_1 = require("./openfang.js");
const API_URL = process.env['API_URL'] ?? 'http://localhost:8080';
const COST_KEYWORDS = ['cost', 'costs', 'expensive', 'cheapest', 'spending', 'billing', 'price', 'how much', 'budget'];
function isCostQuery(input) {
    const lower = input.toLowerCase();
    return COST_KEYWORDS.some((kw) => lower.includes(kw));
}
const SECURITY_KEYWORDS = [
    'security', 'vulnerability', 'misconfiguration', 'finding', 'findings',
    'risk', 'compliance', 'exposed', 'public access', 'ssh', 'open port',
    'iam', 'access key',
];
function isSecurityQuery(input) {
    const lower = input.toLowerCase();
    return SECURITY_KEYWORDS.some((kw) => lower.includes(kw));
}
const SYSTEM_PROMPT = `You are OpenClaw, an AI assistant specialized in infrastructure resource analysis and graph traversal.

You help users query and understand their infrastructure resources stored in a Neo4j knowledge graph.
You can also help users perform infrastructure actions such as creating S3 buckets, starting or stopping EC2 instances.

When answering:
- Answer questions about infrastructure resources clearly and concisely
- When asked about relationships, dependencies, or graph traversal, generate a Neo4j Cypher query
- If a query is ambiguous or lacks necessary details, ask a clarifying question
- When a user requests an infrastructure action (create, start, stop, delete), include an "action" field in the response
- Always respond with valid JSON in this exact format:
  {
    "answer": "your natural language answer",
    "cypher": "MATCH ... RETURN ... (only if graph traversal is needed)",
    "needsClarification": false,
    "clarifyingQuestion": "question if needsClarification is true",
    "action": {
      "type": "START_EC2_INSTANCE",
      "resourceId": "i-1234567890abcdef0",
      "params": {}
    }
  }

Action types: CREATE_S3_BUCKET, START_EC2_INSTANCE, STOP_EC2_INSTANCE, DELETE_RESOURCE
Only include the "action" field when the user explicitly requests an infrastructure action.
Omit "action" for informational queries.

Cypher guidelines:
- Use node labels like :Resource, :Service, :Database, :Network
- Use relationship types like :DEPENDS_ON, :CONNECTS_TO, :HOSTS
- Always include RETURN clause
- Keep queries efficient with LIMIT when appropriate`;
class ConversationContext {
    messages = [];
    maxTurns = 5;
    pendingAction;
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
    setPendingAction(action) {
        this.pendingAction = action;
    }
    getPendingAction() {
        return this.pendingAction;
    }
    clearPendingAction() {
        this.pendingAction = undefined;
    }
    clear() {
        this.messages = [];
        this.pendingAction = undefined;
    }
}
exports.ConversationContext = ConversationContext;
class OpenClawAgent {
    ragPipeline;
    actionExecutor;
    userId;
    llm;
    sessions = new Map();
    constructor(ragPipeline = null, actionExecutor = null, userId = 'system') {
        this.ragPipeline = ragPipeline;
        this.actionExecutor = actionExecutor;
        this.userId = userId;
        this.llm = new openai_1.ChatOpenAI({
            model: 'gpt-4o-mini',
            temperature: 0.1,
            apiKey: process.env['OPENAI_API_KEY'],
        });
    }
    async fetchCostContext() {
        try {
            const response = await fetch(`${API_URL}/api/v1/costs`);
            if (!response.ok)
                return '';
            const data = await response.json();
            const currency = data.currency ?? 'USD';
            const total = data.totalMonthlyCost ?? 0;
            const resources = (data.resourceCosts ?? [])
                .sort((a, b) => b.amount - a.amount)
                .slice(0, 10);
            if (resources.length === 0 && total === 0)
                return '';
            const lines = [
                `Cost Summary (total monthly: ${total.toFixed(2)} ${currency}):`,
                ...resources.map((r, i) => `  ${i + 1}. ${r.resourceId}: ${r.amount.toFixed(2)} ${r.currency}`),
            ];
            return `\n\n[Cost Data]\n${lines.join('\n')}`;
        }
        catch {
            return '';
        }
    }
    async fetchSecurityContext() {
        const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
        try {
            const [findingsRes, scoreRes] = await Promise.all([
                fetch(`${API_URL}/api/v1/security/findings`),
                fetch(`${API_URL}/api/v1/security/score`),
            ]);
            if (!findingsRes.ok && !scoreRes.ok)
                return '';
            let findings = [];
            if (findingsRes.ok) {
                const data = await findingsRes.json();
                findings = data.findings ?? data.items ?? [];
            }
            let scoreData = null;
            if (scoreRes.ok) {
                scoreData = await scoreRes.json();
            }
            const sorted = findings
                .slice()
                .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99))
                .slice(0, 10);
            const lines = [];
            if (scoreData) {
                lines.push(`Security Score: ${scoreData.score}/${scoreData.maxScore} (Grade: ${scoreData.grade})`);
            }
            if (sorted.length > 0) {
                lines.push('Top Security Findings:');
                sorted.forEach((f, i) => {
                    const label = f.title ?? f.description ?? f.id ?? 'Unknown finding';
                    const resource = f.resourceId ? ` [${f.resourceId}]` : '';
                    lines.push(`  ${i + 1}. [${f.severity.toUpperCase()}]${resource} ${label}`);
                });
            }
            if (lines.length === 0)
                return '';
            return `\n\n[Security Data]\n${lines.join('\n')}`;
        }
        catch {
            return '';
        }
    }
    getSession(sessionId) {
        if (!this.sessions.has(sessionId)) {
            this.sessions.set(sessionId, new ConversationContext());
        }
        return this.sessions.get(sessionId);
    }
    async query(input, sessionId = 'default') {
        const session = this.getSession(sessionId);
        // Handle confirmation of a pending destructive action
        if (input.trim().toLowerCase() === 'confirm') {
            const pending = session.getPendingAction();
            if (pending && this.actionExecutor) {
                session.clearPendingAction();
                try {
                    const result = await this.actionExecutor.execute({
                        actionType: pending.type,
                        resourceId: pending.resourceId,
                        params: pending.params,
                        userId: this.userId,
                        confirmed: true,
                    });
                    const answer = result.success
                        ? `✓ ${result.message}`
                        : `✗ Action failed: ${result.message}`;
                    session.addMessage('user', input);
                    session.addMessage('assistant', answer);
                    return { answer, needsClarification: false };
                }
                catch (err) {
                    const message = err instanceof Error ? err.message : 'Unknown error executing action';
                    const answer = `✗ Action failed: ${message}`;
                    session.addMessage('user', input);
                    session.addMessage('assistant', answer);
                    return { answer, needsClarification: false };
                }
            }
        }
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
        if (isCostQuery(input)) {
            const costContext = await this.fetchCostContext();
            contextBlock += costContext;
        }
        if (isSecurityQuery(input)) {
            const securityContext = await this.fetchSecurityContext();
            contextBlock += securityContext;
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
        // Handle action intent from LLM response
        if (parsed.action && this.actionExecutor) {
            const actionType = parsed.action.type;
            const isDestructive = openfang_js_1.DESTRUCTIVE_ACTIONS.has(actionType);
            if (isDestructive) {
                // Store pending action and ask for confirmation
                session.setPendingAction(parsed.action);
                parsed.answer = `${parsed.answer}\n\nThis is a destructive action. Reply 'confirm' to proceed.`;
            }
            else {
                // Execute non-destructive action immediately
                try {
                    const result = await this.actionExecutor.execute({
                        actionType,
                        resourceId: parsed.action.resourceId,
                        params: parsed.action.params,
                        userId: this.userId,
                        confirmed: true,
                    });
                    parsed.answer = result.success
                        ? `${parsed.answer}\n\n✓ ${result.message}`
                        : `${parsed.answer}\n\n✗ Action failed: ${result.message}`;
                }
                catch (err) {
                    const message = err instanceof Error ? err.message : 'Unknown error';
                    parsed.answer = `${parsed.answer}\n\n✗ Action failed: ${message}`;
                }
            }
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