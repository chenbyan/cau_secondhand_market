const auth = require('../../../utils/auth.js')
const util = require('../../../utils/util.js')

Page({
  data: {
    verified: false,
    user: {},
    email: '',
    code: '',
    countdown: 0,
    submitting: false
  },

  timer: null,

  onLoad() {
    if (!auth.checkLoginStatus()) {
      wx.redirectTo({ url: '/pages/login/login' })
      return
    }
    this.syncUser()
  },

  onUnload() {
    if (this.timer) clearInterval(this.timer)
  },

  syncUser() {
    const u = auth.getUserInfo() || {}
    this.setData({
      verified: !!u.campusVerified,
      user: u,
      email: u.campusEmail || ''
    })
  },

  onEmail(e) {
    this.setData({ email: e.detail.value.trim() })
  },
  onCode(e) {
    this.setData({ code: e.detail.value.trim() })
  },

  async onSendCode() {
    const { email } = this.data
    if (!util.validateEmail(email)) {
      util.showToast('请输入有效的 .edu.cn 邮箱')
      return
    }
    try {
      util.showLoading('发送中...')
      const r = await auth.sendVerifyCode(email)
      util.hideLoading()
      if (!r.success) {
        util.showToast(r.message || '发送失败')
        return
      }
      util.showToast('验证码已发送')
      this.startCountdown()
    } catch (e) {
      util.hideLoading()
      console.error(e)
      util.showToast('发送失败')
    }
  },

  startCountdown() {
    if (this.timer) clearInterval(this.timer)
    this.setData({ countdown: 60 })
    this.timer = setInterval(() => {
      const n = this.data.countdown - 1
      if (n <= 0) {
        clearInterval(this.timer)
        this.timer = null
        this.setData({ countdown: 0 })
      } else {
        this.setData({ countdown: n })
      }
    }, 1000)
  },

  async onSubmit() {
    const { email, code } = this.data
    if (!util.validateEmail(email)) {
      util.showToast('邮箱格式不正确')
      return
    }
    if (!/^\d{6}$/.test(code)) {
      util.showToast('请输入 6 位数字验证码')
      return
    }
    this.setData({ submitting: true })
    try {
      const r = await auth.verifyCode(email, code)
      if (!r.success) {
        util.showToast(r.message || '验证失败')
        return
      }
      util.showToast('认证成功', 'success')
      this.setData({ verified: true })
      auth.getUserInfo()
      this.syncUser()
      getApp().syncGlobalUser()
      setTimeout(() => {
        wx.switchTab({ url: '/pages/my/my' })
      }, 2000)
    } catch (e) {
      console.error(e)
      util.showToast('验证失败')
    } finally {
      this.setData({ submitting: false })
    }
  }
})
