# LibreChat 部署架构详细对比

## 当前项目的完整架构分析

### 开发环境架构 (docker-compose.yml)

```
┌────────────────────────────────────────────────────┐
│                    开发环境                         │
└────────────────────────────────────────────────────┘

开发者本地机器:
├─ 前端开发服务器 (Vite)
│  ├─ 端口: 3090 (默认)
│  ├─ 配置: client/vite.config.ts:19
│  ├─ 启动: npm run frontend:dev
│  └─ 代理: /api → http://localhost:3080
│
└─ 后端 API 服务器 (Node.js)
   ├─ 端口: 3080
   ├─ 配置: .env PORT=3080
   ├─ 启动: npm run backend:dev
   └─ 功能: Express API + SSE

Docker 容器 (docker-compose.dev.yml):
├─ MongoDB (chat-mongodb)
│  └─ 端口: 27017 (仅内部访问)
│
├─ Meilisearch (chat-meilisearch)
│  └─ 端口: 7700 (仅内部访问)
│
├─ PostgreSQL + pgvector (vectordb)
│  └─ 端口: 5432 (仅内部访问)
│
└─ RAG API (rag_api)
   └─ 端口: 8000 (仅内部访问)

用户访问:
  http://localhost:3090 (开发服务器,带 HMR)
  http://localhost:3080 (后端 API,可直接访问)
```

**流程图:**
```
┌─────────┐
│ Browser │
│ :3090   │
└────┬────┘
     │ 访问前端
     ▼
┌──────────────┐         /api 请求
│  Vite Dev    │──────────────────┐
│  Server      │                  │
│  (3090)      │                  │
└──────────────┘                  │
                                  ▼
                        ┌──────────────────┐
                        │  Express API     │
                        │  Server (3080)   │
                        └────────┬─────────┘
                                 │
                    ┌────────────┼─────────────┐
                    ▼            ▼             ▼
              ┌─────────┐  ┌──────────┐  ┌────────┐
              │ MongoDB │  │Meilisearch│  │RAG API │
              └─────────┘  └──────────┘  └────────┘
```

---

### 您当前的生产部署架构 (docker-compose.yml + deploy.sh)

```
┌────────────────────────────────────────────────────┐
│              生产环境 (当前方案)                     │
└────────────────────────────────────────────────────┘

服务器 (54.64.181.104):

┌────────────────────────────────────┐
│  LibreChat 容器 (api)              │
│  ├─ 镜像: librechat-local:xxxxxx   │
│  ├─ 端口映射: 3080:3080           │
│  ├─ 包含前端: /app/client/dist    │
│  └─ 包含后端: /app/api            │
└──────────────┬─────────────────────┘
               │
   ┌───────────┼───────────────┐
   ▼           ▼               ▼
┌─────────┐ ┌──────────┐ ┌────────┐
│ MongoDB │ │Meilisearch│ │RAG API │
│(27017)  │ │  (7700)   │ │ (8000) │
└─────────┘ └──────────┘ └────────┘

用户访问:
  http://54.64.181.104:3080 (直接访问 API 容器)
```

**流程图:**
```
┌─────────┐
│ 用户    │
└────┬────┘
     │ http://54.64.181.104:3080
     ▼
┌──────────────────────────────────┐
│  LibreChat Container (API)       │
│  ┌──────────────────────────┐    │
│  │ Node.js Express          │    │
│  │  ├─ 静态: /client/dist   │    │
│  │  └─ API: /api/*          │    │
│  └──────────────────────────┘    │
└──────────────┬───────────────────┘
               │
   ┌───────────┼───────────────┐
   ▼           ▼               ▼
┌─────────┐ ┌──────────┐ ┌────────┐
│ MongoDB │ │Meilisearch│ │RAG API │
└─────────┘ └──────────┘ └────────┘
```

**关键特点:**
- ✅ 简单直接
- ⚠️ 端口 3080 对外暴露
- ⚠️ Node.js 直接服务静态文件
- ⚠️ 无 SSL/TLS 终止层
- ⚠️ 无 Gzip 压缩优化
- ⚠️ 用户需要记住 :3080 端口

---

### 原仓库的生产部署架构 (deploy-compose.yml)

```
┌────────────────────────────────────────────────────┐
│           生产环境 (原仓库标准方案)                  │
└────────────────────────────────────────────────────┘

服务器部署:

┌─────────────────────────────────┐
│  Nginx 容器 (client)            │
│  ├─ 镜像: nginx:1.27.0-alpine   │
│  ├─ 端口: 80:80, 443:443        │
│  ├─ 配置: client/nginx.conf     │
│  └─ 反向代理 → api:3080         │
└──────────────┬──────────────────┘
               │ 内部网络
               ▼
┌─────────────────────────────────┐
│  API 容器 (api)                 │
│  ├─ 镜像: librechat-dev:latest  │
│  ├─ 端口: expose 3080 (仅内部)  │
│  ├─ 包含前端: /app/client/dist  │
│  └─ 包含后端: /app/api          │
└──────────────┬──────────────────┘
               │
   ┌───────────┼───────────────┐
   ▼           ▼               ▼
┌─────────┐ ┌──────────┐ ┌────────┐
│ MongoDB │ │Meilisearch│ │RAG API │
│(内部)   │ │  (内部)   │ │(内部)  │
└─────────┘ └──────────┘ └────────┘

用户访问:
  http://your-server (80端口,标准HTTP)
  https://your-server (443端口,HTTPS + SSL)
```

