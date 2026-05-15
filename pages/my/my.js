const auth = require('../../utils/auth.js')
const util = require('../../utils/util.js')
const Bmob = require('../../utils/bmob.js')

const defaultAvatar =
  'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'

Page({
  data: {
    loggedIn: false,
    user: {},
    defaultAvatar
  },

  onShow() {
    this.refreshView()
  },

  refreshView() {
    const loggedIn = auth.checkLoginStatus()
    const user = auth.getUserInfo() || {}
    this.setData({ loggedIn, user })
    if (!loggedIn || !user.objectId) return
    this.checkAccountStatus(user)
    const page = this
    const uid = user.objectId
    // 先展示缓存，再异步拉取，避免 tab 切换时长时间阻塞
    setTimeout(() => {
      Bmob.User.updateStorage(uid)
        .then(() => {
          auth.persistUserInfo(Bmob.User.current())
          getApp().syncGlobalUser()
          const latest = auth.getUserInfo() || {}
          page.setData({ user: latest, loggedIn: true })
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
    if (!(await getApp().checkAndLogin())) return
    wx.navigateTo({ url: '/pages/my/myItems/myItems' })
  },

  async goMyCart() {
    if (!(await getApp().checkAndLogin())) return
    wx.navigateTo({ url: '/pages/my/myCart/myCart' })
  },

  async goOrdersBuy() {
    if (!(await getApp().checkAndLogin())) return
    wx.navigateTo({ url: '/pages/my/myOrders/myOrders?type=buy' })
  },

  async goOrdersSell() {
    if (!(await getApp().checkAndLogin())) return
    wx.navigateTo({ url: '/pages/my/myOrders/myOrders?type=sell' })
  },

  async goSetting() {
    if (!(await getApp().checkAndLogin())) return
    wx.navigateTo({ url: '/pages/my/mySetting/mySetting' })
  },

  async goCampus() {
    if (!(await getApp().checkAndLogin())) return
    wx.navigateTo({ url: '/pages/my/campusVerify/campusVerify' })
  },

  goAbout() {
    wx.navigateTo({ url: '/pages/my/about/about' })
  },

  onLogout() {
    util.showModal('提示', '确定退出登录？').then((ok) => {
      if (ok) auth.logout()
    })
  }
})
