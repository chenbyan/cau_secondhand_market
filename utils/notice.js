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
  CASE_CLOSED: 'case_closed'
}

const TYPE_LABEL = {
  report_received: '收到举报',
  report_reply: '案卷回应',
  dispute_received: '订单申诉',
  dispute_update: '案卷更新',
  case_closed: '处理结果'
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
    title: '收到新的内容举报',
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
    title: '订单收到申诉',
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
  const ids = (notifyUserIds || []).filter((id) => id && id !== authorId)
  for (let i = 0; i < ids.length; i++) {
    await createNotice({
      userId: ids[i],
      type: NOTICE_TYPE.REPORT_REPLY,
      title: roleText,
      content: `案卷「${caseTitle || caseKey}」有新动态，点击查看。`,
      caseKey
    })
  }
}

/** 撤销 / 管理员结案等 */
async function notifyCaseUpdate(userIds, caseKey, caseTitle, title, content, type) {
  const ids = [...new Set((userIds || []).filter(Boolean))]
  for (let i = 0; i < ids.length; i++) {
    await createNotice({
      userId: ids[i],
      type: type || NOTICE_TYPE.DISPUTE_UPDATE,
      title,
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

async function listNotices(limit = 50) {
  const u = auth.getUserInfo()
  if (!u || !u.objectId) return []
  try {
    const q = Bmob.Query('UserNotice')
    q.equalTo('userId', '==', u.objectId)
    q.order('-createdAt')
    q.limit(limit)
    const list = await q.find()
    return (list || [])
      .filter((row) => row.type !== 'init' && row.userId !== '_init')
      .map((row) => ({
      objectId: row.objectId,
      type: row.type || '',
      typeLabel: TYPE_LABEL[row.type] || '通知',
      title: row.title || '',
      content: row.content || '',
      caseKey: row.caseKey || '',
      disputeId: row.disputeId || '',
      read: !!row.read,
      timeText: formatNoticeTime(row.createdAt),
      createdAt: row.createdAt
    }))
  } catch (e) {
    if (/object not found.*UserNotice/i.test(String(e.error || e.message || ''))) {
      return []
    }
    throw e
  }
}

async function countUnread() {
  const list = await listNotices(100)
  return list.filter((n) => !n.read).length
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

function syncTabBadge() {
  const app = getApp()
  if (!app) return
  countUnread()
    .then((n) => {
      app.globalData.unreadNoticeCount = n
      if (typeof app.refreshTabBadge === 'function') {
        app.refreshTabBadge()
      }
    })
    .catch(() => {})
}

module.exports = {
  NOTICE_TYPE,
  TYPE_LABEL,
  createNotice,
  notifyReportReceived,
  notifyDisputeReceived,
  notifyCaseReply,
  notifyCaseUpdate,
  listNotices,
  countUnread,
  markRead,
  markAllRead,
  syncTabBadge
}
