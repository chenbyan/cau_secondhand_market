# Cursor 代码生成提示词：校园二手交易平台 — 全局启动、登录认证与个人中心

---

## 一、项目背景与你的角色

你是一个微信小程序开发专家。当前项目是「校园二手交易平台」微信小程序，后端使用 **Bmob 后端云**（BaaS），无自建服务器。项目已在微信开发者工具中初始化，目录结构如下：

```
SECONDHAND/
├── components/          # 公共组件
├── pages/               # 页面目录
├── utils/               # 工具函数
├── app.js               # 小程序入口
├── app.json             # 全局配置
├── app.wxss             # 全局样式
├── project.config.json
├── project.private.config.json
└── sitemap.json
```

我负责的模块是 **「全局启动、登录认证与个人中心」**，约占项目 22% 工作量。请根据以下需求，生成完整、可运行、符合微信小程序规范的代码。

---

## 二、技术栈与约束

| 项目 | 规范 |
|------|------|
| 框架 | 微信小程序原生开发（WXML + WXSS + JS） |
| 后端 | Bmob 后端云（通过 JS SDK 调用，不自建服务器） |
| Bmob SDK | 使用 `npm install hydrogen-js-sdk` 或手动引入 `utils/bmob.js` |
| 数据表 | Bmob 后端云创建数据表，通过 SDK CRUD 操作 |
| 登录方式 | 微信授权登录（wx.login 获取 code → Bmob 小程序一键登录） |
| 校园认证 | 校园邮箱验证码（Bmob 邮件功能 或 Bmob 云函数发送验证码） |
| 缓存策略 | wx.setStorageSync / wx.getStorageSync 缓存 userInfo、openid、认证状态 |
| UI 规范 | 遵循微信小程序设计规范，适配 iPhone/Android，使用 rpx 单位 |
| 设计原则 | 无资金链路（不接入支付）、服务端权威（Bmob 数据库为准）、最小权限 |

### Bmob 数据表设计

请在 Bmob 后台创建以下数据表（或在代码中通过 SDK 自动创建）：

**_User 表（Bmob 内置用户表，扩展字段）：**
| 字段名 | 类型 | 说明 |
|--------|------|------|
| username | String | 用户名（自动生成或微信昵称） |
| openid | String | 微信 openid（唯一标识） |
| nickName | String | 微信昵称 |
| avatarUrl | String | 微信头像 URL |
| phone | String | 联系电话 |
| wechatId | String | 微信号 |
| campus | String | 校区名称 |
| dormitory | String | 宿舍楼栋 |
| campusEmail | String | 校园邮箱 |
| campusVerified | Boolean | 是否已通过校园认证，默认 false |
| creditScore | Number | 信用分，默认 100 |
| status | String | 账号状态：active / frozen / disabled，默认 active |

**VerifyCode 表（验证码记录）：**
| 字段名 | 类型 | 说明 |
|--------|------|------|
| email | String | 目标邮箱 |
| code | String | 6 位验证码 |
| userId | Pointer(_User) | 关联用户 |
| expireAt | Date | 过期时间（5 分钟后） |
| used | Boolean | 是否已使用，默认 false |

---

## 三、需要生成的完整文件清单

请按以下结构逐一生成每个文件的完整代码：

