/**
 * 商品拍下 / 卖家确认 / 自动确认（多买家，确认前不锁定商品）
 */
const Bmob = require('./bmob.js')
const notice = require('./notice.js')
const userNick = require('./userNick.js')

const SELLER_CONFIRM_MS = 24 * 60 * 60 * 1000
const BUYER_PAY_MS = 60 * 60 * 1000

function parseTime(value) {
  if (!value) return 0
  if (typeof value === 'number') return value
  if (typeof value === 'string') return new Date(value).getTime() || 0
  if (value.iso) return new Date(value.iso).getTime() || 0
  return 0
}

function toDateField(ms) {
  return { __type: 'Date', iso: new Date(ms).toISOString() }
}

function normalizeLockBuyers(raw) {
  if (!raw) return []
  if (!Array.isArray(raw)) return []
  return raw
    .map((entry) => {
      if (!entry) return null
      if (typeof entry === 'string') {
        return { buyerId: entry, lockTime: '', nickName: '' }
      }
      return {
        buyerId: entry.buyerId || entry.id || '',
        lockTime: entry.lockTime || '',
        nickName: entry.nickName || ''
      }
    })
    .filter((entry) => entry && entry.buyerId)
}

function isUserInLockBuyers(lockBuyers, userId) {
  if (!userId) return false
  return normalizeLockBuyers(lockBuyers).some((entry) => entry.buyerId === userId)
}

function sortLockBuyers(lockBuyers) {
  return normalizeLockBuyers(lockBuyers).slice().sort((a, b) => {
    const ta = parseTime(a.lockTime)
    const tb = parseTime(b.lockTime)
    if (ta && tb) return ta - tb
    if (ta) return -1
    if (tb) return 1
    return 0
  })
}

function getFirstLockBuyer(lockBuyers) {
  const sorted = sortLockBuyers(lockBuyers)
  return sorted.length ? sorted[0] : null
}

function getSellerConfirmDeadline(itemRow) {
  if (!itemRow) return 0
  const lockBuyers = normalizeLockBuyers(itemRow.lockBuyers)
  if (!lockBuyers.length) return parseTime(itemRow.lockExpireAt)
  const first = getFirstLockBuyer(lockBuyers)
  const firstTime = parseTime(first && first.lockTime)
  if (firstTime) return firstTime + SELLER_CONFIRM_MS
  return parseTime(itemRow.lockExpireAt)
}

function buildLockBuyerEntry(user) {
  const u = user || {}
  return {
    buyerId: u.objectId || '',
    lockTime: new Date().toISOString(),
    nickName: u.nickName || u.username || '买家'
  }
}

function addLockBuyer(lockBuyers, entry) {
  const list = normalizeLockBuyers(lockBuyers)
  if (list.some((item) => item.buyerId === entry.buyerId)) return list
  return list.concat([entry])
}

function removeLockBuyer(lockBuyers, buyerId) {
  return normalizeLockBuyers(lockBuyers).filter((entry) => entry.buyerId !== buyerId)
}

async function fetchNicknames(buyerIds) {
  return userNick.resolveUserNickNames(buyerIds)
}

async function enrichLockBuyers(lockBuyers) {
  const list = sortLockBuyers(lockBuyers)
  const nickMap = await fetchNicknames(list.map((entry) => entry.buyerId))
  return list.map((entry) => ({
    ...entry,
    nickName: entry.nickName || nickMap[entry.buyerId] || '买家',
    lockTimeText: entry.lockTime ? formatLockTime(entry.lockTime) : ''
  }))
}

