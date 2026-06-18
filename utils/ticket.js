/**
 * 申诉 / 举报 — Dispute 工单 + DisputeReply 过程链（按 caseKey 归并）
 */
const Bmob = require('./bmob.js')
const auth = require('./auth.js')
const notice = require('./notice.js')
const credit = require('./credit.js')

const TICKET_TYPE = {
  DISPUTE: 'DISPUTE',
  REPORT: 'REPORT'
}

const OPEN_STATUSES = ['SUBMITTED', 'UNDER_REVIEW']

const TERMINAL_ORDER = ['COMPLETED', 'CANCELLED']

const STATUS_LABEL = {
  SUBMITTED: '待受理',
  UNDER_REVIEW: '审核中',
  CLOSED: '已结案'
}

const LIABILITY_LABEL = {
  none: '无责任方',
  buyer: '买家责任',
  seller: '卖家责任',
  submitter: '提交方责任',
  respondent: '被举报方责任'
}

const ORDER_OUTCOME_LABEL = {
  COMPLETED: '订单完成',
  CANCELLED: '订单取消'
}

const REPORT_OUTCOME_LABEL = {
  OFFLINE_RECTIFY: '下架整改',
  NO_ACTION: '不下架，仅记录处理'
}

const ROLE_LABEL = {
  reporter: '举报方',
  respondent: '被举报方',
  participant: '参与方',
  admin: '管理员'
}

const MAX_EVIDENCE_IMAGES = 3

const TICKET_TYPE_LABEL = {
  DISPUTE: '订单申诉',
  REPORT: '内容举报'
}

function trimReason(reason) {
  return String(reason || '')
    .trim()
    .slice(0, 500)
}

function parseEvidenceList(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : [String(parsed)]
  } catch (e) {
    return [String(raw)]
  }
}

function serializeEvidence(imageIds) {
  const list = (imageIds || []).filter(Boolean)
  if (!list.length) return ''
  return JSON.stringify(list)
}

function isReportRectifyRow(row) {
  if (!row || (row.ticketType || '') !== TICKET_TYPE.REPORT) return false
  const reportOutcome = row.reportOutcome || row.itemAction || ''
  const note = row.decisionNote || row.rejectReason || ''
  return reportOutcome === 'OFFLINE_RECTIFY' || (!reportOutcome && /下架|整改/.test(note))
}

function isRejectedRow(row) {
  if (!row) return false
  if (row.reportOutcome || row.itemAction || isReportRectifyRow(row)) return false
  if (row.rejected === true || row.decisionType === 'REJECTED' || row.resolutionType === 'REJECTED') {
    return true
  }
  const note = row.rejectReason || row.decisionNote || ''
  const delta = row.creditDelta != null ? Number(row.creditDelta) : 0
  return (
    row.status === 'CLOSED' &&
    row.liabilityParty === 'none' &&
    !row.orderOutcome &&
    !delta &&
    !!note &&
    note.indexOf('用户自行撤销') < 0
  )
}

function statusLabelForRow(row) {
  const note = row.decisionNote || ''
  const reportOutcome = row.reportOutcome || row.itemAction || ''
  if (row.status === 'CLOSED' && (reportOutcome === 'OFFLINE_RECTIFY' || isReportRectifyRow(row))) {
    return '已下架整改'
  }
  if (row.status === 'CLOSED' && isRejectedRow(row)) {
    return '已驳回'
  }
  if (row.status === 'CLOSED' && note.indexOf('用户自行撤销') >= 0) {
    return '已撤销'
  }
  return STATUS_LABEL[row.status] || row.status
}

function buildDecisionSummary(row) {
  if (!row || row.status !== 'CLOSED') return ''
  if (isRejectedRow(row)) {
    return `已驳回；驳回理由：${row.rejectReason || row.decisionNote || '未填写'}`
  }
  const reportOutcome = row.reportOutcome || row.itemAction || ''
  if ((row.ticketType || '') === TICKET_TYPE.REPORT && (reportOutcome || isReportRectifyRow(row))) {
    const parts = [
      reportOutcome === 'OFFLINE_RECTIFY' || isReportRectifyRow(row)
        ? '处理方式：已下架，卖家需整改后再上架'
        : `处理方式：${REPORT_OUTCOME_LABEL[reportOutcome] || reportOutcome}`
    ]
    parts.push(`商品状态：${row.itemStatusAfter || '已取消'}`)
    if (row.decisionNote) parts.push(`说明：${row.decisionNote}`)
    return parts.join('；')
  }
  const parts = []
  const liability = row.liabilityParty || ''
  const outcome = row.orderOutcome || ''
  const delta = row.creditDelta != null ? Number(row.creditDelta) : 0
  if (liability) parts.push(`责任方：${LIABILITY_LABEL[liability] || liability}`)
  if (outcome) parts.push(`订单结果：${ORDER_OUTCOME_LABEL[outcome] || outcome}`)
  if (delta) parts.push(`信用调整：${delta}`)
  if (row.decisionNote) parts.push(`说明：${row.decisionNote}`)
  return parts.join('；')
}

