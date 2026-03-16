import { Resource_Model } from './types';
import { ResourceFilters } from './engine';
export interface PaginationOptions {
    limit?: number;
    offset?: number;
}
export interface PagedResult<T> {
    items: T[];
    total: number;
    hasMore: boolean;
}
export interface Cycle {
    nodes: string[];
    edges: string[];
}
export declare class GraphQueryEngine {
    /**
     * Returns all resources that the given resource depends on, up to `depth` levels.
     * Depth is capped at 3. Requirements: 8.3, 8.4
     */
    getDependencies(resourceId: string, depth?: number): Promise<Resource_Model[]>;
    /**
     * Returns all resources that depend on the given resource, up to `depth` levels.
     * Requirements: 8.5
     */
    getDependents(resourceId: string, depth?: number): Promise<Resource_Model[]>;
    /**
     * Returns resources that no other resource depends on (leaf/orphan resources).
     * Requirements: 8.6
     */
    findUnusedResources(): Promise<Resource_Model[]>;
    /**
     * Detects circular dependency cycles in the graph.
     * Uses manual Cypher cycle detection via path matching.
     * Requirements: 8.7
     */
    findCircularDependencies(): Promise<Cycle[]>;
    /**
     * Full-text search across resource names and metadata.
     * Requirements: 8.8
     */
    searchResources(query: string): Promise<Resource_Model[]>;
    /**
     * Lists resources with optional filters and pagination.
     * Requirements: 8.9, 8.10, 24.8
     */
    listResourcesPaged(filters?: ResourceFilters, pagination?: PaginationOptions): Promise<PagedResult<Resource_Model>>;
    /**
     * Returns resource counts grouped by type.
     * Requirements: 8.9
     */
    getResourceCounts(): Promise<Record<string, number>>;
}
//# sourceMappingURL=queries.d.ts.map