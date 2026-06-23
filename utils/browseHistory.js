/**
 * 浏览记录 BrowseLog 表（用户历史浏览 + 热门统计数据源）
 */
const Bmob = require('./bmob.js')
const auth = require('./auth.js')
const util = require('./util.js')

const MAX_RECORDS = 100
const DEDUP_MS = 24 * 60 * 60 * 1000

function parseTime(raw) {
  if (!raw) return 0
  if (typeof raw === 'string') return Date.parse(raw) || 0
  if (raw.iso) return Date.parse(raw.iso) || 0
  return 0
}

function toDateField(ms) {
  return new Date(ms).toISOString()
}

async function pruneOldRecords(userId) {
  const q = Bmob.Query('BrowseLog')
  q.equalTo('userId', '==', userId)
  q.order('-viewedAt')
  q.limit(MAX_RECORDS + 30)
  const list = await q.find()
  if (!list || list.length <= MAX_RECORDS) return
  for (let i = MAX_RECORDS; i < list.length; i++) {
    try {
      await Bmob.Query('BrowseLog').destroy(list[i].objectId)
    } catch (e) {}
  }
}

/**
 * 记录浏览（登录且已校园认证；24h 内同商品去重更新 viewedAt）
 */
async function recordView(payload = {}) {
  const u = auth.getUserInfo()
  if (!u || !u.objectId) return { success: false, skipped: true }
  if (!auth.checkCampusVerified()) return { success: false, skipped: true }

  const itemId = payload.itemId
  if (!itemId) return { success: false, message: '缺少商品 ID' }

  const now = Date.now()
  const targetType = payload.targetType || 'goods'

  try {
    const q = Bmob.Query('BrowseLog')
    q.equalTo('userId', '==', u.objectId)
    q.equalTo('itemId', '==', itemId)
    q.order('-viewedAt')
    q.limit(8)
    const existing = await q.find()

    if (existing && existing.length) {
      for (let i = 0; i < existing.length; i++) {
        const row = existing[i]
        if (now - parseTime(row.viewedAt) < DEDUP_MS) {
          const rec = await Bmob.Query('BrowseLog').get(row.objectId)
          rec.set('viewedAt', toDateField(now))
          if (payload.itemTitle) rec.set('itemTitle', String(payload.itemTitle).slice(0, 120))
          if (payload.itemImage) rec.set('itemImage', payload.itemImage)
          if (payload.price != null) rec.set('price', Number(payload.price) || 0)
          rec.set('targetType', targetType)
          await rec.save()
          return { success: true, updated: true }
        }
      }
    }

    const row = Bmob.Query('BrowseLog')
    row.set('userId', u.objectId)
    row.set('itemId', itemId)
    row.set('targetType', targetType)
    row.set('itemTitle', String(payload.itemTitle || '').slice(0, 120))
    row.set('itemImage', payload.itemImage || '')
    row.set('price', payload.price != null ? Number(payload.price) : 0)
    row.set('viewedAt', toDateField(now))
    await row.save()

    await pruneOldRecords(u.objectId)
    return { success: true }
  } catch (e) {
    console.warn('BrowseLog 写入失败', e)
    return { success: false, message: (e && e.message) || '记录失败' }
  }
}

async function enrichWithLiveStatus(rows) {
  if (!rows || !rows.length) return rows
  const publish = require('./publish.js')
  const itemStatus = require('./itemStatus.js')

  const goodsIds = []
  const errandIds = []
  rows.forEach((r) => {
    if (!r.itemId) return
    if (r.targetType === 'errand') errandIds.push(r.itemId)
    else goodsIds.push(r.itemId)
  })

  const liveMap = {}
  const loadTable = async (table, ids, postType) => {
    if (!ids.length) return
    const uniq = [...new Set(ids)]
    const q = Bmob.Query(table)
    q.containedIn('objectId', uniq)
    q.limit(Math.min(uniq.length, 100))
    const list = await q.find()
    ;(list || []).forEach((row) => {
      liveMap[row.objectId] = { status: row.status || 'ON_SALE', postType }
    })
  }

  await loadTable('Item', goodsIds, publish.POST_TYPE.GOODS)
  await loadTable('Errand', errandIds, publish.POST_TYPE.ERRAND)

  return rows.map((r) => {
    const live = liveMap[r.itemId]
    if (!live) {
      return {
        ...r,
        itemMissing: true,
        statusLabel: '已失效',
        statusClass: 'tag-status-off',
        isEnded: true
      }
    }
    const meta = itemStatus.getStatusMeta(live.postType, live.status)
    const ended =
      live.status === 'SOLD_OUT' ||
      live.status === 'OFFLINE' ||
      live.status === 'DELETED_SOFT'
    return {
      ...r,
      itemMissing: false,
      itemStatus: live.status,
      statusLabel: meta.label,
      statusClass: meta.cls,
      isEnded: ended
    }
  })
}

async function listMyHistory(limit = 50) {
  const u = auth.getUserInfo()
  if (!u || !u.objectId) return []
  try {
    const q = Bmob.Query('BrowseLog')
    q.equalTo('userId', '==', u.objectId)
    q.order('-viewedAt')
    q.limit(limit)
    const list = await q.find()
    const rows = (list || []).map((row) => ({
      objectId: row.objectId,
      itemId: row.itemId,
      targetType: row.targetType || 'goods',
      itemTitle: row.itemTitle || '商品',
      itemImage: row.itemImage || '',
      price: row.price,
      viewedAtText: row.viewedAt ? util.formatTime(parseTime(row.viewedAt)) : ''
    }))
    return await enrichWithLiveStatus(rows)
  } catch (e) {
    if (/object not found.*BrowseLog/i.test(String(e.error || e.message || ''))) {
      return []
    }
    throw e
  }
}

async function removeRecord(objectId) {
  if (!objectId) return
  await Bmob.Query('BrowseLog').destroy(objectId)
}

async function clearAll() {
  const u = auth.getUserInfo()
  if (!u || !u.objectId) return
  const list = await listMyHistory(MAX_RECORDS + 30)
  for (let i = 0; i < list.length; i++) {
    try {
      await Bmob.Query('BrowseLog').destroy(list[i].objectId)
    } catch (e) {}
  }
}

module.exports = {
  MAX_RECORDS,
  recordView,
  listMyHistory,
  removeRecord,
  clearAll,
  parseTime
}
