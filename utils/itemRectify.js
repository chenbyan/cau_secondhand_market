/**
 * 商品整改 / 管理员下架审核（Item 表不新增列，状态存 Dispute）
 */
const Bmob = require('./bmob.js')
const ticket = require('./ticket.js')

const ADMIN_OFFLINE_TAG = '[ADMIN_OFFLINE]'
const RELIST_PENDING_TAG = '[RELIST_PENDING_REVIEW]'
const RELIST_APPROVED_TAG = '[RELIST_APPROVED]'

async function fetchPendingRectifyMap(itemIds) {
  const map = {}
  const ids = (itemIds || []).filter(Boolean)
  if (!ids.length) return map

  for (let i = 0; i < ids.length; i++) {
    const itemId = ids[i]
    try {
      const q = Bmob.Query('Dispute')
      q.equalTo('targetType', '==', 'Item')
      q.equalTo('targetId', '==', itemId)
      q.equalTo('status', '==', 'CLOSED')
      q.order('-updatedAt')
      q.limit(10)
      const rows = (await q.find()) || []
      const hit = rows.find((row) => ticket.isReportRectifyRow(row))
      if (hit) {
        map[itemId] = {
          disputeId: hit.objectId,
          reason: hit.decisionNote || hit.rejectReason || ''
        }
      }
    } catch (e) {
      console.warn('[itemRectify] query failed', itemId, e)
    }
  }
  return map
}

function isAdminOfflineDispute(row) {
  if (!row || row.targetType !== 'Item') return false
  const note = String(row.decisionNote || '')
  const outcome = row.reportOutcome || row.itemAction || ''
  return outcome === 'ADMIN_OFFLINE' || note.indexOf(ADMIN_OFFLINE_TAG) >= 0
}

function parseAdminOfflineInfo(row) {
  if (!isAdminOfflineDispute(row)) return null
  const note = String(row.decisionNote || '')
  const pendingReview = note.indexOf(RELIST_PENDING_TAG) >= 0 && note.indexOf(RELIST_APPROVED_TAG) < 0
  const approved = note.indexOf(RELIST_APPROVED_TAG) >= 0
  let reason = note
    .replace(ADMIN_OFFLINE_TAG, '')
    .replace(RELIST_PENDING_TAG, '')
    .replace(RELIST_APPROVED_TAG, '')
    .trim()
  if (!reason) reason = row.reason || ''
  return {
    disputeId: row.objectId,
    reason,
    pendingReview,
    approved
  }
}

async function fetchAdminOfflineMap(itemIds) {
  const map = {}
  const ids = (itemIds || []).filter(Boolean)
  if (!ids.length) return map

  for (let i = 0; i < ids.length; i++) {
    const itemId = ids[i]
    try {
      const q = Bmob.Query('Dispute')
      q.equalTo('targetType', '==', 'Item')
      q.equalTo('targetId', '==', itemId)
      q.order('-updatedAt')
      q.limit(12)
      const rows = (await q.find()) || []
      const hit = rows.find((row) => {
        const info = parseAdminOfflineInfo(row)
        return info && !info.approved
      })
      if (hit) {
        map[itemId] = parseAdminOfflineInfo(hit)
      }
    } catch (e) {
      console.warn('[itemRectify] admin offline query failed', itemId, e)
    }
  }
  return map
}

async function getRectifyInfoForItem(itemId) {
  if (!itemId) return null
  const map = await fetchPendingRectifyMap([itemId])
  return map[itemId] || null
}

async function getAdminOfflineInfoForItem(itemId) {
  if (!itemId) return null
  const map = await fetchAdminOfflineMap([itemId])
  return map[itemId] || null
}

function needsGoodsRectify(itemRow, rectifyMap) {
  if (!itemRow || itemRow.status !== 'OFFLINE') return false
  const postType = itemRow.postType || 'goods'
  if (postType === 'errand') return false
  return !!(rectifyMap && rectifyMap[itemRow.objectId])
}

function needsAdminOfflineRectify(itemRow, adminMap) {
  if (!itemRow || itemRow.status !== 'OFFLINE') return false
  const postType = itemRow.postType || 'goods'
  if (postType === 'errand') return false
  const info = adminMap && adminMap[itemRow.objectId]
  return !!(info && !info.pendingReview)
}

function isAdminRelistPendingReview(itemRow, adminMap) {
  const info = adminMap && itemRow && adminMap[itemRow.objectId]
  return !!(info && info.pendingReview)
}

async function markRelistPendingReview(itemId) {
  const info = await getAdminOfflineInfoForItem(itemId)
  if (!info || !info.disputeId) {
    throw new Error('未找到管理员下架记录')
  }
  const row = await Bmob.Query('Dispute').get(info.disputeId)
  let note = String(row.decisionNote || '')
  if (note.indexOf(RELIST_PENDING_TAG) < 0) {
    note = (note + ' ' + RELIST_PENDING_TAG).trim()
  }
  row.set('decisionNote', note)
  await row.save()
}

module.exports = {
  ADMIN_OFFLINE_TAG,
  RELIST_PENDING_TAG,
  RELIST_APPROVED_TAG,
  fetchPendingRectifyMap,
  fetchAdminOfflineMap,
  getRectifyInfoForItem,
  getAdminOfflineInfoForItem,
  needsGoodsRectify,
  needsAdminOfflineRectify,
  isAdminRelistPendingReview,
  isAdminOfflineDispute,
  markRelistPendingReview
}
