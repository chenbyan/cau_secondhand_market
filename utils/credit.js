/**
 * 信用分服务：统一处理门禁、自动加减分与 CreditRecord 流水。
 */
const Bmob = require('./bmob.js')
const auth = require('./auth.js')
const sysConfig = require('./sysConfig.js')
const notice = require('./notice.js')

const DEFAULT_SCORE = 100
const MIN_SCORE = 0
const MAX_SCORE = 500
const FREEZE_DURATION_DAYS = 7

const SOURCE = {
  ORDER_COMPLETE: 'order_complete',
  ORDER_TIMEOUT: 'order_timeout',
  ORDER_CANCEL: 'order_cancel',
  ORDER_REVIEW: 'order_review',
  SELLER_NO_CONFIRM: 'seller_no_confirm',
  SELLER_NO_RECEIPT: 'seller_no_receipt',
  ERRAND_LATE: 'errand_late',
  ERRAND_BREACH: 'errand_breach',
  FAKE_INFO: 'fake_info',
  PUBLISH_VIOLATION: 'publish_violation',
  ADMIN: 'admin',
  DISPUTE: 'dispute'
}

// 0–150 正常 · 150–350 良好 · 350–500 极好
const LEVELS = [
  { min: 350, label: '信用极好', tone: 'excellent' },
  { min: 150, label: '信用良好', tone: 'good' },
  { min: 0,   label: '信用正常', tone: 'normal' }
]

