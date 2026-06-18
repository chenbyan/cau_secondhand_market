const auth = require('../../utils/auth.js')
const util = require('../../utils/util.js')
const Bmob = require('../../utils/bmob.js')
const cloudImage = require('../../utils/cloudImage.js')

const defaultAvatar =
  'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'

function normalizeCreditScore(user) {
  const score = user && user.creditScore != null ? Number(user.creditScore) : 100
  return Number.isFinite(score) ? score : 100
}

function creditPercent(score) {
  return Math.min(100, Math.max(0, score))
}

function buildStatusText(loggedIn, user, score) {
  if (!loggedIn) return '登录后享受完整服务'
  if (user.campusVerified) {
    return score >= 80 ? '已认证 · 信用良好' : '已认证 · 请保持良好交易'
  }
  if (user.campusVerifySt === 'PENDING') return '认证审核中 · 请耐心等待'
  if (user.campusVerifySt === 'REJECTED') return '认证未通过 · 请重新提交'
  return '未认证 · 完成校园邮箱认证'
}

async function fetchLatestRecordScore(userId) {
  if (!userId) return null
  try {
    const q = Bmob.Query('CreditRecord')
    q.equalTo('userId', '==', userId)
    q.order('-createdAt')
    q.limit(1)
    const rows = await q.find()
    if (!rows || !rows.length || rows[0].afterScore == null) return null
    const score = Number(rows[0].afterScore)
    return Number.isFinite(score) ? score : null
  } catch (e) {
    console.warn('读取最新信用流水失败', e)
    return null
  }
}

Page({
  data: {
    loggedIn: false,
    user: {},
    defaultAvatar,
    creditScore: 100,
    creditPercent: 100,
    statusText: ''
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 })
    }
    this.refreshView()
  },

  async refreshView() {
    const loggedIn = auth.checkLoginStatus()
    const user = auth.getUserInfo() || {}
    const creditScore = normalizeCreditScore(user)
    const creditPercentValue = creditPercent(creditScore)
    const statusText = buildStatusText(loggedIn, user, creditScore)
    let avatarDisplay = user.avatarUrl || ''
    if (avatarDisplay && cloudImage.isCloudFileId(avatarDisplay)) {
      try {
        avatarDisplay = await cloudImage.resolveImageUrl(avatarDisplay)
      } catch (e) {
        console.warn('头像展示解析失败', e)
        avatarDisplay = ''
      }
    }
    this.setData({
      loggedIn,
      user: { ...user, avatarDisplay },
      creditScore,
      creditPercent: creditPercentValue,
      statusText
    })
    if (!loggedIn || !user.objectId) return
    this.checkAccountStatus(user)
    const page = this
    const uid = user.objectId
    // 先展示缓存，再异步拉取，避免 tab 切换时长时间阻塞
    setTimeout(() => {
      Bmob.User.updateStorage(uid)
        .then(async () => {
          auth.persistUserInfo(Bmob.User.current())
          getApp().syncGlobalUser()
          const latest = auth.getUserInfo() || {}
          let avatarDisplay = latest.avatarUrl || ''
          if (avatarDisplay && cloudImage.isCloudFileId(avatarDisplay)) {
            try {
              avatarDisplay = await cloudImage.resolveImageUrl(avatarDisplay)
            } catch (e) {
              avatarDisplay = ''
            }
          }
          const latestRecordScore = await fetchLatestRecordScore(uid)
          const latestCreditScore = latestRecordScore == null ? normalizeCreditScore(latest) : latestRecordScore
          page.setData({
            user: { ...latest, creditScore: latestCreditScore, avatarDisplay },
            loggedIn: true,
            creditScore: latestCreditScore,
            creditPercent: creditPercent(latestCreditScore),
            statusText: buildStatusText(true, latest, latestCreditScore)
          })
          return page.checkAccountStatus(latest)
        })
        .catch((e) => console.warn(e))
    }, 0)
  },

  async checkAccountStatus(user) {
    if (!user || !user.status) return
    if (user.status === 'frozen') {
      await util.showModal(
        '账号受限',
        '您的账号已被冻结，如有疑问请联系管理员。'
      )
    } else if (user.status === 'disabled') {
      await util.showModal('账号受限', '您的账号已被禁用，将退出登录。')
      auth.logout()
    }
  },

  async onUserCardTap() {
    if (!this.data.loggedIn) {
      wx.navigateTo({ url: '/pages/login/login' })
      return
    }
    wx.navigateTo({ url: '/pages/my/mySetting/mySetting' })
  },

  onCampusTap() {
    wx.navigateTo({ url: '/pages/my/campusVerify/campusVerify' })
  },

  async goMyItems() {
    if (!getApp().checkAndCampusVerified('完成校园认证后可管理发布')) return
    wx.navigateTo({ url: '/pages/my/myItems/myItems' })
  },

  async goMyCart() {
    if (!getApp().checkAndCampusVerified('完成校园认证后可使用购物车')) return
    wx.navigateTo({ url: '/pages/my/myCart/myCart' })
  },

  async goOrdersBuy() {
    if (!getApp().checkAndCampusVerified('完成校园认证后可查看买入订单')) return
    wx.navigateTo({ url: '/pages/my/myOrders/myOrders?type=buy' })
  },

  async goOrdersSell() {
    if (!getApp().checkAndCampusVerified('完成校园认证后可查看卖出订单')) return
    wx.navigateTo({ url: '/pages/my/myOrders/myOrders?type=sell' })
  },

  async goOrdersErrand() {
    if (!getApp().checkAndCampusVerified('完成校园认证后可查看跑腿接单')) return
    wx.navigateTo({ url: '/pages/my/myOrders/myOrders?type=errand' })
  },

  async goCreditRecords() {
    if (!(await getApp().checkAndLogin())) return
    wx.navigateTo({ url: '/pages/my/creditRecords/creditRecords' })
  },

  async goSetting() {
    if (!(await getApp().checkAndLogin())) return
    wx.navigateTo({ url: '/pages/my/mySetting/mySetting' })
  },

  async goCampus() {
    if (!(await getApp().checkAndLogin())) return
    wx.navigateTo({ url: '/pages/my/campusVerify/campusVerify' })
  },

  goFeedback() {
    wx.navigateTo({ url: '/pages/feedback/feedback?mode=list' })
  },

  goReportInbox() {
    if (!auth.checkLoginStatus()) {
      wx.navigateTo({ url: '/pages/login/login' })
      return
    }
    wx.navigateTo({ url: '/pages/feedback/feedback?mode=inbox' })
  },

  goAbout() {
    wx.navigateTo({ url: '/pages/my/about/about' })
  },

  // 新增：跳转智能客服
  goToAiChat() {
    wx.navigateTo({ url: '/pages/aiChat/aiChat' })
  },

  async onLogout() {
    const ok = await util.showModal('退出登录', '确定要退出当前账号吗？')
    if (ok) auth.logout()
  }
})