```
SECONDHAND/
├── utils/
│   ├── bmob.js              # Bmob SDK 初始化与封装
│   ├── auth.js              # 登录认证工具函数
│   └── util.js              # 通用工具函数
├── app.js                   # 小程序全局入口（重写）
├── app.json                 # 全局配置（重写，注册所有页面和 tabBar）
├── app.wxss                 # 全局样式（重写）
├── pages/
│   ├── index/               # 首页（占位，留给其他同学）
│   │   ├── index.js
│   │   ├── index.json
│   │   ├── index.wxml
│   │   └── index.wxss
│   ├── login/               # 登录页
│   │   ├── login.js
│   │   ├── login.json
│   │   ├── login.wxml
│   │   └── login.wxss
│   ├── my/                  # 个人中心主页
│   │   ├── my.js
│   │   ├── my.json
│   │   ├── my.wxml
│   │   └── my.wxss
│   ├── my/mySetting/        # 个人设置页（编辑资料）
│   │   ├── mySetting.js
│   │   ├── mySetting.json
│   │   ├── mySetting.wxml
│   │   └── mySetting.wxss
│   ├── my/campusVerify/     # 校园认证页
│   │   ├── campusVerify.js
│   │   ├── campusVerify.json
│   │   ├── campusVerify.wxml
│   │   └── campusVerify.wxss
│   ├── my/myOrders/         # 我的订单页（我买到的 + 我卖出的）
│   │   ├── myOrders.js
│   │   ├── myOrders.json
│   │   ├── myOrders.wxml
│   │   └── myOrders.wxss
│   ├── my/myItems/          # 我发布的商品
│   │   ├── myItems.js
│   │   ├── myItems.json
│   │   ├── myItems.wxml
│   │   └── myItems.wxss
│   ├── my/myCart/            # 我的购物车（收藏夹/意向商品）
│   │   ├── myCart.js
│   │   ├── myCart.json
│   │   ├── myCart.wxml
│   │   └── myCart.wxss
│   └── my/about/            # 关于页面
│       ├── about.js
│       ├── about.json
│       ├── about.wxml
│       └── about.wxss
```

---

## 四、各文件详细需求

### 4.1 `utils/bmob.js` — Bmob SDK 初始化

```
功能要求：
1. 引入 Bmob hydrogen-js-sdk
2. 使用 Bmob.initialize("你的Secret Key", "你的API Key") 初始化
   （请用占位符 "YOUR_SECRET_KEY" 和 "YOUR_API_KEY"，我后续替换）
3. 导出 Bmob 实例供全局使用

代码模式：
const Bmob = require('hydrogen-js-sdk');
Bmob.initialize("YOUR_SECRET_KEY", "YOUR_API_KEY");
module.exports = Bmob;
```

### 4.2 `utils/auth.js` — 认证工具函数

```
封装以下函数并导出：

1. wxLogin()
   - 调用 wx.login() 获取 code
   - 调用 Bmob.User.signOrLoginByMiniProgram(code) 实现一键登录/注册
   - 登录成功后将 userInfo（objectId、openid、nickName、avatarUrl、campusVerified、status）
     存入 wx.setStorageSync('userInfo', userInfo)
   - 返回 userInfo

2. checkLoginStatus()
   - 从缓存读取 userInfo
   - 若存在且有 objectId，返回 true
   - 否则返回 false

3. getUserInfo()
   - 从缓存读取并返回 userInfo
   - 若缓存不存在，返回 null

4. updateUserInfo(data)
   - 参数 data 为要更新的字段对象，如 { nickName: 'xxx', phone: '138xxxx' }
   - 通过 Bmob.User 获取当前用户对象，调用 set + save 更新
   - 同步更新本地缓存

5. logout()
   - 调用 Bmob.User.logOut()
   - 清除本地缓存中的 userInfo
   - 跳转到登录页

6. checkCampusVerified()
   - 读取缓存中 campusVerified 字段
   - 返回 true/false

7. sendVerifyCode(email)
   - 生成 6 位随机数字验证码
   - 在 Bmob VerifyCode 表中创建记录（email, code, userId, expireAt = 当前时间+5分钟, used=false）
   - 通过 Bmob 云函数或 Bmob.sendEmail 发送邮件（邮件内容包含验证码）
   - 频率控制：同一邮箱 60 秒内不可重复发送（用缓存记录上次发送时间）
   - 返回 { success: true } 或 { success: false, message: '原因' }

8. verifyCode(email, code)
   - 查询 VerifyCode 表，条件：email 匹配、code 匹配、used=false、expireAt > 当前时间
   - 若匹配成功：标记 used=true，更新 _User 表 campusVerified=true 和 campusEmail=email
   - 同步更新本地缓存
   - 返回 { success: true } 或 { success: false, message: '验证码错误或已过期' }
```

