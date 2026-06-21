# 已解决问题汇总

> 以下问题均已完成开发，合作者无需重复处理。

---

## 一、跑腿迁移至独立 Errand 表

**背景：** Item 表列数达到 Bmob 上限（20列），跑腿任务已迁移至独立 `Errand` 表。

**Item 表列已满时的约定：**
- **物品**不再使用 `rectifyRequired` / `offlineReason` 等字段（避免自动建列报错 1004）
- 举报「下架整改」只写 `Item.status = OFFLINE`，整改状态由 **Dispute** 表 `reportOutcome=OFFLINE_RECTIFY` 判断
- **跑腿**整改仍用 Errand 表的 `rectifyRequired` 字段

**建议在 Bmob 控制台删除 Item 表中已迁移到 Errand 的冗余列（释放额度）：**
`errandCategory` · `runnerNickName` · `runnerId` · `runnerPhone` · `deadline` · `deliveryAddr` · `pickupAddr`  
（删除前确认无重要历史 Item 跑腿数据，或已迁移完毕）

| 文件 | 改动内容 |
|------|---------|
| `utils/publish.js` | 新增 `saveErrand`、`getErrand`、`bindRunnerToErrand`、`fetchErrands`；`fetchItems` 过滤掉旧 Item 表中 `postType=errand` 的遗留数据 |
| `pages/errandPublish/errandPublish.js` | 读写全部切换至 Errand 表；联系电话不再嵌入 description，直接存 `phone` 字段（对应 Errand 表新增的 `phone` 列） |
| `pages/itemDetail/itemDetail.js` | 通过 URL 参数 `src=errand` 路由至 Errand 表；联系电话从 `row.phone` 读取，**只对发布者本人和已确认接单的骑手可见** |
| `pages/publishHub/publishHub.js` | 跑腿标签页调用 `fetchErrands`，详情跳转附加 `src=errand` |
| `pages/my/myItems/myItems.js` | 跑腿标签页查 Errand 表；物品待整改通过 `utils/itemRectify.js` 查 Dispute 表 |
| `pages/my/myOrders/myOrders.js` | 使用 `cloudImage.resolveOrderItemImage` 解析订单封面图 |
| `pages/orderDetail/orderDetail.js` | 所有跑腿相关查询切换至 Errand 表；`onCodeModalConfirm` 收件码验证后正确更新 Errand 表状态（原来错误地更新 Item 表） |

**Errand 表当前字段（18列）：**
`sellerId` · `status` · `postType` · `title` · `description` · `price` · `category` · `coverImage` · `images` · `campus` · `lockBuyerId` · `lockBuyers` · `lockExpireAt`

> 跑腿专用列（`pickupAddr` 等）建议从 Item 表删除；整改状态查 Dispute 表，不在 Item 表新增列。

---

## 二、聊天室路由修复

**背景：** 迁移至 Errand 表后，`openChatForItem` 仍硬编码查 Item 表，导致 400 报错。

| 文件 | 改动内容 |
|------|---------|
| `utils/chat.js` | `openChatForItem` 支持 `options.src === 'errand'`，路由至正确的 Errand 表 |
| `pages/itemDetail/itemDetail.js` | 所有 `openChatForItem` 调用传入 `src: this.itemSrc` |
| `pages/orderDetail/orderDetail.js` | `onGroupChat` 传入 `src: postType === 'errand' ? 'errand' : 'item'` |

---

## 三、图片解析（合作者改动已合并）

| 文件 | 改动内容 |
|------|---------|
| `utils/cloudImage.js` | 新增 `normalizeImageSource`、`fetchItemCoverSource`（Item/Errand 双表回退）、`resolveOrderItemImage` |
| `pages/orderDetail/orderDetail.js` | 集成 `resolveOrderItemImage` + `onImageError` 重试逻辑；`onLock` 写入 `itemImage` 字段 |

---

## 四、骑手接单 UX 修复

**背景：** 骑手点击"我要接单"后跳转聊天室，返回后只剩"联系发布者"和"任务群聊"两个重复按钮，无法继续操作。

| 文件 | 改动内容 |
|------|---------|
| `pages/itemDetail/itemDetail.wxml` | 跑腿群聊栏中，骑手视角的"联系发布者"（与群聊重复）改为**"确认接单"**，点击跳转至订单详情页完成后续确认 |

---

## 五、通知系统完善

**背景：** 跑腿单状态变更无通知、信用分变更无通知、点击"系统通知"错误跳转至申诉/举报页。

### 5.1 新增通知类型

在 `utils/notice.js` 中新增：

| 类型常量 | 值 | 说明 |
|---------|-----|------|
| `ERRAND_CONFIRMED` | `errand_confirmed` | 骑手已确认接单 |
| `ERRAND_CANCEL_ACCEPT` | `errand_cancel_accept` | 骑手已取消接单 |
| `ERRAND_COMPLETED` | `errand_completed` | 跑腿任务已完成 |
| `CREDIT_CHANGED` | `credit_changed` | 信用分变更 |
| `ITEM_OFFLINE` | `item_offline` | 商品下架（类型已定义，待后续接入） |

`credit_changed` 和 `item_offline` 已加入 `ADMIN_TYPES`，在消息页"系统通知"入口中显示。

### 5.2 补全缺失通知

| 触发时机 | 通知接收方 | 实现位置 |
|---------|-----------|---------|
| 骑手申请接单 | 发布者 | `pages/itemDetail/itemDetail.js` `onAcceptErrand` |
| 骑手确认接单（PENDING_CONFIRM → IN_TRADING） | 发布者 | `pages/orderDetail/orderDetail.js` `onAcceptErrand` |
| 骑手取消接单 | 发布者 | `pages/orderDetail/orderDetail.js` `onCancelAccept` |
| 收件码验证通过（跑腿完成） | 发布者 | `pages/orderDetail/orderDetail.js` `onCodeModalConfirm` |
| 信用分任意变动（加分/扣分） | 当事人 | `utils/credit.js` `applyDelta` |

### 5.3 系统通知页面

- 新建 `pages/notices/notices.*`（js / wxml / wxss / json）：展示所有系统类通知列表，进入时自动标记全部已读
- `pages/messages/messages.js` `onOpenSysNotices`：从错误跳转 `/pages/feedback/feedback?mode=list` 改为跳转 `/pages/notices/notices`
- `app.json` 已注册新页面

---

## 注意事项

- Errand 表中 **`offlineReason` 字段已删除**，代码中所有对该字段的读写已清除，不要再引用
- 跑腿单的骑手 ID 存在 Errand 表的 `runnerId`，通过 `bindRunnerToErrand` 写入
- 跑腿 Order 中 `buyerId` = 发布者，`sellerId` = 骑手（与普通商品订单相反），发通知时注意区分
- 联系电话存于 Errand 表 `phone` 字段，不在 `description` 中，后端查询时请从 `phone` 取值
