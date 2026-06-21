/**
 * 站内通知 UserNotice 表（消息 Tab 展示）
 */
const Bmob = require('./bmob.js')
const auth = require('./auth.js')
const util = require('./util.js')

const NOTICE_TYPE = {
  REPORT_RECEIVED: 'report_received',
  REPORT_REPLY: 'report_reply',
  DISPUTE_RECEIVED: 'dispute_received',
  DISPUTE_UPDATE: 'dispute_update',
  CASE_CLOSED: 'case_closed',
  ORDER_LOCKED: 'order_locked',
  ORDER_CONFIRMED: 'order_confirmed',
  BUYER_PAID: 'buyer_paid',
  SELLER_RECEIVED: 'seller_received',
  ORDER_CANCELLED: 'order_cancelled',
  ERRAND_REQUESTED: 'errand_requested',
  ERRAND_ACCEPTED: 'errand_accepted',
  ERRAND_CONFIRMED: 'errand_confirmed',
  ERRAND_CANCEL_ACCEPT: 'errand_cancel_accept',
  ERRAND_COMPLETED: 'errand_completed',
  ERRAND_PICKUP: 'errand_pickup',
  ERRAND_DELIVERED: 'errand_delivered',
  ORDER_REVIEWED: 'order_reviewed',
  CREDIT_CHANGED: 'credit_changed',
  ITEM_OFFLINE: 'item_offline',
  USER_STATUS: 'user_status',
}

const ORDER_TYPES = [
  'order_locked', 'order_confirmed', 'buyer_paid', 'seller_received',
  'order_cancelled', 'errand_requested', 'errand_accepted', 'errand_confirmed',
  'errand_cancel_accept', 'errand_pickup', 'errand_delivered', 'errand_completed',
  'order_reviewed'
]

// 后台/案卷类通知类型（在消息页按业务分类展示）
const ADMIN_TYPES = [
  'report_received', 'report_reply', 'dispute_received', 'dispute_update', 'case_closed',
  'credit_changed', 'item_offline', 'user_status'
]

const NOTICE_CATEGORY = {
  CREDIT: 'credit',
  USER_STATUS: 'user_status',
  DISPUTE: 'dispute',
  ORDER: 'order'
}

const NOTICE_CATEGORY_META = {
  credit: {
    title: '信用分变更通知',
    avatarText: '信',
    avatarClass: 'credit-avatar',
    tagText: '信用分加减 · 账号信用状态'
  },
  user_status: {
    title: '用户状态通知',
    avatarText: '状',
    avatarClass: 'status-avatar',
    tagText: '账号冻结 / 解冻 · 账号状态'
  },
  dispute: {
    title: '纠纷通知',
    avatarText: '纠',
    avatarClass: 'dispute-avatar',
    tagText: '申诉 · 举报 · 胜诉结果'
  },
  order: {
    title: '订单通知',
    avatarText: '订',
    avatarClass: 'order-avatar',
    tagText: '交易订单 · 跑腿订单'
  }
}

const NOTICE_CATEGORY_ORDER = [
  NOTICE_CATEGORY.CREDIT,
  NOTICE_CATEGORY.USER_STATUS,
  NOTICE_CATEGORY.DISPUTE,
  NOTICE_CATEGORY.ORDER
]

const TYPE_LABEL = {
  report_received: '收到举报',
  report_reply: '案卷回应',
  dispute_received: '订单申诉',
  dispute_update: '案卷更新',
  case_closed: '处理结果',
  order_locked: '买家已拍下',
  order_confirmed: '卖家已确认',
  buyer_paid: '买家已付款',
  seller_received: '交易完成',
  order_cancelled: '订单已取消',
  errand_requested: '跑腿申请',
  errand_accepted: '骑手已接单',
  errand_confirmed: '接单已确认',
  errand_cancel_accept: '骑手已取消',
  errand_completed: '跑腿已完成',
  errand_pickup: '骑手已取件',
  errand_delivered: '跑腿已送达',
  order_reviewed: '收到评价',
  credit_changed: '信用分变更',
  item_offline: '商品下架',
  user_status: '用户状态',
}