### 4.3 `utils/util.js` — 通用工具

```
封装并导出：
1. formatTime(date) — 格式化时间为 YYYY-MM-DD HH:mm:ss
2. showToast(title, icon='none') — 封装 wx.showToast
3. showLoading(title='加载中...') — 封装 wx.showLoading
4. hideLoading() — 封装 wx.hideLoading
5. showModal(title, content) — 封装 wx.showModal，返回 Promise
6. validateEmail(email) — 校验邮箱格式（特别校验 .edu.cn 后缀）
7. validatePhone(phone) — 校验手机号格式
```

### 4.4 `app.js` — 小程序全局入口

```
功能要求：
1. 在 onLaunch 中：
   a. 初始化 Bmob（引入 utils/bmob.js 即可，导入时自动执行初始化）
   b. 检查登录状态（调用 auth.checkLoginStatus()）
   c. 若已登录，从 Bmob 拉取最新用户信息并刷新本地缓存
      （防止后台管理员修改了用户状态，如冻结账号，本地缓存不同步）
   d. 若未登录，标记 globalData.isLoggedIn = false
2. globalData 结构：
   {
     isLoggedIn: false,
     userInfo: null,
     campusVerified: false
   }
3. 提供全局方法 checkAndLogin()：
   - 检查是否登录，未登录则跳转到 /pages/login/login
   - 检查账号状态，若 status !== 'active' 则弹窗提示"账号受限"并阻止操作
   - 返回 boolean
```

### 4.5 `app.json` — 全局配置

```
{
  "pages": [
    "pages/index/index",
    "pages/login/login",
    "pages/my/my",
    "pages/my/mySetting/mySetting",
    "pages/my/campusVerify/campusVerify",
    "pages/my/myOrders/myOrders",
    "pages/my/myItems/myItems",
    "pages/my/myCart/myCart",
    "pages/my/about/about"
  ],
  "tabBar": {
    "color": "#999999",
    "selectedColor": "#2d5a8e",
    "backgroundColor": "#ffffff",
    "borderStyle": "black",
    "list": [
      {
        "pagePath": "pages/index/index",
        "text": "首页",
        "iconPath": "static/tab/home.png",
        "selectedIconPath": "static/tab/home-active.png"
      },
      {
        "pagePath": "pages/my/my",
        "text": "我的",
        "iconPath": "static/tab/my.png",
        "selectedIconPath": "static/tab/my-active.png"
      }
    ]
  },
  "window": {
    "navigationBarBackgroundColor": "#2d5a8e",
    "navigationBarTitleText": "校园二手交易",
    "navigationBarTextStyle": "white",
    "backgroundColor": "#f5f5f5"
  },
  "style": "v2",
  "sitemapLocation": "sitemap.json"
}

注意：tabBar 的 iconPath 使用占位路径，我后续添加图标文件。
后续其他同学会在 pages 数组中添加更多页面（商品发布、商品详情、搜索等）。
tabBar 也预留了扩展位置（后续可能加"发布"和"消息"tab）。
```

### 4.6 `app.wxss` — 全局样式

```
定义全局样式变量和基础样式：
1. 主色调 #2d5a8e（蓝），辅色 #c45b3e（橙红），背景 #f5f5f5
2. page 默认背景色、字体、字号
3. 常用工具类：.flex-row, .flex-col, .flex-center, .text-center, .text-muted, .text-primary
4. 按钮样式：.btn-primary（蓝色主按钮）, .btn-outline（边框按钮）, .btn-danger（红色危险按钮）
5. 卡片样式：.card（白色圆角带阴影）
6. 状态标签样式：.tag-success, .tag-warning, .tag-danger, .tag-info
```

### 4.7 `pages/login/login` — 登录页

