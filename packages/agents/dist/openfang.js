"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActionExecutor = exports.DESTRUCTIVE_ACTIONS = exports.Permission = exports.ActionType = void 0;
var ActionType;
(function (ActionType) {
    ActionType["CREATE_S3_BUCKET"] = "CREATE_S3_BUCKET";
    ActionType["START_EC2_INSTANCE"] = "START_EC2_INSTANCE";
    ActionType["STOP_EC2_INSTANCE"] = "STOP_EC2_INSTANCE";
    ActionType["DELETE_RESOURCE"] = "DELETE_RESOURCE";
})(ActionType || (exports.ActionType = ActionType = {}));
var Permission;
(function (Permission) {
    Permission["READ_RESOURCES"] = "READ_RESOURCES";
    Permission["WRITE_RESOURCES"] = "WRITE_RESOURCES";
    Permission["EXECUTE_ACTIONS"] = "EXECUTE_ACTIONS";
    Permission["ADMIN"] = "ADMIN";
})(Permission || (exports.Permission = Permission = {}));
exports.DESTRUCTIVE_ACTIONS = new Set([
    ActionType.DELETE_RESOURCE,
    ActionType.STOP_EC2_INSTANCE,
]);
class ActionExecutor {
    userPermissions;
    auditLog = [];
    constructor(userPermissions) {
        this.userPermissions = userPermissions;
    }
    async execute(request) {
        if (!this.userPermissions.has(Permission.EXECUTE_ACTIONS) && !this.userPermissions.has(Permission.ADMIN)) {
            const message = 'Permission denied: EXECUTE_ACTIONS permission required.';
            this.log(request, 'denied', message);
            return { success: false, message };
        }
        if (exports.DESTRUCTIVE_ACTIONS.has(request.actionType) && request.confirmed !== true) {
            const message = 'Confirmation required for destructive action. Set confirmed: true to proceed.';
            this.log(request, 'pending_confirmation', message);
            return { success: false, message };
        }
        let result;
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
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            this.log(request, 'failure', message);
            return { success: false, message };
        }
        this.log(request, result.success ? 'success' : 'failure', result.message);
        return result;
    }
    getAuditLog() {
        return this.auditLog;
    }
    log(request, result, message) {
        this.auditLog.push({
            timestamp: new Date(),
            userId: request.userId,
            actionType: request.actionType,
            resourceId: request.resourceId,
            result,
            message,
        });
    }
    async handleCreateS3Bucket(request) {
        const bucketName = request.params.bucketName ?? request.resourceId;
        return { success: true, message: `S3 bucket '${bucketName}' created successfully.`, data: { bucketName } };
    }
    async handleStartEc2Instance(request) {
        return { success: true, message: `EC2 instance '${request.resourceId}' started successfully.`, data: { instanceId: request.resourceId } };
    }
    async handleStopEc2Instance(request) {
        return { success: true, message: `EC2 instance '${request.resourceId}' stopped successfully.`, data: { instanceId: request.resourceId } };
    }
    async handleDeleteResource(request) {
        return { success: true, message: `Resource '${request.resourceId}' deleted successfully.`, data: { resourceId: request.resourceId } };
    }
}
exports.ActionExecutor = ActionExecutor;
//# sourceMappingURL=openfang.js.map