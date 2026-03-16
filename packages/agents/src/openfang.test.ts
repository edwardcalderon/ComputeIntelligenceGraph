/**
 * Integration tests for ActionExecutor (OpenFang).
 * Validates: Requirements 26.2
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ActionExecutor, ActionType, Permission } from './openfang.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeExecutor(...perms: Permission[]): ActionExecutor {
  return new ActionExecutor(new Set(perms));
}

const BASE_REQUEST = {
  resourceId: 'res-1',
  params: {},
  userId: 'user-1',
};

// ─── Permission validation ────────────────────────────────────────────────────

describe('Permission validation', () => {
  it('returns error when user has no permissions', async () => {
    const executor = makeExecutor();
    const result = await executor.execute({
      ...BASE_REQUEST,
      actionType: ActionType.CREATE_S3_BUCKET,
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('Permission denied');
  });

  it('returns error when user only has READ_RESOURCES', async () => {
    const executor = makeExecutor(Permission.READ_RESOURCES);
    const result = await executor.execute({
      ...BASE_REQUEST,
      actionType: ActionType.CREATE_S3_BUCKET,
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('Permission denied');
  });

  it('succeeds when user has EXECUTE_ACTIONS permission', async () => {
    const executor = makeExecutor(Permission.EXECUTE_ACTIONS);
    const result = await executor.execute({
      ...BASE_REQUEST,
      actionType: ActionType.CREATE_S3_BUCKET,
    });
    expect(result.success).toBe(true);
  });

  it('succeeds when user has ADMIN permission (without EXECUTE_ACTIONS)', async () => {
    const executor = makeExecutor(Permission.ADMIN);
    const result = await executor.execute({
      ...BASE_REQUEST,
      actionType: ActionType.CREATE_S3_BUCKET,
    });
    expect(result.success).toBe(true);
  });

  it('denied actions are logged with result="denied"', async () => {
    const executor = makeExecutor();
    await executor.execute({
      ...BASE_REQUEST,
      actionType: ActionType.CREATE_S3_BUCKET,
    });
    const log = executor.getAuditLog();
    expect(log).toHaveLength(1);
    expect(log[0].result).toBe('denied');
  });
});

// ─── Destructive action confirmation ─────────────────────────────────────────

describe('Destructive action confirmation', () => {
  let executor: ActionExecutor;

  beforeEach(() => {
    executor = makeExecutor(Permission.EXECUTE_ACTIONS);
  });

  it('STOP_EC2_INSTANCE without confirmed=true returns pending_confirmation', async () => {
    const result = await executor.execute({
      ...BASE_REQUEST,
      actionType: ActionType.STOP_EC2_INSTANCE,
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('Confirmation required');
  });

  it('DELETE_RESOURCE without confirmed=true returns pending_confirmation', async () => {
    const result = await executor.execute({
      ...BASE_REQUEST,
      actionType: ActionType.DELETE_RESOURCE,
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('Confirmation required');
  });

  it('STOP_EC2_INSTANCE with confirmed=true executes successfully', async () => {
    const result = await executor.execute({
      ...BASE_REQUEST,
      actionType: ActionType.STOP_EC2_INSTANCE,
      confirmed: true,
    });
    expect(result.success).toBe(true);
    expect(result.message).toContain('stopped successfully');
  });

  it('CREATE_S3_BUCKET (non-destructive) executes without confirmation', async () => {
    const result = await executor.execute({
      ...BASE_REQUEST,
      actionType: ActionType.CREATE_S3_BUCKET,
    });
    expect(result.success).toBe(true);
  });
});

// ─── Action execution ─────────────────────────────────────────────────────────

describe('Action execution', () => {
  let executor: ActionExecutor;

  beforeEach(() => {
    executor = makeExecutor(Permission.EXECUTE_ACTIONS);
  });

  it('CREATE_S3_BUCKET returns success with bucket name', async () => {
    const result = await executor.execute({
      ...BASE_REQUEST,
      actionType: ActionType.CREATE_S3_BUCKET,
      params: { bucketName: 'my-bucket' },
    });
    expect(result.success).toBe(true);
    expect(result.message).toContain('my-bucket');
    expect((result.data as Record<string, unknown>)?.bucketName).toBe('my-bucket');
  });

  it('START_EC2_INSTANCE returns success with instance ID', async () => {
    const result = await executor.execute({
      ...BASE_REQUEST,
      resourceId: 'i-abc123',
      actionType: ActionType.START_EC2_INSTANCE,
    });
    expect(result.success).toBe(true);
    expect(result.message).toContain('i-abc123');
    expect((result.data as Record<string, unknown>)?.instanceId).toBe('i-abc123');
  });

  it('STOP_EC2_INSTANCE with confirmed=true returns success', async () => {
    const result = await executor.execute({
      ...BASE_REQUEST,
      resourceId: 'i-abc123',
      actionType: ActionType.STOP_EC2_INSTANCE,
      confirmed: true,
    });
    expect(result.success).toBe(true);
    expect(result.message).toContain('i-abc123');
  });

  it('DELETE_RESOURCE with confirmed=true returns success', async () => {
    const result = await executor.execute({
      ...BASE_REQUEST,
      resourceId: 'rds-1',
      actionType: ActionType.DELETE_RESOURCE,
      confirmed: true,
    });
    expect(result.success).toBe(true);
    expect(result.message).toContain('rds-1');
    expect((result.data as Record<string, unknown>)?.resourceId).toBe('rds-1');
  });
});

// ─── Audit logging ────────────────────────────────────────────────────────────

describe('Audit logging', () => {
  let executor: ActionExecutor;

  beforeEach(() => {
    executor = makeExecutor(Permission.EXECUTE_ACTIONS);
  });

  it('getAuditLog() returns all logged entries', async () => {
    await executor.execute({ ...BASE_REQUEST, actionType: ActionType.CREATE_S3_BUCKET });
    await executor.execute({ ...BASE_REQUEST, actionType: ActionType.START_EC2_INSTANCE });
    expect(executor.getAuditLog()).toHaveLength(2);
  });

  it('each entry has required fields', async () => {
    await executor.execute({ ...BASE_REQUEST, actionType: ActionType.CREATE_S3_BUCKET });
    const entry = executor.getAuditLog()[0];
    expect(entry).toHaveProperty('timestamp');
    expect(entry).toHaveProperty('userId', BASE_REQUEST.userId);
    expect(entry).toHaveProperty('actionType', ActionType.CREATE_S3_BUCKET);
    expect(entry).toHaveProperty('resourceId', BASE_REQUEST.resourceId);
    expect(entry).toHaveProperty('result');
    expect(entry).toHaveProperty('message');
    expect(entry.timestamp).toBeInstanceOf(Date);
  });

  it('multiple actions produce multiple log entries', async () => {
    await executor.execute({ ...BASE_REQUEST, actionType: ActionType.CREATE_S3_BUCKET });
    await executor.execute({ ...BASE_REQUEST, actionType: ActionType.START_EC2_INSTANCE });
    await executor.execute({ ...BASE_REQUEST, actionType: ActionType.STOP_EC2_INSTANCE, confirmed: true });
    expect(executor.getAuditLog()).toHaveLength(3);
  });

  it('denied actions appear in audit log with result="denied"', async () => {
    const noPermsExecutor = makeExecutor();
    await noPermsExecutor.execute({ ...BASE_REQUEST, actionType: ActionType.CREATE_S3_BUCKET });
    const log = noPermsExecutor.getAuditLog();
    expect(log).toHaveLength(1);
    expect(log[0].result).toBe('denied');
    expect(log[0].userId).toBe(BASE_REQUEST.userId);
  });

  it('pending_confirmation actions appear in audit log', async () => {
    await executor.execute({ ...BASE_REQUEST, actionType: ActionType.DELETE_RESOURCE });
    const log = executor.getAuditLog();
    expect(log).toHaveLength(1);
    expect(log[0].result).toBe('pending_confirmation');
  });
});
