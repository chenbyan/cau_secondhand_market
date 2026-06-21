/**
 * 发布模块（物品 / 跑腿）共用：图片上传、Item 读写
 */
var Bmob = require('hydrogen-js-sdk');
Bmob.initialize('adfd024460d06ae8', '0906');
const auth = require('./auth.js')
const util = require('./util.js')
const credit = require('./credit.js')
const { CLOUD_STORAGE_ENABLED } = require('./cloudConfig.js')
const cloudStorage = require('./cloudStorage.js')
const cloudImage = require('./cloudImage.js')

const POST_TYPE = {
  GOODS: 'goods',
  ERRAND: 'errand',
  PARTTIME: 'parttime'
}

const GOODS_CATEGORIES = ['数码', '书籍', '日用', '服饰', '其他']
const ERRAND_CATEGORIES = ['书籍跑腿', '数码跑腿', '日用跑腿', '服饰跑腿', '其他跑腿']
const ERRAND_GOODS_CATEGORIES = ['数码跑腿', '日用跑腿', '服饰跑腿', '其他跑腿']
const PARTTIME_CATEGORIES = ERRAND_CATEGORIES
const HIDDEN_PARTTIME_CATEGORIES = ['家教', '校内兼职', '短期兼职', '其他兼职']

const TYPE_ALL = 'all'
const TYPE_BOOK = 'book'
const TYPE_GOODS = 'goods'
const TYPE_PARTTIME = 'parttime'

const PAGE_SIZE = 10
const QUERY_BATCH_SIZE = 30
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

const GOODS_FILTER_CATEGORIES = GOODS_CATEGORIES.filter((cat) => cat !== '书籍')

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
    ...ERRAND_GOODS_CATEGORIES.map((cat) => ({ key: cat, name: cat }))
  ]
}

const ERRAND_STATUS_META = {
  ON_SALE: { label: '未接单', cls: 'tag-errand-wait' },
  IN_TRADING: { label: '已接单', cls: 'tag-errand-taken' },
  SOLD_OUT: { label: '已完成', cls: 'tag-success' },
  OFFLINE: { label: '已取消', cls: 'tag-status-off' }
}

const UPLOAD_TIMEOUT_MS = 20000

/** 将 Bmob 返回的错误转成可读的提示 */
const formatUploadError = (msg) => {
  const text = msg || '图片上传失败'
  if (text.indexOf('绑定文件域名') >= 0 || text.indexOf('文件服务') >= 0) {
    return 'Bmob 未绑定文件域名，请负责人在 Bmob 控制台「设置-域名管理」开通并绑定后再试'
  }
  return text
}

const throwIfBmobError = (payload) => {
  if (!payload || typeof payload !== 'object') return
  const err = payload.error || payload.msg || payload.message
  if (err) throw new Error(formatUploadError(String(err)))
}

/** 确保 Bmob SDK 有 sessionToken（上传文件必需，与头像上传一致） */
const ensureBmobSession = async () => {
  if (!auth.checkLoginStatus()) {
    throw new Error('请先登录')
  }
  let cur = Bmob.User.current()
  if (cur && cur.sessionToken) return cur
  const u = auth.getUserInfo()
  if (u && u.objectId) {
    await Bmob.User.updateStorage(u.objectId)
    cur = Bmob.User.current()
    if (cur && cur.sessionToken) return cur
  }
  throw new Error('登录状态失效，请返回「我的」重新登录后再上传')
}

const parseUploadUrl = (res) => {
  if (!res) return null
  const item = Array.isArray(res) ? res[0] : res
  if (typeof item === 'string') {
    try {
      const j = JSON.parse(item)
      throwIfBmobError(j)
      return j.url || j.cdnUrl || null
    } catch (e) {
      if (e instanceof Error && e.message.indexOf('Bmob') >= 0) throw e
      return item.indexOf('http') === 0 ? item : null
    }
  }
  if (item && typeof item === 'object') {
    throwIfBmobError(item)
    if (item.url) return item.url
    if (item.cdnUrl) return item.cdnUrl
  }
  return null
}

