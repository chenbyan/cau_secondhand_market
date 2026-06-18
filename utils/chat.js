/**
 * 站内群聊（Bmob 表 ChatRoom / ChatMessage，需在后台创建）
 * 同一 Item 对应一个群：物品=买家+卖家；跑腿接单后=发布者+骑手（+当前进入的认证用户）
 */
const Bmob = require('./bmob.js')
const auth = require('./auth.js')
const publish = require('./publish.js')

const LOCAL_ROOMS_KEY = 'chatRoomsLocal'
const LOCAL_MSG_PREFIX = 'chatMsgs_'

// null = 未检测, true = 可用, false = 不可用（表不存在）
let bmobAvailable = null

const parseJson = (v, fallback) => {
  if (!v) return fallback
  if (Array.isArray(v)) return v
  try {
    return JSON.parse(v)
  } catch (e) {
    return fallback
  }
}

const memberIdsForItem = (row, currentUserId) => {
  const sellerId = publish.getSellerId(row)
  const runnerId = (row.runnerId && row.runnerId.objectId) || row.runnerId || ''
  const ids = [sellerId]
  if (currentUserId && ids.indexOf(currentUserId) < 0) ids.push(currentUserId)
  if (row.postType === publish.POST_TYPE.ERRAND && runnerId) {
    if (ids.indexOf(runnerId) < 0) ids.push(runnerId)
  }
  return ids.filter(Boolean)
}

const roomTitle = (row) => {
  const t = (row.title || '').slice(0, 20)
  return row.postType === publish.POST_TYPE.ERRAND ? `跑腿 · ${t}` : `交易 · ${t}`
}

const tryBmobRoom = async (row, currentUserId) => {
  if (bmobAvailable === false) throw new Error('ChatRoom not available')
  try {
    const roomId = await ensureBmobRoom(row, currentUserId)
    bmobAvailable = true
    return roomId
  } catch (e) {
    bmobAvailable = false
    throw e
  }
}

const getLocalRooms = () => {
  try {
    return wx.getStorageSync(LOCAL_ROOMS_KEY) || []
  } catch (e) {
    return []
  }
}

const saveLocalRooms = (rooms) => {
  wx.setStorageSync(LOCAL_ROOMS_KEY, rooms)
}

const ensureLocalRoom = (row, currentUserId) => {
  const rooms = getLocalRooms()
  let room = rooms.find((r) => r.itemId === row.objectId)
  const members = memberIdsForItem(row, currentUserId)
  if (!room) {
    room = {
      objectId: `local_${row.objectId}`,
      itemId: row.objectId,
      title: roomTitle(row),
      memberIds: members,
      postType: row.postType || publish.POST_TYPE.GOODS,
      lastMsg: '',
      updatedAt: Date.now()
    }
    rooms.unshift(room)
    saveLocalRooms(rooms)
  } else {
    room.memberIds = [...new Set([...room.memberIds, ...members])]
    const idx = rooms.findIndex((r) => r.itemId === row.objectId)
    rooms[idx] = room
    saveLocalRooms(rooms)
  }
  return room.objectId
}

const ensureBmobRoom = async (row, currentUserId) => {
  const q = Bmob.Query('ChatRoom')
  q.equalTo('itemId', '==', row.objectId)
  q.limit(1)
  const list = await q.find()
  const members = memberIdsForItem(row, currentUserId)
  if (list && list.length) {
    const rec = await Bmob.Query('ChatRoom').get(list[0].objectId)
    rec.set('memberIds', JSON.stringify(members))
    rec.set('title', roomTitle(row))
    await rec.save()
    return list[0].objectId
  }
  const rowNew = Bmob.Query('ChatRoom')
  rowNew.set('itemId', row.objectId)
  rowNew.set('title', roomTitle(row))
  rowNew.set('memberIds', JSON.stringify(members))
  rowNew.set('postType', row.postType || publish.POST_TYPE.GOODS)
  rowNew.set('lastMsg', '群聊已创建，快发第一条消息吧')
  await rowNew.save()
  return rowNew.objectId
}

/**
 * 为 Item 创建/更新群并跳转聊天室
 */
