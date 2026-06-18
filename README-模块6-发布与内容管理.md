# 模块 ⑥ · 发布与内容管理（约 20%）

面向校园二手平台的 **物品发布**、**跑腿发布**、**图片上传**、**我的发布**、**删除（软删）**，以及相关的 **UI 优化** 与 **混合云存储方案**。

## 一、功能清单

| # | 功能 | 状态 | 说明 |
|---|------|------|------|
| 1 | 物品发布 | 已完成 | `pages/itemPublish/` |
| 2 | 跑腿发布 | 已完成 | `pages/errandPublish/` |
| 3 | 图片上传（微信云存储） | 已完成 | `cloudStorage.js` + `publish.js` |
| 4 | 我的发布列表 | 已完成 | `pages/my/myItems/` |
| 5 | 编辑已发布内容 | 已完成 | `?id=objectId` |
| 6 | 下架 / 重新上架 | 已完成 | `myItems` |
| 7 | 删除发布（软删） | 已完成 | `status = DELETED_SOFT` |
| 8 | 首页商品列表（基础） | 已完成 | `pages/index/` 拉取 `ON_SALE` |
| 9 | 商品详情（基础） | 已完成 | `pages/itemDetail/` |
| 10 | 头像上传（云存储） | 已完成 | `pages/my/mySetting/` |

---

## 二、本模块变更记录（维护说明）

以下为模块 ⑥ 及相关联调的主要修改，便于答辩与后期维护。

### 2.1 发布与数据（Bmob）

- 新增 `utils/publish.js`：物品/跑腿共用上传、`Item` 读写、`postType` 区分。
- 新增 `pages/itemPublish/`、`pages/errandPublish/`，`app.json` 注册路由。
- 扩展 `pages/my/myItems/`：物品/跑腿 Tab、状态筛选、编辑分流、软删。
- `Item` 表字段约定见下文第三节；旧数据无 `postType` 视为物品。

### 2.2 图片存储（Bmob 文件域名 → 微信云存储）

**背景**：Bmob 上传报「绑定文件域名」，备案来不及。

**方案**：业务数据仍 **Bmob**；图片改 **微信云开发云存储**。

| 改动 | 文件 |
|------|------|
| 云环境配置 | `utils/cloudConfig.js`（`CLOUD_ENV_ID`、`CLOUD_STORAGE_ENABLED`） |
| 上传实现 | `utils/cloudStorage.js`（`items/`、`avatars/`） |
| 发布页接入 | `utils/publish.js` 上传段改调云存储 |
| 展示解析 | `utils/cloudImage.js`（`getTempFileURL`，解决列表 403） |
| 启动初始化 | `app.js` → `wx.cloud.init` |
| 头像 | `pages/my/mySetting/mySetting.js` 改云存储；`my.js` 展示解析 |

### 2.3 小程序与 Bmob 配置

- 正式 AppID：`wx84eb83299b4116c0`（`project.config.json`）。
- 微信 AppSecret 仅在 **Bmob 控制台 → 应用配置** 填写，不进仓库。
- `utils/bmob.js` 仍为 Bmob `SECRET_KEY` + `API_SAFE_CODE`（与微信 Secret 无关）。

### 2.4 UI 美化（2026-05-22 节点）

- 全局：`app.wxss` 校园蓝 `#4a7ab8`、卡片圆角与阴影。
- 自定义 TabBar：`custom-tab-bar/` + 中间 **发布** → `pages/publishHub/`（满足 pagePath 不重复）。
- 首页：搜索栏、分类 Chip、商品列表、骨架屏/空状态。
- 我的：信用进度条、菜单排序、退出二次确认。
- 我的发布：一级 Tab（物品/跑腿）+ 状态 Chip、FAB「+」、卡片样式。
- 发布页：分组表单、底部固定提交、校验提示、`canSubmit`。
- 详情页：轮播、状态标签、底栏占位按钮。

### 2.5 跑腿状态与发布完善

- 新增 `utils/itemStatus.js`：跑腿显示 **未接单 / 已接单 / 已完成 / 已取消**（与物品「在售」等区分）。
- `myItems`：未接单可编辑/取消；**已接单**由接单流程写入状态；卖家在已接单时点 **标记完成**。
- `errandPublish`：日期时间选择、赏金/取件快捷填、完成时间必填、发布后跳转跑腿列表。

| status（库内） | 跑腿展示 |
|----------------|----------|
| ON_SALE | 未接单 |
| IN_TRADING | 已接单 |
| SOLD_OUT | 已完成 |
| OFFLINE | 已取消 |

## 三、目录与文件