/** 发布页选图上传：默认走微信云存储（无需 Bmob 文件域名） */
const uploadImage = async (tempFilePath) => {
  if (!auth.checkLoginStatus()) {
    throw new Error('请先登录')
  }
  await util.assertImageWithinSize(tempFilePath)
  if (CLOUD_STORAGE_ENABLED) {
    return cloudStorage.uploadImage(tempFilePath)
  }
  return uploadImageViaBmob(tempFilePath)
}

/**
 * Bmob.File 上传（需控制台绑定文件域名）；CLOUD_STORAGE_ENABLED=false 时使用
 */
const uploadImageViaBmob = async (tempFilePath) => {
  await ensureBmobSession()
  const name = `item_${Date.now()}_${Math.floor(Math.random() * 10000)}.jpg`
  const nativeUpload = wx.uploadFile
  let settled = false

  const finish = (fn, value) => {
    if (settled) return
    settled = true
    wx.uploadFile = nativeUpload
    fn(value)
  }

  return new Promise((resolve, reject) => {
    wx.uploadFile = function (options) {
      const userSuccess = options.success
      const userFail = options.fail
      options.success = function (res) {
        if (userSuccess) userSuccess(res)
        if (settled) return
        try {
          if (res.statusCode && res.statusCode >= 400) {
            finish(reject, new Error(`上传失败(${res.statusCode})`))
            return
          }
          const body =
            typeof res.data === 'string' ? JSON.parse(res.data) : res.data
          throwIfBmobError(body)
          const url = body && (body.url || body.cdnUrl)
          if (url) {
            finish(resolve, url)
          } else {
            finish(
              reject,
              new Error(
                formatUploadError(
                  (body && (body.error || body.msg)) || '图片上传失败，未返回地址'
                )
              )
            )
          }
        } catch (e) {
          finish(reject, e)
        }
      }
      options.fail = function (err) {
        if (userFail) userFail(err)
        const msg =
          (err && err.errMsg) ||
          '上传失败，请检查网络及「不校验合法域名」是否已勾选'
        finish(reject, new Error(msg))
      }
      return nativeUpload(options)
    }

    const file = Bmob.File(name, tempFilePath)
    const timer = setTimeout(() => {
      finish(
        reject,
        new Error('上传超时，请检查网络、Bmob 配置与登录状态')
      )
    }, UPLOAD_TIMEOUT_MS)

    file
      .save()
      .then((res) => {
        clearTimeout(timer)
        if (settled) return
        const url = parseUploadUrl(res)
        if (url) finish(resolve, url)
        else finish(reject, new Error('图片上传失败，未返回地址'))
      })
      .catch((err) => {
        clearTimeout(timer)
        if (!settled) {
          const raw =
            err instanceof Error ? err.message : err && err.error ? err.error : ''
          finish(reject, new Error(formatUploadError(raw || '图片上传失败')))
        }
      })
  })
}

const uploadImages = async (tempPaths, maxCount = 6) => {
  const paths = (tempPaths || []).slice(0, maxCount)
  const urls = []
  for (let i = 0; i < paths.length; i++) {
    const url = await uploadImage(paths[i])
    urls.push(url)
  }
  return urls
}

const chooseAndUploadImages = async (currentCount, maxTotal = 6) => {
  const remain = maxTotal - currentCount
  if (remain <= 0) return []
  const res = await new Promise((resolve, reject) => {
    wx.chooseMedia({
      count: remain,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: resolve,
      fail: reject
    })
  })
  const files = res.tempFiles || []
  const oversize = files.find(
    (f) => f.size != null && f.size > util.MAX_IMAGE_SIZE_BYTES
  )
  if (oversize) {
    util.showToast(`单张图片不能超过 ${util.MAX_IMAGE_SIZE_LABEL}`)
    return []
  }
  const paths = files.map((f) => f.tempFilePath)
  const urls = []
  for (let i = 0; i < paths.length; i++) {
    const url = await uploadImage(paths[i])
    urls.push(url)
  }
  return urls
}

