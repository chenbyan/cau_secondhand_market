const auth = require('../../../utils/auth.js')
const util = require('../../../utils/util.js')
const Bmob = require('../../../utils/bmob.js')

const defaultAvatar =
  'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'

const BAD_WORDS = ['admin', '管理员', '系统']

const campuses = ['东校区', '西校区', '烟台校区', '培黎校区']

Page({
  data: {
    form: {
      nickName: '',
      avatarUrl: '',
      phone: '',
      wechatId: '',
      campus: '',
      dormitory: ''
    },
    campuses,
    campusIndex: 0,
    saving: false,
    defaultAvatar
  },

  onLoad() {
    if (!auth.checkLoginStatus()) {
      wx.redirectTo({ url: '/pages/login/login' })
      return
    }
    const u = auth.getUserInfo() || {}
    const campusIndex = Math.max(0, campuses.indexOf(u.campus || ''))
    this.setData({
      form: {
        nickName: u.nickName || '',
        avatarUrl: u.avatarUrl || '',
        phone: u.phone || '',
        wechatId: u.wechatId || '',
        campus: u.campus || '',
        dormitory: u.dormitory || ''
      },
      campusIndex
    })
  },

  onNick(e) {
    this.setData({ 'form.nickName': e.detail.value })
  },
  onPhone(e) {
    this.setData({ 'form.phone': e.detail.value })
  },
  onWechat(e) {
    this.setData({ 'form.wechatId': e.detail.value })
  },
  onDorm(e) {
    this.setData({ 'form.dormitory': e.detail.value })
  },
  onCampusChange(e) {
    const i = Number(e.detail.value)
    this.setData({
      campusIndex: i,
      'form.campus': campuses[i]
    })
  },

  async onChooseAvatar() {
    try {
      const res = await new Promise((resolve, reject) => {
        wx.chooseMedia({
          count: 1,
          mediaType: ['image'],
          sourceType: ['album', 'camera'],
          success: resolve,
          fail: reject
        })
      })
      const path = res.tempFiles[0].tempFilePath
      util.showLoading('上传中...')
      const name = `avatar_${Date.now()}.jpg`
      const file = Bmob.File(name, path)
      const uploadRes = await file.save()
      util.hideLoading()
      const url = uploadRes && uploadRes[0] && uploadRes[0].url
      if (!url) {
        util.showToast('上传失败')
        return
      }
      this.setData({ 'form.avatarUrl': url })
    } catch (e) {
      util.hideLoading()
      if (e && e.errMsg && e.errMsg.indexOf('cancel') >= 0) return
      console.error(e)
      util.showToast('选择或上传失败')
    }
  },

  filterNick(name) {
    const lower = (name || '').toLowerCase()
    return BAD_WORDS.some((w) => lower.includes(w.toLowerCase()))
  },

  async onSave() {
    const { nickName, phone, campus, dormitory, avatarUrl, wechatId } = this.data.form
    if (!nickName || nickName.length < 2 || nickName.length > 20) {
      util.showToast('昵称需 2-20 个字符')
      return
    }
    if (this.filterNick(nickName)) {
      util.showToast('昵称包含不允许的词汇')
      return
    }
    if (!util.validatePhone(phone)) {
      util.showToast('请输入正确手机号')
      return
    }
    if (!campus) {
      util.showToast('请选择校区')
      return
    }
    this.setData({ saving: true })
    try {
      await auth.updateUserInfo({
        nickName,
        phone,
        campus,
        dormitory,
        wechatId,
        avatarUrl
      })
      getApp().syncGlobalUser()
      util.showToast('保存成功', 'success')
      setTimeout(() => wx.navigateBack(), 500)
    } catch (e) {
      console.error(e)
      util.showToast((e && e.message) || '保存失败')
    } finally {
      this.setData({ saving: false })
    }
  }
})
