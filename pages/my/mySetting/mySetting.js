const auth = require('../../../utils/auth.js')
const util = require('../../../utils/util.js')
const cloudStorage = require('../../../utils/cloudStorage.js')
const cloudImage = require('../../../utils/cloudImage.js')
const { CLOUD_STORAGE_ENABLED } = require('../../../utils/cloudConfig.js')

const defaultAvatar =
  'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'

const BAD_WORDS = ['admin', '管理员', '系统']

const campuses = auth.CAMPUSES

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
    avatarDisplay: '',
    campuses,
    campusIndex: 0,
    saving: false,
    uploadingAvatar: false,
    defaultAvatar
  },

  onBack() {
    util.goBack()
  },

  async onLoad() {
    if (!auth.checkLoginStatus()) {
      wx.redirectTo({ url: '/pages/login/login' })
      return
    }
    const u = auth.getUserInfo() || {}
    let campus = u.campus || ''
    let campusIndex = campuses.indexOf(campus)
    if (campusIndex < 0) {
      campus = ''
      campusIndex = 0
    }
    let avatarDisplay = u.avatarUrl || ''
    if (avatarDisplay && cloudImage.isCloudFileId(avatarDisplay)) {
      try {
        avatarDisplay = await cloudImage.resolveImageUrl(avatarDisplay)
      } catch (e) {
        console.warn('头像预览解析失败', e)
        avatarDisplay = ''
      }
    }
    this.setData({
      form: {
        nickName: u.nickName || '',
        avatarUrl: u.avatarUrl || '',
        phone: u.phone || '',
        wechatId: u.wechatId || '',
        campus,
        dormitory: u.dormitory || ''
      },
      avatarDisplay,
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
    if (this.data.uploadingAvatar) return
    try {
      const res = await new Promise((resolve, reject) => {
        wx.chooseMedia({
          count: 1,
          mediaType: ['image'],
          sourceType: ['album', 'camera'],
          sizeType: ['compressed'],
          success: resolve,
          fail: reject
        })
      })
      const path = res.tempFiles[0].tempFilePath
      this.setData({ uploadingAvatar: true })
      util.showLoading('上传中...')

      let storedUrl = ''
      let displayUrl = ''

      if (CLOUD_STORAGE_ENABLED) {
        storedUrl = await cloudStorage.uploadImage(path, 'avatars')
        displayUrl = await cloudImage.resolveImageUrl(storedUrl)
      } else {
        const Bmob = require('../../../utils/bmob.js')
        const file = Bmob.File(`avatar_${Date.now()}.jpg`, path)
        const uploadRes = await file.save()
        const item = uploadRes && uploadRes[0]
        storedUrl =
          (item && (item.url || item.cdnUrl)) ||
          (typeof item === 'string' ? item : '')
        displayUrl = storedUrl
      }

      util.hideLoading()
      if (!storedUrl) {
        util.showToast('上传失败，未返回地址')
        return
      }
      this.setData({
        'form.avatarUrl': storedUrl,
        avatarDisplay: displayUrl || storedUrl
      })
      util.showToast('头像已更新，记得点保存', 'success')
    } catch (e) {
      util.hideLoading()
      if (e && e.errMsg && e.errMsg.indexOf('cancel') >= 0) return
      console.error(e)
      const msg =
        (e && e.message) ||
        (e && e.errMsg) ||
        '上传失败，请确认已开通云开发且 cloudConfig 环境 ID 正确'
      util.showToast(msg)
    } finally {
      this.setData({ uploadingAvatar: false })
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
        avatarUrl,
        userPic: avatarUrl
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