function getNoticeCategory(type) {
  if (type === NOTICE_TYPE.CREDIT_CHANGED) return NOTICE_CATEGORY.CREDIT
  if (type === NOTICE_TYPE.USER_STATUS) return NOTICE_CATEGORY.USER_STATUS
  if (ORDER_TYPES.indexOf(type) >= 0) return NOTICE_CATEGORY.ORDER
  if (ADMIN_TYPES.indexOf(type) >= 0) return NOTICE_CATEGORY.DISPUTE
  return ''
}

function extractQuotedName(text) {
  const m = String(text || '').match(/「([^」]+)」/)
  return m ? m[1].trim() : ''
}

function extractSubjectName(row) {
  if (!row) return ''
  const fromContent = extractQuotedName(row.content)
  if (fromContent) return fromContent
  const fromTitle = extractQuotedName(row.title)
  if (fromTitle) return fromTitle
  return ''
}

function normalizeNoticeTitle(row) {
  if (!row) return ''
  if (row.type === NOTICE_TYPE.ITEM_OFFLINE) return '商品违规，请整改后再上架'
  if (row.title === '商品已下架，请整改后再上架') return '商品违规，请整改后再上架'
  return row.title || ''
}

function buildNoticeDisplayTitle(row) {
  if (!row) return ''
  const type = row.type || ''
  const subject = extractSubjectName(row) || (row.itemTitle || '')
  const base = normalizeNoticeTitle(row) || TYPE_LABEL[type] || '通知'

  if (type === NOTICE_TYPE.REPORT_RECEIVED) {
    return subject ? `收到举报 · ${subject}` : '收到新的内容举报'
  }
  if (type === NOTICE_TYPE.DISPUTE_RECEIVED) {
    return subject ? `订单申诉 · ${subject}` : '订单收到申诉'
  }
  if (type === NOTICE_TYPE.ITEM_OFFLINE) {
    return subject ? `商品下架整改 · ${subject}` : '商品违规，请整改后再上架'
  }
  if (type === NOTICE_TYPE.CASE_CLOSED) {
    return subject ? `处理结果 · ${subject}` : base
  }
  if (type === NOTICE_TYPE.REPORT_REPLY || type === NOTICE_TYPE.DISPUTE_UPDATE) {
    return subject ? `${base} · ${subject}` : base
  }
  if (ORDER_TYPES.indexOf(type) >= 0) {
    const orderHint = row.disputeId ? `订单 ${String(row.disputeId).slice(-8)}` : ''
    if (subject) return `${base} · ${subject}`
    if (orderHint) return `${base} · ${orderHint}`
  }
  return base
}

async function createNotice(payload) {
  const {
    userId,
    type,
    title,
    content,
    caseKey = '',
    disputeId = ''
  } = payload
  if (!userId || !type || !title) return null
  try {
    const row = Bmob.Query('UserNotice')
    row.set('userId', userId)
    row.set('type', type)
    row.set('title', title)
    row.set('content', String(content || '').slice(0, 200))
    if (caseKey) row.set('caseKey', caseKey)
    if (disputeId) row.set('disputeId', disputeId)
    row.set('read', false)
    return await row.save()
  } catch (e) {
    console.warn('UserNotice 写入失败（请建 UserNotice 表）', e)
    return null
  }
}

/** 举报：通知被举报方 */
async function notifyReportReceived(respondentId, caseKey, caseTitle, reporterId) {
  if (!respondentId || respondentId === reporterId) return
  await createNotice({
    userId: respondentId,
    type: NOTICE_TYPE.REPORT_RECEIVED,
    title: caseTitle ? `收到举报 · ${caseTitle}` : '收到新的内容举报',
    content: `「${caseTitle || '您的发布'}」被举报，请尽快查看并回应。`,
    caseKey
  })
}

/** 订单申诉：通知对方 */
async function notifyDisputeReceived(respondentId, caseKey, caseTitle, orderId) {
  if (!respondentId) return
  await createNotice({
    userId: respondentId,
    type: NOTICE_TYPE.DISPUTE_RECEIVED,
    title: caseTitle ? `订单申诉 · ${caseTitle}` : '订单收到申诉',
    content: `订单相关商品「${caseTitle || orderId}」被对方发起申诉，订单已冻结。`,
    caseKey,
    disputeId: orderId
  })
}

