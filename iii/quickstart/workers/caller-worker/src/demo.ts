import { randomUUID } from 'node:crypto';

export type DemoSource = 'http' | 'cron';
export type DemoStatus = 'queued' | 'processed' | 'completed';

export type DemoJob = {
  job_id: string;
  message: string;
  source: DemoSource;
  status: DemoStatus;
  steps: string[];
  created_at: string;
  updated_at: string;
};

export function createDemoJob(
  message: string,
  source: DemoSource,
  jobId: string = randomUUID(),
  timestamp: string = new Date().toISOString(),
): DemoJob {
  return {
    job_id: jobId,
    message,
    source,
    status: 'queued',
    steps: [source, 'state'],
    created_at: timestamp,
    updated_at: timestamp,
  };
}
