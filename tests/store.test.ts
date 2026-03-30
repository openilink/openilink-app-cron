/**
 * Store 持久化层测试
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Store } from "../src/store.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("Store", () => {
  let store: Store;
  let dbPath: string;

  beforeEach(() => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cron-store-test-"));
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

  describe("saveInstallation / getInstallation", () => {
    it("保存并读取安装记录", () => {
      const inst = {
        id: "inst-001",
        hubUrl: "https://hub.example.com",
        appId: "app-001",
        botId: "bot-001",
        appToken: "token-001",
        webhookSecret: "secret-001",
        createdAt: "2025-01-01T00:00:00.000Z",
      };

      store.saveInstallation(inst);
      const result = store.getInstallation("inst-001");

      expect(result).toBeDefined();
      expect(result!.id).toBe("inst-001");
      expect(result!.hubUrl).toBe("https://hub.example.com");
      expect(result!.appToken).toBe("token-001");
    });

    it("查询不存在的安装记录返回 undefined", () => {
      const result = store.getInstallation("nonexistent");
      expect(result).toBeUndefined();
    });

    it("更新已有的安装记录", () => {
      const inst = {
        id: "inst-001",
        hubUrl: "https://hub.example.com",
        appId: "app-001",
        botId: "bot-001",
        appToken: "old-token",
        webhookSecret: "old-secret",
      };

      store.saveInstallation(inst);
      store.saveInstallation({ ...inst, appToken: "new-token", webhookSecret: "new-secret" });

      const result = store.getInstallation("inst-001");
      expect(result!.appToken).toBe("new-token");
      expect(result!.webhookSecret).toBe("new-secret");
    });
  });

  describe("getAllInstallations", () => {
    it("返回所有安装记录", () => {
      store.saveInstallation({
        id: "inst-001", hubUrl: "https://hub.test", appId: "app-001",
        botId: "bot-001", appToken: "t1", webhookSecret: "s1",
      });
      store.saveInstallation({
        id: "inst-002", hubUrl: "https://hub.test", appId: "app-002",
        botId: "bot-002", appToken: "t2", webhookSecret: "s2",
      });

      const all = store.getAllInstallations();
      expect(all).toHaveLength(2);
    });

    it("空数据库返回空数组", () => {
      const all = store.getAllInstallations();
      expect(all).toEqual([]);
    });
  });

  describe("CronJob 操作", () => {
    it("创建并读取定时任务", () => {
      const job = store.createCronJob({
        installationId: "inst-001",
        userId: "user-001",
        name: "每日提醒",
        cronExpr: "0 9 * * *",
        message: "该起床了！",
        nextRun: 1700000000,
      });

      expect(job.id).toBeGreaterThan(0);
      expect(job.name).toBe("每日提醒");
      expect(job.cronExpr).toBe("0 9 * * *");
      expect(job.message).toBe("该起床了！");
      expect(job.enabled).toBe(1);
      expect(job.nextRun).toBe(1700000000);
      expect(job.lastRun).toBeNull();

      const fetched = store.getCronJob(job.id);
      expect(fetched).toBeDefined();
      expect(fetched!.name).toBe("每日提醒");
    });

    it("列出用户的所有任务", () => {
      store.createCronJob({
        installationId: "inst-001", userId: "user-001",
        name: "任务1", cronExpr: "0 9 * * *", message: "msg1", nextRun: 1700000000,
      });
      store.createCronJob({
        installationId: "inst-001", userId: "user-001",
        name: "任务2", cronExpr: "0 18 * * *", message: "msg2", nextRun: 1700000000,
      });
      store.createCronJob({
        installationId: "inst-001", userId: "user-002",
        name: "其他用户的任务", cronExpr: "0 12 * * *", message: "msg3", nextRun: 1700000000,
      });

      const jobs = store.listCronJobs("inst-001", "user-001");
      expect(jobs).toHaveLength(2);
    });

    it("删除定时任务", () => {
      const job = store.createCronJob({
        installationId: "inst-001", userId: "user-001",
        name: "待删除", cronExpr: "0 9 * * *", message: "msg", nextRun: 1700000000,
      });

      const deleted = store.deleteCronJob(job.id, "inst-001", "user-001");
      expect(deleted).toBe(true);

      const fetched = store.getCronJob(job.id);
      expect(fetched).toBeUndefined();
    });

    it("不能删除其他用户的任务", () => {
      const job = store.createCronJob({
        installationId: "inst-001", userId: "user-001",
        name: "别人的", cronExpr: "0 9 * * *", message: "msg", nextRun: 1700000000,
      });

      const deleted = store.deleteCronJob(job.id, "inst-001", "user-002");
      expect(deleted).toBe(false);
    });

    it("启用和禁用任务", () => {
      const job = store.createCronJob({
        installationId: "inst-001", userId: "user-001",
        name: "切换状态", cronExpr: "0 9 * * *", message: "msg", nextRun: 1700000000,
      });

      // 禁用
      const disabled = store.disableCronJob(job.id, "inst-001", "user-001");
      expect(disabled).toBe(true);
      expect(store.getCronJob(job.id)!.enabled).toBe(0);

      // 启用
      const enabled = store.enableCronJob(job.id, "inst-001", "user-001", 1700001000);
      expect(enabled).toBe(true);
      const updated = store.getCronJob(job.id)!;
      expect(updated.enabled).toBe(1);
      expect(updated.nextRun).toBe(1700001000);
    });

    it("查询到期任务", () => {
      store.createCronJob({
        installationId: "inst-001", userId: "user-001",
        name: "已到期", cronExpr: "0 9 * * *", message: "msg1", nextRun: 1000,
      });
      store.createCronJob({
        installationId: "inst-001", userId: "user-001",
        name: "未到期", cronExpr: "0 9 * * *", message: "msg2", nextRun: 9999999999,
      });

      const dueJobs = store.getDueCronJobs(2000);
      expect(dueJobs).toHaveLength(1);
      expect(dueJobs[0].name).toBe("已到期");
    });

    it("更新任务执行时间", () => {
      const job = store.createCronJob({
        installationId: "inst-001", userId: "user-001",
        name: "更新执行时间", cronExpr: "0 9 * * *", message: "msg", nextRun: 1700000000,
      });

      store.updateCronJobRun(job.id, 1700000000, 1700086400);
      const updated = store.getCronJob(job.id)!;
      expect(updated.lastRun).toBe(1700000000);
      expect(updated.nextRun).toBe(1700086400);
    });
  });
});
