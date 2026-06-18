/**
 * 云存储 fileID（cloud://）在 <image> 中展示时的解析
 * 避免直接走 CDN 签名链出现 403（与存储权限、签名有关）
 */

const isCloudFileId = (url) => !!url && String(url).indexOf('cloud://') === 0

/** 从 coverImage / images 字段提取首个可用图片地址 */
const normalizeImageSource = (value) => {
  if (!value) return ''
  if (Array.isArray(value)) return String(value[0] || '').trim()
  const str = String(value).trim()
  if (!str || str === '[]') return ''
  if (str.charAt(0) === '[') {
    try {
      const parsed = JSON.parse(str)
      if (Array.isArray(parsed) && parsed.length) {
        return String(parsed[0] || '').trim()
      }
    } catch (e) {}
  }
  return str
}

const normItemId = (itemId) => {
  if (!itemId) return ''
  if (typeof itemId === 'object') return itemId.objectId || ''
  return String(itemId)
}

const fetchItemCoverSource = async (itemId, cache) => {
  const id = normItemId(itemId)
  if (!id) return ''
  if (cache && Object.prototype.hasOwnProperty.call(cache, id)) {
    return cache[id]
  }
  try {
    const Bmob = require('./bmob.js')
    // 优先查 Item 表，不存在则查 Errand 表
    let item = null
    try {
      item = await Bmob.Query('Item').get(id)
    } catch (e) {
      try {
        item = await Bmob.Query('Errand').get(id)
      } catch (e2) {}
    }
    const cover =
      normalizeImageSource(item && item.coverImage) ||
      normalizeImageSource(item && item.images)
    if (cache) cache[id] = cover
    return cover
  } catch (e) {
    console.warn('[cloudImage] fetch item cover failed', id, e)
    if (cache) cache[id] = ''
    return ''
  }
}

const getTempFileURL = (fileID) =>
  new Promise((resolve, reject) => {
    if (!wx.cloud || !wx.cloud.getTempFileURL) {
      reject(new Error('云开发未初始化'))
      return
    }
    wx.cloud.getTempFileURL({
      fileList: [fileID],
      success: (res) => {
        const item = res.fileList && res.fileList[0]
        if (item && item.tempFileURL && item.status === 0) {
          resolve(item.tempFileURL)
          return
        }
        const err = (item && item.errMsg) || '获取临时链接失败'
        reject(new Error(err))
      },
      fail: (err) => reject(err || new Error('getTempFileURL 失败'))
    })
  })

/** 展示用：cloud:// → 临时 https；其它 URL 原样返回 */
const resolveImageUrl = async (url) => {
  if (!url) return ''
  if (!isCloudFileId(url)) return url
  try {
    return await getTempFileURL(url)
  } catch (e) {
    console.warn('[cloudImage] resolve failed', url, e)
    return ''
  }
}

const resolveImageUrls = async (urls) => {
  const list = urls || []
  const out = []
  for (let i = 0; i < list.length; i++) {
    out.push(await resolveImageUrl(list[i]))
  }
  return out
}

/** 订单展示图：解析 itemImage，必要时回退到关联 Item/Errand 的 coverImage */
const resolveOrderItemImage = async (order, cache) => {
  if (!order) return ''
  const itemId = normItemId(order.itemId)

  const resolveCloudSource = async (source) => {
    const raw = normalizeImageSource(source)
    if (!raw || !isCloudFileId(raw)) return ''
    return resolveImageUrl(raw)
  }

  let resolved = await resolveCloudSource(order.itemImage)
  if (resolved) return resolved

  if (itemId) {
    const fromItem = await fetchItemCoverSource(itemId, cache)
    resolved = await resolveCloudSource(fromItem)
    if (resolved) return resolved
  }
  return ''
}

module.exports = {
  isCloudFileId,
  normalizeImageSource,
  resolveImageUrl,
  resolveImageUrls,
  resolveOrderItemImage
}