**流程图:**
```
┌─────────┐
│ 用户    │
└────┬────┘
     │ http://server (80) 或 https://server (443)
     ▼
┌──────────────────────────────────┐
│  Nginx Container                 │
│  ├─ SSL 终止                     │
│  ├─ Gzip 压缩                    │
│  ├─ 静态缓存                     │
│  └─ 反向代理配置:                │
│     location /api/ {             │
│       proxy_pass                 │
│         http://api:3080;         │
│     }                            │
└──────────────┬───────────────────┘
               │ Docker 内部网络
               ▼
┌──────────────────────────────────┐
│  API Container (不对外暴露)      │
│  ├─ Express API                  │
│  └─ 静态文件: /client/dist       │
└──────────────┬───────────────────┘
               │
   ┌───────────┼───────────────┐
   ▼           ▼               ▼
┌─────────┐ ┌──────────┐ ┌────────┐
│ MongoDB │ │Meilisearch│ │RAG API │
└─────────┘ └──────────┘ └────────┘
```

**关键特点:**
- ✅ 标准 HTTP/HTTPS 端口 (80/443)
- ✅ SSL/TLS 由 Nginx 处理
- ✅ Gzip 压缩和静态缓存
- ✅ API 端口不对外暴露 (安全)
- ✅ 负载均衡能力
- ✅ 符合行业最佳实践

---

## 详细对比表

| 维度 | 当前方案 | 原仓库方案 | 推荐 |
|------|----------|-----------|------|
| **对外端口** | 3080 | 80/443 | ✅ 原仓库 |
| **用户体验** | 需要记住 :3080 | 标准端口,无需端口号 | ✅ 原仓库 |
| **SSL/TLS** | 需要在 Node.js 配置 | Nginx 统一管理 | ✅ 原仓库 |
| **Gzip 压缩** | 需要 Node.js 处理 | Nginx 高效压缩 | ✅ 原仓库 |
| **静态文件服务** | Node.js Express | Nginx (性能更好) | ✅ 原仓库 |
| **安全性** | 3080 端口暴露 | 仅 Nginx 暴露 | ✅ 原仓库 |
| **负载均衡** | 不支持 | Nginx 支持 | ✅ 原仓库 |
| **容器数量** | 5个 (api+4个依赖) | 6个 (多1个nginx) | 中性 |
| **部署复杂度** | 简单 | 略复杂 | ⚠️ 当前方案 |
| **运维成本** | 低 | 中等 | ⚠️ 当前方案 |

---

## Nginx 配置详解

### client/nginx.conf 的工作原理

```nginx
server {
    listen 80;

    # 1. API 请求代理到后端
    location /api/ {
        proxy_pass http://api:3080$request_uri;
        # api:3080 是 Docker 内部网络地址
    }

    # 2. 其他所有请求也代理到后端
    location / {
        proxy_pass http://api:3080/;
        # 因为前端已打包进 API 容器的 /app/client/dist
    }
}
```

**为什么前端也要代理到后端?**
- 前端在构建时已经打包到 API 容器的 `/app/client/dist`
- API 容器的 Express 配置了静态文件服务
- Nginx 只是一个**统一的入口**,所有请求都转发给 API 容器

### API 容器的 Express 静态服务配置

参考 `api/server/index.js`:
```javascript
app.use(express.static(path.join(__dirname, '../client/dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});
```

---

## 端口总结

### 开发环境端口
| 服务 | 端口 | 对外暴露 | 用途 |
|------|------|---------|------|
| Vite Dev | 3090 | ✅ | 前端开发服务器 (HMR) |
| API | 3080 | ✅ | 后端开发服务器 |
| MongoDB | 27017 | ❌ | 数据库 (仅内部) |
| Meilisearch | 7700 | ❌ | 搜索引擎 (仅内部) |
| RAG API | 8000 | ❌ | 向量检索 (仅内部) |

### 生产环境端口 (当前方案)
| 服务 | 端口 | 对外暴露 | 用途 |
|------|------|---------|------|
| API (含前端) | 3080 | ✅ | 唯一入口 |
| MongoDB | 27017 | ❌ | 数据库 (仅内部) |
| Meilisearch | 7700 | ❌ | 搜索引擎 (仅内部) |
| RAG API | 8000 | ❌ | 向量检索 (仅内部) |

