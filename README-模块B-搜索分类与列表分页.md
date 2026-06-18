# 模块 B · 搜索、分类与列表分页

本模块负责校园二手平台中的 **找商品 / 找兼职** 链路：用户从首页搜索栏、快捷分类或“更多”入口进入结果列表，通过关键词、类型和分类筛选快速找到书籍、物品、兼职/跑腿内容，并支持下拉刷新与上拉分页加载。

> 说明：当前首页实际跳转到 `pages/publishHub/publishHub`，该页面在代码中承担“搜索结果页 / 更多列表页”的职责；`pages/searchResult/` 也保留了一套同源搜索结果页实现。

---

## 一、功能清单

| # | 功能 | 状态 | 说明 |
|---|------|------|------|
| 1 | 首页搜索栏 | 已完成 | 支持输入关键词搜索书籍、物品、兼职 |
| 2 | 书籍搜索 | 已完成 | 快捷入口 `type=book`，筛选 `category = 书籍` |
| 3 | 物品搜索 | 已完成 | 快捷入口 `type=goods`，排除书籍与兼职类内容 |
| 4 | 兼职分类 | 已完成 | 快捷入口 `type=parttime`，覆盖兼职与跑腿 |
| 5 | 首页分区推荐 | 已完成 | 书籍推荐、物品推荐、兼职与跑腿三块，每块拉取 4 条 |
| 6 | 更多列表 | 已完成 | 首页每个分区右侧“更多”进入对应类型列表 |
| 7 | 搜索结果页 | 已完成 | 搜索框、类型 Tab、分类 Chip、结果数量、空状态 |
| 8 | 分类筛选 | 已完成 | 全部、书籍、物品、兼职，以及细分类筛选 |
| 9 | 分页加载 | 已完成 | `cursor + pageSize` 分页，上拉触底加载更多 |
| 10 | 下拉刷新 | 已完成 | 重置 cursor，重新加载第一页 |
| 11 | 详情跳转 | 已完成 | 点击卡片进入 `pages/itemDetail/itemDetail?id=` |
| 12 | 图片与状态展示 | 已完成 | 云图片临时链接解析、跑腿状态标签、路线提示 |

---

## 二、核心文件

| 文件 | 作用 |
|------|------|
| `pages/index/index.js` | 首页搜索入口、快捷入口、首页三类推荐、更多入口 |
| `pages/index/index.wxml` | 首页搜索栏、快捷卡片、分区列表、更多按钮 |
| `pages/publishHub/publishHub.js` | 当前实际使用的搜索结果页逻辑 |
| `pages/publishHub/publishHub.wxml` | 搜索结果页结构：搜索框、类型 Tab、分类 Chip、列表 |
| `pages/searchResult/searchResult.js` | 同源搜索结果页实现，逻辑与 `publishHub` 基本一致 |
| `pages/searchResult/searchResult.wxml` | 搜索结果页备用结构 |
| `utils/publish.js` | 当前页面实际引用的查询与分类方法：`fetchItems()`、类型常量、分类常量 |
| `utils/itemQuery.js` | 独立查询模块版本，保留同类查询能力 |
| `utils/cloudImage.js` | 将 `cloud://` 图片解析为可展示的临时链接 |
| `utils/itemStatus.js` | 跑腿任务状态文案与样式映射 |
| `pages/itemDetail/itemDetail.js` | 搜索结果点击后的详情页承接 |
| `app.json` | 注册 `pages/index/index`、`pages/publishHub/publishHub` 等页面 |

---

## 三、页面入口与跳转

### 3.1 首页关键词搜索

首页搜索框输入关键词后，触发 `onSearchConfirm()`，跳转到搜索结果页：

```js
wx.navigateTo({
  url: buildSearchUrl(itemQuery.TYPE_ALL, this.data.keyword)
})
```

最终 URL 格式：

```text
/pages/publishHub/publishHub?type=all&keyword=关键词
```

### 3.2 首页快捷入口

首页三个快捷卡片分别对应：

| 入口 | type | 展示内容 |
|------|------|----------|
| 书籍搜索 | `book` | 教材、资料、课外书 |
| 物品搜索 | `goods` | 数码、日用、服饰、其他 |
| 兼职分类 | `parttime` | 家教、校内兼职、短期兼职、跑腿、其他兼职 |

点击后会携带当前搜索框关键词跳转：

