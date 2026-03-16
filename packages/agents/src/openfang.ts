export enum ActionType {
  CREATE_S3_BUCKET = 'CREATE_S3_BUCKET',
  START_EC2_INSTANCE = 'START_EC2_INSTANCE',
  STOP_EC2_INSTANCE = 'STOP_EC2_INSTANCE',
  DELETE_RESOURCE = 'DELETE_RESOURCE',
}

export enum Permission {
  READ_RESOURCES = 'READ_RESOURCES',
  WRITE_RESOURCES = 'WRITE_RESOURCES',
  EXECUTE_ACTIONS = 'EXECUTE_ACTIONS',
  ADMIN = 'ADMIN',
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

export const DESTRUCTIVE_ACTIONS = new Set<ActionType>([
  ActionType.DELETE_RESOURCE,
  ActionType.STOP_EC2_INSTANCE,
]);

export class ActionExecutor {
  private userPermissions: Set<Permission>;
  private auditLog: AuditLogEntry[] = [];

  constructor(userPermissions: Set<Permission>) {
    this.userPermissions = userPermissions;
  }

  async execute(request: ActionRequest): Promise<ActionResult> {
    if (!this.userPermissions.has(Permission.EXECUTE_ACTIONS) && !this.userPermissions.has(Permission.ADMIN)) {
      const message = 'Permission denied: EXECUTE_ACTIONS permission required.';
      this.log(request, 'denied', message);
      return { success: false, message };
    }

    if (DESTRUCTIVE_ACTIONS.has(request.actionType) && request.confirmed !== true) {
      const message = 'Confirmation required for destructive action. Set confirmed: true to proceed.';
      this.log(request, 'pending_confirmation', message);
      return { success: false, message };
    }

    let result: ActionResult;
    try {
      switch (request.actionType) {
        case ActionType.CREATE_S3_BUCKET:
          result = await this.handleCreateS3Bucket(request);
          break;
        case ActionType.START_EC2_INSTANCE:
          result = await this.handleStartEc2Instance(request);
          break;
        case ActionType.STOP_EC2_INSTANCE:
          result = await this.handleStopEc2Instance(request);
          break;
        case ActionType.DELETE_RESOURCE:
          result = await this.handleDeleteResource(request);
          break;
        default:
          result = { success: false, message: `Unknown action type: ${request.actionType}` };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.log(request, 'failure', message);
      return { success: false, message };
    }

    this.log(request, result.success ? 'success' : 'failure', result.message);
    return result;
  }

  getAuditLog(): AuditLogEntry[] {
    return this.auditLog;
  }

  private log(request: ActionRequest, result: AuditLogEntry['result'], message: string): void {
    this.auditLog.push({
      timestamp: new Date(),
      userId: request.userId,
      actionType: request.actionType,
      resourceId: request.resourceId,
      result,
      message,
    });
  }

  private async handleCreateS3Bucket(request: ActionRequest): Promise<ActionResult> {
    const bucketName = (request.params.bucketName as string) ?? request.resourceId;
    return { success: true, message: `S3 bucket '${bucketName}' created successfully.`, data: { bucketName } };
  }

  private async handleStartEc2Instance(request: ActionRequest): Promise<ActionResult> {
    return { success: true, message: `EC2 instance '${request.resourceId}' started successfully.`, data: { instanceId: request.resourceId } };
  }

  private async handleStopEc2Instance(request: ActionRequest): Promise<ActionResult> {
    return { success: true, message: `EC2 instance '${request.resourceId}' stopped successfully.`, data: { instanceId: request.resourceId } };
  }

  private async handleDeleteResource(request: ActionRequest): Promise<ActionResult> {
    return { success: true, message: `Resource '${request.resourceId}' deleted successfully.`, data: { resourceId: request.resourceId } };
  }
}