function inferCaseKey(row) {
  if (row.caseKey) return row.caseKey
  if (row.orderId) return `ORDER:${row.orderId}`
  if (row.targetType === 'Item' && row.targetId) return `ITEM:${row.targetId}`
  if (row.targetType === '_User' && row.targetId) return `USER:${row.targetId}`
  return `TICKET:${row.objectId}`
}

function buildCaseKey(ticketType, opts) {
  const orderId = opts.orderId || ''
  const targetType = opts.targetType || ''
  const targetId = opts.targetId || ''
  if (ticketType === TICKET_TYPE.DISPUTE && orderId) return `ORDER:${orderId}`
  if (targetType === 'Item' && targetId) return `ITEM:${targetId}`
  if (targetType === '_User' && targetId) return `USER:${targetId}`
  return `MISC:${Date.now()}`
}

function formatBmobError(e) {
  const msg = String((e && e.error) || e.message || e || '')
  if (/object not found.*Dispute/i.test(msg)) {
    return '数据库未创建 Dispute 表，见 docs/申诉举报说明.md'
  }
  if (/object not found.*DisputeReply/i.test(msg)) {
    return '数据库未创建 DisputeReply 表，见 docs/申诉举报说明.md'
  }
  if (/frozen/i.test(msg) && /Order/i.test(msg)) {
    return 'Order 表缺少 frozen 字段（布尔）'
  }
  return msg || '提交失败'
}

async function addCaseReply(caseKey, payload) {
  const {
    disputeId = '',
    authorId,
    authorRole,
    content,
    evidence = [],
    isPublic = true
  } = payload
  if (!caseKey || !authorId || !content) return
  try {
    const row = Bmob.Query('DisputeReply')
    row.set('caseKey', caseKey)
    if (disputeId) row.set('disputeId', disputeId)
    row.set('authorId', authorId)
    row.set('authorRole', authorRole)
    row.set('content', content)
    row.set('isPublic', !!isPublic)
    const ev = serializeEvidence(evidence)
    if (ev) row.set('evidence', ev)
    await row.save()
  } catch (e) {
    console.warn('DisputeReply 写入失败（请建 DisputeReply 表）', e)
  }
}

async function listRepliesForCase(caseKey) {
  if (!caseKey) return []
  try {
    const q = Bmob.Query('DisputeReply')
    q.equalTo('caseKey', '==', caseKey)
    q.order('createdAt')
    q.limit(100)
    const list = await q.find()
    return (list || []).map((r) => ({
      objectId: r.objectId,
      caseKey: r.caseKey,
      disputeId: r.disputeId || '',
      authorId: r.authorId || '',
      authorRole: r.authorRole || 'participant',
      roleLabel: ROLE_LABEL[r.authorRole] || r.authorRole,
      content: r.content || '',
      evidenceIds: parseEvidenceList(r.evidence),
      isPublic: r.isPublic !== false,
      createdAt: r.createdAt
    }))
  } catch (e) {
    if (/object not found.*DisputeReply/i.test(formatBmobError(e))) {
      return []
    }
    throw e
  }
}

async function findOpenDisputeByOrder(orderId) {
  const q = Bmob.Query('Dispute')
  q.equalTo('orderId', '==', orderId)
  const list = await q.find()
  return (list || []).find((d) => {
    const t = d.ticketType || TICKET_TYPE.DISPUTE
    return t === TICKET_TYPE.DISPUTE && OPEN_STATUSES.indexOf(d.status) >= 0
  }) || null
}

async function countOpenReportsOnItem(itemId) {
  const q = Bmob.Query('Dispute')
  q.equalTo('caseKey', '==', `ITEM:${itemId}`)
  const list = await q.find()
  return (list || []).filter(
    (d) =>
      (d.ticketType || '') === TICKET_TYPE.REPORT &&
      OPEN_STATUSES.indexOf(d.status) >= 0
  ).length
}