```text
/pages/publishHub/publishHub?type=book&keyword=xxx
/pages/publishHub/publishHub?type=goods&keyword=xxx
/pages/publishHub/publishHub?type=parttime&keyword=xxx
```

### 3.3 更多列表

首页分区包括：

- `书籍推荐`：`type=book`
- `物品推荐`：`type=goods`
- `兼职与跑腿`：`type=parttime`

每个分区右侧“更多”复用同一个搜索结果页，只改变 `type` 参数。

### 3.4 详情页跳转

列表卡片点击后统一进入详情页：

```js
wx.navigateTo({ url: `/pages/itemDetail/itemDetail?id=${id}` })
```

---

## 四、分类与筛选规则

### 4.1 类型 Tab

`utils/publish.js` 中定义了搜索类型：

| 常量 | 值 | 文案 |
|------|----|------|
| `TYPE_ALL` | `all` | 全部结果 |
| `TYPE_BOOK` | `book` | 书籍搜索 |
| `TYPE_GOODS` | `goods` | 物品搜索 |
| `TYPE_PARTTIME` | `parttime` | 兼职分类 |

`pages/publishHub/publishHub.js` 当前展示书籍、物品、兼职三个 Tab，不展示“全部”Tab；通过首页搜索进入时仍可使用 `type=all` 加载全部结果。

### 4.2 物品分类

物品分类来自：

```js
const GOODS_CATEGORIES = ['数码', '书籍', '日用', '服饰', '其他']
```

物品搜索会排除 `书籍`，所以物品分类 Chip 为：

```text
全部物品 / 数码 / 日用 / 服饰 / 其他
```

### 4.3 兼职分类

兼职分类来自：

```js
const PARTTIME_CATEGORIES = ['家教', '校内兼职', '短期兼职', '跑腿', '其他兼职']
```

兼职搜索会把以下内容都视为兼职链路：

- `postType = parttime`
- `postType = errand`
- `category` 属于 `PARTTIME_CATEGORIES`

其中 `跑腿` 既可以通过 `category = 跑腿` 命中，也可以通过 `postType = errand` 命中。

---

## 五、分页加载逻辑

### 5.1 查询入口

首页和搜索结果页都调用：

```js
itemQuery.fetchItems({
  type,
  category,
  keyword,
  cursor,
  pageSize
})
```

当前页面实际 `require('../../utils/publish.js')`，并用 `itemQuery` 作为变量名。

### 5.2 首页推荐分页参数

首页只做推荐预览，每个分区拉取 4 条：

```js
itemQuery.fetchItems({
  type: section.key,
  cursor: 0,
  pageSize: 4
})
```

### 5.3 搜索结果分页参数

搜索结果页默认：

| 字段 | 值 | 说明 |
|------|----|------|
| `pageSize` | `10` | 每页展示 10 条 |
| `QUERY_BATCH_SIZE` | `30` | 每次从 Bmob 扫描 30 条候选数据 |
| `MAX_SCAN_BATCHES` | `5` | 一次分页最多扫描 5 批，避免无限扫描 |
| `cursor` | 数字 | 基于 Bmob `skip()` 的游标，不是页码 |

### 5.4 Bmob 查询条件

`fetchItems()` 每次查询 `Item` 表：

1. 固定筛选 `status = ON_SALE`，只展示在售 / 可接单内容。
2. 按 `createdAt` 倒序排列，最新发布靠前。
3. 书籍搜索直接服务端筛选 `category = 书籍`。
4. 明确细分类时尽量服务端筛选 `category`，减少本地过滤压力。
5. 对类型、分类、关键词再做本地二次过滤。

关键词匹配字段包括：

```text
title / description / category / pickupAddr / deliveryAddr / deadline
```

### 5.5 游标与 hasMore

分页不是简单的 `page * pageSize`，而是扫描候选数据后记录实际消耗位置：

```js
cursor = batchStart + consumed
```

返回值：

| 字段 | 说明 |
|------|------|
| `list` | 当前页最终展示列表 |
| `nextCursor` | 下一次加载继续扫描的位置 |
| `hasMore` | 是否还有后续候选数据 |

搜索结果页加载更多时会把新列表拼接到旧列表：

```js
const list = reset ? res.list : this.data.list.concat(res.list)
```

同时通过 `loading`、`loadingMore`、`hasMore` 防止重复请求。

