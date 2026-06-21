/**
 * 站内群聊（Bmob 表 ChatRoom / ChatMessage，需在后台创建）
 * 同一 Item 对应一个群：物品=买家+卖家；跑腿接单后=发布者+骑手（+当前进入的认证用户）
 */
const Bmob = require('./bmob.js')
const auth = require('./auth.js')
const publish = require('./publish.js')
const itemLock = require('./itemLock.js')

const LOCAL_ROOMS_KEY = 'chatRoomsLocal'
const LOCAL_MSG_PREFIX = 'chatMsgs_'
const CHAT_LAST_READ_KEY = 'chatLastRead'

// null = 未检测, true = 可用, false = 不可用（表不存在）
let bmobAvailable = null
const sendingKeys = {}

const parseJson = (v, fallback) => {
  if (!v) return fallback
  if (Array.isArray(v)) return v
  if (typeof v === 'string') {
    const trimmed = v.trim()
    if (!trimmed) return fallback
    try {
      return JSON.parse(trimmed)
    } catch (e) {
      return trimmed.split(',').map((s) => s.trim()).filter(Boolean)
    }
  }
  return fallback
}

const normUserId = (value) => {
  if (!value) return ''
  if (typeof value === 'string') return value
  return value.objectId || value.id || ''
}

const memberIncludes = (memberIds, userId) => {
  const uid = normUserId(userId)
  if (!uid) return false
  return (memberIds || []).some((id) => normUserId(id) === uid)
}

const normalizeLockBuyersForChat = (raw) => {
  if (!raw) return []
  if (Array.isArray(raw)) {
    return raw
      .map((entry) => {
        if (!entry) return ''
        if (typeof entry === 'string') return entry
        return entry.buyerId || entry.id || ''
      })
      .filter(Boolean)
  }
  return itemLock.normalizeLockBuyers(raw).map((entry) => entry.buyerId)
}

const roomTimestamp = (room) => {
  const raw = room && room.updatedAt
  if (!raw) return 0
  if (typeof raw === 'number') return raw
  if (typeof raw === 'string') return new Date(raw).getTime() || 0
  if (raw.iso) return new Date(raw.iso).getTime() || 0
  return 0
}

const isChatTableMissing = (error) => {
  const msg = String((error && error.message) || error || '').toLowerCase()
  return msg.indexOf('object not found') >= 0 || msg.indexOf('chatroom') >= 0 && msg.indexOf('not found') >= 0
}

const memberIdsForItem = (row, currentUserId) => {
  const sellerId = publish.getSellerId(row)
  const runnerId = (row.runnerId && row.runnerId.objectId) || row.runnerId || ''
  const lockBuyerId = row.lockBuyerId || ''
  const status = row.status || 'ON_SALE'

  if (row.postType !== publish.POST_TYPE.ERRAND && lockBuyerId && (status === 'IN_TRADING' || status === 'SHIPPED')) {
    return [sellerId, lockBuyerId].filter(Boolean)
  }

  const lockBuyerIds = normalizeLockBuyersForChat(row.lockBuyers)
  const ids = [sellerId]
  lockBuyerIds.forEach((buyerId) => {
    if (buyerId && ids.indexOf(buyerId) < 0) ids.push(buyerId)
  })
  const uid = normUserId(currentUserId)
  if (uid && ids.indexOf(uid) < 0) ids.push(uid)
  if (row.postType === publish.POST_TYPE.ERRAND && runnerId) {
    if (ids.indexOf(runnerId) < 0) ids.push(runnerId)
  }
  return ids.filter(Boolean)
}

const mergeMemberIds = (row, currentUserId, existingMembers) => {
  const fromItem = memberIdsForItem(row, currentUserId)
  const sellerId = publish.getSellerId(row)
  const lockBuyerId = row.lockBuyerId || ''
  const status = row.status || 'ON_SALE'
  if (row.postType !== publish.POST_TYPE.ERRAND && lockBuyerId && (status === 'IN_TRADING' || status === 'SHIPPED')) {
    return fromItem
  }
  const merged = [...parseJson(existingMembers, []), ...fromItem]
  return [...new Set(merged.map(normUserId).filter(Boolean))]
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
    if (isChatTableMissing(e)) bmobAvailable = false
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
  const members = mergeMemberIds(row, currentUserId, list && list.length ? list[0].memberIds : [])
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
  // SDK save() returns { objectId, createdAt } — the original query object is NOT mutated
  const saved = await rowNew.save()
  return saved.objectId
}

/**
 * 为 Item 创建/更新群并跳转聊天室
 */