async function submitDispute(orderId, reason, evidence) {
  const text = trimReason(reason)
  if (!text || text.length < 5) {
    return { success: false, message: '请填写至少 5 字的申诉说明' }
  }
  const u = auth.getUserInfo()
  if (!u || !u.objectId) {
    return { success: false, message: '请先登录' }
  }
  if (!orderId) {
    return { success: false, message: '缺少订单信息' }
  }

  try {
    const order = await Bmob.Query('Order').get(orderId)
    if (!order) return { success: false, message: '订单不存在' }
    const buyerId = order.buyerId || ''
    const sellerId = order.sellerId || ''
    if (u.objectId !== buyerId && u.objectId !== sellerId) {
      return { success: false, message: '仅买卖双方可发起申诉' }
    }
    if (TERMINAL_ORDER.indexOf(order.status) >= 0) {
      return { success: false, message: '订单已结束，无法申诉' }
    }
    if (order.frozen) {
      return { success: false, message: '该订单已有进行中的申诉' }
    }
    const existing = await findOpenDisputeByOrder(orderId)
    if (existing) {
      return { success: false, message: '该订单已有待处理申诉' }
    }

    const caseKey = buildCaseKey(TICKET_TYPE.DISPUTE, { orderId })
    const respondentId = u.objectId === buyerId ? sellerId : buyerId

    const row = Bmob.Query('Dispute')
    row.set('ticketType', TICKET_TYPE.DISPUTE)
    row.set('caseKey', caseKey)
    row.set('orderId', orderId)
    row.set('submitterId', u.objectId)
    row.set('respondentId', respondentId)
    row.set('caseTitle', order.itemTitle || '订单申诉')
    row.set('reason', text)
    row.set('status', 'SUBMITTED')
    const evidenceStr = serializeEvidence(evidence)
    if (evidenceStr) row.set('evidence', evidenceStr)
    const saved = await row.save()

    await addCaseReply(caseKey, {
      disputeId: saved.objectId,
      authorId: u.objectId,
      authorRole: 'reporter',
      content: text,
      evidence
    })

    await notice.notifyDisputeReceived(
      respondentId,
      caseKey,
      order.itemTitle || '订单申诉',
      orderId
    )
    notice.syncTabBadge()

    try {
      const orderRow = await Bmob.Query('Order').get(orderId)
      orderRow.set('frozen', true)
      await orderRow.save()
    } catch (freezeErr) {
      console.warn('订单冻结标记失败', freezeErr)
      return {
        success: true,
        disputeId: saved.objectId,
        caseKey,
        message: '申诉已提交（订单 frozen 字段请检查 Bmob）'
      }
    }

    return {
      success: true,
      disputeId: saved.objectId,
      caseKey,
      message: '申诉已提交，订单已冻结，请等待管理员处理'
    }
  } catch (e) {
    console.error('submitDispute', e)
    return { success: false, message: formatBmobError(e) }
  }
}

