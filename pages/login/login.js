const auth = require('../../utils/auth.js')
const util = require('../../utils/util.js')
const campusPreference = require('../../utils/campusPreference.js')

Page({
  data: {
    loading: false
  },

  onBack() {
    util.goBack()
  },

  async onWxLogin() {
    if (this.data.loading) return
    this.setData({ loading: true })
    try {
      const { isNewUser } = await auth.wxLogin()
      const app = getApp()
      app.syncGlobalUser()
      try {
        await campusPreference.detectCampusByLocation()
      } catch (locErr) {
        console.warn('登录后定位校区失败', locErr)
      }
      util.showToast('登录成功', 'success')
      if (isNewUser) {
        wx.redirectTo({ url: '/pages/my/mySetting/mySetting' })
      } else {
        wx.switchTab({ url: '/pages/index/index' })
      }
    } catch (e) {
      console.error(e)
      if (e && e.code === auth.ACCOUNT_DISABLED_CODE) {
        wx.showModal({
          title: '账户已禁用',
          content: '该账户已被禁用，无法登录。',
          showCancel: false
        })
        return
      }
      const msg = (e && (e.errMsg || e.message)) || ''
      let tip = '登录失败，请重试'
      if (msg.indexOf('domain list') >= 0 || msg.indexOf('合法域名') >= 0) {
        tip =
          '域名未配置：工具「详情-本地设置」勾选不校验合法域名，或公众平台添加 api.bmobcloud.com'
      } else if (
        msg.indexOf('40125') >= 0 ||
        msg.indexOf('invalid appsecret') >= 0 ||
        msg.indexOf('invalid apps') >= 0 ||
        msg.indexOf('sessionKey err') >= 0
      ) {
        tip = '微信登录配置错误：请检查 Bmob 后台的小程序 AppID/AppSecret 是否与当前项目一致'
      } else if (e && e.message) {
        tip = e.message
      }
      util.showToast(tip)
    } finally {
      this.setData({ loading: false })
    }
  }
})
