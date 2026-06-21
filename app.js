const util = require('./utils/util.js')
const authStorage = require('./utils/authStorage.js')
const { CLOUD_ENV_ID, CLOUD_STORAGE_ENABLED } = require('./utils/cloudConfig.js')

App({
  globalData: {
    isLoggedIn: false,
    userInfo: null,
    campusVerified: false,
    unreadNoticeCount: 0,
    chatUnreadCount: 0
  },

  onLaunch() {
    if (CLOUD_STORAGE_ENABLED && wx.cloud) {
      if (!CLOUD_ENV_ID || CLOUD_ENV_ID === 'your-cloud-env-id') {
        console.warn(
          '[云存储] 请在 utils/cloudConfig.js 填写 CLOUD_ENV_ID（开发者工具 → 云开发 → 设置）'
        )
      } else {
        try {
          wx.cloud.init({
            traceUser: true,
            env: CLOUD_ENV_ID
          })
        } catch (e) {
          console.warn('云开发初始化失败', e)
        }
      }
    }

    try {
      const logged = authStorage.checkLoginStatus()
      if (logged) {
        const u = authStorage.getUserInfo()
        this.globalData.isLoggedIn = true
        this.globalData.userInfo = u
        this.globalData.campusVerified = !!(u && u.campusVerified)
        const app = this
        // 延后加载 hydrogen-js-sdk，避免首屏同步执行过重触发基础库「timeout」
        setTimeout(() => {
          try {
            const Bmob = require('./utils/bmob.js')
            const auth = require('./utils/auth.js')
            const cur = Bmob.User.current()
            if (cur && cur.objectId) {
              Bmob.User.updateStorage(cur.objectId)
                .then(() => {
                  auth.persistUserInfo(Bmob.User.current())
                  app.syncGlobalUser()
                })
                .catch((e) => console.warn('刷新用户信息失败', e))
            }
          } catch (e) {
            console.warn('Bmob 延后初始化失败', e)
          }
        }, 0)
      } else {
        this.globalData.isLoggedIn = false
        this.globalData.userInfo = null
        this.globalData.campusVerified = false
      }
    } catch (e) {
      console.error(e)
      this.globalData.isLoggedIn = false
    }

    setTimeout(() => {
      try {
        const sysConfig = require('./utils/sysConfig.js')
        sysConfig.ensureLoaded().catch(() => {})
      } catch (e) {}
    }, 0)
  },

  syncGlobalUser() {
    const auth = require('./utils/auth.js')
    const u = auth.getUserInfo()
    this.globalData.userInfo = u
    this.globalData.isLoggedIn = !!u
    this.globalData.campusVerified = !!(u && u.campusVerified)
    if (u && u.objectId) {
      try {
        const notice = require('./utils/notice.js')
        notice.syncTabBadge()
      } catch (e) {}
    }
  },

  refreshTabBadge() {
    const pages = getCurrentPages()
    if (!pages.length) return
    const page = pages[pages.length - 1]
    if (page && typeof page.getTabBar === 'function' && page.getTabBar()) {
      page.getTabBar().setData({
        messageBadge: this.globalData.unreadNoticeCount || 0
      })
    }
  },

  async checkAndLogin() {
    const auth = require('./utils/auth.js')
    if (!auth.checkLoginStatus()) {
      wx.navigateTo({ url: '/pages/login/login' })
      return false
    }
    const u = auth.getUserInfo()
    if (u && u.status && u.status !== 'active') {
      if (u.status === 'disabled') {
        auth.forceLogoutDisabled()
        return false
      }
      await util.showModal('账号受限', '您的账号状态异常，暂时无法使用该功能。')
      return false
    }
    return true
  },

  /** 发布/购买/接单等：须已校园认证 */
  checkAndCampusVerified(tip) {
    const auth = require('./utils/auth.js')
    return auth.guardCampusAction({ tip })
  }
})