async function submitReport(targetType, targetId, reason, evidence) {
  const text = trimReason(reason)
  if (!text || text.length < 5) {
    return { success: false, message: '请填写至少 5 字的举报说明' }
  }
  const u = auth.getUserInfo()
  if (!u || !u.objectId) {
    return { success: false, message: '请先登录' }
  }
  const tt = targetType === '_User' ? '_User' : 'Item'
  if (!targetId) {
    return { success: false, message: '缺少举报对象' }
  }

  try {
    let respondentId = ''
    let caseTitle = '内容举报'
    if (tt === 'Item') {
      const item = await Bmob.Query('Item').get(targetId)
      if (!item) return { success: false, message: '商品不存在' }
      const sid = (item.sellerId && item.sellerId.objectId) || item.sellerId || ''
      if (sid === u.objectId) {
        return { success: false, message: '不能举报自己发布的内容' }
      }
      respondentId = sid
      caseTitle = item.title || caseTitle
    }

    const caseKey = buildCaseKey(TICKET_TYPE.REPORT, {
      targetType: tt,
      targetId
    })
    const openCount = tt === 'Item' ? await countOpenReportsOnItem(targetId) : 0

    const row = Bmob.Query('Dispute')
    row.set('ticketType', TICKET_TYPE.REPORT)
    row.set('caseKey', caseKey)
    row.set('targetType', tt)
    row.set('targetId', targetId)
    row.set('submitterId', u.objectId)
    row.set('respondentId', respondentId)
    row.set('caseTitle', caseTitle)
    row.set('reason', text)
    row.set('status', 'SUBMITTED')
    const evidenceStr = serializeEvidence(evidence)
    if (evidenceStr) row.set('evidence', evidenceStr)
    const saved = await row.save()

    await addCaseReply(caseKey, {
      disputeId: saved.objectId,
      authorId: u.objectId,
      authorRole: 'reporter',
      content: text,
      evidence
    })

    if (respondentId) {
      await notice.notifyReportReceived(respondentId, caseKey, caseTitle, u.objectId)
      notice.syncTabBadge()
    }

    let message = '举报已提交，管理员将尽快处理'
    if (openCount > 0) {
      message = `已并入同一${tt === 'Item' ? '商品' : '对象'}举报案卷（共 ${openCount + 1} 条），对方将在「消息」收到通知`
    } else if (respondentId) {
      message = '举报已提交，被举报方将在「消息」收到通知'
    }

    return {
      success: true,
      disputeId: saved.objectId,
      caseKey,
      message
    }
  } catch (e) {
    console.error('submitReport', e)
    return { success: false, message: formatBmobError(e) }
  }
}

async function submitCaseReply(caseKey, content, evidence) {
  const text = trimReason(content)
  if (!text || text.length < 5) {
    return { success: false, message: '请填写至少 5 字的说明' }
  }
  const u = auth.getUserInfo()
  if (!u || !u.objectId) {
    return { success: false, message: '请先登录' }
  }
  if (!caseKey) {
    return { success: false, message: '案卷不存在' }
  }

  try {
    const q = Bmob.Query('Dispute')
    q.equalTo('caseKey', '==', caseKey)
    q.limit(50)
    const tickets = await q.find()
    if (!tickets || !tickets.length) {
      return { success: false, message: '案卷不存在' }
    }
    const anyOpen = tickets.some((t) => OPEN_STATUSES.indexOf(t.status) >= 0)
    if (!anyOpen) {
      return { success: false, message: '该案卷已结案，无法回复' }
    }

    const respondentId = tickets[0].respondentId || ''
    const isRespondent = respondentId && respondentId === u.objectId
    const isReporter = tickets.some((t) => t.submitterId === u.objectId)
    if (!isRespondent && !isReporter) {
      return { success: false, message: '仅举报方或被举报方可补充说明' }
    }

    const role = isRespondent ? 'respondent' : 'participant'
    const caseTitle = tickets[0].caseTitle || caseKey
    await addCaseReply(caseKey, {
      authorId: u.objectId,
      authorRole: role,
      content: text,
      evidence,
      isPublic: true
    })

    const notifyIds = []
    if (respondentId) notifyIds.push(respondentId)
    tickets.forEach((t) => {
      if (t.submitterId && notifyIds.indexOf(t.submitterId) < 0) {
        notifyIds.push(t.submitterId)
      }
    })
    await notice.notifyCaseReply(
      caseKey,
      caseTitle,
      u.objectId,
      role,
      notifyIds
    )
    notice.syncTabBadge()

    return {
      success: true,
      message: isRespondent ? '回应已提交，管理员与举报方可见' : '补充说明已提交'
    }
  } catch (e) {
    console.error('submitCaseReply', e)
    return { success: false, message: formatBmobError(e) }
  }
}

