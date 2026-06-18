/**
 * 读取管理端维护的 Category / SysConfig（失败时回退 publish.js 内置默认值）
 */
const Bmob = require('./bmob.js')

const CACHE_KEY = 'remote_sys_config_v1'
const CACHE_MS = 10 * 60 * 1000

const TYPE_ALL = 'all'
const TYPE_BOOK = 'book'
const TYPE_GOODS = 'goods'
const TYPE_PARTTIME = 'parttime'

const FALLBACK_GOODS = ['数码', '书籍', '日用', '服饰', '其他']
const FALLBACK_ERRAND = ['书籍跑腿', '数码跑腿', '日用跑腿', '服饰跑腿', '其他跑腿']
const FALLBACK_ERRAND_GOODS = ['数码跑腿', '日用跑腿', '服饰跑腿', '其他跑腿']

let memory = null
let loadingPromise = null

function namesByScope(categories, scope) {
  return (categories || [])
    .filter((c) => c.enabled !== false && (c.scope || 'goods') === scope)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    .map((c) => c.name)
    .filter(Boolean)
}

function buildCategoryOptions(categories) {
  const goods = namesByScope(categories, 'goods')
  const errand = namesByScope(categories, 'errand')
  const goodsList = goods.length ? goods : FALLBACK_GOODS
  const errandList = errand.length ? errand : FALLBACK_ERRAND
  const goodsFilter = goodsList.filter((c) => c !== '书籍')
  const errandGoods = errandList.filter((c) => c !== '书籍跑腿')
  if (!errandGoods.length) errandGoods.push(...FALLBACK_ERRAND_GOODS)

  return {
    [TYPE_ALL]: [
      { key: 'all', name: '全部' },
      { key: '书籍', name: '书籍' },
      { key: '物品', name: '物品' },
      { key: '跑腿', name: '跑腿' }
    ],
    [TYPE_BOOK]: [{ key: 'all', name: '全部书籍' }],
    [TYPE_GOODS]: [
      { key: 'all', name: '全部物品' },
      ...goodsFilter.map((cat) => ({ key: cat, name: cat }))
    ],
    [TYPE_PARTTIME]: [
      { key: 'all', name: '全部跑腿' },
      { key: '书籍跑腿', name: '书籍跑腿' },
      ...errandGoods.map((cat) => ({ key: cat, name: cat }))
    ]
  }
}

async function fetchRemote() {
  const catQuery = Bmob.Query('Category')
  catQuery.limit(200)
  const cfgQuery = Bmob.Query('SysConfig')
  cfgQuery.limit(100)

  let categories = []
  let configs = {}

  try {
    const catRows = await catQuery.find()
    categories = (catRows || []).map((row) => ({
      name: row.name || '',
      scope: row.scope || 'goods',
      sortOrder: row.sortOrder != null ? Number(row.sortOrder) : 0,
      enabled: row.enabled !== false
    }))
  } catch (e) {
    console.warn('[sysConfig] Category 读取失败，使用默认分类', e)
  }

  try {
    const cfgRows = await cfgQuery.find()
    ;(cfgRows || []).forEach((row) => {
      if (row.key) configs[row.key] = row.value != null ? String(row.value) : ''
    })
  } catch (e) {
    console.warn('[sysConfig] SysConfig 读取失败', e)
  }

  return {
    categories,
    configs,
    categoryOptions: buildCategoryOptions(categories),
    fetchedAt: Date.now()
  }
}

async function ensureLoaded(force) {
  if (!force && memory && Date.now() - memory.fetchedAt < CACHE_MS) {
    return memory
  }
  if (!force && loadingPromise) return loadingPromise

  loadingPromise = (async () => {
    try {
      memory = await fetchRemote()
      wx.setStorageSync(CACHE_KEY, memory)
    } catch (e) {
      const cached = wx.getStorageSync(CACHE_KEY)
      memory = cached && cached.categoryOptions ? cached : null
      if (!memory) {
        memory = {
          categories: [],
          configs: {},
          categoryOptions: buildCategoryOptions([]),
          fetchedAt: 0
        }
      }
    } finally {
      loadingPromise = null
    }
    return memory
  })()

  return loadingPromise
}

