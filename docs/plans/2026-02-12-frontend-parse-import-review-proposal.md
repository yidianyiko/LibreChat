# Frontend Parse + JSON Batch Import 待评估方案

> 状态：Draft（待评估）
> 日期：2026-02-12
> 范围：会话级导入（不含消息级编辑）

## 1. 背景
当前导入链路为文件上传到服务器后再解析。虽然已有前端分片上传缓解大文件问题，但仍存在：
- 上传阶段仍可能受网关/代理限制影响（413 风险未彻底消除）
- 用户无法在导入前审阅会话内容并选择性导入
- 失败重试粒度较粗（以文件/分片为主，而非会话批次）

## 2. 目标
- 在前端完成 JSON 解析与会话列表构建
- 用户可预览并勾选会话后再导入
- 后端接收结构化 JSON 批次，而非原始文件
- 单次上传上限：最多 500 条会话（硬阈值）
- 保持兼容现有 4 类导入结构：ChatGPT / Claude / ChatbotUI / LibreChat

## 3. 非目标
- 不在第一版支持“消息级裁剪/重写”
- 不替换现有 `/api/convos/import`（保留兼容）
- 不在第一版实现跨设备导入草稿持久化

## 4. 方案概述（方案 A）
### 4.1 前端流程
1. 用户选择本地 JSON 文件
2. 前端本地解析并识别 sourceType
3. 前端标准化为统一会话视图模型（标题、时间、消息数、摘要）
4. UI 展示会话列表与详情预览，用户勾选要导入的会话
5. 前端按批提交到新接口，每批最多 500 条会话
6. 展示批次进度、成功/失败统计，支持失败批次重试

### 4.2 后端流程
1. 新增 JSON 批量导入接口（非 multipart）
2. 校验 sourceType 与批次大小（1..500）
3. 将结构化会话路由到现有 importer 逻辑
4. 返回批次导入结果（成功数、失败数、错误明细）

## 5. 前端设计
### 5.1 关键模块
- `ImportConversationDialog`：新增“解析并预览”入口态
- `ImportReviewDialog`（新）：列表 + 详情 + 选择 + 导入控制
- `parser.worker.ts`（新）：在 Worker 中解析，避免主线程卡顿
- `normalize.ts`（新）：多来源结构统一
- `useImportJsonBatches.ts`（新）：批量提交与重试

### 5.2 统一前端模型（示意）
```ts
interface NormalizedConversation {
  localId: string;
  sourceType: 'chatgpt' | 'claude' | 'chatbotui' | 'librechat';
  title: string;
  createdAt?: string;
  messageCount: number;
  preview: string;
  raw: unknown; // 原始会话对象，提交时透传
}
```

### 5.3 交互要求
- 支持全选/反选/按标题搜索
- 支持“仅导入选中项”
- 导入前显示“将分 N 批上传（每批最多 500 条）”
- 失败批次支持重试，不影响已成功批次

## 6. 后端设计
### 6.1 新接口
`POST /api/convos/import-json-batch`

请求体（示意）：
```json
{
  "clientImportId": "uuid",
  "sourceType": "chatgpt",
  "batchIndex": 1,
  "totalBatches": 3,
  "conversations": []
}
```

约束：
- `sourceType` 必填且枚举合法
- `conversations.length` 必须在 `1..500`
- 超过 500 返回 400

响应体（示意）：
```json
{
  "imported": 498,
  "failed": 2,
  "errors": [
    { "index": 15, "reason": "Invalid conversation format" },
    { "index": 211, "reason": "Unsupported import type" }
  ]
}
```

### 6.2 与现有 importer 的衔接
- `chatgpt` / `claude`：可直接按数组调用对应 importer
- `chatbotui`：转换为 `{ version, history }` 再导入
- `librechat`：按单会话对象逐条调用 `importLibreChatConvo`

## 7. 阈值策略（固定为 500）
- 客户端：切批时严格按“最多 500 条会话/批”
- 服务端：再次校验，保证“永不超过 500”
- 备注：500 为条数阈值，不是字节阈值；如后续发现单批体积偏大，可再加字节上限双阈值

## 8. 错误处理与可恢复性
- 解析失败：前端提示格式错误，不发请求
- 批次失败：记录 `batchIndex`，支持只重试失败批
- 部分会话失败：服务端返回 `errors[index]`，前端标注具体会话
- 网络中断：前端保留已完成批次状态，恢复后继续

## 9. 安全与性能考虑
- 安全：服务端保留结构校验与鉴权，不信任前端解析结果
- 性能：解析放入 Worker，避免 UI 卡死
- 资源：不落盘临时大文件，降低服务器 IO 压力

## 10. 兼容与迁移策略
- 保留现有 `/api/convos/import` 文件导入链路
- 新 UI 默认走“前端解析 + JSON 批量导入”
- 可配置回退开关（出现异常时切回旧链路）

## 11. 验收标准（建议）
- 可成功导入 4 类支持格式
- 用户可在导入前预览并选择会话
- 批次上传严格不超过 500 条
- 单批失败可重试且不影响已完成批次
- 不上传原始大文件即可完成导入

## 12. 待评估问题
1. 是否需要在第一版加入“按会话总字节数”二次限流（除 500 条外）？
2. 是否需要幂等键（`clientImportId + batchIndex`）防重复导入？
3. 失败明细是否需要长期可追踪（落库）还是仅请求级返回？
4. 旧链路保留周期与下线条件是什么？

## 13. 结论（当前建议）
推荐推进方案 A。该方案在用户体验、413 风险控制、导入可恢复性上优于当前文件上传方案；
其中“每批最多 500 条会话”作为前后端双重硬限制，满足当前约束。
