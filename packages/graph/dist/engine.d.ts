import { Resource_Model, Relationship, RelationshipType, ResourceType, Provider, ResourceState, type GraphScope } from './types';
export interface ResourceFilters {
    type?: ResourceType;
    provider?: Provider;
    region?: string;
    state?: ResourceState;
    tags?: Record<string, string>;
}
export interface CypherExecutionResult {
    rowCount: number;
}
export declare class GraphEngine {
    private readonly circuitBreaker;
    private runWrite;
    private runRead;
    createResource(resource: Resource_Model, scope?: GraphScope): Promise<void>;
    updateResource(id: string, updates: Partial<Resource_Model>, scope?: GraphScope): Promise<void>;
    deleteResource(id: string, scope?: GraphScope): Promise<void>;
    getResource(id: string, scope?: GraphScope): Promise<Resource_Model | null>;
    listResources(filters?: ResourceFilters, scope?: GraphScope): Promise<Resource_Model[]>;
    createRelationship(from: string, to: string, type: RelationshipType, props?: Record<string, unknown>, scope?: GraphScope): Promise<void>;
    deleteRelationship(from: string, to: string, type: RelationshipType, scope?: GraphScope): Promise<void>;
    getRelationships(resourceId: string, scope?: GraphScope): Promise<Relationship[]>;
    executeCypher(query: string, parameters?: Record<string, unknown>, mode?: 'read' | 'write', scope?: GraphScope): Promise<CypherExecutionResult>;
}
//# sourceMappingURL=engine.d.ts.map