function mapTicketRow(row) {
  return {
    objectId: row.objectId,
    ticketType: row.ticketType || TICKET_TYPE.DISPUTE,
    ticketTypeLabel: TICKET_TYPE_LABEL[row.ticketType] || '工单',
    caseKey: inferCaseKey(row),
    orderId: row.orderId || '',
    targetType: row.targetType || '',
    targetId: row.targetId || '',
    caseTitle: row.caseTitle || '',
    submitterId: row.submitterId || '',
    respondentId: row.respondentId || '',
    reason: row.reason || '',
    evidence: row.evidence || '',
    evidenceIds: parseEvidenceList(row.evidence),
    status: row.status || 'SUBMITTED',
    statusLabel: statusLabelForRow(row),
    decisionType: row.decisionType || '',
    rejected: row.rejected === true,
    rejectReason: row.rejectReason || '',
    liabilityParty: row.liabilityParty || '',
    liabilityLabel: LIABILITY_LABEL[row.liabilityParty] || row.liabilityParty || '',
    orderOutcome: row.orderOutcome || '',
    orderOutcomeLabel: ORDER_OUTCOME_LABEL[row.orderOutcome] || row.orderOutcome || '',
    reportOutcome: row.reportOutcome || row.itemAction || '',
    reportOutcomeLabel: REPORT_OUTCOME_LABEL[row.reportOutcome || row.itemAction] || row.reportOutcome || row.itemAction || '',
    itemAction: row.itemAction || '',
    itemStatusAfter: row.itemStatusAfter || '',
    creditDelta: row.creditDelta != null ? Number(row.creditDelta) : 0,
    decisionNote: row.decisionNote || '',
    decisionSummary: buildDecisionSummary(row),
    canCancel: row.status === 'SUBMITTED',
    createdAt: row.createdAt
  }
}

async function listMyTickets() {
  const u = auth.getUserInfo()
  if (!u || !u.objectId) return []
  const q = Bmob.Query('Dispute')
  q.equalTo('submitterId', '==', u.objectId)
  q.order('-createdAt')
  q.limit(50)
  const list = await q.find()
  return (list || []).map(mapTicketRow)
}

/** 被举报方：待处理案卷列表 */
async function listRespondentInbox() {
  const u = auth.getUserInfo()
  if (!u || !u.objectId) return []
  const q = Bmob.Query('Dispute')
  q.equalTo('respondentId', '==', u.objectId)
  q.order('-createdAt')
  q.limit(100)
  const list = await q.find()
  const caseMap = {}
  ;(list || []).forEach((row) => {
    const ck = inferCaseKey(row)
    if (!caseMap[ck]) {
      caseMap[ck] = {
        caseKey: ck,
        caseTitle: row.caseTitle || '举报案卷',
        targetType: row.targetType || '',
        targetId: row.targetId || '',
        ticketType: row.ticketType || TICKET_TYPE.REPORT,
        openCount: 0,
        reportCount: 0,
        latestAt: row.createdAt
      }
    }
    const g = caseMap[ck]
    g.reportCount += 1
    if (OPEN_STATUSES.indexOf(row.status) >= 0) g.openCount += 1
  })
  return Object.keys(caseMap)
    .map((k) => caseMap[k])
    .filter((g) => g.openCount > 0)
    .sort((a, b) => (a.latestAt > b.latestAt ? -1 : 1))
}

async function fetchDisputesForCase(caseKey, userId) {
  async function queryDisputes(buildQuery) {
    const q = Bmob.Query('Dispute')
    const built = buildQuery(q)
    const query = built && typeof built.find === 'function' ? built : q
    query.order('-createdAt')
    query.limit(50)
    return (await query.find()) || []
  }

  let rows = await queryDisputes((q) => q.equalTo('caseKey', '==', caseKey))
  if (rows.length) return rows

  if (caseKey.indexOf('ORDER:') === 0) {
    const orderId = caseKey.slice(6)
    if (orderId) {
      rows = await queryDisputes((q) => q.equalTo('orderId', '==', orderId))
      if (rows.length) return rows
    }
  }

  if (caseKey.indexOf('ITEM:') === 0) {
    const itemId = caseKey.slice(5)
    if (itemId) {
      rows = await queryDisputes((q) => {
        q.equalTo('targetType', '==', 'Item')
        q.equalTo('targetId', '==', itemId)
        return q
      })
      if (rows.length) return rows
    }
  }

  if (!userId) return []

  const map = {}
  const merge = (list) => {
    ;(list || []).forEach((row) => {
      if (row && row.objectId) map[row.objectId] = row
    })
  }
  merge(await queryDisputes((q) => q.equalTo('submitterId', '==', userId)))
  merge(await queryDisputes((q) => q.equalTo('respondentId', '==', userId)))

  return Object.keys(map)
    .map((id) => map[id])
    .filter((row) => inferCaseKey(row) === caseKey)
}

