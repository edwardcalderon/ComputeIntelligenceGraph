export declare enum ActionType {
    CREATE_S3_BUCKET = "CREATE_S3_BUCKET",
    START_EC2_INSTANCE = "START_EC2_INSTANCE",
    STOP_EC2_INSTANCE = "STOP_EC2_INSTANCE",
    DELETE_RESOURCE = "DELETE_RESOURCE"
}
export declare enum Permission {
    READ_RESOURCES = "READ_RESOURCES",
    WRITE_RESOURCES = "WRITE_RESOURCES",
    EXECUTE_ACTIONS = "EXECUTE_ACTIONS",
    ADMIN = "ADMIN"
}
export interface ActionRequest {
    actionType: ActionType;
    resourceId: string;
    params: Record<string, unknown>;
    userId: string;
    confirmed?: boolean;
}
export interface ActionResult {
    success: boolean;
    message: string;
    data?: unknown;
}
export interface AuditLogEntry {
    timestamp: Date;
    userId: string;
    actionType: ActionType;
    resourceId: string;
    result: 'success' | 'failure' | 'denied' | 'pending_confirmation';
    message: string;
}
export declare const DESTRUCTIVE_ACTIONS: Set<ActionType>;
export declare class ActionExecutor {
    private userPermissions;
    private auditLog;
    constructor(userPermissions: Set<Permission>);
    execute(request: ActionRequest): Promise<ActionResult>;
    getAuditLog(): AuditLogEntry[];
    private log;
    private handleCreateS3Bucket;
    private handleStartEc2Instance;
    private handleStopEc2Instance;
    private handleDeleteResource;
}
//# sourceMappingURL=openfang.d.ts.map