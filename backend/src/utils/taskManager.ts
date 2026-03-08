import { createTask, updateTask, getTask, type TaskRow } from "../db/queries/tasks";
import { logger } from "./logger";

export enum TaskType {
  DOCUMENT_PROCESS = "document_process",
  GRAPH_BUILD = "graph_build",
  SIMULATION = "simulation",
  REPORT_GENERATE = "report_generate",
}

export class TaskManager {
  async create(type: TaskType, referenceId: string, ownerId: string): Promise<TaskRow> {
    const task = await createTask(type, referenceId, ownerId);
    logger.info({ taskId: task.id, type }, "Task created");
    return task;
  }
  async start(taskId: string): Promise<void> { await updateTask(taskId, { status: "running", progress: 0 }); }
  async progress(taskId: string, progress: number): Promise<void> { await updateTask(taskId, { progress: Math.min(100, Math.max(0, progress)) }); }
  async complete(taskId: string, result?: Record<string, unknown>): Promise<void> {
    await updateTask(taskId, { status: "completed", progress: 100, result });
    logger.info({ taskId }, "Task completed");
  }
  async fail(taskId: string, error: string): Promise<void> {
    await updateTask(taskId, { status: "failed", error });
    logger.error({ taskId, error }, "Task failed");
  }
  async get(taskId: string): Promise<TaskRow | null> { return getTask(taskId); }
}

let instance: TaskManager | null = null;
export function getTaskManager(): TaskManager {
  if (!instance) instance = new TaskManager();
  return instance;
}
