/**
 * 定时任务调度器
 *
 * 每 30 秒检查一次到期的任务（next_run <= now 且 enabled=1），
 * 触发时通过 HubClient 发送消息给用户，然后更新 last_run 和 next_run。
 */

import type { Store, CronJob } from "./store.js";
import { HubClient } from "./hub/client.js";
import { getNextRun } from "./utils/cron-parser.js";

/** 检查间隔：30 秒 */
const CHECK_INTERVAL_MS = 30_000;

/** 调度器选项 */
export interface SchedulerOptions {
  /** Store 实例 */
  store: Store;
  /** 可选的发送回调（用于测试覆盖） */
  sendCallback?: (job: CronJob, installation: { hubUrl: string; appToken: string }) => Promise<void>;
}

/**
 * 定时任务调度器
 */
export class Scheduler {
  private store: Store;
  private timer: ReturnType<typeof setInterval> | null = null;
  private sendCallback: (
    job: CronJob,
    installation: { hubUrl: string; appToken: string },
  ) => Promise<void>;

  constructor(opts: SchedulerOptions) {
    this.store = opts.store;
    this.sendCallback = opts.sendCallback ?? this.defaultSendCallback.bind(this);
  }

  /** 启动调度器 */
  start(): void {
    if (this.timer) return;
    console.log("[scheduler] 调度器已启动，检查间隔 30 秒");

    // 启动后立即检查一次
    this.tick().catch((err) => console.error("[scheduler] tick 异常:", err));

    this.timer = setInterval(() => {
      this.tick().catch((err) => console.error("[scheduler] tick 异常:", err));
    }, CHECK_INTERVAL_MS);
  }

  /** 停止调度器 */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log("[scheduler] 调度器已停止");
    }
  }

  /** 单次检查：查询到期任务并触发 */
  async tick(): Promise<void> {
    const nowUnix = Math.floor(Date.now() / 1000);
    const dueJobs = this.store.getDueCronJobs(nowUnix);

    if (dueJobs.length === 0) return;

    console.log(`[scheduler] 发现 ${dueJobs.length} 个到期任务`);

    for (const job of dueJobs) {
      try {
        // 获取安装记录
        const installation = this.store.getInstallation(job.installationId);
        if (!installation) {
          console.warn(`[scheduler] 任务 #${job.id} 的安装记录不存在，跳过`);
          continue;
        }

        // 发送消息给用户
        await this.sendCallback(job, {
          hubUrl: installation.hubUrl,
          appToken: installation.appToken,
        });

        console.log(`[scheduler] 任务 #${job.id}「${job.name}」已触发`);

        // 计算下次执行时间并更新
        const nextRunDate = getNextRun(job.cronExpr, new Date(nowUnix * 1000));
        const nextRunUnix = Math.floor(nextRunDate.getTime() / 1000);
        this.store.updateCronJobRun(job.id, nowUnix, nextRunUnix);
      } catch (err) {
        console.error(`[scheduler] 任务 #${job.id} 执行失败:`, err);
      }
    }
  }

  /** 默认的消息发送回调 */
  private async defaultSendCallback(
    job: CronJob,
    installation: { hubUrl: string; appToken: string },
  ): Promise<void> {
    const client = new HubClient(installation.hubUrl, installation.appToken);
    const text = `⏰ 定时任务「${job.name}」\n\n${job.message}`;
    await client.sendText(job.userId, text);
  }
}
