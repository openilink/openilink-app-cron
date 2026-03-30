/**
 * Scheduler 定时调度器测试
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Scheduler } from "../src/scheduler.js";
import { Store } from "../src/store.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("Scheduler", () => {
  let store: Store;
  let dbPath: string;

  beforeEach(() => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cron-scheduler-test-"));
    dbPath = path.join(tmpDir, "test.db");
    store = new Store(dbPath);
  });

  afterEach(() => {
    store.close();
    const dir = path.dirname(dbPath);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("tick 触发到期任务并调用 sendCallback", async () => {
    // 创建安装记录
    store.saveInstallation({
      id: "inst-001",
      hubUrl: "https://hub.test",
      appId: "app-001",
      botId: "bot-001",
      appToken: "token-001",
      webhookSecret: "secret-001",
    });

    // 创建一个已到期的任务
    store.createCronJob({
      installationId: "inst-001",
      userId: "user-001",
      name: "已到期",
      cronExpr: "0 9 * * *",
      message: "该起床了！",
      nextRun: Math.floor(Date.now() / 1000) - 100, // 100 秒前到期
    });

    const sendCallback = vi.fn().mockResolvedValue(undefined);
    const scheduler = new Scheduler({ store, sendCallback });

    await scheduler.tick();

    expect(sendCallback).toHaveBeenCalledOnce();
    const [job, installation] = sendCallback.mock.calls[0];
    expect(job.name).toBe("已到期");
    expect(job.message).toBe("该起床了！");
    expect(installation.hubUrl).toBe("https://hub.test");
    expect(installation.appToken).toBe("token-001");

    // 检查 last_run 和 next_run 是否更新
    const updatedJob = store.getCronJob(job.id)!;
    expect(updatedJob.lastRun).toBeGreaterThan(0);
    expect(updatedJob.nextRun).toBeGreaterThan(updatedJob.lastRun!);
  });

  it("tick 不触发未到期的任务", async () => {
    store.saveInstallation({
      id: "inst-001",
      hubUrl: "https://hub.test",
      appId: "app-001",
      botId: "bot-001",
      appToken: "token-001",
      webhookSecret: "secret-001",
    });

    store.createCronJob({
      installationId: "inst-001",
      userId: "user-001",
      name: "未到期",
      cronExpr: "0 9 * * *",
      message: "msg",
      nextRun: Math.floor(Date.now() / 1000) + 86400, // 明天
    });

    const sendCallback = vi.fn().mockResolvedValue(undefined);
    const scheduler = new Scheduler({ store, sendCallback });

    await scheduler.tick();

    expect(sendCallback).not.toHaveBeenCalled();
  });

  it("tick 不触发禁用的任务", async () => {
    store.saveInstallation({
      id: "inst-001",
      hubUrl: "https://hub.test",
      appId: "app-001",
      botId: "bot-001",
      appToken: "token-001",
      webhookSecret: "secret-001",
    });

    const job = store.createCronJob({
      installationId: "inst-001",
      userId: "user-001",
      name: "已禁用",
      cronExpr: "0 9 * * *",
      message: "msg",
      nextRun: Math.floor(Date.now() / 1000) - 100,
    });

    // 禁用任务
    store.disableCronJob(job.id, "inst-001", "user-001");

    const sendCallback = vi.fn().mockResolvedValue(undefined);
    const scheduler = new Scheduler({ store, sendCallback });

    await scheduler.tick();

    expect(sendCallback).not.toHaveBeenCalled();
  });

  it("start 和 stop 正确控制调度器", () => {
    const scheduler = new Scheduler({ store, sendCallback: vi.fn() });

    scheduler.start();
    // 再次 start 不会重复
    scheduler.start();

    scheduler.stop();
    // 再次 stop 不会报错
    scheduler.stop();
  });

  it("tick 跳过没有安装记录的任务", async () => {
    // 创建任务但不创建安装记录
    store.createCronJob({
      installationId: "inst-missing",
      userId: "user-001",
      name: "无安装记录",
      cronExpr: "0 9 * * *",
      message: "msg",
      nextRun: Math.floor(Date.now() / 1000) - 100,
    });

    const sendCallback = vi.fn().mockResolvedValue(undefined);
    const scheduler = new Scheduler({ store, sendCallback });

    // 不应该抛出异常
    await scheduler.tick();

    expect(sendCallback).not.toHaveBeenCalled();
  });
});