function getSnapshot() {
  if (memory && memory.categoryOptions) return memory
  const cached = wx.getStorageSync(CACHE_KEY)
  if (cached && cached.categoryOptions) {
    memory = cached
    return memory
  }
  return {
    categories: [],
    configs: {},
    categoryOptions: buildCategoryOptions([]),
    fetchedAt: 0
  }
}

function getCategoryOptions(type) {
  const t = type || TYPE_ALL
  const snap = getSnapshot()
  return snap.categoryOptions[t] || snap.categoryOptions[TYPE_ALL]
}

function getGoodsCategories() {
  const names = namesByScope(getSnapshot().categories, 'goods')
  return names.length ? names : FALLBACK_GOODS
}

function getErrandCategories() {
  const names = namesByScope(getSnapshot().categories, 'errand')
  return names.length ? names : FALLBACK_ERRAND
}

function getConfig(key, fallback) {
  const val = getSnapshot().configs[key]
  return val != null && val !== '' ? val : fallback || ''
}

function getHomeAnnouncement() {
  return getConfig('announcement.home', '').trim()
}

function getCreditMinGate() {
  const n = Number(getConfig('credit.min_gate', '60'))
  return Number.isFinite(n) ? n : 60
}

function getCreditCompleteBonus() {
  const n = Number(getConfig('credit.complete_bonus', '2'))
  return Number.isFinite(n) ? n : 2
}

function getCreditTimeoutPenalty() {
  const n = Number(getConfig('credit.timeout_penalty', '-5'))
  return Number.isFinite(n) ? n : -5
}

function getCreditCancelPenalty() {
  const n = Number(getConfig('credit.cancel_penalty', '-10'))
  return Number.isFinite(n) ? n : -10
}

function getCreditFreezeGate() {
  const n = Number(getConfig('credit.freeze_gate', '40'))
  return Number.isFinite(n) ? n : 40
}

function getCreditErrandBreachPenalty() {
  const n = Number(getConfig('credit.errand_breach_penalty', '-10'))
  return Number.isFinite(n) ? n : -10
}

function getCreditFakeInfoPenalty() {
  const n = Number(getConfig('credit.fake_info_penalty', '-20'))
  return Number.isFinite(n) ? n : -20
}

function getCreditViolationPublishPenalty() {
  const n = Number(getConfig('credit.violation_publish_penalty', '-15'))
  return Number.isFinite(n) ? n : -15
}

function getCreditDisputePenalty() {
  const n = Number(getConfig('credit.dispute_penalty', '-15'))
  return Number.isFinite(n) ? n : -15
}

function getCreditDownrankMin() {
  const n = Number(getConfig('credit.downrank_min', '61'))
  return Number.isFinite(n) ? n : 61
}

function getCreditDownrankMax() {
  const n = Number(getConfig('credit.downrank_max', '80'))
  return Number.isFinite(n) ? n : 80
}

function getCreditDownrankPenalty() {
  const n = Number(getConfig('credit.downrank_penalty', '40'))
  return Number.isFinite(n) ? n : 40
}

module.exports = {
  TYPE_ALL,
  TYPE_BOOK,
  TYPE_GOODS,
  TYPE_PARTTIME,
  ensureLoaded,
  getCategoryOptions,
  getGoodsCategories,
  getErrandCategories,
  getConfig,
  getHomeAnnouncement,
  getCreditMinGate,
  getCreditCompleteBonus,
  getCreditTimeoutPenalty,
  getCreditCancelPenalty,
  getCreditFreezeGate,
  getCreditErrandBreachPenalty,
  getCreditFakeInfoPenalty,
  getCreditViolationPublishPenalty,
  getCreditDisputePenalty,
  getCreditDownrankMin,
  getCreditDownrankMax,
  getCreditDownrankPenalty
}