async function getCaseDetail(caseKey) {
  const u = auth.getUserInfo()
  if (!u || !u.objectId) {
    return { success: false, message: '请先登录' }
  }

  const normalizedKey = String(caseKey || '').trim()
  if (!normalizedKey) {
    return { success: false, message: '案卷不存在' }
  }

  const tickets = await fetchDisputesForCase(normalizedKey, u.objectId)
  if (!tickets.length) {
    return { success: false, message: '案卷不存在或无权查看' }
  }

  const mapped = tickets.map(mapTicketRow)
  const replies = await listRepliesForCase(normalizedKey)
  const reporterIds = []
  const participantIds = []
  mapped.forEach((t) => {
    if (t.submitterId && reporterIds.indexOf(t.submitterId) < 0) {
      reporterIds.push(t.submitterId)
    }
  })
  replies.forEach((r) => {
    if (r.authorId && participantIds.indexOf(r.authorId) < 0) {
      participantIds.push(r.authorId)
    }
  })

  const respondentId = tickets[0].respondentId || ''
  const canReply =
    mapped.some((t) => OPEN_STATUSES.indexOf(t.status) >= 0) &&
    (u.objectId === respondentId || reporterIds.indexOf(u.objectId) >= 0)
  const latestClosed = mapped.find((t) => t.status === 'CLOSED' && t.decisionNote)

  return {
    success: true,
    caseKey: normalizedKey,
    caseTitle: tickets[0].caseTitle || '',
    targetType: tickets[0].targetType || '',
    targetId: tickets[0].targetId || '',
    respondentId,
    reporterIds,
    participantIds,
    tickets: mapped,
    replies,
    canReply,
    isRespondent: u.objectId === respondentId,
    isClosed: !mapped.some((t) => OPEN_STATUSES.indexOf(t.status) >= 0),
    decisionNote: latestClosed ? latestClosed.decisionNote : '',
    liabilityParty: latestClosed ? latestClosed.liabilityParty : '',
    liabilityLabel: latestClosed ? latestClosed.liabilityLabel : '',
    orderOutcome: latestClosed ? latestClosed.orderOutcome : '',
    orderOutcomeLabel: latestClosed ? latestClosed.orderOutcomeLabel : '',
    reportOutcome: latestClosed ? latestClosed.reportOutcome : '',
    reportOutcomeLabel: latestClosed ? latestClosed.reportOutcomeLabel : '',
    itemAction: latestClosed ? latestClosed.itemAction : '',
    itemStatusAfter: latestClosed ? latestClosed.itemStatusAfter : '',
    creditDelta: latestClosed ? latestClosed.creditDelta : 0,
    decisionSummary: latestClosed ? latestClosed.decisionSummary : ''
  }
}

async function cancelTicket(disputeId) {
  const u = auth.getUserInfo()
  if (!u || !u.objectId) {
    return { success: false, message: '请先登录' }
  }
  if (!disputeId) {
    return { success: false, message: '参数错误' }
  }
  try {
    const row = await Bmob.Query('Dispute').get(disputeId)
    if (!row) return { success: false, message: '工单不存在' }
    if (row.submitterId !== u.objectId) {
      return { success: false, message: '无权撤销该工单' }
    }
    if (row.status !== 'SUBMITTED') {
      return { success: false, message: '仅「待受理」状态可撤销' }
    }
    const disputeRow = await Bmob.Query('Dispute').get(disputeId)
    disputeRow.set('status', 'CLOSED')
    disputeRow.set('decisionNote', '用户自行撤销')
    disputeRow.set('liabilityParty', 'none')
    disputeRow.set('orderOutcome', '')
    disputeRow.set('creditDelta', 0)
    await disputeRow.save()

    const caseKey = inferCaseKey(row)
    await addCaseReply(caseKey, {
      disputeId,
      authorId: u.objectId,
      authorRole: 'reporter',
      content: '【撤销】举报人主动撤销本条工单',
      isPublic: true
    })

    const respondentId = row.respondentId || ''
    const notifyIds = [respondentId].filter(Boolean)
    await notice.notifyCaseUpdate(
      notifyIds,
      caseKey,
      row.caseTitle || '案卷',
      '申诉/举报已撤销',
      '提交方已撤销工单，相关订单已解除冻结。',
      notice.NOTICE_TYPE.DISPUTE_UPDATE
    )
    notice.syncTabBadge()

    const orderId = row.orderId || ''
    if (orderId) {
      try {
        const orderRow = await Bmob.Query('Order').get(orderId)
        orderRow.set('frozen', false)
        await orderRow.save()
      } catch (e) {
        console.warn('解冻订单失败', e)
      }
    }
    return { success: true, message: '已撤销' }
  } catch (e) {
    console.error('cancelTicket', e)
    return { success: false, message: formatBmobError(e) }
  }
}

