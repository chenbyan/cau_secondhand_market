# UI 美化优化 — 回滚节点

**节点时间**：2026-05-22  
**说明**：云存储图片显示正常后的 UI 全站美化。回滚时可对照本文件恢复的 Git 提交或文件列表。

## 回滚方式

```bash
# 若已提交，按提交回滚（示例）
git log --oneline -5
git checkout <UI优化前的commit> -- secondhand/app.wxss secondhand/app.json secondhand/custom-tab-bar secondhand/pages/index secondhand/pages/my secondhand/pages/itemPublish secondhand/pages/errandPublish secondhand/pages/itemDetail secondhand/docs/UI-优化回滚节点.md
```

未提交时：用 IDE 本地历史 / 备份覆盖下列目录即可。

## 本节点主要改动文件

| 模块 | 路径 |
|------|------|
| 设计规范 | `app.wxss`、`app.json` |
| 自定义 TabBar | `custom-tab-bar/*` |
| 首页 | `pages/index/*` |
| 我的 | `pages/my/my.wxml`、`my.wxss`、`my.js` |
| 我的发布 | `pages/my/myItems/*` |
| 发布页 | `pages/itemPublish/*`、`pages/errandPublish/*` |
| 商品详情 | `pages/itemDetail/*` |
| 回滚说明 | `docs/UI-优化回滚节点.md` |

## 设计 token（回滚后若需保留色值参考）

- 校园蓝主色：`#4a7ab8`
- 背景：`#f2f5f8`
- 卡片圆角：`20rpx`
- 阴影：`0 4rpx 16rpx rgba(74, 122, 184, 0.08)`
