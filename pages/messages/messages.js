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
    noticeGroups: [],
    orderGroups: [],
    rooms: [],
    totalUnread: 0,
    noticeUnreadCount: 0,
    chatUnreadCount: 0,
    markingAllRead: false
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
      this.setData({ loading: false, noticeGroups: [], orderGroups: [], rooms: [], totalUnread: 0 })
      return
    }
    this.setData({ loading: true })
    try {
      const u = auth.getUserInfo()
      const [grouped, rawRooms] = await Promise.all([
        notice.listNoticesGrouped(100),
        chat.listRoomsForUser(u.objectId)
      ])

      const { noticeGroups, orderGroups } = grouped

      // Add unread counts to rooms
      const rooms = await Promise.all(rawRooms.map(async (r) => {
        const updatedAtIso = typeof r.updatedAt === 'string'
          ? r.updatedAt
          : (r.updatedAt && r.updatedAt.iso) || ''
        const unread = await chat.getUnreadCountForRoom(r.objectId, updatedAtIso, u.objectId)
        return {
          ...r,
          unread,
          avatarText: r.postType === publish.POST_TYPE.ERRAND ? '跑' : '聊',
          timeText: chat.formatTime(updatedAtIso),
          tagText: r.postType === publish.POST_TYPE.ERRAND ? '跑腿群聊' : '交易群聊'
        }
      }))

      const noticeUnreadCount =
        noticeGroups.reduce((s, g) => s + g.unread, 0) +
        orderGroups.reduce((s, g) => s + g.unread, 0)
      const chatUnreadCount = rooms.reduce((s, r) => s + r.unread, 0)
      const totalUnread = noticeUnreadCount + chatUnreadCount

      const app = getApp()
      app.globalData.chatUnreadCount = chatUnreadCount
      app.globalData.unreadNoticeCount = totalUnread
      app.refreshTabBadge()

      this.setData({ noticeGroups, orderGroups, rooms, totalUnread, noticeUnreadCount, chatUnreadCount, loading: false })
    } catch (e) {
      console.error(e)
      this.setData({ loading: false })
    }
  },

  onOpenNoticeGroup(e) {
    const category = e.currentTarget.dataset.category || ''
    wx.navigateTo({
      url: `/pages/notices/notices?category=${category}`,
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

  async onMarkAllRead() {
    if (this.data.markingAllRead || this.data.totalUnread <= 0) return

    const rooms = this.data.rooms || []
    const noticeGroups = this.data.noticeGroups || []
    const orderGroups = this.data.orderGroups || []
    const app = getApp()

    rooms.forEach((room) => chat.markRoomRead(room.objectId))
    if (app && app.globalData) {
      app.globalData.chatUnreadCount = 0
      app.globalData.unreadNoticeCount = 0
      if (typeof app.refreshTabBadge === 'function') {
        app.refreshTabBadge()
      }
    }

    this.setData({
      markingAllRead: true,
      noticeGroups: noticeGroups.map((group) => ({
        ...group,
        unread: 0,
        notices: (group.notices || []).map((n) => ({ ...n, read: true }))
      })),
      orderGroups: orderGroups.map((group) => ({
        ...group,
        unread: 0,
        notices: (group.notices || []).map((n) => ({ ...n, read: true }))
      })),
      rooms: rooms.map((room) => ({ ...room, unread: 0 })),
      totalUnread: 0,
      noticeUnreadCount: 0,
      chatUnreadCount: 0
    })

    try {
      await notice.markAllRead()
      notice.syncTabBadge()
      await this.loadAll()
    } catch (e) {
      console.error(e)
      util.showToast('标记已读失败')
      await this.loadAll()
    } finally {
      this.setData({ markingAllRead: false })
    }
  },

  onOpenRoom(e) {
    const { roomId, itemId } = e.currentTarget.dataset
    if (!auth.guardCampusAction({
      tip: '完成校园认证后可查看消息',
      allowFrozen: true
    })) return
    if (roomId && itemId) {
      chat.markRoomRead(roomId)
      wx.navigateTo({
        url: `/pages/chatRoom/chatRoom?roomId=${roomId}&itemId=${itemId}`
      })
    }
  }
})