const openChatForItem = async (itemId, options = {}) => {
  if (!auth.guardCampusAction({ tip: options.tip || '完成校园认证后可联系' })) {
    return null
  }
  const u = auth.getUserInfo()
  const row = await publish.getItem(itemId)
  if (!row) {
    wx.showToast({ title: '内容不存在', icon: 'none' })
    return null
  }
  let roomId
  try {
    roomId = await tryBmobRoom(row, u.objectId)
  } catch (e) {
    if (bmobAvailable === false) {
      console.info('ChatRoom 表未创建，使用本地会话')
    } else {
      console.warn('ChatRoom Bmob 异常，使用本地会话', e)
    }
    roomId = ensureLocalRoom(row, u.objectId)
  }
  wx.navigateTo({
    url: `/pages/chatRoom/chatRoom?roomId=${roomId}&itemId=${itemId}`
  })
  return roomId
}

const listRoomsForUser = async (userId) => {
  if (!userId) return []
  try {
    const q = Bmob.Query('ChatRoom')
    q.order('-updatedAt')
    q.limit(50)
    const all = await q.find()
    return (all || [])
      .map((r) => ({
        objectId: r.objectId,
        itemId: r.itemId,
        title: r.title,
        memberIds: parseJson(r.memberIds, []),
        lastMsg: r.lastMsg || '',
        updatedAt: r.updatedAt,
        postType: r.postType
      }))
      .filter((r) => r.memberIds.indexOf(userId) >= 0)
  } catch (e) {
    console.warn('listRooms Bmob', e)
    return getLocalRooms().filter((r) => r.memberIds.indexOf(userId) >= 0)
  }
}

const listMessages = async (roomId) => {
  if (bmobAvailable === false || (roomId && roomId.startsWith('local_'))) {
    const key = LOCAL_MSG_PREFIX + roomId
    return wx.getStorageSync(key) || []
  }
  try {
    const q = Bmob.Query('ChatMessage')
    q.equalTo('roomId', '==', roomId)
    q.order('createdAt')
    q.limit(100)
    const list = await q.find()
    bmobAvailable = true
    return (list || []).map((m) => ({
      objectId: m.objectId,
      senderId: m.senderId,
      senderName: m.senderName || '用户',
      content: m.content,
      createdAt: m.createdAt
    }))
  } catch (e) {
    bmobAvailable = false
    const key = LOCAL_MSG_PREFIX + roomId
    return wx.getStorageSync(key) || []
  }
}

const sendMessage = async (roomId, content) => {
  const u = auth.getUserInfo()
  if (!u || !u.objectId) throw new Error('请先登录')
  const text = (content || '').trim()
  if (!text) return
  const msg = {
    senderId: u.objectId,
    senderName: u.nickName || '校内用户',
    content: text,
    createdAt: new Date().toISOString()
  }
  if (bmobAvailable !== false && !roomId.startsWith('local_')) {
    try {
      const row = Bmob.Query('ChatMessage')
      row.set('roomId', roomId)
      row.set('senderId', u.objectId)
      row.set('senderName', msg.senderName)
      row.set('content', text)
      await row.save()
      try {
        const room = await Bmob.Query('ChatRoom').get(roomId)
        room.set('lastMsg', text.slice(0, 60))
        await room.save()
      } catch (e2) { /* ignore */ }
      return msg
    } catch (e) {
      bmobAvailable = false
    }
  }
  // 本地存储兜底
  const key = LOCAL_MSG_PREFIX + roomId
  const arr = wx.getStorageSync(key) || []
  arr.push({ ...msg, objectId: `m_${Date.now()}` })
  wx.setStorageSync(key, arr)
  const rooms = getLocalRooms()
  const idx = rooms.findIndex((r) => r.objectId === roomId)
  if (idx >= 0) {
    rooms[idx].lastMsg = text.slice(0, 60)
    rooms[idx].updatedAt = Date.now()
    saveLocalRooms(rooms)
  }
  return msg
}

const formatTime = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => (n < 10 ? '0' + n : '' + n)
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const roleLabel = (senderId, ctx) => {
  if (!ctx) return '成员'
  if (senderId === ctx.sellerId) return ctx.isErrand ? '发布者' : '卖家'
  if (senderId === ctx.runnerId) return '骑手'
  return '买家'
}

module.exports = {
  openChatForItem,
  listRoomsForUser,
  listMessages,
  sendMessage,
  formatTime,
  roleLabel,
  memberIdsForItem
}