/** 案卷内有人回应：通知其他参与方 */
async function notifyCaseReply(caseKey, caseTitle, authorId, authorRole, notifyUserIds) {
  const roleText =
    authorRole === 'respondent'
      ? '被举报方已回应'
      : authorRole === 'reporter'
        ? '举报方补充说明'
        : '参与方补充说明'
  const displayTitle = caseTitle ? `${roleText} · ${caseTitle}` : roleText
  const ids = (notifyUserIds || []).filter((id) => id && id !== authorId)
  for (let i = 0; i < ids.length; i++) {
    await createNotice({
      userId: ids[i],
      type: NOTICE_TYPE.REPORT_REPLY,
      title: displayTitle,
      content: `案卷「${caseTitle || caseKey}」有新动态，点击查看。`,
      caseKey
    })
  }
}

/** 撤销 / 管理员结案等 */
async function notifyCaseUpdate(userIds, caseKey, caseTitle, title, content, type) {
  const ids = [...new Set((userIds || []).filter(Boolean))]
  const subject = (caseTitle || '').trim()
  const displayTitle =
    subject && title && title.indexOf(subject) < 0 ? `${title} · ${subject}` : (title || subject)
  for (let i = 0; i < ids.length; i++) {
    await createNotice({
      userId: ids[i],
      type: type || NOTICE_TYPE.DISPUTE_UPDATE,
      title: displayTitle,
      content: content || caseTitle,
      caseKey
    })
  }
}

function formatNoticeTime(raw) {
  if (!raw) return ''
  if (typeof raw === 'string') return util.formatTime(raw)
  if (raw.iso) return util.formatTime(raw.iso)
  return ''
}

async function resolveNoticeSubject(row, cache) {
  const fromText = extractSubjectName(row)
  if (fromText) return fromText
  const type = row.type || ''
  const itemCache = (cache && cache.item) || {}
  const disputeCache = (cache && cache.dispute) || {}
  if (type === NOTICE_TYPE.ITEM_OFFLINE && row.disputeId) {
    if (itemCache[row.disputeId]) return itemCache[row.disputeId]
    try {
      const item = await Bmob.Query('Item').get(row.disputeId)
      const title = item.title || ''
      itemCache[row.disputeId] = title
      return title
    } catch (e) {}
  }
  const caseKey = row.caseKey || ''
  if (caseKey.indexOf('ITEM:') === 0) {
    const itemId = caseKey.slice(5)
    if (itemCache[itemId]) return itemCache[itemId]
    try {
      const item = await Bmob.Query('Item').get(itemId)
      const title = item.title || ''
      itemCache[itemId] = title
      return title
    } catch (e) {}
  }
  if (row.disputeId && (type === NOTICE_TYPE.CASE_CLOSED || type === NOTICE_TYPE.DISPUTE_UPDATE)) {
    if (disputeCache[row.disputeId]) return disputeCache[row.disputeId]
    try {
      const dispute = await Bmob.Query('Dispute').get(row.disputeId)
      const title = dispute.caseTitle || ''
      disputeCache[row.disputeId] = title
      return title
    } catch (e) {}
  }
  return ''
}

async function listNotices(limit = 50) {
  const u = auth.getUserInfo()
  if (!u || !u.objectId) return []
  try {
    const q = Bmob.Query('UserNotice')
    q.equalTo('userId', '==', u.objectId)
    q.order('-createdAt')
    q.limit(limit)
    const list = await q.find()
    const filtered = (list || [])
      .filter((row) => row.type !== 'init' && row.userId !== '_init')
    const mapped = []
    const entityCache = { item: {}, dispute: {} }
    for (let i = 0; i < filtered.length; i++) {
      const row = filtered[i]
      const itemTitle = await resolveNoticeSubject(row, entityCache)
      const displayRow = {
        type: row.type || '',
        title: row.title || '',
        content: row.content || '',
        disputeId: row.disputeId || '',
        itemTitle
      }
      mapped.push({
        objectId: row.objectId,
        type: row.type || '',
        typeLabel: TYPE_LABEL[row.type] || '通知',
        title: buildNoticeDisplayTitle(displayRow),
        content: row.content || '',
        caseKey: row.caseKey || '',
        disputeId: row.disputeId || '',
        read: !!row.read,
        timeText: formatNoticeTime(row.createdAt),
        createdAt: row.createdAt
      })
    }
    return mapped
  } catch (e) {
    if (/object not found.*UserNotice/i.test(String(e.error || e.message || ''))) {
      return []
    }
    throw e
  }
}