function resolveLiabilityUser(order, ticket, liabilityParty) {
  const party = liabilityParty || 'none'
  if (party === 'buyer') return order && order.buyerId
  if (party === 'seller') return order && order.sellerId
  if (party === 'submitter') return ticket && ticket.submitterId
  if (party === 'respondent') return ticket && ticket.respondentId
  return ''
}

async function decideCase(options = {}) {
  const {
    disputeId = '',
    caseKey = '',
    liabilityParty = 'none',
    orderOutcome = '',
    creditDelta,
    decisionNote = '管理员裁决',
    adminId = ''
  } = options
  let tickets = []
  if (disputeId) {
    tickets = [await Bmob.Query('Dispute').get(disputeId)]
  } else if (caseKey) {
    const q = Bmob.Query('Dispute')
    q.equalTo('caseKey', '==', caseKey)
    q.limit(50)
    tickets = await q.find()
  } else {
    return { success: false, message: '缺少案卷信息' }
  }
  if (!tickets || !tickets.length) {
    return { success: false, message: '案卷不存在' }
  }

  const first = tickets[0]
  let order = null
  if (first.orderId) {
    order = await Bmob.Query('Order').get(first.orderId)
  }
  const targetUserId = resolveLiabilityUser(order, first, liabilityParty)

  let finalDelta = creditDelta
  if (finalDelta == null && targetUserId && liabilityParty !== 'none') {
    finalDelta = undefined
  }
  if (targetUserId && liabilityParty !== 'none') {
    const penaltyResult = await credit.penalizeDisputeLiability(targetUserId, {
      delta: finalDelta,
      disputeId: first.objectId,
      orderId: first.orderId || '',
      itemId: order ? order.itemId || '' : first.targetId || '',
      adminId,
      reason: decisionNote || '纠纷裁决扣分'
    })
    if (finalDelta == null && penaltyResult) {
      finalDelta = penaltyResult.requestedDelta || penaltyResult.delta || 0
    }
  }

  for (let i = 0; i < tickets.length; i++) {
    const row = await Bmob.Query('Dispute').get(tickets[i].objectId)
    row.set('status', 'CLOSED')
    row.set('liabilityParty', liabilityParty)
    row.set('orderOutcome', orderOutcome || '')
    row.set('creditDelta', Number(finalDelta || 0))
    row.set('decisionNote', decisionNote)
    await row.save()
  }

  if (order) {
    const orderRow = await Bmob.Query('Order').get(order.objectId)
    if (orderOutcome) orderRow.set('status', orderOutcome)
    orderRow.set('frozen', false)
    await orderRow.save()
    if (order.itemId && orderOutcome) {
      try {
        const itemRow = await Bmob.Query('Item').get(order.itemId)
        if (orderOutcome === 'COMPLETED') itemRow.set('status', 'SOLD_OUT')
        if (orderOutcome === 'CANCELLED') itemRow.set('status', 'ON_SALE')
        await itemRow.save()
      } catch (e) {
        console.warn('裁决同步商品状态失败', e)
      }
    }
    if (orderOutcome === 'COMPLETED') {
      await credit.rewardOrderComplete({ ...order, status: 'COMPLETED' })
    }
  }

  const notifyIds = []
  tickets.forEach((t) => {
    if (t.submitterId) notifyIds.push(t.submitterId)
    if (t.respondentId) notifyIds.push(t.respondentId)
  })
  await notice.notifyCaseUpdate(
    notifyIds,
    first.caseKey || inferCaseKey(first),
    first.caseTitle || '案卷',
    '案卷已结案',
    decisionNote,
    notice.NOTICE_TYPE.CASE_CLOSED
  )
  notice.syncTabBadge()

  return { success: true, message: '裁决已执行' }
}

module.exports = {
  TICKET_TYPE,
  TICKET_TYPE_LABEL,
  STATUS_LABEL,
  LIABILITY_LABEL,
  ORDER_OUTCOME_LABEL,
  ROLE_LABEL,
  MAX_EVIDENCE_IMAGES,
  parseEvidenceList,
  serializeEvidence,
  buildCaseKey,
  inferCaseKey,
  submitDispute,
  submitReport,
  submitCaseReply,
  listMyTickets,
  listRespondentInbox,
  getCaseDetail,
  findOpenDisputeByOrder,
  cancelTicket,
  decideCase
}
