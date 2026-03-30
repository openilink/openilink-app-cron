/**
 * Cron 表达式解析器测试
 */
import { describe, it, expect } from "vitest";
import { getNextRun, matchesCron, isValidCron, describeCron } from "../../src/utils/cron-parser.js";

describe("matchesCron", () => {
  it("匹配 '0 9 * * *' — 每天 09:00", () => {
    // 2025-01-15 09:00 (周三)
    const date = new Date(2025, 0, 15, 9, 0, 0);
    expect(matchesCron("0 9 * * *", date)).toBe(true);
  });

  it("不匹配 '0 9 * * *' — 09:30", () => {
    const date = new Date(2025, 0, 15, 9, 30, 0);
    expect(matchesCron("0 9 * * *", date)).toBe(false);
  });

  it("匹配 '*/5 * * * *' — 每 5 分钟", () => {
    const date = new Date(2025, 0, 15, 14, 15, 0);
    expect(matchesCron("*/5 * * * *", date)).toBe(true);
  });

  it("不匹配 '*/5 * * * *' — 第 3 分钟", () => {
    const date = new Date(2025, 0, 15, 14, 3, 0);
    expect(matchesCron("*/5 * * * *", date)).toBe(false);
  });

  it("匹配 '0 9 * * 1' — 周一 09:00", () => {
    // 2025-01-13 是周一
    const date = new Date(2025, 0, 13, 9, 0, 0);
    expect(matchesCron("0 9 * * 1", date)).toBe(true);
  });

  it("不匹配 '0 9 * * 1' — 周二 09:00", () => {
    // 2025-01-14 是周二
    const date = new Date(2025, 0, 14, 9, 0, 0);
    expect(matchesCron("0 9 * * 1", date)).toBe(false);
  });

  it("匹配 '0 9,18 * * *' — 09:00", () => {
    const date = new Date(2025, 0, 15, 9, 0, 0);
    expect(matchesCron("0 9,18 * * *", date)).toBe(true);
  });

  it("匹配 '0 9,18 * * *' — 18:00", () => {
    const date = new Date(2025, 0, 15, 18, 0, 0);
    expect(matchesCron("0 9,18 * * *", date)).toBe(true);
  });

  it("不匹配 '0 9,18 * * *' — 12:00", () => {
    const date = new Date(2025, 0, 15, 12, 0, 0);
    expect(matchesCron("0 9,18 * * *", date)).toBe(false);
  });
});

describe("getNextRun", () => {
  it("计算 '0 9 * * *' 的下次执行时间", () => {
    // 从 2025-01-15 08:30 开始
    const after = new Date(2025, 0, 15, 8, 30, 0);
    const next = getNextRun("0 9 * * *", after);

    expect(next.getHours()).toBe(9);
    expect(next.getMinutes()).toBe(0);
    expect(next.getDate()).toBe(15);
  });

  it("已过当天时间则跳到第二天", () => {
    // 从 2025-01-15 10:00 开始
    const after = new Date(2025, 0, 15, 10, 0, 0);
    const next = getNextRun("0 9 * * *", after);

    expect(next.getHours()).toBe(9);
    expect(next.getMinutes()).toBe(0);
    expect(next.getDate()).toBe(16);
  });

  it("计算 '*/5 * * * *' 的下次执行时间", () => {
    // 从 2025-01-15 14:03 开始
    const after = new Date(2025, 0, 15, 14, 3, 0);
    const next = getNextRun("*/5 * * * *", after);

    expect(next.getMinutes()).toBe(5);
    expect(next.getHours()).toBe(14);
  });

  it("计算 '0 9 * * 1' 的下次执行时间（跳到下周一）", () => {
    // 2025-01-15 是周三
    const after = new Date(2025, 0, 15, 10, 0, 0);
    const next = getNextRun("0 9 * * 1", after);

    expect(next.getDay()).toBe(1); // 周一
    expect(next.getHours()).toBe(9);
    expect(next.getDate()).toBe(20); // 下周一
  });

  it("计算 '0 9,18 * * *' 的下次执行时间", () => {
    // 从 2025-01-15 10:00 开始
    const after = new Date(2025, 0, 15, 10, 0, 0);
    const next = getNextRun("0 9,18 * * *", after);

    expect(next.getHours()).toBe(18);
    expect(next.getMinutes()).toBe(0);
    expect(next.getDate()).toBe(15);
  });
});

describe("isValidCron", () => {
  it("合法的 cron 表达式返回 true", () => {
    expect(isValidCron("0 9 * * *")).toBe(true);
    expect(isValidCron("*/5 * * * *")).toBe(true);
    expect(isValidCron("0 9 * * 1")).toBe(true);
    expect(isValidCron("0 9,18 * * *")).toBe(true);
    expect(isValidCron("30 12 15 * *")).toBe(true);
  });

  it("非法的 cron 表达式返回 false", () => {
    expect(isValidCron("")).toBe(false);
    expect(isValidCron("* * *")).toBe(false);
    expect(isValidCron("60 * * * *")).toBe(false);
    expect(isValidCron("* 25 * * *")).toBe(false);
    expect(isValidCron("abc")).toBe(false);
    expect(isValidCron("0 9 * * 8")).toBe(false);
  });
});

describe("describeCron", () => {
  it("描述 '0 9 * * *'", () => {
    const desc = describeCron("0 9 * * *");
    expect(desc).toContain("09:00");
  });

  it("描述 '0 9,18 * * *'", () => {
    const desc = describeCron("0 9,18 * * *");
    expect(desc).toContain("09:00");
    expect(desc).toContain("18:00");
  });

  it("描述 '0 9 * * 1'", () => {
    const desc = describeCron("0 9 * * 1");
    expect(desc).toContain("周一");
    expect(desc).toContain("09:00");
  });
});