```
页面功能：
1. 页面中央展示 App Logo + 标题 "校园二手交易平台"
2. 一个按钮 "微信一键登录"
3. 点击按钮：
   a. 调用 auth.wxLogin()
   b. 成功后检查用户是否首次登录（isNewUser）
   c. 首次登录 → 跳转到 mySetting 完善资料
   d. 非首次 → switchTab 到首页
   e. 失败 → showToast 提示错误
4. 底部展示 "登录即表示同意《用户服务协议》" 文案

UI 设计：
- 简洁大气，居中布局
- Logo 区域上方留白，按钮使用主色调圆角样式
- 背景纯白或浅灰
```

### 4.8 `pages/my/my` — 个人中心主页

```
页面功能：
1. 顶部用户信息卡片区域：
   - 头像（圆形，点击可进入设置页）
   - 昵称
   - 校园认证状态标签（"已认证" 绿色 / "未认证" 灰色，点击未认证可跳转认证页）
   - 信用分展示
2. 若未登录，头像区域显示默认头像 + "点击登录"，点击跳转登录页
3. 功能菜单列表（cell 列表样式）：
   - 📦 我的发布（跳转 myItems）
   - 🛒 我的购物车（跳转 myCart）
   - 📋 我买到的（跳转 myOrders?type=buy）
   - 📋 我卖出的（跳转 myOrders?type=sell）
   - ⚙️ 个人设置（跳转 mySetting）
   - 🎓 校园认证（跳转 campusVerify，已认证则显示"已认证"不可点）
   - ℹ️ 关于我们（跳转 about）
4. 底部"退出登录"按钮（仅登录状态显示）

生命周期：
- onShow 时刷新用户信息（从缓存读取，确保每次进入看到最新状态）
- 若检测到 status !== 'active'，弹窗提示账号受限
```

### 4.9 `pages/my/mySetting/mySetting` — 个人设置

```
页面功能：
1. 表单字段（带标签 + 输入框）：
   - 头像（点击可选择新头像，调用 wx.chooseMedia 选择图片后上传到 Bmob 文件存储）
   - 昵称（text input，2-20 字符）
   - 联系电话（number input，校验手机号格式）
   - 微信号（text input）
   - 校区（picker，选项后续可从字典表读取，暂时硬编码几个校区）
   - 宿舍楼栋（text input）
2. "保存" 按钮：
   - 校验所有字段
   - 调用 auth.updateUserInfo(data) 更新 Bmob 和本地缓存
   - 成功提示 → 返回上一页
3. 页面 onLoad 时从缓存加载当前用户信息填充表单

注意：昵称需调用 Bmob 或微信的内容安全检测（可简化为本地敏感词过滤）。
```

### 4.10 `pages/my/campusVerify/campusVerify` — 校园认证

```
页面功能：
1. 若已认证，显示认证成功状态页（✅ 绿色勾 + "已通过校园认证" + 认证邮箱）
2. 若未认证，显示认证表单：
   a. 邮箱输入框（校验 .edu.cn 后缀）
   b. 验证码输入框 + "获取验证码" 按钮
   c. "获取验证码" 按钮：
      - 先校验邮箱格式
      - 调用 auth.sendVerifyCode(email)
      - 成功后按钮变为 60 秒倒计时，倒计时结束恢复
      - 失败提示错误
   d. "提交验证" 按钮：
      - 调用 auth.verifyCode(email, code)
      - 成功 → 显示认证成功页面，2 秒后自动返回个人中心
      - 失败 → 提示"验证码错误或已过期"

UI 设计：
- 顶部图标/插图区域（学生帽或校园图标）
- 表单区域白色卡片
- 按钮使用主色调
- 倒计时按钮变灰色不可点击
```

### 4.11 `pages/my/myOrders/myOrders` — 我的订单

