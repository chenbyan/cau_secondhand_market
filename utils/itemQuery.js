const Bmob = require('./bmob.js')
const publish = require('./publish.js')
const cloudImage = require('./cloudImage.js')
const itemStatus = require('./itemStatus.js')

const TYPE_ALL = 'all'
const TYPE_BOOK = 'book'
const TYPE_GOODS = 'goods'
const TYPE_PARTTIME = 'parttime'

const PAGE_SIZE = 10
const BATCH_SIZE = 30
const MAX_SCAN_BATCHES = 5

const TYPE_OPTIONS = [
  { key: TYPE_ALL, name: '全部' },
  { key: TYPE_BOOK, name: '书籍' },
  { key: TYPE_GOODS, name: '物品' },
  { key: TYPE_PARTTIME, name: '跑腿' }
]

const SEARCH_TYPE_LABELS = {
  [TYPE_ALL]: '全部结果',
  [TYPE_BOOK]: '书籍搜索',
  [TYPE_GOODS]: '物品搜索',
  [TYPE_PARTTIME]: '跑腿任务'
}

const GOODS_FILTER_CATEGORIES = publish.GOODS_CATEGORIES.filter(
  (cat) => cat !== '书籍'
)

const CATEGORY_OPTIONS = {
  [TYPE_ALL]: [
    { key: 'all', name: '全部' },
    { key: '书籍', name: '书籍' },
    { key: '物品', name: '物品' },
    { key: '跑腿', name: '跑腿' }
  ],
  [TYPE_BOOK]: [{ key: 'all', name: '全部书籍' }],
  [TYPE_GOODS]: [
    { key: 'all', name: '全部物品' },
    ...GOODS_FILTER_CATEGORIES.map((cat) => ({ key: cat, name: cat }))
  ],
  [TYPE_PARTTIME]: [
    { key: 'all', name: '全部跑腿' },
    { key: '书籍跑腿', name: '书籍跑腿' },
    ...publish.ERRAND_GOODS_CATEGORIES.map((cat) => ({ key: cat, name: cat }))
  ]
}

const normalizeType = (type) => {
  const keys = TYPE_OPTIONS.map((item) => item.key)
  return keys.indexOf(type) >= 0 ? type : TYPE_ALL
}

const normalizeKeyword = (keyword) =>
  String(keyword || '').trim().toLowerCase()

const normalizePostType = (row) =>
  (row && row.postType) || publish.POST_TYPE.GOODS

const isErrand = (row) => normalizePostType(row) === publish.POST_TYPE.ERRAND

const inferErrandCategory = (row) => {
  const text = [
    row && row.title,
    row && row.description,
    row && row.pickupAddr,
    row && row.deliveryAddr
  ].join(' ')
  if (/书|教材|资料|试卷|图书|讲义/.test(text)) return '书籍跑腿'
  if (/电脑|手机|耳机|相机|平板|充电|数码|键盘|鼠标/.test(text)) {
    return '数码跑腿'
  }
  if (/衣|鞋|帽|服饰|外套|裤|裙|包/.test(text)) return '服饰跑腿'
  if (/饭|食堂|水|纸|药|日用|洗护|快递|文件|钥匙/.test(text)) {
    return '日用跑腿'
  }
  return ''
}

const getErrandCategory = (row) => {
  if (!row) return ''
  if (publish.ERRAND_CATEGORIES.indexOf(row.errandCategory) >= 0) {
    return row.errandCategory
  }
  if (publish.ERRAND_CATEGORIES.indexOf(row.category) >= 0) {
    return row.category
  }
  return inferErrandCategory(row)
}

const isHiddenParttime = (row) => {
  const postType = normalizePostType(row)
  const category = row && row.category
  return (
    (postType === publish.POST_TYPE.PARTTIME &&
      category !== '跑腿' &&
      publish.ERRAND_CATEGORIES.indexOf(category) < 0) ||
    ['家教', '校内兼职', '短期兼职', '其他兼职'].indexOf(category) >= 0
  )
}

const isParttime = (row) => {
  const postType = normalizePostType(row)
  const category = row && row.category
  return (
    postType === publish.POST_TYPE.ERRAND ||
    category === '跑腿' ||
    publish.ERRAND_CATEGORIES.indexOf(category) >= 0 ||
    publish.ERRAND_CATEGORIES.indexOf(row && row.errandCategory) >= 0
  )
}

const isBook = (row) =>
  row && row.category === '书籍' && !isParttime(row)

const isGoods = (row) =>
  row &&
  !isParttime(row) &&
  !isErrand(row) &&
  !isHiddenParttime(row) &&
  row.category !== '书籍'

const matchesType = (row, type) => {
  const safeType = normalizeType(type)
  if (isHiddenParttime(row)) return false
  if (safeType === TYPE_ALL) return true
  if (safeType === TYPE_BOOK) return isBook(row)
  if (safeType === TYPE_GOODS) return isGoods(row)
  if (safeType === TYPE_PARTTIME) return isParttime(row)
  return true
}