function formatLockTime(value) {
  const ms = parseTime(value)
  if (!ms) return ''
  const d = new Date(ms)
  const pad = (n) => (n < 10 ? '0' + n : '' + n)
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function syncChatMembers(itemId, memberIds) {
  if (!itemId) return
  const ids = [...new Set((memberIds || []).filter(Boolean))]
  if (!ids.length) return
  try {
    const q = Bmob.Query('ChatRoom')
    q.equalTo('itemId', '==', itemId)
    q.limit(1)
    const list = await q.find()
    if (!list || !list.length) return
    const rec = await Bmob.Query('ChatRoom').get(list[0].objectId)
    rec.set('memberIds', JSON.stringify(ids))
    await rec.save()
  } catch (e) {
    console.warn('[itemLock] syncChatMembers failed', e)
  }
}

async function cancelOtherPendingOrders(itemId, keepBuyerId) {
  const q = Bmob.Query('Order')
  q.equalTo('itemId', '==', itemId)
  q.equalTo('status', '==', 'PENDING_CONFIRM')
  q.limit(50)
  const list = await q.find()
  for (let i = 0; i < (list || []).length; i++) {
    const row = list[i]
    const buyerId = (row.buyerId && row.buyerId.objectId) || row.buyerId || ''
    if (buyerId === keepBuyerId) continue
    const orderRow = await Bmob.Query('Order').get(row.objectId)
    orderRow.set('status', 'CANCELLED')
    await orderRow.save()
  }
}

async function confirmBuyerForItem(itemId, buyerId, options = {}) {
  if (!itemId || !buyerId) throw new Error('参数错误')

  const itemRow = await Bmob.Query('Item').get(itemId)
  const lockBuyers = normalizeLockBuyers(itemRow.lockBuyers)
  const sellerId = (itemRow.sellerId && itemRow.sellerId.objectId) || itemRow.sellerId || ''

  if (itemRow.lockBuyerId && itemRow.lockBuyerId !== buyerId) {
    throw new Error('商品已由其他买家锁定')
  }
  if (itemRow.status === 'IN_TRADING' && itemRow.lockBuyerId === buyerId) {
    return { alreadyConfirmed: true, buyerId }
  }
  if (itemRow.status !== 'ON_SALE' && itemRow.status !== 'IN_TRADING') {
    throw new Error('商品状态不可确认')
  }
  if (lockBuyers.length && !isUserInLockBuyers(lockBuyers, buyerId)) {
    throw new Error('该买家未拍下此商品')
  }

  const payExpireAt = Date.now() + BUYER_PAY_MS

  const orderQ = Bmob.Query('Order')
  orderQ.equalTo('itemId', '==', itemId)
  orderQ.equalTo('buyerId', '==', buyerId)
  orderQ.equalTo('status', '==', 'PENDING_CONFIRM')
  orderQ.limit(5)
  const pendingOrders = await orderQ.find()
  const targetOrder = pendingOrders && pendingOrders[0]
  if (!targetOrder) throw new Error('未找到该买家的待确认订单')

  const orderRow = await Bmob.Query('Order').get(targetOrder.objectId)
  orderRow.set('status', 'IN_TRADING')
  orderRow.set('payExpireAt', toDateField(payExpireAt))
  await orderRow.save()

  await cancelOtherPendingOrders(itemId, buyerId)

  itemRow.set('status', 'IN_TRADING')
  itemRow.set('lockBuyerId', buyerId)
  itemRow.set('lockBuyers', [])
  itemRow.set('lockExpireAt', toDateField(payExpireAt))
  await itemRow.save()

  await syncChatMembers(itemId, [sellerId, buyerId])

  if (options.notify !== false) {
    notice.notifyOrderEvent(
      buyerId,
      notice.NOTICE_TYPE.ORDER_CONFIRMED,
      '卖家已确认订单',
      options.auto ? '卖家未在24小时内确认，已自动确认首位拍下买家，请尽快付款' : '卖家已确认您的购买请求，请尽快付款',
      targetOrder.objectId,
      itemId
    ).catch(() => {})
  }

  return {
    orderId: targetOrder.objectId,
    buyerId,
    sellerId,
    auto: !!options.auto
  }
}

async function autoConfirmFirstBuyer(itemId) {
  const itemRow = await Bmob.Query('Item').get(itemId)
  if (!itemRow || itemRow.lockBuyerId) return null
  if (itemRow.status !== 'ON_SALE') return null
  const lockBuyers = normalizeLockBuyers(itemRow.lockBuyers)
  if (!lockBuyers.length) return null
  const deadline = getSellerConfirmDeadline(itemRow)
  if (!deadline || deadline > Date.now()) return null
  const first = getFirstLockBuyer(lockBuyers)
  if (!first) return null
  return confirmBuyerForItem(itemId, first.buyerId, { auto: true })
}

async function releaseItemToOnSale(itemId) {
  if (!itemId) return
  const itemRow = await Bmob.Query('Item').get(itemId)
  itemRow.set('status', 'ON_SALE')
  itemRow.set('lockBuyerId', '')
  itemRow.set('lockBuyers', [])
  itemRow.unset('lockExpireAt')
  await itemRow.save()
}

module.exports = {
  SELLER_CONFIRM_MS,
  BUYER_PAY_MS,
  parseTime,
  toDateField,
  normalizeLockBuyers,
  isUserInLockBuyers,
  sortLockBuyers,
  getFirstLockBuyer,
  getSellerConfirmDeadline,
  buildLockBuyerEntry,
  addLockBuyer,
  removeLockBuyer,
  enrichLockBuyers,
  formatLockTime,
  confirmBuyerForItem,
  autoConfirmFirstBuyer,
  releaseItemToOnSale,
  syncChatMembers
}
