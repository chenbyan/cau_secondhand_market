const auth = require('../../utils/auth.js')
const notice = require('../../utils/notice.js')
const util = require('../../utils/util.js')

Page({
  data: {
    loading: true,
    notices: [],
    category: '',
    emptyTitle: '暂无通知'
  },

  onLoad(options) {
    const rawCategory = (options && options.category) || ''
    const meta = rawCategory ? notice.NOTICE_CATEGORY_META[rawCategory] : null
    const category = meta ? rawCategory : ''
    const title = meta ? meta.title : '通知详情'
    this.setData({
      category,
      emptyTitle: meta ? `暂无${meta.title}` : '暂无通知'
    })
    wx.setNavigationBarTitle({ title })
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
      const category = this.data.category
      const filtered = category
        ? all.filter((n) => notice.getNoticeCategory(n.type) === category)
        : all.filter((n) => notice.getNoticeCategory(n.type))
      this.setData({ notices: filtered, loading: false })
      // 全部标记已读
      filtered.filter((n) => !n.read).forEach((n) => {
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
    const orderId = e.currentTarget.dataset.orderId
    const type = e.currentTarget.dataset.type
    const category = notice.getNoticeCategory(type)
    if (category === notice.NOTICE_CATEGORY.CREDIT || category === notice.NOTICE_CATEGORY.USER_STATUS) return
    if (category === notice.NOTICE_CATEGORY.ORDER && orderId) {
      wx.navigateTo({
        url: `/pages/orderDetail/orderDetail?id=${orderId}`,
        fail: () => util.showToast('无法打开订单')
      })
      return
    }
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
