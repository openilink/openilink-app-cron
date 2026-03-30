/**
 * SQLite 持久化存储层（基于 better-sqlite3）
 */

import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import type { Installation } from "./hub/types.js";

/** Cron 任务记录 */
export interface CronJob {
  /** 任务 ID */
  id: number;
  /** 安装实例 ID */
  installationId: string;
  /** 创建者用户 ID */
  userId: string;
  /** 任务名称 */
  name: string;
  /** Cron 表达式 */
  cronExpr: string;
  /** 到时间发送给用户的消息 */
  message: string;
  /** 是否启用（0/1） */
  enabled: number;
  /** 上次执行时间（unix 秒） */
  lastRun: number | null;
  /** 下次执行时间（unix 秒） */
  nextRun: number;
  /** 创建时间 */
  createdAt: string;
}

/** 数据库存储管理器 */
export class Store {
  private db: Database.Database;

  constructor(dbPath: string) {
    // 内存数据库不需要创建目录
    if (dbPath !== ":memory:") {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.initTables();
  }

  /** 创建所需的数据表 */
  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS installations (
        id            TEXT PRIMARY KEY,
        hub_url       TEXT NOT NULL,
        app_id        TEXT NOT NULL,
        bot_id        TEXT NOT NULL,
        app_token     TEXT NOT NULL,
        webhook_secret TEXT NOT NULL,
        created_at    TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS cron_jobs (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        installation_id TEXT NOT NULL,
        user_id         TEXT NOT NULL,
        name            TEXT NOT NULL,
        cron_expr       TEXT NOT NULL,
        message         TEXT NOT NULL,
        enabled         INTEGER NOT NULL DEFAULT 1,
        last_run        INTEGER,
        next_run        INTEGER NOT NULL,
        created_at      TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_cron_jobs_next_run
        ON cron_jobs(next_run) WHERE enabled = 1;

      CREATE INDEX IF NOT EXISTS idx_cron_jobs_user
        ON cron_jobs(installation_id, user_id);
    `);
  }

  // ─── 安装记录操作 ─────────────────────────────────────────

  /** 保存或更新安装记录 */
  saveInstallation(inst: Installation): void {
    const stmt = this.db.prepare(`
      INSERT INTO installations (id, hub_url, app_id, bot_id, app_token, webhook_secret, created_at)
      VALUES (@id, @hubUrl, @appId, @botId, @appToken, @webhookSecret, @createdAt)
      ON CONFLICT(id) DO UPDATE SET
        hub_url        = excluded.hub_url,
        app_id         = excluded.app_id,
        bot_id         = excluded.bot_id,
        app_token      = excluded.app_token,
        webhook_secret = excluded.webhook_secret
    `);
    stmt.run({
      id: inst.id,
      hubUrl: inst.hubUrl,
      appId: inst.appId,
      botId: inst.botId,
      appToken: inst.appToken,
      webhookSecret: inst.webhookSecret,
      createdAt: inst.createdAt || new Date().toISOString(),
    });
  }

  /** 根据 ID 获取单条安装记录 */
  getInstallation(id: string): Installation | undefined {
    const row = this.db
      .prepare("SELECT * FROM installations WHERE id = ?")
      .get(id) as Record<string, string> | undefined;

    if (!row) return undefined;
    return this.rowToInstallation(row);
  }

  /** 获取所有安装记录 */
  getAllInstallations(): Installation[] {
    const rows = this.db
      .prepare("SELECT * FROM installations ORDER BY created_at DESC")
      .all() as Record<string, string>[];

    return rows.map((row) => this.rowToInstallation(row));
  }

  /** 将数据库行映射为 Installation 对象 */
  private rowToInstallation(row: Record<string, string>): Installation {
    return {
      id: row.id,
      hubUrl: row.hub_url,
      appId: row.app_id,
      botId: row.bot_id,
      appToken: row.app_token,
      webhookSecret: row.webhook_secret,
      createdAt: row.created_at,
    };
  }

  // ─── Cron 任务操作 ─────────────────────────────────────────

  /** 创建定时任务 */
  createCronJob(job: {
    installationId: string;
    userId: string;
    name: string;
    cronExpr: string;
    message: string;
    nextRun: number;
  }): CronJob {
    const stmt = this.db.prepare(`
      INSERT INTO cron_jobs (installation_id, user_id, name, cron_expr, message, enabled, next_run)
      VALUES (@installationId, @userId, @name, @cronExpr, @message, 1, @nextRun)
    `);
    const result = stmt.run(job);
    return this.getCronJob(Number(result.lastInsertRowid))!;
  }

  /** 根据 ID 获取定时任务（内部使用，不校验归属） */
  getCronJob(id: number): CronJob | undefined;
  /** 根据 ID + 安装实例 + 用户获取定时任务（tool handler 使用，校验归属） */
  getCronJob(id: number, installationId: string, userId: string): CronJob | undefined;
  getCronJob(id: number, installationId?: string, userId?: string): CronJob | undefined {
    let row: Record<string, any> | undefined;
    if (installationId && userId) {
      // 带归属校验的查询
      row = this.db
        .prepare("SELECT * FROM cron_jobs WHERE id = ? AND installation_id = ? AND user_id = ?")
        .get(id, installationId, userId) as Record<string, any> | undefined;
    } else {
      row = this.db
        .prepare("SELECT * FROM cron_jobs WHERE id = ?")
        .get(id) as Record<string, any> | undefined;
    }

    if (!row) return undefined;
    return this.rowToCronJob(row);
  }

  /** 获取某个用户在某个安装实例下的所有定时任务 */
  listCronJobs(installationId: string, userId: string): CronJob[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM cron_jobs WHERE installation_id = ? AND user_id = ? ORDER BY created_at DESC",
      )
      .all(installationId, userId) as Record<string, any>[];

    return rows.map((row) => this.rowToCronJob(row));
  }

  /** 删除定时任务 */
  deleteCronJob(id: number, installationId: string, userId: string): boolean {
    const result = this.db
      .prepare("DELETE FROM cron_jobs WHERE id = ? AND installation_id = ? AND user_id = ?")
      .run(id, installationId, userId);
    return result.changes > 0;
  }

  /** 启用定时任务 */
  enableCronJob(id: number, installationId: string, userId: string, nextRun: number): boolean {
    const result = this.db
      .prepare(
        "UPDATE cron_jobs SET enabled = 1, next_run = ? WHERE id = ? AND installation_id = ? AND user_id = ?",
      )
      .run(nextRun, id, installationId, userId);
    return result.changes > 0;
  }

  /** 禁用定时任务 */
  disableCronJob(id: number, installationId: string, userId: string): boolean {
    const result = this.db
      .prepare(
        "UPDATE cron_jobs SET enabled = 0 WHERE id = ? AND installation_id = ? AND user_id = ?",
      )
      .run(id, installationId, userId);
    return result.changes > 0;
  }

  /** 查询所有到期且启用的任务（next_run <= now） */
  getDueCronJobs(nowUnix: number): CronJob[] {
    const rows = this.db
      .prepare("SELECT * FROM cron_jobs WHERE enabled = 1 AND next_run <= ?")
      .all(nowUnix) as Record<string, any>[];

    return rows.map((row) => this.rowToCronJob(row));
  }

  /** 更新任务的 last_run 和 next_run */
  updateCronJobRun(id: number, lastRun: number, nextRun: number): void {
    this.db
      .prepare("UPDATE cron_jobs SET last_run = ?, next_run = ? WHERE id = ?")
      .run(lastRun, nextRun, id);
  }

  /** 将数据库行映射为 CronJob 对象 */
  private rowToCronJob(row: Record<string, any>): CronJob {
    return {
      id: row.id,
      installationId: row.installation_id,
      userId: row.user_id,
      name: row.name,
      cronExpr: row.cron_expr,
      message: row.message,
      enabled: row.enabled,
      lastRun: row.last_run,
      nextRun: row.next_run,
      createdAt: row.created_at,
    };
  }

  /** 关闭数据库连接 */
  close(): void {
    this.db.close();
  }
}
