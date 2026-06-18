/**
 * 订单互评：订单完成后买卖双方各评价一次。
 */
const Bmob = require('./bmob.js')
const auth = require('./auth.js')

const ROLE_LABEL = {
  buyer: '买家',
  seller: '卖家'
}

function clampRating(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 5
  return Math.max(1, Math.min(5, Math.round(n)))
}

function trimContent(value) {
  return String(value || '').trim().slice(0, 200)
}

function getReviewee(order, reviewerId) {
  if (!order || !reviewerId) return null
  if (reviewerId === order.buyerId) {
    return { revieweeId: order.sellerId, reviewerRole: 'buyer' }
  }
  if (reviewerId === order.sellerId) {
    return { revieweeId: order.buyerId, reviewerRole: 'seller' }
  }
  return null
}

async function findOrderReview(orderId, reviewerId) {
  if (!orderId || !reviewerId) return null
  try {
    const q = Bmob.Query('OrderReview')
    q.equalTo('orderId', '==', orderId)
    q.equalTo('reviewerId', '==', reviewerId)
    q.limit(1)
    const list = await q.find()
    return list && list[0] ? list[0] : null
  } catch (e) {
    if (/object not found.*OrderReview/i.test(String(e.error || e.message || ''))) {
      return null
    }
    throw e
  }
}

async function listOrderReviews(orderId) {
  if (!orderId) return []
  try {
    const q = Bmob.Query('OrderReview')
    q.equalTo('orderId', '==', orderId)
    q.order('-createdAt')
    q.limit(10)
    const rows = await q.find()
    return (rows || []).map((row) => ({
      objectId: row.objectId,
      orderId: row.orderId,
      reviewerId: row.reviewerId,
      revieweeId: row.revieweeId,
      reviewerRole: row.reviewerRole,
      reviewerRoleLabel: ROLE_LABEL[row.reviewerRole] || '用户',
      rating: clampRating(row.rating),
      content: row.content || '',
      createdAt: row.createdAt
    }))
  } catch (e) {
    if (/object not found.*OrderReview/i.test(String(e.error || e.message || ''))) {
      return []
    }
    throw e
  }
}

async function getReviewState(order, currentUserId) {
  if (!order || !order.objectId || order.status !== 'COMPLETED' || !currentUserId) {
    return { canReview: false, reviewed: false, reviews: [] }
  }
  const target = getReviewee(order, currentUserId)
  if (!target || !target.revieweeId) {
    return { canReview: false, reviewed: false, reviews: [] }
  }
  const existing = await findOrderReview(order.objectId, currentUserId)
  const reviews = await listOrderReviews(order.objectId)
  return {
    canReview: !existing,
    reviewed: !!existing,
    targetUserId: target.revieweeId,
    reviewerRole: target.reviewerRole,
    reviews
  }
}

async function submitOrderReview(orderId, rating, content) {
  const u = auth.getUserInfo()
  if (!u || !u.objectId) {
    return { success: false, message: '请先登录' }
  }
  if (!orderId) {
    return { success: false, message: '缺少订单信息' }
  }
  const order = await Bmob.Query('Order').get(orderId)
  if (!order || order.status !== 'COMPLETED') {
    return { success: false, message: '订单完成后才可评价' }
  }
  const target = getReviewee(order, u.objectId)
  if (!target || !target.revieweeId) {
    return { success: false, message: '仅订单双方可评价' }
  }
  const existing = await findOrderReview(orderId, u.objectId)
  if (existing) {
    return { success: false, message: '您已评价过该订单' }
  }

  const row = Bmob.Query('OrderReview')
  row.set('orderId', orderId)
  row.set('itemId', order.itemId || '')
  row.set('itemTitle', order.itemTitle || '')
  row.set('reviewerId', u.objectId)
  row.set('revieweeId', target.revieweeId)
  row.set('reviewerRole', target.reviewerRole)
  row.set('rating', clampRating(rating))
  row.set('content', trimContent(content))
  await row.save()

  try {
    const orderRow = await Bmob.Query('Order').get(orderId)
    if (target.reviewerRole === 'buyer') {
      orderRow.set('buyerReviewed', true)
    } else {
      orderRow.set('sellerReviewed', true)
    }
    await orderRow.save()
  } catch (e) {
    console.warn('订单评价状态回写失败', e)
  }

  return { success: true, message: '评价已提交' }
}

module.exports = {
  ROLE_LABEL,
  clampRating,
  getReviewee,
  findOrderReview,
  listOrderReviews,
  getReviewState,
  submitOrderReview
}