const matchesCategory = (row, type, category) => {
  if (!category || category === 'all') return true
  if (category === '书籍') return isBook(row)
  if (category === '物品') return isGoods(row)
  if (category === '跑腿') return isParttime(row)
  if (publish.ERRAND_CATEGORIES.indexOf(category) >= 0) {
    return isParttime(row) && getErrandCategory(row) === category
  }
  return row.category === category
}

const matchesKeyword = (row, keyword) => {
  const kw = normalizeKeyword(keyword)
  if (!kw) return true
  const fields = [
    row.title,
    row.description,
    row.category,
    row.pickupAddr,
    row.deliveryAddr,
    row.deadline
  ]
  return fields.some((v) => String(v || '').toLowerCase().indexOf(kw) >= 0)
}

const shouldUseServerCategory = (type, category) => {
  if (!category || category === 'all') return false
  if (type === TYPE_PARTTIME) return false
  if (category === '物品' || category === '跑腿') return false
  return true
}

const mapItem = async (row) => {
  const postType = normalizePostType(row)
  const parttime = isParttime(row)
  const errand = postType === publish.POST_TYPE.ERRAND
  let coverImage = row.coverImage || ''
  if (cloudImage.isCloudFileId(coverImage)) {
    coverImage = await cloudImage.resolveImageUrl(coverImage)
  }
  const meta = itemStatus.getStatusMeta(postType, row.status)
  const price = Number(row.price) || 0
  const priceText = parttime
    ? price > 0
      ? `¥${price}`
      : '面议'
    : `¥${price}`
  const errandCategory = parttime ? getErrandCategory(row) || '跑腿' : ''
  return {
    objectId: row.objectId,
    title: row.title || '',
    description: row.description || '',
    price,
    priceText,
    coverImage,
    category: parttime ? errandCategory : row.category || '其他',
    errandCategory,
    postType,
    isErrand: errand,
    isParttime: parttime,
    priceLabel: parttime ? '赏金' : '价格',
    statusLabel: errand ? meta.label : '',
    statusClass: errand ? meta.cls : '',
    routeHint:
      errand && row.pickupAddr && row.deliveryAddr
        ? `${row.pickupAddr} → ${row.deliveryAddr}`
        : '',
    campus: row.campus || '',
    pickupAddr: row.pickupAddr || '',
    deliveryAddr: row.deliveryAddr || '',
    deadline: row.deadline || '',
    createdAt: row.createdAt || ''
  }
}

const mapItems = async (rows) => {
  const out = []
  for (let i = 0; i < (rows || []).length; i++) {
    out.push(await mapItem(rows[i]))
  }
  return out
}

const fetchItems = async (options = {}) => {
  const type = normalizeType(options.type)
  const category = options.category || 'all'
  const keyword = options.keyword || ''
  const pageSize = Number(options.pageSize) || PAGE_SIZE
  const batchSize = Math.max(BATCH_SIZE, pageSize * 3)
  let cursor = Number(options.cursor) || 0
  let scanned = 0
  let exhausted = false
  let filled = false
  let filledHasMore = false
  const matched = []

  while (
    matched.length < pageSize &&
    !exhausted &&
    scanned < MAX_SCAN_BATCHES
  ) {
    const batchStart = cursor
    const q = Bmob.Query('Item')
    q.equalTo('status', '==', 'ON_SALE')
    if (type === TYPE_BOOK) {
      q.equalTo('category', '==', '书籍')
    } else if (shouldUseServerCategory(type, category)) {
      q.equalTo('category', '==', category)
    }
    q.order('-createdAt')
    q.limit(batchSize)
    q.skip(cursor)

    const raw = (await q.find()) || []
    scanned += 1
    if (raw.length < batchSize) exhausted = true

    let consumed = raw.length
    for (let i = 0; i < raw.length; i++) {
      const row = raw[i]
      if (
        matchesType(row, type) &&
        matchesCategory(row, type, category) &&
        matchesKeyword(row, keyword)
      ) {
        matched.push(row)
        if (matched.length >= pageSize) {
          consumed = i + 1
          filled = true
          filledHasMore = consumed < raw.length || raw.length === batchSize
          break
        }
      }
    }
    cursor = batchStart + consumed
    if (filled) break
  }

  return {
    list: await mapItems(matched),
    nextCursor: cursor,
    hasMore: filled ? filledHasMore : !exhausted
  }
}

const getCategoryOptions = (type) => {
  try {
    const sysConfig = require('./sysConfig.js')
    const remote = sysConfig.getCategoryOptions(normalizeType(type))
    if (remote && remote.length) return remote
  } catch (e) {}
  return CATEGORY_OPTIONS[normalizeType(type)] || CATEGORY_OPTIONS[TYPE_ALL]
}

const getTypeLabel = (type) =>
  SEARCH_TYPE_LABELS[normalizeType(type)] || SEARCH_TYPE_LABELS[TYPE_ALL]

module.exports = {
  TYPE_ALL,
  TYPE_BOOK,
  TYPE_GOODS,
  TYPE_PARTTIME,
  PAGE_SIZE,
  TYPE_OPTIONS,
  SEARCH_TYPE_LABELS,
  getCategoryOptions,
  getTypeLabel,
  normalizeType,
  fetchItems
}
