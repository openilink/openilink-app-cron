# @openilink/app-cron

Cron 定时任务工具，支持创建、管理定时任务，到时间自动发送消息给用户。

## 特色

- **零外部依赖** — 仅依赖 better-sqlite3 做持久化
- **标准 Cron 语法** — 支持 5 段 cron 表达式（分 时 日 月 周）
- **自动调度** — 每 30 秒检查到期任务并发送消息
- **任务管理** — 创建、查看、删除、启用、禁用

## 快速开始

```bash
npm install
npm run dev
```

### Docker 部署

```bash
docker-compose up -d
```

## 环境变量

| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `HUB_URL` | 是 | — | OpeniLink Hub 服务地址 |
| `BASE_URL` | 是 | — | 本服务的公网回调地址 |
| `DB_PATH` | 否 | `data/cron.db` | SQLite 数据库文件路径 |
| `PORT` | 否 | `8096` | HTTP 服务端口 |

## 5 个 AI Tools

| 工具名 | 说明 |
|--------|------|
| `create_job` | 创建定时任务 |
| `list_jobs` | 查看任务列表 |
| `delete_job` | 删除指定任务 |
| `enable_job` | 启用任务 |
| `disable_job` | 禁用任务 |

## Cron 表达式

| 表达式 | 含义 |
|--------|------|
| `0 9 * * *` | 每天 09:00 |
| `*/5 * * * *` | 每 5 分钟 |
| `0 9 * * 1` | 每周一 09:00 |
| `0 9,18 * * *` | 每天 09:00 和 18:00 |

## API 路由

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/hub/webhook` | 接收 Hub 推送的事件 |
| `GET` | `/oauth/setup` | 启动 OAuth 安装流程 |
| `GET` | `/oauth/redirect` | OAuth 回调处理 |
| `POST` | `/oauth/redirect` | 模式 2 安装通知 |
| `GET` | `/manifest.json` | 返回应用清单 |
| `GET` | `/health` | 健康检查 |

## License

MIT