---

## 六、展示数据结构

`fetchItems()` 会把 Bmob `Item` 数据整理为列表卡片需要的结构：

| 字段 | 说明 |
|------|------|
| `objectId` | 详情页跳转 ID |
| `title` | 标题 |
| `description` | 描述 |
| `price` / `priceText` | 原始价格与展示价格 |
| `priceLabel` | 物品为“价格”，兼职为“薪酬”，跑腿为“赏金” |
| `coverImage` | 封面图，支持云存储临时链接解析 |
| `category` | 展示分类 |
| `postType` | `goods` / `errand` / `parttime` |
| `isParttime` | 是否展示“兼职”标签 |
| `isErrand` | 是否为跑腿 |
| `statusLabel` / `statusClass` | 跑腿状态标签 |
| `routeHint` | 跑腿路线，如 `东区快递站 → 图书馆` |
| `deadline` | 截止时间 |
| `createdAt` | 发布时间 |

---

## 七、页面状态

搜索结果页维护以下状态：

| 状态 | 作用 |
|------|------|
| `activeType` | 当前类型：书籍 / 物品 / 兼职 / 全部 |
| `activeCategory` | 当前分类 Chip |
| `keyword` | 当前关键词 |
| `titleText` | 导航栏和结果标题 |
| `list` | 当前已加载列表 |
| `cursor` | 下一次分页游标 |
| `loading` | 首屏加载中 |
| `loadingMore` | 上拉加载中 |
| `refreshing` | 下拉刷新中 |
| `hasMore` | 是否还有更多 |

交互规则：

1. 切换类型：重置分类为 `all`，重新加载第一页。
2. 切换分类：保留关键词，重新加载第一页。
3. 搜索确认：保留当前类型和分类，按新关键词重新加载。
4. 清空关键词：重置关键词，重新加载。
5. 上拉触底：`onReachBottom()` 调用 `loadList(false)`。
6. 下拉刷新：`onPullDownRefresh()` 调用 `loadList(true)`。

---

## 八、与其它模块联动

| 模块 | 联动方式 |
|------|----------|
| 发布模块 | 读取发布页写入的 `Item` 表，依赖 `postType`、`category`、`status` |
| 详情模块 | 搜索结果点击后进入 `itemDetail?id=` |
| 图片模块 | 列表封面通过 `cloudImage.resolveImageUrl()` 展示云图片 |
| 跑腿模块 | `postType = errand` 纳入兼职链路，并展示路线与状态 |
| 首页模块 | 首页搜索栏、快捷入口、分区推荐均复用 `fetchItems()` |

---

## 九、自测流程

1. 发布一条书籍商品，分类选择 `书籍`，状态保持 `ON_SALE`。
2. 发布一条普通物品，分类选择 `数码`、`日用`、`服饰` 或 `其他`。
3. 发布一条跑腿任务，确认它出现在兼职 / 跑腿链路中。
4. 回到首页，检查三个分区是否分别展示书籍、物品、兼职与跑腿。
5. 在首页搜索框输入关键词，回车进入搜索结果页。
6. 点击首页 `书籍搜索`、`物品搜索`、`兼职分类`，检查类型筛选是否正确。
7. 点击分区右侧“更多”，检查是否进入对应类型的完整列表。
8. 在搜索结果页切换分类 Chip，确认列表重置并重新加载。
9. 上拉触底，确认出现“加载中...”并追加下一页。
10. 下拉刷新，确认列表回到第一页且 `cursor` 重置。
11. 点击任意结果卡片，确认进入对应商品 / 跑腿详情页。

---

## 十、答辩说明口径

本模块主要解决“用户如何找到内容”的问题，覆盖从首页入口到搜索结果页的完整发现链路。首页提供书籍、物品、兼职三个明确入口，结果页提供关键词搜索、类型切换、细分类筛选和分页加载。

数据层统一读取 `Item` 表，并只展示 `status = ON_SALE` 的内容；书籍通过 `category = 书籍` 区分，普通物品排除书籍和兼职，兼职链路同时兼容 `parttime` 与 `errand`，因此跑腿任务也能在“找兼职”中被发现。

分页采用 `cursor + skip()` 的扫描方式，并结合本地二次过滤，能在 Bmob 查询能力有限的情况下同时支持类型、分类和多字段关键词匹配。
