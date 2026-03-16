export interface DiscoveryRun {
    id: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    startedAt: Date;
    completedAt?: Date;
    success?: boolean;
    error?: string;
}
export interface CartographyStatus {
    running: boolean;
    run_count: number;
    last_run_start: string | null;
    last_run_end: string | null;
    last_run_success: boolean | null;
    last_error: string | null;
}
export interface CartographyRunResponse {
    status: 'started' | 'already_running';
    timestamp?: string;
}
export interface CartographyRecentRuns {
    total_runs: number;
    last_success: boolean | null;
    last_run: string | null;
}
export interface DiscoveryEvent {
    type: 'resource_discovered' | 'discovery_complete' | 'discovery_failed';
    runId: string;
    timestamp: Date;
    data?: Record<string, unknown>;
}
export interface DiscoveredResource {
    id: string;
    type: string;
    provider: 'aws' | 'gcp' | 'k8s' | 'docker';
    region?: string;
    metadata: Record<string, unknown>;
}
//# sourceMappingURL=types.d.ts.map