const openChatForItem = async (itemId, options = {}) => {
  if (!auth.guardCampusAction({
    tip: options.tip || '完成校园认证后可联系',
    allowFrozen: true
  })) {
    return null
  }
  const u = auth.getUserInfo()
  // options.src === 'errand' 时从 Errand 表查询（跑腿已迁移至独立表）
  const row = options.src === 'errand'
    ? await publish.getErrand(itemId)
    : await publish.getItem(itemId)
  if (!row) {
    wx.showToast({ title: '内容不存在', icon: 'none' })
    return null
  }
  if (u.status === 'frozen') {
    const existingRooms = await listRoomsForUser(u.objectId)
    const existingRoom = existingRooms.find((room) => room.itemId === itemId)
    if (!existingRoom) {
      wx.showToast({
        title: '账号已被冻结，仅可在已有群聊中聊天',
        icon: 'none'
      })
      return null
    }
    wx.navigateTo({
      url: `/pages/chatRoom/chatRoom?roomId=${existingRoom.objectId}&itemId=${itemId}`
    })
    return existingRoom.objectId
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

const mapBmobRoom = (r) => ({
  objectId: r.objectId,
  itemId: r.itemId,
  title: r.title,
  memberIds: parseJson(r.memberIds, []).map(normUserId).filter(Boolean),
  lastMsg: r.lastMsg || '',
  updatedAt: r.updatedAt,
  postType: r.postType
})

const listRoomsForUser = async (userId) => {
  const uid = normUserId(userId)
  if (!uid) return []

  let bmobRooms = []
  try {
    const q = Bmob.Query('ChatRoom')
    q.order('-updatedAt')
    q.limit(200)
    const all = await q.find()
    bmobRooms = (all || []).map(mapBmobRoom).filter((r) => memberIncludes(r.memberIds, uid))
    bmobAvailable = true
  } catch (e) {
    console.warn('listRooms Bmob', e)
    if (isChatTableMissing(e)) bmobAvailable = false
  }

  const localRooms = getLocalRooms()
    .map((r) => ({
      ...r,
      memberIds: parseJson(r.memberIds, []).map(normUserId).filter(Boolean)
    }))
    .filter((r) => memberIncludes(r.memberIds, uid))

  const merged = new Map()
  const putRoom = (room) => {
    const key = room.itemId || room.objectId
    if (!key) return
    const prev = merged.get(key)
    if (!prev || roomTimestamp(room) >= roomTimestamp(prev)) {
      merged.set(key, room)
    }
  }
  bmobRooms.forEach(putRoom)
  localRooms.forEach(putRoom)
  return Array.from(merged.values()).sort((a, b) => roomTimestamp(b) - roomTimestamp(a))
}

const listMessages = async (roomId) => {
  if (!roomId) return []
  if (bmobAvailable === false || roomId.startsWith('local_')) {
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
    if (isChatTableMissing(e)) bmobAvailable = false
    const key = LOCAL_MSG_PREFIX + roomId
    return wx.getStorageSync(key) || []
  }
}

const sendMessage = async (roomId, content) => {
  if (!roomId) throw new Error('roomId 为空，无法发送消息')
  const u = auth.getUserInfo()
  if (!u || !u.objectId) throw new Error('请先登录')
  const text = (content || '').trim()
  if (!text) return
  const sendKey = roomId + '|' + u.objectId + '|' + text
  const now = Date.now()
  if (sendingKeys[sendKey] && now - sendingKeys[sendKey] < 3000) return null
  sendingKeys[sendKey] = now
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
      markRoomRead(roomId)
      delete sendingKeys[sendKey]
      return msg
    } catch (e) {
      if (isChatTableMissing(e)) bmobAvailable = false
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
  markRoomRead(roomId)
  delete sendingKeys[sendKey]
  return msg
}

const getLastReadMap = () => {
  try { return wx.getStorageSync(CHAT_LAST_READ_KEY) || {} } catch (e) { return {} }
}

const markRoomRead = (roomId) => {
  if (!roomId) return
  try {
    const map = getLastReadMap()
    map[roomId] = new Date().toISOString()
    wx.setStorageSync(CHAT_LAST_READ_KEY, map)
  } catch (e) {}
}

const getUnreadCountForRoom = async (roomId, roomUpdatedAtIso, userId) => {
  if (!roomId) return 0
  const map = getLastReadMap()
  const lastRead = map[roomId]
  const lastReadTs = lastRead ? new Date(lastRead).getTime() : 0
  const selfId = normUserId(userId || (auth.getUserInfo() && auth.getUserInfo().objectId))

  const countFromList = (list) => {
    return (list || []).filter((m) => {
      const senderId = normUserId(m.senderId)
      if (selfId && senderId === selfId) return false
      const mIso = typeof m.createdAt === 'string' ? m.createdAt : (m.createdAt && m.createdAt.iso) || ''
      if (!mIso) return false
      return new Date(mIso).getTime() > lastReadTs
    }).length
  }

  if (roomId.startsWith('local_')) {
    const key = LOCAL_MSG_PREFIX + roomId
    return Math.min(countFromList(wx.getStorageSync(key) || []), 99)
  }

  try {
    const q = Bmob.Query('ChatMessage')
    q.equalTo('roomId', '==', roomId)
    q.order('createdAt')
    q.limit(99)
    const list = await q.find()
    return Math.min(countFromList(list), 99)
  } catch (e) {
    if (!lastRead && roomUpdatedAtIso) return 0
    return 0
  }
}

/** 为关联跑腿子任务创建三方群聊（buyer+seller+未来的rider） */
const createLinkedErrandRoom = async (errandItemId, tradeItemTitle, memberIds) => {
  if (!errandItemId) return null
  try {
    const q = Bmob.Query('ChatRoom')
    q.equalTo('itemId', '==', errandItemId)
    q.limit(1)
    const list = await q.find()
    if (list && list.length) return list[0].objectId
    const validMembers = (memberIds || []).filter(Boolean)
    const rowNew = Bmob.Query('ChatRoom')
    rowNew.set('itemId', errandItemId)
    rowNew.set('title', `配送群聊 · ${(tradeItemTitle || '').slice(0, 20)}`)
    rowNew.set('memberIds', JSON.stringify(validMembers))
    rowNew.set('postType', 'errand')
    rowNew.set('lastMsg', '配送群聊已创建，骑手接单后将加入')
    const saved = await rowNew.save()
    return saved.objectId
  } catch (e) {
    console.warn('createLinkedErrandRoom 失败', e)
    return null
  }
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
  memberIdsForItem,
  markRoomRead,
  getUnreadCountForRoom,
  createLinkedErrandRoom
}