const getItem = async (objectId) => {
  if (!objectId) return null
  return Bmob.Query('Item').get(objectId)
}

/** 从描述中解析发布者联系电话（兼容旧数据） */
const parseContactFromDescription = (desc) => {
  const m = (desc || '').match(/联系电话[：:]\s*(\d[\d\s-]{6,}\d)/)
  return m ? m[1].replace(/\s|-/g, '') : ''
}

/** 展示用描述：去掉末尾联系电话行 */
const stripContactFromDescription = (desc) => {
  return (desc || '').replace(/\n?联系电话[：:][^\n]*/g, '').trim()
}

/** 从描述中解析禁止接单的用户ID列表（关联跑腿用） */
const parseBlockedUsersFromDescription = (desc) => {
  const m = (desc || '').match(/\[blockedUsers:([^\]]+)\]/)
  return m ? m[1].split(',').filter(Boolean) : []
}

/** 展示用描述：去掉 blockedUsers 标签 */
const stripBlockedUsersFromDescription = (desc) => {
  return (desc || '').replace(/\n?\[blockedUsers:[^\]]*\]/g, '').trim()
}

const getSellerId = (row) => {
  if (!row) return ''
  return (row.sellerId && row.sellerId.objectId) || row.sellerId || ''
}

/**
 * 跑腿已接单时获取接单人联系方式（Item 冗余字段 → runnerId → Order.buyerId）
 */
const getRunnerContact = async (row) => {
  if (!row) return null
  const st = row.status
  if (st !== 'IN_TRADING' && st !== 'SOLD_OUT') return null

  if (row.runnerPhone || row.runnerNickName) {
    return {
      nickName: row.runnerNickName || '接单人',
      phone: row.runnerPhone || '',
      wechatId: row.runnerWechatId || ''
    }
  }

  const runnerId = (row.runnerId && row.runnerId.objectId) || row.runnerId
  if (runnerId) {
    try {
      const u = await Bmob.User.get(runnerId)
      return {
        nickName: u.nickName || '接单人',
        phone: u.phone || '',
        wechatId: u.wechatId || ''
      }
    } catch (e) {
      console.warn('getRunnerContact user', e)
    }
  }

  try {
    const q = Bmob.Query('Order')
    q.equalTo('itemId', '==', row.objectId)
    q.order('-createdAt')
    q.limit(5)
    const orders = (await q.find()) || []
    const active = orders.find(
      (o) => o.status === 'IN_TRADING' || o.status === 'PENDING_CONFIRM'
    )
    if (active) {
      const bid = (active.buyerId && active.buyerId.objectId) || active.buyerId
      if (bid) {
        const u = await Bmob.User.get(bid)
        return {
          nickName: u.nickName || '接单人',
          phone: u.phone || '',
          wechatId: u.wechatId || ''
        }
      }
    }
  } catch (e) {
    console.warn('getRunnerContact order', e)
  }
  return null
}

/** 接单后写入 Item（只更新 status 和 runnerId，联系方式从 User 表实时查询） */
const bindRunnerToItem = async (itemId, runnerUserId) => {
  const row = await Bmob.Query('Item').get(itemId)
  row.set('status', 'IN_TRADING')
  row.set('runnerId', runnerUserId)
  await row.save()
  return row
}

const normalizeType = (type) => {
  const keys = TYPE_OPTIONS.map((item) => item.key)
  return keys.indexOf(type) >= 0 ? type : TYPE_ALL
}

const normalizeKeyword = (keyword) =>
  String(keyword || '').trim().toLowerCase()

const normalizePostType = (row) => (row && row.postType) || POST_TYPE.GOODS

