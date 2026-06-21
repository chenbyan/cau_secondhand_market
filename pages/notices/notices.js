const auth = require('../../utils/auth.js')
const notice = require('../../utils/notice.js')
const util = require('../../utils/util.js')

Page({
  data: {
    loading: true,
    notices: []
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: '系统通知' })
    this.loadNotices()
  },

  onShow() {
    this.loadNotices()
  },

  async loadNotices() {
    if (!auth.checkLoginStatus()) {
      this.setData({ loading: false })
      return
    }
    this.setData({ loading: true })
    try {
      const all = await notice.listNotices(100)
      const sysNotices = all.filter((n) => notice.ADMIN_TYPES.indexOf(n.type) >= 0)
      this.setData({ notices: sysNotices, loading: false })
      // 全部标记已读
      sysNotices.filter((n) => !n.read).forEach((n) => {
        notice.markRead(n.objectId).catch(() => {})
      })
      notice.syncTabBadge()
    } catch (e) {
      console.error(e)
      this.setData({ loading: false })
    }
  },

  onTapNotice(e) {
    const caseKey = e.currentTarget.dataset.caseKey
    const type = e.currentTarget.dataset.type
    if (type === 'credit_changed') return
    if (caseKey) {
      wx.navigateTo({
        url: `/pages/feedback/feedback?mode=case&caseKey=${caseKey}`,
        fail: () => util.showToast('暂无法查看')
      })
    }
  },

  onBack() {
    util.goBack()
  }
})
