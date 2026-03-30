/**
 * Cron 工具模块测试
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { cronTools } from "../../src/tools/cron.js";
import { Store } from "../../src/store.js";
import type { ToolContext } from "../../src/hub/types.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("cronTools", () => {
  let store: Store;
  let dbPath: string;
  let handlers: Map<string, (ctx: ToolContext) => Promise<string>>;

  /** 构建测试用 ToolContext */
  function makeCtx(args: Record<string, any> = {}): ToolContext {
    return {
      installationId: "inst-001",
      botId: "bot-001",
      userId: "user-001",
      traceId: "trace-001",
      args,
    };
  }

  beforeEach(() => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cron-tools-test-"));
    dbPath = path.join(tmpDir, "test.db");
    store = new Store(dbPath);
    handlers = cronTools.createHandlers({ store });
  });

  afterEach(() => {
    store.close();
    const dir = path.dirname(dbPath);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  describe("definitions", () => {
    it("包含 5 个工具定义", () => {
      expect(cronTools.definitions).toHaveLength(5);
    });

    it("包含所有必要的工具", () => {
      const names = cronTools.definitions.map((d) => d.name);
      expect(names).toContain("create_job");
      expect(names).toContain("list_jobs");
      expect(names).toContain("delete_job");
      expect(names).toContain("enable_job");
      expect(names).toContain("disable_job");
    });
  });

  describe("create_job", () => {
    it("成功创建定时任务", async () => {
      const handler = handlers.get("create_job")!;
      const result = await handler(
        makeCtx({ name: "每日提醒", cron: "0 9 * * *", message: "该起床了！" }),
      );
      expect(result).toContain("创建成功");
      expect(result).toContain("每日提醒");
      expect(result).toContain("0 9 * * *");
    });

    it("缺少参数时返回错误提示", async () => {
      const handler = handlers.get("create_job")!;

      const r1 = await handler(makeCtx({ cron: "0 9 * * *", message: "msg" }));
      expect(r1).toContain("错误");

      const r2 = await handler(makeCtx({ name: "test", message: "msg" }));
      expect(r2).toContain("错误");

      const r3 = await handler(makeCtx({ name: "test", cron: "0 9 * * *" }));
      expect(r3).toContain("错误");
    });

    it("无效 cron 表达式返回错误提示", async () => {
      const handler = handlers.get("create_job")!;
      const result = await handler(
        makeCtx({ name: "错误的", cron: "abc", message: "msg" }),
      );
      expect(result).toContain("无效");
    });
  });

  describe("list_jobs", () => {
    it("没有任务时显示提示", async () => {
      const handler = handlers.get("list_jobs")!;
      const result = await handler(makeCtx());
      expect(result).toContain("没有任何定时任务");
    });

    it("列出用户的所有任务", async () => {
      // 先创建两个任务
      const createHandler = handlers.get("create_job")!;
      await createHandler(makeCtx({ name: "任务1", cron: "0 9 * * *", message: "msg1" }));
      await createHandler(makeCtx({ name: "任务2", cron: "0 18 * * *", message: "msg2" }));

      const handler = handlers.get("list_jobs")!;
      const result = await handler(makeCtx());
      expect(result).toContain("2 个定时任务");
      expect(result).toContain("任务1");
      expect(result).toContain("任务2");
    });
  });

  describe("delete_job", () => {
    it("成功删除任务", async () => {
      // 创建一个任务
      const createHandler = handlers.get("create_job")!;
      await createHandler(makeCtx({ name: "待删除", cron: "0 9 * * *", message: "msg" }));

      // 获取任务 ID
      const jobs = store.listCronJobs("inst-001", "user-001");
      expect(jobs).toHaveLength(1);

      const handler = handlers.get("delete_job")!;
      const result = await handler(makeCtx({ job_id: jobs[0].id }));
      expect(result).toContain("已删除");
    });

    it("删除不存在的任务返回提示", async () => {
      const handler = handlers.get("delete_job")!;
      const result = await handler(makeCtx({ job_id: 999 }));
      expect(result).toContain("未找到");
    });
  });

  describe("enable_job / disable_job", () => {
    it("禁用和启用任务", async () => {
      // 创建任务
      const createHandler = handlers.get("create_job")!;
      await createHandler(makeCtx({ name: "切换", cron: "0 9 * * *", message: "msg" }));

      const jobs = store.listCronJobs("inst-001", "user-001");
      const jobId = jobs[0].id;

      // 禁用
      const disableHandler = handlers.get("disable_job")!;
      const disableResult = await disableHandler(makeCtx({ job_id: jobId }));
      expect(disableResult).toContain("已禁用");

      // 验证状态
      expect(store.getCronJob(jobId)!.enabled).toBe(0);

      // 启用
      const enableHandler = handlers.get("enable_job")!;
      const enableResult = await enableHandler(makeCtx({ job_id: jobId }));
      expect(enableResult).toContain("已启用");

      // 验证状态
      expect(store.getCronJob(jobId)!.enabled).toBe(1);
    });

    it("重复禁用返回提示", async () => {
      const createHandler = handlers.get("create_job")!;
      await createHandler(makeCtx({ name: "test", cron: "0 9 * * *", message: "msg" }));

      const jobs = store.listCronJobs("inst-001", "user-001");
      const jobId = jobs[0].id;

      // 第一次禁用
      const disableHandler = handlers.get("disable_job")!;
      await disableHandler(makeCtx({ job_id: jobId }));

      // 第二次禁用
      const result = await disableHandler(makeCtx({ job_id: jobId }));
      expect(result).toContain("已经是禁用状态");
    });

    it("重复启用返回提示", async () => {
      const createHandler = handlers.get("create_job")!;
      await createHandler(makeCtx({ name: "test", cron: "0 9 * * *", message: "msg" }));

      const jobs = store.listCronJobs("inst-001", "user-001");
      const jobId = jobs[0].id;

      const enableHandler = handlers.get("enable_job")!;
      const result = await enableHandler(makeCtx({ job_id: jobId }));
      expect(result).toContain("已经是启用状态");
    });
  });
});
