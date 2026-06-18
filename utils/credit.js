/**
 * 信用分服务：统一处理门禁、自动加减分与 CreditRecord 流水。
 */
const Bmob = require('./bmob.js')
const auth = require('./auth.js')
const sysConfig = require('./sysConfig.js')

const DEFAULT_SCORE = 100
const MIN_SCORE = 0

const SOURCE = {
  ORDER_COMPLETE: 'order_complete',
  ORDER_TIMEOUT: 'order_timeout',
  ORDER_CANCEL: 'order_cancel',
  ORDER_REVIEW: 'order_review',
  ERRAND_BREACH: 'errand_breach',
  FAKE_INFO: 'fake_info',
  PUBLISH_VIOLATION: 'publish_violation',
  ADMIN: 'admin',
  DISPUTE: 'dispute'
}

const LEVELS = [
  { min: 90, label: '信用优秀', tone: 'excellent' },
  { min: 80, label: '信用良好', tone: 'good' },
  { min: 60, label: '信用正常', tone: 'normal' },
  { min: 40, label: '信用偏低', tone: 'warning' },
  { min: 0, label: '信用受限', tone: 'danger' }
]

function toNumber(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function normalizeScore(value) {
  return Math.max(MIN_SCORE, toNumber(value, DEFAULT_SCORE))
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
  const afterScore = Math.max(MIN_SCORE, beforeScore + numericDelta)
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
  penalizeSellerTimeout,
  penalizeBuyerCancel,
  penalizeErrandBreach,
  penalizePublishViolation,
  penalizeFakeInfo,
  penalizeDisputeLiability,
  getUserCreditProfile,
  attachSellerCreditScores
}