```
secondhand/
├── utils/
│   ├── cloudConfig.js       # 云开发环境 ID、是否启用云存储
│   ├── cloudStorage.js      # wx.cloud.uploadFile
│   ├── cloudImage.js        # cloud:// 展示解析
│   ├── itemStatus.js        # 物品/跑腿状态文案
│   └── publish.js           # 发布业务 + 选图上传入口
├── pages/
│   ├── index/               # 首页列表（模块⑥扩展）
│   ├── itemDetail/          # 详情（基础版）
│   ├── itemPublish/
│   ├── errandPublish/
│   ├── publishHub/          # TabBar「发布」占位页
│   └── my/myItems/
├── custom-tab-bar/          # 底部导航
├── docs/
│   ├── 数据存储与配置说明.md
│   └── UI-优化回滚节点.md
└── README-模块6-发布与内容管理.md
```

---

## 四、Bmob `Item` 表字段

在 Bmob 云数据库 → `Item` 中确认（无表可「添加表」或首发后自动出现）：

| 字段 | 类型建议 | 物品 | 跑腿 | 说明 |
|------|----------|------|------|------|
| sellerId | String | ✓ | ✓ | 发布者 objectId |
| postType | String | ✓ | ✓ | `goods` / `errand` |
| title | String | ✓ | ✓ | 标题 |
| description | String | ✓ | ✓ | 描述 |
| price | Number | ✓ | ✓ | 价格 / 赏金 |
| category | String | ✓ | ✓ | 分类；跑腿可为「跑腿」 |
| coverImage | String | ✓ | 可选 | 常为 `cloud://...` |
| images | String | ✓ | 可选 | JSON 数组字符串 |
| pickupAddr | String | | ✓ | 取件地点 |
| deliveryAddr | String | | ✓ | 送达地点 |
| deadline | String | | ✓ | 期望完成时间 |
| status | String | ✓ | ✓ | 物品：在售/交易中/已售出/已下架；跑腿：未接单/已接单/已完成/已取消（见 `utils/itemStatus.js`） |
| contactPhone | String | | ✓ | 跑腿发布者联系电话（单独字段，不再写入 description） |
| runnerId | Pointer→User | | ✓ | 接单人（接单后由订单模块写入，可选） |
| runnerPhone / runnerNickName / runnerWechatId | String | | ✓ | 接单人联系方式冗余，便于卖家详情页展示 |

---

## 五、使用流程

### 5.1 发布

1. 登录 → **我的** → **我的发布** 或底部 **+ 发布**。  
2. 选择物品 / 跑腿 → 填表、传图 → 提交。  
3. 新建 `status = ON_SALE`；图片链写入 `coverImage` / `images`。

### 5.2 管理

- **我的发布**：顶部「物品发布 / 跑腿发布」+ 状态 Chip；右下角 FAB「+」。  
- **编辑**：`/pages/itemPublish/itemPublish?id=` 或 `errandPublish?id=`。  
- **跑腿详情**：在「我的发布」点击跑腿卡片 → `itemDetail?id=`；发布者可见自己的电话；**已接单**时展示接单人昵称/电话（来自 `runner*` 字段或关联 `Order.buyerId`）。  
- **下架 / 上架 / 软删 / 标记完成**：列表卡片或详情页底部操作栏。

---

## 六、接口说明（`utils/publish.js`）

| 方法 | 作用 |
|------|------|
| `POST_TYPE.GOODS` / `ERRAND` | 类型常量 |
| `GOODS_CATEGORIES` | 物品分类 |
| `chooseAndUploadImages(current, max)` | 选图并上传（云或 Bmob） |
| `getItem(objectId)` | 查询单条 |
| `saveItem(fields, editId?)` | 创建或更新 Item |
| `getRunnerContact(row)` | 跑腿已接单时解析接单人电话 |
| `bindRunnerToItem(itemId, runnerUserId)` | 接单后写 `IN_TRADING` 与接单人字段（供模块⑤调用） |

```js
const publish = require('../../utils/publish.js')
await publish.saveItem({ postType: 'goods', title: '...', coverImage: 'cloud://...' })
```

## 七、与其它模块联调

| 模块 | 约定 |
|------|------|
| ② 首页 | `pages/index/` 已拉 `ON_SALE`，可按分类/关键词筛 |
| ③ 搜索 | 可复用首页查询逻辑扩展 |
| ④ 详情 | `itemDetail?id=`；跑腿展示路线、卖家联系与接单人信息 |
| ⑤ 订单 | 关联 `Item.objectId`；跑腿接单时调用 `bindRunnerToItem` 并创建 `Order` |
| ① 用户 | 登录、`avatarUrl` 云链；校园认证不变 |

---