```
页面功能：
1. 通过页面参数 type（buy/sell）区分"我买到的"和"我卖出的"
2. 顶部 tab 切换：全部 / 待确认 / 交易中 / 已完成 / 已取消
   （对应状态：all / PENDING_CONFIRM / IN_TRADING / COMPLETED / CANCELLED）
3. 订单列表（下拉刷新 + 上拉加载更多）：
   - 每个订单卡片展示：商品图片缩略图、商品标题、价格、订单状态标签、创建时间
   - 点击卡片跳转订单详情（预留路由，页面由其他同学开发）
4. 空状态：暂无订单 + 插图
5. 数据来源：查询 Bmob 的 Order 表（这个表由负责交易模块的同学创建，
   这里只需要写好查询逻辑，查询条件为当前用户 objectId 匹配 buyerId 或 sellerId）

数据查询示例（伪代码）：
- type=buy：query.equalTo('buyerId', currentUserId)
- type=sell：query.equalTo('sellerId', currentUserId)
- 若选中某个状态 tab：query.equalTo('status', selectedStatus)
- query.order('-createdAt')，分页 limit 10，skip = page * 10
```

### 4.12 `pages/my/myItems/myItems` — 我发布的商品

```
页面功能：
1. 展示当前用户发布的所有商品列表
2. 顶部 tab：全部 / 在售 / 交易中 / 已售出 / 已下架
   （对应 Item 表 status：all / ON_SALE / IN_TRADING / SOLD_OUT / OFFLINE）
3. 每个商品卡片：封面图、标题、价格、状态标签、发布时间
4. 卡片右侧操作按钮：
   - 在售状态 → "编辑" "下架"
   - 已下架 → "重新上架" "删除"
5. 下架操作调用 Bmob 更新 Item 表 status 为 OFFLINE
6. 删除操作（软删除）更新 status 为 DELETED_SOFT
7. 空状态：暂无发布的商品 + "去发布" 按钮（跳转到发布页，页面由其他同学开发）
8. 下拉刷新 + 上拉加载更多

数据查询：
- query.equalTo('sellerId', currentUserId)
- query.notEqualTo('status', 'DELETED_SOFT')  // 软删除不显示
```

### 4.13 `pages/my/myCart/myCart` — 我的购物车（收藏/意向商品）

```
页面功能：
1. 展示用户收藏/加入购物车的商品列表
2. 每个商品卡片：封面图、标题、价格、卖家昵称
3. 卡片可左滑删除（取消收藏）
4. 点击卡片跳转商品详情（预留路由）
5. 空状态：购物车为空 + "去逛逛" 按钮
6. 注意：因为本系统无资金链路，购物车本质是"意向收藏"，不涉及下单结算

数据来源：查询 Bmob 的 Cart 表（简单表：userId, itemId, createdAt）
通过 include('itemId') 联查商品信息
```

### 4.14 `pages/my/about/about` — 关于页面

```
简单展示页：
1. App Logo + 名称 "校园二手交易平台" + 版本号 "v1.0.0"
2. 项目简介（1-2 段文字）
3. 开发团队信息
4. 联系方式 / 反馈邮箱
```

### 4.15 `pages/index/index` — 首页占位

```
生成一个最简单的占位首页：
1. 显示 "校园二手交易平台" 标题
2. 一段欢迎文字
3. 留下注释：// TODO: 首页商品列表、搜索、分类等功能由其他同学实现
```

---

## 五、关键业务逻辑强调

### 5.1 登录流程
```
用户打开小程序
  → app.js onLaunch 检查缓存
  → 有缓存 → 静默刷新用户信息（Bmob 查询最新数据）→ 进入首页
  → 无缓存 → globalData.isLoggedIn = false → 用户可浏览首页
  → 用户点击需要登录的操作（如"我的"、"发布"）
  → 调用 app.checkAndLogin()
  → 未登录 → 跳转 login 页 → 微信一键登录 → 返回
```

