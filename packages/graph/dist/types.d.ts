export declare enum ResourceType {
    COMPUTE = "compute",
    STORAGE = "storage",
    NETWORK = "network",
    DATABASE = "database",
    SERVICE = "service",
    FUNCTION = "function",
    CONTAINER = "container",
    VOLUME = "volume"
}
export declare enum Provider {
    AWS = "aws",
    GCP = "gcp",
    KUBERNETES = "kubernetes",
    DOCKER = "docker"
}
export declare enum ResourceState {
    RUNNING = "running",
    STOPPED = "stopped",
    TERMINATED = "terminated",
    ACTIVE = "active",
    INACTIVE = "inactive",
    PENDING = "pending",
    FAILED = "failed"
}
export declare enum RelationshipType {
    DEPENDS_ON = "DEPENDS_ON",
    CONNECTS_TO = "CONNECTS_TO",
    USES = "USES",
    MEMBER_OF = "MEMBER_OF",
    HAS_PERMISSION = "HAS_PERMISSION",
    MOUNTS = "MOUNTS",
    ROUTES_TO = "ROUTES_TO"
}
export interface Resource_Model {
    id: string;
    name: string;
    type: ResourceType;
    provider: Provider;
    region?: string;
    zone?: string;
    state: ResourceState;
    tags: Record<string, string>;
    metadata: Record<string, unknown>;
    cost?: number;
    createdAt: Date;
    updatedAt: Date;
    discoveredAt: Date;
}
export interface Relationship {
    id: string;
    type: RelationshipType;
    fromId: string;
    toId: string;
    properties: Record<string, unknown>;
}
//# sourceMappingURL=types.d.ts.map