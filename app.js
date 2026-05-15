const util = require('./utils/util.js')
const authStorage = require('./utils/authStorage.js')

App({
  globalData: {
    isLoggedIn: false,
    userInfo: null,
    campusVerified: false
  },

  onLaunch() {
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
  },

  syncGlobalUser() {
    const auth = require('./utils/auth.js')
    const u = auth.getUserInfo()
    this.globalData.userInfo = u
    this.globalData.isLoggedIn = !!u
    this.globalData.campusVerified = !!(u && u.campusVerified)
  },

  async checkAndLogin() {
    const auth = require('./utils/auth.js')
    if (!auth.checkLoginStatus()) {
      wx.navigateTo({ url: '/pages/login/login' })
      return false
    }
    const u = auth.getUserInfo()
    if (u && u.status && u.status !== 'active') {
      await util.showModal('账号受限', '您的账号状态异常，暂时无法使用该功能。')
      return false
    }
    return true
  }
})