const isErrand = (row) => normalizePostType(row) === POST_TYPE.ERRAND

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
  if (ERRAND_CATEGORIES.indexOf(row.errandCategory) >= 0) {
    return row.errandCategory
  }
  if (ERRAND_CATEGORIES.indexOf(row.category) >= 0) {
    return row.category
  }
  return inferErrandCategory(row)
}

const isHiddenParttime = (row) => {
  const postType = normalizePostType(row)
  const category = row && row.category
  return (
    (postType === POST_TYPE.PARTTIME &&
      category !== '跑腿' &&
      ERRAND_CATEGORIES.indexOf(category) < 0) ||
    HIDDEN_PARTTIME_CATEGORIES.indexOf(category) >= 0
  )
}

const isParttime = (row) => {
  const postType = normalizePostType(row)
  const category = row && row.category
  return (
    postType === POST_TYPE.ERRAND ||
    category === '跑腿' ||
    ERRAND_CATEGORIES.indexOf(category) >= 0 ||
    ERRAND_CATEGORIES.indexOf(row && row.errandCategory) >= 0
  )
}

const isBook = (row) => row && row.category === '书籍' && !isParttime(row)

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

const matchesCategory = (row, category) => {
  if (!category || category === 'all') return true
  if (category === '书籍') return isBook(row)
  if (category === '物品') return isGoods(row)
  if (category === '跑腿') return isParttime(row)
  if (ERRAND_CATEGORIES.indexOf(category) >= 0) {
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

const mapSearchItem = async (row) => {
  const postType = normalizePostType(row)
  const parttime = isParttime(row)
  const errand = postType === POST_TYPE.ERRAND
  let coverImage = row.coverImage || ''
  if (cloudImage.isCloudFileId(coverImage)) {
    coverImage = await cloudImage.resolveImageUrl(coverImage)
  }
  const meta = ERRAND_STATUS_META[row.status] || ERRAND_STATUS_META.ON_SALE
  const price = Number(row.price) || 0
  const priceText = parttime ? (price > 0 ? `¥${price}` : '面议') : `¥${price}`
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
    sellerCreditScore: row.sellerCreditScore != null ? Number(row.sellerCreditScore) : null,
    creditRankPenalty: row.creditRankPenalty != null ? Number(row.creditRankPenalty) : 0,
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

const mapSearchItems = async (rows) => {
  const out = []
  for (let i = 0; i < (rows || []).length; i++) {
    out.push(await mapSearchItem(rows[i]))
  }
  return out
}

const fetchItems = async (options = {}) => {
  const type = normalizeType(options.type)
  const category = options.category || 'all'
  const keyword = options.keyword || ''
  const pageSize = Number(options.pageSize) || PAGE_SIZE
  const batchSize = Math.max(QUERY_BATCH_SIZE, pageSize * 3)
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
        !isErrand(row) &&    // 跑腿已迁移至 Errand 表，Item 表中跳过
        matchesType(row, type) &&
        matchesCategory(row, category) &&
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

  const ranked = await credit.attachSellerCreditScores(matched)
  ranked.sort(
    (a, b) =>
      (Number(a.creditRankPenalty) || 0) -
        (Number(b.creditRankPenalty) || 0)
  )

  return {
    list: await mapSearchItems(ranked),
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

/**
 * 创建或更新 Item
 */
const saveItem = async (fields, editId) => {
  const u = auth.getUserInfo()
  if (!u || !u.objectId) throw new Error('请先登录')

  let row
  if (editId) {
    row = await Bmob.Query('Item').get(editId)
    const sellerId =
      (row.sellerId && row.sellerId.objectId) || row.sellerId
    if (sellerId !== u.objectId) throw new Error('无权编辑该内容')
  } else {
    if (!credit.canPassCreditGate(u.creditScore)) {
      throw new Error(credit.buildGateMessage('发布', u.creditScore))
    }
    row = Bmob.Query('Item')
    row.set('sellerId', u.objectId)
    row.set('status', 'ON_SALE')
  }

  const nextFields = { ...fields }
  if (!nextFields.campus && u.campus) {
    nextFields.campus = u.campus
  }

  Object.keys(nextFields).forEach((key) => {
    if (nextFields[key] !== undefined) row.set(key, nextFields[key])
  })

  await row.save()
  return row
}

// ─── Errand 表专用函数（跑腿已从 Item 表迁移至独立 Errand 表）───

const saveErrand = async (fields, editId) => {
  const u = auth.getUserInfo()
  if (!u || !u.objectId) throw new Error('请先登录')
  let row
  if (editId) {
    row = await Bmob.Query('Errand').get(editId)
    const sellerId = (row.sellerId && row.sellerId.objectId) || row.sellerId
    if (sellerId !== u.objectId) throw new Error('无权编辑该内容')
  } else {
    if (!credit.canPassCreditGate(u.creditScore)) {
      throw new Error(credit.buildGateMessage('发布', u.creditScore))
    }
    row = Bmob.Query('Errand')
    row.set('sellerId', u.objectId)
    row.set('status', 'ON_SALE')
  }
  const nextFields = { ...fields }
  if (!nextFields.campus && u.campus) nextFields.campus = u.campus
  Object.keys(nextFields).forEach((key) => {
    if (nextFields[key] !== undefined) row.set(key, nextFields[key])
  })
  await row.save()
  return row
}

const getErrand = async (objectId) => {
  if (!objectId) return null
  return Bmob.Query('Errand').get(objectId)
}

const bindRunnerToErrand = async (errandId, runnerUserId) => {
  const row = await Bmob.Query('Errand').get(errandId)
  row.set('status', 'IN_TRADING')
  row.set('runnerId', runnerUserId)
  await row.save()
  return row
}

const fetchErrands = async (options = {}) => {
  const keyword = options.keyword || ''
  const category = options.category || 'all'
  const pageSize = Number(options.pageSize) || PAGE_SIZE
  const batchSize = Math.max(QUERY_BATCH_SIZE, pageSize * 3)
  let cursor = Number(options.cursor) || 0
  let scanned = 0
  let exhausted = false
  let filled = false
  let filledHasMore = false
  const matched = []

  while (matched.length < pageSize && !exhausted && scanned < MAX_SCAN_BATCHES) {
    const batchStart = cursor
    const q = Bmob.Query('Errand')
    q.equalTo('status', '==', 'ON_SALE')
    q.order('-createdAt')
    q.limit(batchSize)
    q.skip(cursor)
    const raw = (await q.find()) || []
    scanned += 1
    if (raw.length < batchSize) exhausted = true
    let consumed = raw.length
    for (let i = 0; i < raw.length; i++) {
      const row = raw[i]
      const cat = getErrandCategory(row)
      if (
        matchesKeyword(row, keyword) &&
        (category === 'all' || cat === category || row.errandCategory === category)
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

  const ranked = await credit.attachSellerCreditScores(matched)
  return {
    list: await mapSearchItems(ranked.map((r) => ({ ...r, postType: POST_TYPE.ERRAND }))),
    nextCursor: cursor,
    hasMore: filled ? filledHasMore : !exhausted
  }
}

module.exports = {
  POST_TYPE,
  GOODS_CATEGORIES,
  ERRAND_CATEGORIES,
  ERRAND_GOODS_CATEGORIES,
  PARTTIME_CATEGORIES,
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
  fetchItems,
  uploadImage,
  uploadImages,
  chooseAndUploadImages,
  getItem,
  saveItem,
  ensureBmobSession,
  parseContactFromDescription,
  stripContactFromDescription,
  parseBlockedUsersFromDescription,
  stripBlockedUsersFromDescription,
  getSellerId,
  getRunnerContact,
  bindRunnerToItem,
  saveErrand,
  getErrand,
  bindRunnerToErrand,
  fetchErrands
}
