const auth = require('../../utils/auth.js')
const chat = require('../../utils/chat.js')
const notice = require('../../utils/notice.js')
const publish = require('../../utils/publish.js')
const util = require('../../utils/util.js')

Page({
  data: {
    loggedIn: false,
    loading: true,
    activeTab: 'all',
    notices: [],
    rooms: [],
    unreadCount: 0
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 })
    }
    this.loadAll()
  },

  onSwitchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' })
  },

  async loadAll() {
    const loggedIn = auth.checkLoginStatus()
    this.setData({ loggedIn })
    if (!loggedIn) {
      this.setData({ loading: false, notices: [], rooms: [], unreadCount: 0 })
      return
    }
    this.setData({ loading: true })
    try {
      const u = auth.getUserInfo()
      const [notices, raw, unreadCount] = await Promise.all([
        notice.listNotices(50),
        chat.listRoomsForUser(u.objectId),
        notice.countUnread()
      ])
      const rooms = raw.map((r) => ({
        ...r,
        avatarText: r.postType === publish.POST_TYPE.ERRAND ? '跑' : '聊',
        timeText: chat.formatTime(
          typeof r.updatedAt === 'string'
            ? r.updatedAt
            : r.updatedAt && r.updatedAt.iso
        ),
        tagText:
          r.postType === publish.POST_TYPE.ERRAND
            ? '跑腿群聊 · 发布者/骑手'
            : '交易群聊 · 买家/卖家'
      }))
      const app = getApp()
      app.globalData.unreadNoticeCount = unreadCount
      app.refreshTabBadge()
      this.setData({ notices, rooms, unreadCount, loading: false })
    } catch (e) {
      console.error(e)
      this.setData({ loading: false, notices: [], rooms: [] })
    }
  },

  onOpenNotice(e) {
    const idx = Number(e.currentTarget.dataset.index)
    const item = this.data.notices[idx]
    if (!item) return

    const caseKey = (item.caseKey || '').trim()
    const url = caseKey
      ? `/pages/feedback/feedback?mode=case&caseKey=${encodeURIComponent(caseKey)}`
      : '/pages/feedback/feedback?mode=list'

    wx.navigateTo({
      url,
      fail: (err) => {
        console.error('navigateTo feedback', err)
        util.showToast('无法打开案卷，请重试')
      }
    })

    if (item.objectId) {
      notice.markRead(item.objectId).then(() => {
        notice.syncTabBadge()
        setTimeout(() => this.loadAll(), 500)
      })
    }
  },

  async onMarkAllRead() {
    await notice.markAllRead()
    notice.syncTabBadge()
    this.loadAll()
  },

  onOpenRoom(e) {
    const { roomId, itemId } = e.currentTarget.dataset
    if (!auth.guardCampusAction({ tip: '完成校园认证后可查看消息' })) {
      return
    }
    if (itemId) {
      wx.navigateTo({
        url: `/pages/chatRoom/chatRoom?roomId=${roomId}&itemId=${itemId}`
      })
    }
  }
})
