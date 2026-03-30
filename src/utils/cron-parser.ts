// 简单 Cron 表达式解析器
//
// 支持标准 5 段 cron 表达式：分 时 日 月 周
// 支持的语法：
// - 具体值: "0", "9"
// - 通配符: "*"
// - 步进: "*/5" (每 5 单位)
// - 列表: "9,18" (多个值)
//
// 示例:
// - "0 9 * * *"     每天 09:00
// - "*/5 * * * *"   每 5 分钟
// - "0 9 * * 1"     每周一 09:00
// - "0 9,18 * * *"  每天 09:00 和 18:00

/** Cron 表达式解析后的各字段 */
interface CronFields {
  /** 分钟（0-59） */
  minute: number[];
  /** 小时（0-23） */
  hour: number[];
  /** 日期（1-31） */
  dayOfMonth: number[];
  /** 月份（1-12） */
  month: number[];
  /** 星期几（0-6，0 = 周日） */
  dayOfWeek: number[];
}

/**
 * 解析单个 cron 字段
 * @param field 字段字符串（如 "*", "star/5", "9,18", "0"）
 * @param min 字段允许的最小值
 * @param max 字段允许的最大值
 * @returns 匹配的数值数组
 */
function parseField(field: string, min: number, max: number): number[] {
  const values = new Set<number>();

  // 逗号分隔的列表
  const parts = field.split(",");
  for (const part of parts) {
    const trimmed = part.trim();

    if (trimmed === "*") {
      // 通配符：所有值
      for (let i = min; i <= max; i++) {
        values.add(i);
      }
    } else if (trimmed.startsWith("*/")) {
      // 步进表达式：*/N
      const step = parseInt(trimmed.slice(2), 10);
      if (isNaN(step) || step <= 0) {
        throw new Error(`无效的步进值: ${trimmed}`);
      }
      for (let i = min; i <= max; i += step) {
        values.add(i);
      }
    } else {
      // 具体数值
      const num = parseInt(trimmed, 10);
      if (isNaN(num) || num < min || num > max) {
        throw new Error(`无效的 cron 字段值: ${trimmed}（范围 ${min}-${max}）`);
      }
      values.add(num);
    }
  }

  return Array.from(values).sort((a, b) => a - b);
}

/**
 * 解析 cron 表达式为各字段的匹配值数组
 * @param expr 5 段 cron 表达式
 * @returns 解析后的字段信息
 */
function parseCronExpr(expr: string): CronFields {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(`无效的 cron 表达式: "${expr}"（需要 5 个字段: 分 时 日 月 周）`);
  }

  return {
    minute: parseField(parts[0], 0, 59),
    hour: parseField(parts[1], 0, 23),
    dayOfMonth: parseField(parts[2], 1, 31),
    month: parseField(parts[3], 1, 12),
    dayOfWeek: parseField(parts[4], 0, 6),
  };
}

/**
 * 检查给定日期是否匹配 cron 表达式
 * @param expr cron 表达式
 * @param date 要检查的日期
 * @returns 是否匹配
 */
export function matchesCron(expr: string, date: Date): boolean {
  const fields = parseCronExpr(expr);

  const minute = date.getMinutes();
  const hour = date.getHours();
  const dayOfMonth = date.getDate();
  const month = date.getMonth() + 1; // JS 月份从 0 开始
  const dayOfWeek = date.getDay(); // 0 = 周日

  return (
    fields.minute.includes(minute) &&
    fields.hour.includes(hour) &&
    fields.dayOfMonth.includes(dayOfMonth) &&
    fields.month.includes(month) &&
    fields.dayOfWeek.includes(dayOfWeek)
  );
}

/**
 * 计算 cron 表达式的下一次执行时间
 * @param expr cron 表达式
 * @param after 起始时间（默认当前时间）
 * @returns 下一次执行的 Date 对象
 */
export function getNextRun(expr: string, after?: Date): Date {
  const fields = parseCronExpr(expr);

  // 从 after 的下一分钟开始搜索（秒和毫秒归零）
  const start = after ? new Date(after.getTime()) : new Date();
  start.setSeconds(0, 0);
  start.setMinutes(start.getMinutes() + 1);

  // 最多搜索 2 年（约 1051200 分钟），防止死循环
  const maxIterations = 1051200;
  const candidate = new Date(start.getTime());

  for (let i = 0; i < maxIterations; i++) {
    const month = candidate.getMonth() + 1;
    const dayOfMonth = candidate.getDate();
    const dayOfWeek = candidate.getDay();
    const hour = candidate.getHours();
    const minute = candidate.getMinutes();

    if (
      fields.month.includes(month) &&
      fields.dayOfMonth.includes(dayOfMonth) &&
      fields.dayOfWeek.includes(dayOfWeek) &&
      fields.hour.includes(hour) &&
      fields.minute.includes(minute)
    ) {
      return candidate;
    }

    // 前进一分钟
    candidate.setMinutes(candidate.getMinutes() + 1);
  }

  throw new Error(`无法在 2 年内找到匹配 "${expr}" 的执行时间`);
}

/**
 * 验证 cron 表达式是否合法
 * @param expr cron 表达式
 * @returns 是否合法
 */
export function isValidCron(expr: string): boolean {
  try {
    parseCronExpr(expr);
    return true;
  } catch {
    return false;
  }
}

/**
 * 将 cron 表达式转为人类可读的中文描述
 * @param expr cron 表达式
 * @returns 中文描述
 */
export function describeCron(expr: string): string {
  const fields = parseCronExpr(expr);

  const weekDayNames = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

  const parts: string[] = [];

  // 月份
  if (fields.month.length < 12) {
    parts.push(`${fields.month.join(",")} 月`);
  }

  // 星期
  if (fields.dayOfWeek.length < 7) {
    const names = fields.dayOfWeek.map((d) => weekDayNames[d]);
    parts.push(`每${names.join("、")}`);
  }

  // 日期
  if (fields.dayOfMonth.length < 31) {
    parts.push(`${fields.dayOfMonth.join(",")} 日`);
  }

  // 时间
  if (fields.hour.length < 24 && fields.minute.length < 60) {
    const times = fields.hour
      .flatMap((h) =>
        fields.minute.map(
          (m) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
        ),
      );
    parts.push(times.join("、"));
  } else if (fields.minute.length < 60) {
    // 有具体分钟
    const step = fields.minute.length > 1
      ? fields.minute[1] - fields.minute[0]
      : null;
    if (step && fields.minute.every((v, i) => v === i * step)) {
      parts.push(`每 ${step} 分钟`);
    } else {
      parts.push(`${fields.minute.join(",")} 分`);
    }
  }

  return parts.length > 0 ? parts.join(" ") : "每分钟";
}