### 5.2 校园认证流程
```
用户进入 campusVerify 页面
  → 输入校园邮箱（必须 .edu.cn 后缀）
  → 点击获取验证码 → 后端生成 6 位码存 VerifyCode 表 + 发邮件
  → 按钮进入 60s 倒计时
  → 用户输入验证码 → 点击提交
  → 后端校验：邮箱+验证码+未使用+未过期
  → 通过 → 更新用户 campusVerified=true → 刷新缓存 → 提示成功
  → 失败 → 提示错误原因
```

### 5.3 账号状态检查
```
每次 onShow 个人中心：
  → 从 Bmob 拉取最新用户状态
  → 若 status === 'frozen' → 弹窗 "您的账号已被冻结，如有疑问请联系管理员"
  → 若 status === 'disabled' → 弹窗 "您的账号已被禁用" → 强制退出登录
```

---

## 六、代码风格要求

1. **全部使用 ES6+ 语法**（const/let、箭头函数、async/await、解构赋值、模板字符串）
2. **统一错误处理**：所有 Bmob 请求用 try/catch 包裹，catch 中统一 showToast 提示
3. **函数和变量命名**：驼峰命名，见名知义，关键函数写注释
4. **WXML**：结构语义化，合理使用 wx:if / wx:for / wx:key，列表渲染必须加 wx:key
5. **WXSS**：使用 class 而非 id 选择器，使用 rpx 单位，避免内联样式
6. **数据加载态**：所有列表页实现 loading 态（加载中显示 loading，空数据显示空状态图）
7. **页面间通信**：通过 URL 参数或 globalData 传递，不用事件总线

---

## 七、生成顺序

请严格按照以下顺序逐一输出每个文件的完整代码：

1. `utils/bmob.js`
2. `utils/auth.js`
3. `utils/util.js`
4. `app.js`
5. `app.json`
6. `app.wxss`
7. `pages/login/login.wxml` → `login.wxss` → `login.js` → `login.json`
8. `pages/my/my.wxml` → `my.wxss` → `my.js` → `my.json`
9. `pages/my/mySetting/mySetting.wxml` → `.wxss` → `.js` → `.json`
10. `pages/my/campusVerify/campusVerify.wxml` → `.wxss` → `.js` → `.json`
11. `pages/my/myOrders/myOrders.wxml` → `.wxss` → `.js` → `.json`
12. `pages/my/myItems/myItems.wxml` → `.wxss` → `.js` → `.json`
13. `pages/my/myCart/myCart.wxml` → `.wxss` → `.js` → `.json`
14. `pages/my/about/about.wxml` → `.wxss` → `.js` → `.json`
15. `pages/index/index.wxml` → `.wxss` → `.js` → `.json`

每个文件输出完整代码，不要省略，不要用 "..." 占位。在代码中对关键逻辑添加中文注释。

---

## 八、Bmob 云函数（如需要）

如果 Bmob JS SDK 不直接支持发送邮件，请额外提供一个 Bmob 云函数代码 `sendVerifyEmail`：

```
功能：
- 接收参数 { email, code }
- 调用邮件发送服务，发送验证码到指定邮箱
- 邮件标题："校园二手交易平台 - 身份验证码"
- 邮件正文：包含 6 位验证码，提示 5 分钟有效

请给出云函数的完整代码以及在 Bmob 后台部署的说明。
```

---

## 九、补充说明

1. 本项目是团队协作开发，其他同学负责首页商品列表、商品发布/详情、交易订单处理、管理后台等模块。我的代码需要预留好接口和路由，确保后续可以无缝对接。
2. 所有涉及"商品详情"、"订单详情"、"发布商品"的跳转，使用 `wx.navigateTo({ url: '/pages/xxx/xxx' })` 并加注释说明该页面由其他同学实现。
3. 数据表的查询代码中，Order 表和 Item 表的字段命名请与上面需求分析报告中的实体定义保持一致。
4. 生成代码后，我会在微信开发者工具中编译测试，请确保代码可以直接运行，没有语法错误。