### 生产环境端口 (原仓库方案)
| 服务 | 端口 | 对外暴露 | 用途 |
|------|------|---------|------|
| Nginx | 80, 443 | ✅ | 唯一对外入口 |
| API | 3080 | ❌ | 仅内部访问 |
| MongoDB | 27017 | ❌ | 数据库 (仅内部) |
| Meilisearch | 7700 | ❌ | 搜索引擎 (仅内部) |
| RAG API | 8000 | ❌ | 向量检索 (仅内部) |

---

## 构建流程对比

### Dockerfile.multi 多阶段构建

```dockerfile
# Stage 1: 基础依赖
FROM node:20-alpine AS base
RUN npm ci

# Stage 2-5: 构建各个 package
FROM base AS data-provider-build
FROM base AS data-schemas-build
FROM base AS api-package-build
FROM base AS client-package-build

# Stage 6: 构建前端 (client-build)
FROM base AS client-build
COPY --from=data-provider-build ...
COPY --from=client-package-build ...
RUN npm run build  # ← 前端构建 (生成 client/dist)

# Stage 7: 最终镜像 (api-build)
FROM base-min AS api-build
COPY api ./api
COPY --from=client-build /app/client/dist ./client/dist  # ← 复制前端产物
CMD ["node", "server/index.js"]
```

**关键点:**
1. **前端在镜像构建时已完成打包** → `client/dist`
2. **最终镜像只包含 Node.js 运行时 + 后端代码 + 前端静态文件**
3. **不存在"分离部署"** - 前后端在同一个镜像中

---

## 部署流程对比

### 您的 deploy.sh 流程
```bash
1. 本地构建镜像 (包含前后端)
   └─ docker build -f Dockerfile.multi --target api-build

2. 导出 tarball
   └─ docker save | gzip > librechat-xxx.tar.gz

3. SCP 传输到服务器
   └─ scp tarball ubuntu@server:/tmp/

4. 服务器加载镜像
   └─ docker load < tarball

5. 创建 override.yml
   └─ 指定新镜像版本

6. 重启 API 容器
   └─ docker-compose up -d api
```

### 原仓库的 deploy-compose.yml
```bash
1. 拉取镜像
   └─ docker pull ghcr.io/danny-avila/librechat-dev:latest

2. 启动所有容器
   └─ docker-compose -f deploy-compose.yml up -d

3. 包含 Nginx 容器
   └─ 自动配置反向代理
```

---

## 建议的优化方向

### 方案 A: 采用原仓库架构 + Registry 传输 (推荐)

**架构调整:**
```yaml
# docker-compose.yml 改为 deploy-compose.yml
services:
  client:
    image: nginx:1.27.0-alpine
    ports:
      - 80:80
      - 443:443
    volumes:
      - ./client/nginx.conf:/etc/nginx/conf.d/default.conf

  api:
    image: ghcr.io/your-org/librechat:latest
    expose:  # 不用 ports,仅内部暴露
      - 3080
```

**部署流程:**
```bash
1. 本地构建
   └─ docker build -t ghcr.io/your-org/librechat:xxx .

2. 推送到 Registry
   └─ docker push ghcr.io/your-org/librechat:xxx

3. 服务器拉取
   └─ docker pull ghcr.io/your-org/librechat:xxx

4. 重启服务
   └─ docker-compose -f deploy-compose.yml up -d
```

**优势:**
- ✅ 传输速度快 (增量传输)
- ✅ 标准端口 (80/443)
- ✅ 符合行业最佳实践
- ✅ 支持 SSL/Gzip/缓存

### 方案 B: 保持当前架构 + 优化传输 (次选)

保持直接暴露 3080 端口,但优化部署效率:
- 使用 Container Registry 代替 tarball 传输
- 添加智能缓存策略
- 并行压缩优化

**优势:**
- ⚠️ 改动最小
- ⚠️ 但不符合生产标准

---

## 决策建议

**推荐: 方案 A (Nginx + Registry)**

**原因:**
1. **用户体验** - 标准端口,无需 :3080
2. **安全性** - API 端口不对外暴露
3. **性能** - Nginx 静态服务 + Gzip 压缩
4. **可扩展性** - 支持负载均衡和 SSL
5. **行业标准** - 符合生产最佳实践

**所需调整:**
1. 修改 `deploy.sh` 使用 `deploy-compose.yml`
2. 设置 GitHub Container Registry
3. 配置 SSL 证书 (可选)

**工作量:** 约 2-4 小时

---

## 下一步行动

请选择您想采用的方案:

**A. 采用 Nginx + Registry 架构** (推荐)
  - 需要调整部署脚本和 compose 文件
  - 符合生产标准

**B. 保持当前架构 + 优化传输**
  - 只优化部署速度
  - 不改变端口暴露方式

**C. 先看看具体实施计划再决定**
  - 我可以为您制定详细的迁移步骤
