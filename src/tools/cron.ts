/**
 * Cron 定时任务工具模块 — 创建、查看、删除、启用、禁用定时任务
 */

import type { ToolModule, ToolDefinition, ToolHandler, ToolModuleDeps } from "../hub/types.js";
import { getNextRun, isValidCron, describeCron } from "../utils/cron-parser.js";
import type { Store, CronJob } from "../store.js";

/** 工具定义 */
const definitions: ToolDefinition[] = [
  {
    name: "create_job",
    description: "创建一个定时任务，到指定时间自动发送消息",
    command: "create_job",
    parameters: {
      name: { type: "string", description: "任务名称", required: true },
      cron: {
        type: "string",
        description: "Cron 表达式（5 段: 分 时 日 月 周），例如 '0 9 * * *' 表示每天 9 点",
        required: true,
      },
      message: { type: "string", description: "到时间发送的消息内容", required: true },
    },
  },
  {
    name: "list_jobs",
    description: "查看当前用户的所有定时任务列表",
    command: "list_jobs",
    parameters: {},
  },
  {
    name: "delete_job",
    description: "删除指定的定时任务",
    command: "delete_job",
    parameters: {
      job_id: { type: "number", description: "任务 ID", required: true },
    },
  },
  {
    name: "enable_job",
    description: "启用指定的定时任务",
    command: "enable_job",
    parameters: {
      job_id: { type: "number", description: "任务 ID", required: true },
    },
  },
  {
    name: "disable_job",
    description: "禁用指定的定时任务",
    command: "disable_job",
    parameters: {
      job_id: { type: "number", description: "任务 ID", required: true },
    },
  },
];

/** 格式化任务信息 */
function formatJob(job: CronJob): string {
  const status = job.enabled ? "启用" : "禁用";
  const lastRunStr = job.lastRun
    ? new Date(job.lastRun * 1000).toLocaleString("zh-CN")
    : "从未执行";
  const nextRunStr = new Date(job.nextRun * 1000).toLocaleString("zh-CN");
  const desc = describeCron(job.cronExpr);

  return [
    `ID: ${job.id}`,
    `名称: ${job.name}`,
    `Cron: ${job.cronExpr}（${desc}）`,
    `消息: ${job.message}`,
    `状态: ${status}`,
    `上次执行: ${lastRunStr}`,
    `下次执行: ${nextRunStr}`,
  ].join("\n");
}

/** 创建处理函数 */
function createHandlers(deps?: ToolModuleDeps): Map<string, ToolHandler> {
  const handlers = new Map<string, ToolHandler>();

  /** 获取 Store 实例 */
  function getStore(): Store {
    if (!deps?.store) {
      throw new Error("Store 未初始化");
    }
    return deps.store;
  }

  // ─── create_job ──────────────────────────────────────────
  handlers.set("create_job", async (ctx) => {
    try {
      const { name, cron, message } = ctx.args;
      if (!name) return "错误：请提供任务名称（name）";
      if (!cron) return "错误：请提供 Cron 表达式（cron）";
      if (!message) return "错误：请提供消息内容（message）";

      const cronStr = String(cron).trim();
      if (!isValidCron(cronStr)) {
        return `错误：无效的 Cron 表达式 "${cronStr}"。格式为 5 段（分 时 日 月 周），例如 "0 9 * * *"`;
      }

      const store = getStore();
      const nextRunDate = getNextRun(cronStr);
      const nextRunUnix = Math.floor(nextRunDate.getTime() / 1000);

      const job = store.createCronJob({
        installationId: ctx.installationId,
        userId: ctx.userId,
        name: String(name),
        cronExpr: cronStr,
        message: String(message),
        nextRun: nextRunUnix,
      });

      return `定时任务创建成功！\n\n${formatJob(job)}`;
    } catch (err: any) {
      return `创建定时任务失败：${err.message}`;
    }
  });

  // ─── list_jobs ───────────────────────────────────────────
  handlers.set("list_jobs", async (ctx) => {
    try {
      const store = getStore();
      const jobs = store.listCronJobs(ctx.installationId, ctx.userId);

      if (jobs.length === 0) {
        return "当前没有任何定时任务。使用 create_job 创建一个新任务。";
      }

      const lines = [`共 ${jobs.length} 个定时任务：`, ""];
      for (const job of jobs) {
        lines.push(formatJob(job));
        lines.push("─".repeat(30));
      }

      return lines.join("\n");
    } catch (err: any) {
      return `查询任务列表失败：${err.message}`;
    }
  });

  // ─── delete_job ──────────────────────────────────────────
  handlers.set("delete_job", async (ctx) => {
    try {
      const { job_id } = ctx.args;
      if (job_id == null) return "错误：请提供任务 ID（job_id）";

      const store = getStore();
      const deleted = store.deleteCronJob(
        Number(job_id),
        ctx.installationId,
        ctx.userId,
      );

      if (!deleted) {
        return `未找到 ID 为 ${job_id} 的任务，或该任务不属于你。`;
      }

      return `定时任务 #${job_id} 已删除。`;
    } catch (err: any) {
      return `删除任务失败：${err.message}`;
    }
  });

  // ─── enable_job ──────────────────────────────────────────
  handlers.set("enable_job", async (ctx) => {
    try {
      const { job_id } = ctx.args;
      if (job_id == null) return "错误：请提供任务 ID（job_id）";

      const store = getStore();
      const job = store.getCronJob(Number(job_id));
      if (!job || job.installationId !== ctx.installationId || job.userId !== ctx.userId) {
        return `未找到 ID 为 ${job_id} 的任务，或该任务不属于你。`;
      }

      if (job.enabled) {
        return `任务 #${job_id}「${job.name}」已经是启用状态。`;
      }

      const nextRunDate = getNextRun(job.cronExpr);
      const nextRunUnix = Math.floor(nextRunDate.getTime() / 1000);
      const updated = store.enableCronJob(
        Number(job_id),
        ctx.installationId,
        ctx.userId,
        nextRunUnix,
      );

      if (!updated) {
        return `启用任务失败，请重试。`;
      }

      const nextRunStr = nextRunDate.toLocaleString("zh-CN");
      return `定时任务 #${job_id}「${job.name}」已启用。\n下次执行时间: ${nextRunStr}`;
    } catch (err: any) {
      return `启用任务失败：${err.message}`;
    }
  });

  // ─── disable_job ─────────────────────────────────────────
  handlers.set("disable_job", async (ctx) => {
    try {
      const { job_id } = ctx.args;
      if (job_id == null) return "错误：请提供任务 ID（job_id）";

      const store = getStore();
      const job = store.getCronJob(Number(job_id));
      if (!job || job.installationId !== ctx.installationId || job.userId !== ctx.userId) {
        return `未找到 ID 为 ${job_id} 的任务，或该任务不属于你。`;
      }

      if (!job.enabled) {
        return `任务 #${job_id}「${job.name}」已经是禁用状态。`;
      }

      const updated = store.disableCronJob(
        Number(job_id),
        ctx.installationId,
        ctx.userId,
      );

      if (!updated) {
        return `禁用任务失败，请重试。`;
      }

      return `定时任务 #${job_id}「${job.name}」已禁用。`;
    } catch (err: any) {
      return `禁用任务失败：${err.message}`;
    }
  });

  return handlers;
}

export const cronTools: ToolModule = { definitions, createHandlers };
