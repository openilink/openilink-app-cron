/**
 * 应用清单定义
 *
 * 向 Hub 注册时使用的元信息，包含应用名称、图标、订阅的事件类型等。
 */

/** 应用清单结构 */
export interface AppManifest {
  /** 应用唯一标识（URL 友好） */
  slug: string;
  /** 应用显示名称 */
  name: string;
  /** 应用图标（emoji 或 URL） */
  icon: string;
  /** 应用描述 */
  description: string;
  /** 订阅的事件类型列表 */
  events: string[];
  /** 配置表单 JSON Schema */
  config_schema?: Record<string, unknown>;
  /** 安装引导说明（Markdown） */
  guide?: string;
}

/** Cron 定时任务应用清单 */
export const manifest: AppManifest = {
  slug: "cron",
  name: "定时任务",
  icon: "🔄",
  description: "Cron 定时任务管理，支持创建、查看、启用/禁用定时任务，到时间自动发送消息给用户",
  events: ["command"],
  config_schema: { type: "object", properties: {} },
};
