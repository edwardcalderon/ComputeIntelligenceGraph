import { beforeEach, describe, expect, it, vi } from 'vitest';
import { startBackgroundJobs } from '../index.js';

const jobMocks = vi.hoisted(() => ({
  ensureDemoWorkspaceProvisioned: vi.fn().mockResolvedValue(undefined),
  startHeartbeatMonitor: vi.fn(),
  startSemanticIndexSync: vi.fn(),
  stopHeartbeatMonitor: vi.fn(),
  stopSemanticIndexSync: vi.fn(),
}));

vi.mock('../demo-workspace', () => ({
  ensureDemoWorkspaceProvisioned: jobMocks.ensureDemoWorkspaceProvisioned,
}));

vi.mock('../jobs/heartbeat-monitor', () => ({
  startHeartbeatMonitor: jobMocks.startHeartbeatMonitor,
  stopHeartbeatMonitor: jobMocks.stopHeartbeatMonitor,
}));

vi.mock('../jobs/semantic-index-sync', () => ({
  startSemanticIndexSync: jobMocks.startSemanticIndexSync,
  stopSemanticIndexSync: jobMocks.stopSemanticIndexSync,
}));

describe('startBackgroundJobs', () => {
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    jobMocks.ensureDemoWorkspaceProvisioned.mockClear();
    jobMocks.startHeartbeatMonitor.mockClear();
    jobMocks.startSemanticIndexSync.mockClear();
    jobMocks.stopHeartbeatMonitor.mockClear();
    jobMocks.stopSemanticIndexSync.mockClear();
    logger.info.mockClear();
    logger.warn.mockClear();
    logger.error.mockClear();
    delete process.env.CIG_AUTH_MODE;
  });

  it('starts semantic sync and provisions the demo workspace in managed mode', () => {
    process.env.CIG_AUTH_MODE = 'managed';

    startBackgroundJobs({ log: logger } as never);

    expect(jobMocks.startHeartbeatMonitor).toHaveBeenCalledTimes(1);
    expect(jobMocks.startSemanticIndexSync).toHaveBeenCalledWith(logger);
    expect(jobMocks.ensureDemoWorkspaceProvisioned).toHaveBeenCalledWith(logger);
  });

  it('does not provision the demo workspace outside managed mode', () => {
    process.env.CIG_AUTH_MODE = 'self-hosted';

    startBackgroundJobs({ log: logger } as never);

    expect(jobMocks.startHeartbeatMonitor).toHaveBeenCalledTimes(1);
    expect(jobMocks.startSemanticIndexSync).toHaveBeenCalledWith(logger);
    expect(jobMocks.ensureDemoWorkspaceProvisioned).not.toHaveBeenCalled();
  });
});
