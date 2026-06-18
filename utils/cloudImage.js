/**
 * 云存储 fileID（cloud://）在 <image> 中展示时的解析
 * 避免直接走 CDN 签名链出现 403（与存储权限、签名有关）
 */

const isCloudFileId = (url) => !!url && String(url).indexOf('cloud://') === 0

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

module.exports = {
  isCloudFileId,
  resolveImageUrl,
  resolveImageUrls
}