async function countUnread() {
  const u = auth.getUserInfo()
  if (!u || !u.objectId) return 0
  try {
    const q = Bmob.Query('UserNotice')
    q.equalTo('userId', '==', u.objectId)
    q.equalTo('read', '==', false)
    q.limit(200)
    const list = await q.find()
    return (list || []).filter((row) => row.type !== 'init' && row.userId !== '_init').length
  } catch (e) {
    if (/object not found.*UserNotice/i.test(String(e.error || e.message || ''))) {
      return 0
    }
    console.warn('countUnread', e)
    return 0
  }
}

async function markRead(noticeId) {
  if (!noticeId) return
  try {
    const row = await Bmob.Query('UserNotice').get(noticeId)
    row.set('read', true)
    await row.save()
  } catch (e) {
    console.warn('标记已读失败', e)
  }
}

async function markAllRead() {
  const u = auth.getUserInfo()
  if (!u || !u.objectId) return
  const list = await listNotices(100)
  const unread = list.filter((n) => !n.read)
  for (let i = 0; i < unread.length; i++) {
    await markRead(unread[i].objectId)
  }
}

let lastBadgeSyncAt = 0
const BADGE_SYNC_MIN_MS = 30000

function syncTabBadge() {
  const app = getApp()
  if (!app) return
  const now = Date.now()
  if (now - lastBadgeSyncAt < BADGE_SYNC_MIN_MS) return
  lastBadgeSyncAt = now
  countUnread()
    .then((n) => {
      const chatUnread = (app.globalData && app.globalData.chatUnreadCount) || 0
      app.globalData.unreadNoticeCount = n + chatUnread
      if (typeof app.refreshTabBadge === 'function') {
        app.refreshTabBadge()
      }
    })
    .catch(() => {})
}

/** 订单状态变更通知（复用 disputeId 存 orderId，caseKey 存 itemId） */
async function notifyOrderEvent(toUserId, type, title, content, orderId, itemId) {
  if (!toUserId) return null
  return createNotice({
    userId: toUserId,
    type,
    title,
    content: String(content || ''),
    caseKey: itemId || '',
    disputeId: orderId || ''
  })
}

/** 通知列表分组：后台通知（按信用/商品/纠纷分类）+ 订单通知（每个订单一组） */
async function listNoticesGrouped(limit = 100) {
  const all = await listNotices(limit)

  const categoryMap = {}
  NOTICE_CATEGORY_ORDER.forEach((category) => {
    categoryMap[category] = []
  })
  all.forEach((n) => {
    const category = getNoticeCategory(n.type)
    if (category && categoryMap[category]) {
      categoryMap[category].push(n)
    }
  })

  const noticeGroups = NOTICE_CATEGORY_ORDER.map((category) => {
    const notices = categoryMap[category] || []
    if (!notices.length) return null
    const meta = NOTICE_CATEGORY_META[category]
    const first = notices[0]
    return {
      category,
      title: meta.title,
      avatarText: meta.avatarText,
      avatarClass: meta.avatarClass,
      tagText: meta.tagText,
      unread: notices.filter((n) => !n.read).length,
      count: notices.length,
      lastTitle: first ? first.title : '',
      lastContent: first ? first.content : '',
      timeText: first ? first.timeText : '',
      notices
    }
  }).filter(Boolean)

  return { noticeGroups, orderGroups: [] }
}

module.exports = {
  NOTICE_TYPE,
  NOTICE_CATEGORY,
  NOTICE_CATEGORY_META,
  NOTICE_CATEGORY_ORDER,
  ADMIN_TYPES,
  TYPE_LABEL,
  getNoticeCategory,
  createNotice,
  notifyReportReceived,
  notifyDisputeReceived,
  notifyCaseReply,
  notifyCaseUpdate,
  notifyOrderEvent,
  listNotices,
  listNoticesGrouped,
  countUnread,
  markRead,
  markAllRead,
  syncTabBadge
}
