const auth = require('../../utils/auth.js')
const chat = require('../../utils/chat.js')
const publish = require('../../utils/publish.js')
const util = require('../../utils/util.js')
Page({
  data: {
    roomId: '',
    itemId: '',
    roomTitle: '',
    isErrand: false,
    memberTags: [],
    myRoleLabel: '',
    messages: [],
    inputText: '',
    scrollInto: '',
    sending: false
  },

  chatCtx: null,
  sendingMessage: false,

  onBack() {
    util.goBack()
  },

  onLoad(options) {
    if (!auth.guardCampusAction({
      tip: '完成校园认证后可进入群聊',
      allowFrozen: true
    })) {
      setTimeout(() => wx.navigateBack(), 300)
      return
    }
    this.setData({
      roomId: options.roomId || '',
      itemId: options.itemId || ''
    })
    this.initRoom()
  },

  onShow() {
    if (this.data.roomId) {
      chat.markRoomRead(this.data.roomId)
    }
  },

  async initRoom() {
    const { roomId, itemId } = this.data
    const currentUser = auth.getUserInfo()
    if (currentUser && currentUser.status === 'frozen') {
      const existingRooms = await chat.listRoomsForUser(currentUser.objectId)
      const canAccess = existingRooms.some((room) => room.objectId === roomId)
      if (!canAccess) {
        util.showToast('账号已被冻结，仅可进入已有群聊')
        setTimeout(() => wx.navigateBack(), 300)
        return
      }
    }
    let title = '群聊'
    let isErrand = false
    const tags = []
    if (itemId) {
      try {
        const row = await publish.getItem(itemId)
        if (row) {
          title = row.title || title
          isErrand = row.postType === publish.POST_TYPE.ERRAND
          const sellerId = publish.getSellerId(row)
          const runnerId = (row.runnerId && row.runnerId.objectId) || row.runnerId || ''
          this.chatCtx = { sellerId, runnerId, isErrand }
          const u = auth.getUserInfo()
          const myRoleLabel = u ? chat.roleLabel(u.objectId, { sellerId, runnerId, isErrand }) : '成员'
          tags.push(isErrand ? '发布者' : '卖家')
          if (isErrand && runnerId) tags.push('骑手')
          else tags.push('买家')
          tags.push('群内沟通')
          this.myRoleLabel = myRoleLabel
        }
      } catch (e) {
        console.warn(e)
      }
    }
    wx.setNavigationBarTitle({ title: isErrand ? '跑腿群聊' : '交易群聊' })
    this.setData({ roomTitle: title, isErrand, memberTags: tags, myRoleLabel: this.myRoleLabel || '' })
    this.loadMessages()
  },

  async loadMessages() {
    const u = auth.getUserInfo()
    const list = await chat.listMessages(this.data.roomId)
    const deduped = []
    ;(list || []).forEach((m) => {
      const iso = typeof m.createdAt === 'string' ? m.createdAt : m.createdAt && m.createdAt.iso
      const ts = iso ? new Date(iso).getTime() : 0
      const prev = deduped[deduped.length - 1]
      const prevIso = prev && (typeof prev.createdAt === 'string' ? prev.createdAt : prev.createdAt && prev.createdAt.iso)
      const prevTs = prevIso ? new Date(prevIso).getTime() : 0
      const looksDuplicated =
        prev &&
        prev.senderId === m.senderId &&
        prev.content === m.content &&
        (!m.objectId || !prev.objectId || m.objectId !== prev.objectId) &&
        ts &&
        prevTs &&
        Math.abs(ts - prevTs) <= 3000
      if (!looksDuplicated) deduped.push(m)
    })
    const mapped = deduped.map((m, index) => {
      const iso =
        typeof m.createdAt === 'string' ? m.createdAt : m.createdAt && m.createdAt.iso
      return {
        ...m,
        isSelf: m.senderId === u.objectId,
        roleLabel: chat.roleLabel(m.senderId, this.chatCtx),
        timeText: chat.formatTime(iso)
      }
    })
    this.setData({
      messages: mapped,
      scrollInto: mapped.length ? `msg-${mapped.length - 1}` : ''
    })
    chat.markRoomRead(this.data.roomId)
  },

  onInput(e) {
    this.setData({ inputText: e.detail.value })
  },

  async onSend() {
    if (this.sendingMessage || this.data.sending) return
    const text = (this.data.inputText || '').trim()
    if (!text) return
    this.sendingMessage = true
    this.setData({ sending: true })
    try {
      await chat.sendMessage(this.data.roomId, text)
      this.setData({ inputText: '' })
      await this.loadMessages()
    } catch (e) {
      console.error(e)
      wx.showToast({ title: '发送失败', icon: 'none' })
    } finally {
      this.sendingMessage = false
      this.setData({ sending: false })
    }
  }
})
