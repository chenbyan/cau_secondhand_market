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
    sysGroup: { unread: 0, lastTitle: '', lastContent: '', timeText: '', count: 0 },
    orderGroups: [],
    rooms: [],
    totalUnread: 0,
    noticeUnreadCount: 0,
    chatUnreadCount: 0
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      const app = getApp()
      this.getTabBar().setData({
        selected: 1,
        messageBadge: (app && app.globalData.unreadNoticeCount) || 0
      })
    }
    this.loadAll()
  },

  onSwitchTab(e) {
    this.setData({ activeTab: e.currentTarget.dataset.tab })
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' })
  },

  async loadAll() {
    const loggedIn = auth.checkLoginStatus()
    this.setData({ loggedIn })
    if (!loggedIn) {
      this.setData({ loading: false, sysGroup: { unread: 0, count: 0 }, orderGroups: [], rooms: [], totalUnread: 0 })
      return
    }
    this.setData({ loading: true })
    try {
      const u = auth.getUserInfo()
      const [grouped, rawRooms] = await Promise.all([
        notice.listNoticesGrouped(100),
        chat.listRoomsForUser(u.objectId)
      ])

      const { sysGroup, orderGroups } = grouped

      // Add unread counts to rooms
      const rooms = await Promise.all(rawRooms.map(async (r) => {
        const updatedAtIso = typeof r.updatedAt === 'string'
          ? r.updatedAt
          : (r.updatedAt && r.updatedAt.iso) || ''
        const unread = await chat.getUnreadCountForRoom(r.objectId, updatedAtIso)
        return {
          ...r,
          unread,
          avatarText: r.postType === publish.POST_TYPE.ERRAND ? '跑' : '聊',
          timeText: chat.formatTime(updatedAtIso),
          tagText: r.postType === publish.POST_TYPE.ERRAND ? '跑腿群聊' : '交易群聊'
        }
      }))

      const noticeUnreadCount = sysGroup.unread + orderGroups.reduce((s, g) => s + g.unread, 0)
      const chatUnreadCount = rooms.reduce((s, r) => s + r.unread, 0)
      const totalUnread = noticeUnreadCount + chatUnreadCount

      const app = getApp()
      app.globalData.chatUnreadCount = chatUnreadCount  // 供 syncTabBadge 叠加
      app.globalData.unreadNoticeCount = totalUnread    // 通知 + 聊天，驱动 tabBar 红点
      app.refreshTabBadge()

      this.setData({ sysGroup, orderGroups, rooms, totalUnread, noticeUnreadCount, chatUnreadCount, loading: false })
    } catch (e) {
      console.error(e)
      this.setData({ loading: false })
    }
  },

  onOpenSysNotices() {
    wx.navigateTo({
      url: '/pages/notices/notices',
      fail: () => util.showToast('暂无法打开')
    })
  },

  onOpenOrderGroup(e) {
    const orderId = e.currentTarget.dataset.orderId
    if (!orderId) return
    wx.navigateTo({
      url: `/pages/orderDetail/orderDetail?id=${orderId}`,
      fail: () => util.showToast('无法打开订单')
    })
    // Mark all notices in this group as read
    const idx = Number(e.currentTarget.dataset.index)
    const group = this.data.orderGroups[idx]
    if (group && group.notices) {
      group.notices.filter(n => !n.read).forEach(n => {
        notice.markRead(n.objectId).catch(() => {})
      })
      setTimeout(() => { notice.syncTabBadge(); this.loadAll() }, 500)
    }
  },

  onMarkAllRead() {
    notice.markAllRead().then(() => {
      notice.syncTabBadge()
      this.loadAll()
    })
  },

  onOpenRoom(e) {
    const { roomId, itemId } = e.currentTarget.dataset
    if (!auth.guardCampusAction({ tip: '完成校园认证后可查看消息' })) return
    if (roomId && itemId) {
      wx.navigateTo({
        url: `/pages/chatRoom/chatRoom?roomId=${roomId}&itemId=${itemId}`
      })
    }
  }
})
