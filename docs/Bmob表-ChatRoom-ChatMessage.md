# Bmob 表：站内群聊（可选，未建表时使用本地缓存）

在 Bmob 控制台新建两张表后，消息将云端同步；否则自动降级为本地存储（仅本机可见）。

## ChatRoom

| 字段 | 类型 | 说明 |
|------|------|------|
| itemId | String | 关联 Item.objectId |
| title | String | 会话标题 |
| memberIds | String | JSON 数组，成员 objectId |
| postType | String | goods / errand |
| lastMsg | String | 最后一条消息摘要 |
| updatedAt | Date | 更新时间 |

## ChatMessage

| 字段 | 类型 | 说明 |
|------|------|------|
| roomId | String | ChatRoom.objectId |
| senderId | String | 发送者 _User.objectId |
| senderName | String | 昵称 |
| content | String | 文本内容 |
