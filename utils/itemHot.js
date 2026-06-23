/**
 * 按 BrowseLog 聚合日/月浏览热度，供首页热门推荐
 */
const Bmob = require('./bmob.js')
const browseHistory = require('./browseHistory.js')

const DAY_MS = 24 * 60 * 60 * 1000
const MONTH_MS = 30 * DAY_MS
const CACHE_MS = 5 * 60 * 1000
const LOG_LIMIT = 1000

let cachedAgg = null
let cachedAt = 0

async function fetchBrowseAggregates(force) {
  const now = Date.now()
  if (!force && cachedAgg && now - cachedAt < CACHE_MS) {
    return cachedAgg
  }

  const dayStart = now - DAY_MS
  const monthStart = now - MONTH_MS
  const dayMap = {}
  const monthMap = {}

  try {
    const q = Bmob.Query('BrowseLog')
    q.order('-viewedAt')
    q.limit(LOG_LIMIT)
    const rows = await q.find()
    for (let i = 0; i < (rows || []).length; i++) {
      const row = rows[i]
      const itemId = row.itemId
      if (!itemId) continue
      const t = browseHistory.parseTime(row.viewedAt)
      if (!t || t < monthStart) continue
      monthMap[itemId] = (monthMap[itemId] || 0) + 1
      if (t >= dayStart) {
        dayMap[itemId] = (dayMap[itemId] || 0) + 1
      }
    }
  } catch (e) {
    console.warn('fetchBrowseAggregates', e)
  }

  cachedAgg = { dayMap, monthMap, fetchedAt: now }
  cachedAt = now
  return cachedAgg
}

function mergeItemPool(lists) {
  const map = {}
  const pool = []
  const add = (item) => {
    if (!item || !item.objectId || map[item.objectId]) return
    map[item.objectId] = true
    pool.push(item)
  }
  ;(lists || []).forEach((list) => {
    (list || []).forEach(add)
  })
  return pool
}

function pickHotFromPool(pool, countMap, limit) {
  const scored = (pool || [])
    .map((item, index) => ({
      item,
      score: Number(countMap[item.objectId]) || 0,
      index
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)

  return scored.map((entry) => ({
    ...entry.item,
    hotCount: entry.score
  }))
}

module.exports = {
  fetchBrowseAggregates,
  mergeItemPool,
  pickHotFromPool,
  DAY_MS,
  MONTH_MS
}
