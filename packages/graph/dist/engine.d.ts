import { Resource_Model, Relationship, RelationshipType, ResourceType, Provider, ResourceState } from './types';
export interface ResourceFilters {
    type?: ResourceType;
    provider?: Provider;
    region?: string;
    state?: ResourceState;
    tags?: Record<string, string>;
}
export declare class GraphEngine {
    private readonly circuitBreaker;
    private runWrite;
    private runRead;
    createResource(resource: Resource_Model): Promise<void>;
    updateResource(id: string, updates: Partial<Resource_Model>): Promise<void>;
    deleteResource(id: string): Promise<void>;
    getResource(id: string): Promise<Resource_Model | null>;
    listResources(filters?: ResourceFilters): Promise<Resource_Model[]>;
    createRelationship(from: string, to: string, type: RelationshipType, props?: Record<string, unknown>): Promise<void>;
    deleteRelationship(from: string, to: string, type: RelationshipType): Promise<void>;
    getRelationships(resourceId: string): Promise<Relationship[]>;
}
//# sourceMappingURL=engine.d.ts.map