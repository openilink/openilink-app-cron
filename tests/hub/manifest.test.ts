/**
 * 应用清单测试
 */
import { describe, it, expect } from "vitest";
import { manifest } from "../../src/hub/manifest.js";

describe("manifest", () => {
  it("包含必要的 slug 字段", () => {
    expect(manifest.slug).toBe("cron");
  });

  it("包含应用名称", () => {
    expect(manifest.name).toBe("定时任务");
  });

  it("包含图标", () => {
    expect(manifest.icon).toBeTruthy();
    expect(typeof manifest.icon).toBe("string");
  });

  it("包含应用描述", () => {
    expect(manifest.description).toBeTruthy();
    expect(manifest.description).toContain("定时任务");
  });

  it("订阅了 command 事件", () => {
    expect(manifest.events).toContain("command");
  });

  it("events 是字符串数组", () => {
    expect(Array.isArray(manifest.events)).toBe(true);
    for (const event of manifest.events) {
      expect(typeof event).toBe("string");
    }
  });

  it("config_schema 存在", () => {
    expect(manifest.config_schema).toBeDefined();
  });

  it("没有 guide 字段（无需配置）", () => {
    expect(manifest.guide).toBeUndefined();
  });
});
