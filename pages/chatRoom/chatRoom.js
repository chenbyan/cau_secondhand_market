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
    scrollInto: ''
  },

  chatCtx: null,

  onBack() {
    util.goBack()
  },

  onLoad(options) {
    if (!auth.guardCampusAction({ tip: '完成校园认证后可进入群聊' })) {
      setTimeout(() => wx.navigateBack(), 300)
      return
    }
    this.setData({
      roomId: options.roomId || '',
      itemId: options.itemId || ''
    })
    this.initRoom()
  },

  async initRoom() {
    const { roomId, itemId } = this.data
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
    const mapped = list.map((m, index) => {
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
  },

  onInput(e) {
    this.setData({ inputText: e.detail.value })
  },

  async onSend() {
    const text = (this.data.inputText || '').trim()
    if (!text) return
    try {
      await chat.sendMessage(this.data.roomId, text)
      this.setData({ inputText: '' })
      await this.loadMessages()
    } catch (e) {
      console.error(e)
      wx.showToast({ title: '发送失败', icon: 'none' })
    }
  }
})