function toNumber(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function normalizeScore(value) {
  return Math.min(MAX_SCORE, Math.max(MIN_SCORE, toNumber(value, DEFAULT_SCORE)))
}

function getLevel(score) {
  const safeScore = normalizeScore(score)
  return LEVELS.find((item) => safeScore >= item.min) || LEVELS[LEVELS.length - 1]
}

function getCurrentScore() {
  const u = auth.getUserInfo()
  return u && u.creditScore != null ? normalizeScore(u.creditScore) : DEFAULT_SCORE
}

function canPassCreditGate(score) {
  return normalizeScore(score) >= sysConfig.getCreditMinGate()
}

function isDownrankScore(score) {
  const safeScore = normalizeScore(score)
  return (
    safeScore >= sysConfig.getCreditDownrankMin() &&
    safeScore <= sysConfig.getCreditDownrankMax()
  )
}

function getRankPenalty(score) {
  return isDownrankScore(score) ? sysConfig.getCreditDownrankPenalty() : 0
}

function buildGateMessage(actionName, score) {
  const minGate = sysConfig.getCreditMinGate()
  const action = actionName || '进行该操作'
  return `信用分 ${normalizeScore(score)} 低于 ${minGate}，暂不可${action}`
}

async function refreshCurrentUser(userId) {
  const current = auth.getUserInfo()
  if (!current || current.objectId !== userId) return
  try {
    await Bmob.User.updateStorage(userId)
    auth.persistUserInfo(Bmob.User.current())
    const app = getApp && getApp()
    if (app && typeof app.syncGlobalUser === 'function') {
      app.syncGlobalUser()
    }
  } catch (e) {
    console.warn('刷新信用分缓存失败', e)
  }
}

async function hasSourceRecord(userId, source, sourceRef) {
  if (!userId || !source || !sourceRef) return false
  try {
    const q = Bmob.Query('CreditRecord')
    q.equalTo('userId', '==', userId)
    q.equalTo('source', '==', source)
    q.equalTo('sourceRef', '==', sourceRef)
    q.limit(1)
    const list = await q.find()
    return !!(list && list.length)
  } catch (e) {
    console.warn('信用流水去重查询失败', e)
    return false
  }
}

async function writeCreditRecord(payload) {
  try {
    const row = Bmob.Query('CreditRecord')
    row.set('userId', payload.userId)
    row.set('delta', payload.delta)
    row.set('reason', payload.reason)
    row.set('source', payload.source)
    row.set('beforeScore', payload.beforeScore)
    row.set('afterScore', payload.afterScore)
    if (payload.sourceRef) row.set('sourceRef', payload.sourceRef)
    if (payload.orderId) row.set('orderId', payload.orderId)
    if (payload.itemId) row.set('itemId', payload.itemId)
    if (payload.adminId) row.set('adminId', payload.adminId)
    if (payload.requestedDelta != null) {
      row.set('requestedDelta', payload.requestedDelta)
    }
    await row.save()
  } catch (e) {
    console.warn('信用流水写入失败', e)
  }
}

async function applyDelta(userId, delta, options = {}) {
  const numericDelta = toNumber(delta, 0)
  if (!userId || !numericDelta) return null

  const source = options.source || 'system'
  const sourceRef = options.sourceRef || ''
  if (sourceRef && await hasSourceRecord(userId, source, sourceRef)) {
    return { skipped: true, reason: 'duplicate' }
  }

  const userRow = await Bmob.User.get(userId)
  const beforeScore = normalizeScore(userRow.creditScore)
  const afterScore = normalizeScore(beforeScore + numericDelta)
  const actualDelta = afterScore - beforeScore

  userRow.set('creditScore', afterScore)

  const freezeGate = sysConfig.getCreditFreezeGate()
  const currentStatus = userRow.status || 'active'
  const shouldFreeze =
    options.autoFreeze !== false &&
    currentStatus === 'active' &&
    afterScore < freezeGate

  if (shouldFreeze) {
    userRow.set('status', 'frozen')
    userRow.set('creditFrozen', true)
    const days = sysConfig.getCreditFreezeDurationDays()
    userRow.set('frozenUntil', {
      __type: 'Date',
      iso: new Date(Date.now() + days * 86400000).toISOString()
    })
  }

  await userRow.save()

  await writeCreditRecord({
    userId,
    delta: actualDelta,
    requestedDelta: numericDelta,
    reason: options.reason || '信用分变更',
    source,
    sourceRef,
    beforeScore,
    afterScore,
    orderId: options.orderId,
    itemId: options.itemId,
    adminId: options.adminId
  })

  await refreshCurrentUser(userId)

  // 通知用户信用分发生了变化
  notice.createNotice({
    userId,
    type: notice.NOTICE_TYPE.CREDIT_CHANGED,
    title: actualDelta >= 0 ? `信用分 +${actualDelta}` : `信用分 ${actualDelta}`,
    content: `${options.reason || '信用分变更'} · 当前信用分：${afterScore}${shouldFreeze ? ' · 账号已冻结' : ''}`
  }).catch(() => {})

  return {
    userId,
    beforeScore,
    afterScore,
    delta: actualDelta,
    requestedDelta: numericDelta,
    frozen: shouldFreeze
  }
}

function uniq(list) {
  const seen = {}
  return (list || []).filter((id) => {
    if (!id || seen[id]) return false
    seen[id] = true
    return true
  })
}

async function markOrderCreditSettled(orderId, data = {}) {
  if (!orderId) return
  try {
    const row = await Bmob.Query('Order').get(orderId)
    row.set('creditSettled', true)
    row.set('creditSettledAt', {
      __type: 'Date',
      iso: new Date().toISOString()
    })
    Object.keys(data).forEach((key) => row.set(key, data[key]))
    await row.save()
  } catch (e) {
    console.warn('订单信用结算标记失败', e)
  }
}

async function rewardOrderComplete(order) {
  if (!order || !order.objectId || order.creditSettled) {
    return { skipped: true }
  }
  const bonus = sysConfig.getCreditCompleteBonus()
  if (!bonus) return { skipped: true, reason: 'zero_bonus' }

  const users = uniq([order.buyerId, order.sellerId])
  const results = []
  for (let i = 0; i < users.length; i++) {
    const userId = users[i]
    results.push(await applyDelta(userId, bonus, {
      source: SOURCE.ORDER_COMPLETE,
      sourceRef: `${order.objectId}:complete:${userId}`,
      orderId: order.objectId,
      itemId: order.itemId || '',
      reason: `订单完成奖励：${order.itemTitle || '交易'}`
    }))
  }
  await markOrderCreditSettled(order.objectId)
  return { results }
}

async function penalizeSellerTimeout(order) {
  if (!order || !order.objectId || order.timeoutCreditSet) {
    return { skipped: true }
  }
  const delta = sysConfig.getCreditTimeoutPenalty()
  if (!delta || !order.sellerId) return { skipped: true, reason: 'no_seller' }
  const result = await applyDelta(order.sellerId, delta, {
    source: SOURCE.ORDER_TIMEOUT,
    sourceRef: `${order.objectId}:seller_timeout`,
    orderId: order.objectId,
    itemId: order.itemId || '',
    reason: `超时未响应：${order.itemTitle || '订单'}`
  })
  await markOrderCreditSettled(order.objectId, { timeoutCreditSet: true })
  return result
}

async function penalizeBuyerCancel(order) {
  if (!order || !order.objectId || order.cancelCreditSet) {
    return { skipped: true }
  }
  const delta = sysConfig.getCreditCancelPenalty()
  if (!delta || !order.buyerId) return { skipped: true, reason: 'no_buyer' }
  const result = await applyDelta(order.buyerId, delta, {
    source: SOURCE.ORDER_CANCEL,
    sourceRef: `${order.objectId}:buyer_cancel`,
    orderId: order.objectId,
    itemId: order.itemId || '',
    reason: `主动取消订单：${order.itemTitle || '订单'}`
  })
  await markOrderCreditSettled(order.objectId, { cancelCreditSet: true })
  return result
}

async function penalizeErrandBreach(order, userId) {
  if (!order || !order.objectId) {
    return { skipped: true }
  }
  const targetId = userId || order.sellerId
  if (!targetId) return { skipped: true, reason: 'no_target' }
  const delta = sysConfig.getCreditErrandBreachPenalty()
  if (!delta) return { skipped: true, reason: 'zero_delta' }
  return applyDelta(targetId, delta, {
    source: SOURCE.ERRAND_BREACH,
    sourceRef: `${order.objectId}:errand_breach:${targetId}`,
    orderId: order.objectId,
    itemId: order.itemId || '',
    reason: `跑腿违约：${order.itemTitle || '跑腿任务'}`
  })
}

async function penalizePublishViolation(userId, itemId, reason) {
  const delta = sysConfig.getCreditViolationPublishPenalty()
  if (!userId || !delta) return { skipped: true }
  return applyDelta(userId, delta, {
    source: SOURCE.PUBLISH_VIOLATION,
    sourceRef: itemId ? `${itemId}:publish_violation` : '',
    itemId: itemId || '',
    reason: reason || '违规发布扣分'
  })
}

async function penalizeFakeInfo(userId, itemId, reason) {
  const delta = sysConfig.getCreditFakeInfoPenalty()
  if (!userId || !delta) return { skipped: true }
  return applyDelta(userId, delta, {
    source: SOURCE.FAKE_INFO,
    sourceRef: itemId ? `${itemId}:fake_info` : '',
    itemId: itemId || '',
    reason: reason || '虚假信息扣分'
  })
}

async function penalizeDisputeLiability(userId, options = {}) {
  const delta = options.delta != null
    ? toNumber(options.delta, sysConfig.getCreditDisputePenalty())
    : sysConfig.getCreditDisputePenalty()
  if (!userId || !delta) return { skipped: true }
  return applyDelta(userId, delta, {
    source: SOURCE.DISPUTE,
    sourceRef: options.sourceRef || (options.disputeId ? `${options.disputeId}:dispute:${userId}` : ''),
    orderId: options.orderId || '',
    itemId: options.itemId || '',
    adminId: options.adminId || '',
    reason: options.reason || '纠纷裁决扣分'
  })
}

// 评价奖惩：revieweeId 为被评价方，rating 1-5，sourceRef 通常为 orderId
async function rewardReview(revieweeId, rating, sourceRef) {
  if (!revieweeId) return { skipped: true }
  const delta = sysConfig.getCreditReviewDelta(rating)
  if (!delta) return { skipped: true, reason: 'neutral_rating' }
  const sign = delta > 0 ? '+' : ''
  return applyDelta(revieweeId, delta, {
    source: SOURCE.ORDER_REVIEW,
    sourceRef: sourceRef ? `${sourceRef}:review_${rating}star` : '',
    reason: `收到 ${rating} 星评价 (${sign}${delta}分)`
  })
}

// 卖家 24 小时未确认订单，系统自动确认时扣 1 分
async function penalizeSellerNoConfirm(order) {
  if (!order || !order.objectId) return { skipped: true }
  const delta = sysConfig.getCreditSellerNoConfirmPenalty()
  if (!delta || !order.sellerId) return { skipped: true }
  return applyDelta(order.sellerId, delta, {
    source: SOURCE.SELLER_NO_CONFIRM,
    sourceRef: `${order.objectId}:seller_no_confirm`,
    orderId: order.objectId,
    itemId: order.itemId || '',
    reason: `超时24小时未确认订单，系统自动确认`
  })
}

// 买家确认付款后卖家超 1 小时未确认收款扣 2 分
async function penalizeSellerReceiptTimeout(order) {
  if (!order || !order.objectId) return { skipped: true }
  const delta = sysConfig.getCreditSellerReceiptTimeoutPenalty()
  if (!delta || !order.sellerId) return { skipped: true }
  return applyDelta(order.sellerId, delta, {
    source: SOURCE.SELLER_NO_RECEIPT,
    sourceRef: `${order.objectId}:seller_no_receipt`,
    orderId: order.objectId,
    itemId: order.itemId || '',
    reason: `买家确认付款后超1小时卖家未确认收款`
  })
}

// 骑手逾期送达：1-5 分钟不扣，>5 分钟 -1，>60 分钟 -3
async function penalizeErrandLate(order, minutesLate) {
  if (!order || !order.objectId) return { skipped: true }
  const minutes = Number(minutesLate) || 0
  if (minutes <= 5) return { skipped: true, reason: 'within_tolerance' }
  const delta = minutes > 60
    ? sysConfig.getCreditErrandLate1hPenalty()
    : sysConfig.getCreditErrandLate5minPenalty()
  if (!delta) return { skipped: true }
  // 跑腿订单中 sellerId = 骑手
  const runnerId = (typeof order.sellerId === 'object' ? order.sellerId.objectId : order.sellerId) || ''
  if (!runnerId) return { skipped: true, reason: 'no_runner' }
  return applyDelta(runnerId, delta, {
    source: SOURCE.ERRAND_LATE,
    sourceRef: `${order.objectId}:errand_late:${runnerId}`,
    orderId: order.objectId,
    itemId: order.itemId || '',
    reason: `跑腿超时 ${minutes} 分钟送达`
  })
}

async function getUserCreditProfile(userId) {
  if (!userId) return null
  try {
    const user = await Bmob.User.get(userId)
    const score = normalizeScore(user.creditScore)
    return {
      userId,
      score,
      level: getLevel(score),
      nickName: user.nickName || user.username || '',
      status: user.status || 'active',
      campusVerified: !!user.campusVerified
    }
  } catch (e) {
    console.warn('读取用户信用信息失败', e)
    return null
  }
}

function getRowSellerId(row) {
  if (!row) return ''
  return (row.sellerId && row.sellerId.objectId) || row.sellerId || ''
}

async function buildUserCreditMap(userIds) {
  const ids = uniq(userIds)
  const map = {}
  for (let i = 0; i < ids.length; i++) {
    const userId = ids[i]
    try {
      const user = await Bmob.User.get(userId)
      map[userId] = normalizeScore(user.creditScore)
    } catch (e) {
      map[userId] = DEFAULT_SCORE
    }
  }
  return map
}

async function attachSellerCreditScores(rows) {
  const list = rows || []
  const scoreMap = await buildUserCreditMap(list.map(getRowSellerId))
  return list.map((row) => {
    const sellerId = getRowSellerId(row)
    const sellerCreditScore = sellerId && scoreMap[sellerId] != null
      ? scoreMap[sellerId]
      : DEFAULT_SCORE
    return {
      ...row,
      sellerCreditScore,
      creditRankPenalty: getRankPenalty(sellerCreditScore)
    }
  })
}

module.exports = {
  DEFAULT_SCORE,
  MIN_SCORE,
  MAX_SCORE,
  SOURCE,
  LEVELS,
  normalizeScore,
  getLevel,
  getCurrentScore,
  canPassCreditGate,
  isDownrankScore,
  getRankPenalty,
  buildGateMessage,
  applyDelta,
  rewardOrderComplete,
  rewardReview,
  penalizeSellerTimeout,
  penalizeSellerNoConfirm,
  penalizeSellerReceiptTimeout,
  penalizeBuyerCancel,
  penalizeErrandBreach,
  penalizeErrandLate,
  penalizePublishViolation,
  penalizeFakeInfo,
  penalizeDisputeLiability,
  getUserCreditProfile,
  attachSellerCreditScores
}
