const auth = require('../../../utils/auth.js')
const util = require('../../../utils/util.js')

const { CAMPUSES } = auth

Page({
  data: {
    verified: false,
    pending: false,
    rejected: false,
    user: {},
    email: '',
    code: '',
    campus: '',
    campuses: CAMPUSES,
    campusIndex: 0,
    countdown: 0,
    submitting: false
  },

  timer: null,

  onBack() {
    util.goBack()
  },

  onLoad() {
    if (!auth.checkLoginStatus()) {
      wx.redirectTo({ url: '/pages/login/login' })
      return
    }
    this.syncUser()
  },

  onShow() {
    if (auth.checkLoginStatus()) {
      this.syncUser()
    }
  },

  onUnload() {
    if (this.timer) clearInterval(this.timer)
  },

  async syncUser() {
    await auth.refreshCurrentUserInfo()
    const u = auth.getUserInfo() || {}
    const campus = u.campus && CAMPUSES.indexOf(u.campus) >= 0 ? u.campus : ''
    const campusIndex = campus ? CAMPUSES.indexOf(campus) : 0
    const status = u.campusVerifySt || ''
    this.setData({
      verified: !!u.campusVerified,
      pending: !u.campusVerified && status === 'PENDING',
      rejected: !u.campusVerified && status === 'REJECTED',
      user: u,
      email: u.campusEmail || '',
      campus,
      campusIndex
    })
  },

  onEmail(e) {
    this.setData({ email: e.detail.value.trim() })
  },
  onCode(e) {
    this.setData({ code: e.detail.value.trim() })
  },

  onCampusChange(e) {
    const i = Number(e.detail.value)
    this.setData({
      campusIndex: i,
      campus: CAMPUSES[i]
    })
  },

  async onSendCode() {
    const { email, campus } = this.data
    if (!campus) {
      util.showToast('请先选择校区')
      return
    }
    if (!util.validateEmail(email)) {
      util.showToast('请输入有效的 @cau.edu.cn 邮箱')
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
    const { email, code, campus } = this.data
    if (!campus) {
      util.showToast('请选择东校区或西校区')
      return
    }
    if (!util.validateEmail(email)) {
      util.showToast('请输入有效的 @cau.edu.cn 邮箱')
      return
    }
    if (!/^\d{6}$/.test(code)) {
      util.showToast('请输入 6 位数字验证码')
      return
    }
    this.setData({ submitting: true })
    try {
      const r = await auth.verifyCode(email, code, campus)
      if (!r.success) {
        util.showToast(r.message || '验证失败')
        return
      }
      util.showToast(r.message || '已提交审核', 'success')
      await this.syncUser()
      getApp().syncGlobalUser()
      if (r.message && r.message.indexOf('等待') >= 0) {
        return
      }
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
