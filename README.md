# @openilink/app-cron

微信定时任务 -- 支持 Cron 调度和自动消息推送，仅依赖 SQLite，零外部依赖。

> **一键安装** -- 前往 [OpeniLink Hub 应用市场](https://hub.openilink.com) 搜索「定时任务」，点击安装即可在微信中使用。

## 功能亮点

- **标准 Cron 语法** -- 支持 5 段 cron 表达式（分 时 日 月 周）
- **自动调度** -- 每 30 秒检查到期任务并发送消息
- **任务管理** -- 创建、查看、删除、启用、禁用一应俱全
- **零外部依赖** -- 仅依赖 better-sqlite3 做持久化

### 常用 Cron 表达式

| 表达式 | 含义 |
|--------|------|
| `0 9 * * *` | 每天 09:00 |
| `*/5 * * * *` | 每 5 分钟 |
| `0 9 * * 1` | 每周一 09:00 |
| `0 9,18 * * *` | 每天 09:00 和 18:00 |

## 使用方式

安装到 Bot 后，直接用微信对话即可：

**自然语言（推荐）**

- "每天早上 8 点给我推送天气"
- "每周一 9 点提醒我写周报"

**命令调用**

- `/create_job --name 天气推送 --cron "0 8 * * *" --message 该看天气了`

**AI 自动调用** -- Hub AI 在多轮对话中会自动判断是否需要调用定时任务功能，无需手动触发。

### AI Tools

| 工具名 | 说明 |
|--------|------|
| `create_job` | 创建定时任务 |
| `list_jobs` | 查看任务列表 |
| `delete_job` | 删除指定任务 |
| `enable_job` | 启用任务 |
| `disable_job` | 禁用任务 |

<details>
<summary><strong>部署与开发</strong></summary>

### 快速开始

```bash
npm install
npm run dev
```

### Docker 部署

```bash
docker-compose up -d
```

### 环境变量

| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `HUB_URL` | 是 | -- | OpeniLink Hub 服务地址 |
| `BASE_URL` | 是 | -- | 本服务的公网回调地址 |
| `DB_PATH` | 否 | `data/cron.db` | SQLite 数据库文件路径 |
| `PORT` | 否 | `8096` | HTTP 服务端口 |

### API 路由

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/hub/webhook` | 接收 Hub 推送的事件 |
| `GET` | `/oauth/setup` | 启动 OAuth 安装流程 |
| `GET` | `/oauth/redirect` | OAuth 回调处理 |
| `POST` | `/oauth/redirect` | 模式 2 安装通知 |
| `GET` | `/manifest.json` | 返回应用清单 |
| `GET` | `/health` | 健康检查 |

</details>

## 安全与隐私

本 App 需要存储定时任务名称和消息内容。所有数据：

- **严格按用户隔离** -- 每条记录绑定 `installation_id` + `user_id`，不同用户之间完全隔离
- **无法跨用户访问** -- 所有查询、删除操作均在 SQL 层面强制过滤用户归属
- **数据存储在 SQLite** -- 数据文件位于 `data/` 目录，不上传到任何云端
- **代码完全开源** -- 接受社区审查

如果您对数据隐私有更高要求，建议自行部署：`docker compose up -d`，所有数据仅存储在您自己的服务器上。

## License

MIT
