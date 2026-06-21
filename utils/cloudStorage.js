/**
 * 微信云开发 · 云存储（仅图片上传，业务数据仍用 Bmob）
 */
const { CLOUD_ENV_ID } = require('./cloudConfig.js')
const util = require('./util.js')

const UPLOAD_TIMEOUT_MS = 20000

const assertEnvConfigured = () => {
  if (!CLOUD_ENV_ID || CLOUD_ENV_ID === 'your-cloud-env-id') {
    throw new Error(
      '请先在 utils/cloudConfig.js 填写 CLOUD_ENV_ID（云开发环境 ID）'
    )
  }
}

const assertCloudApi = () => {
  if (!wx.cloud || typeof wx.cloud.uploadFile !== 'function') {
    throw new Error('当前基础库不支持云开发，请升级微信开发者工具/基础库')
  }
}

const extFromPath = (tempFilePath) => {
  const m = (tempFilePath || '').match(/\.(\w+)(?:\?|$)/)
  const ext = m ? m[1].toLowerCase() : 'jpg'
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].indexOf(ext) >= 0) return ext
  return 'jpg'
}

/**
 * 上传单张图片，返回 cloud:// 开头的 fileID（可写入 Item.coverImage / images）
 */
/** @param {string} tempFilePath @param {string} [folder='items'] 云存储目录，头像用 avatars */
const uploadImage = async (tempFilePath, folder = 'items') => {
  assertCloudApi()
  assertEnvConfigured()
  await util.assertImageWithinSize(tempFilePath)

  const ext = extFromPath(tempFilePath)
  const cloudPath = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`

  return new Promise((resolve, reject) => {
    let done = false
    const timer = setTimeout(() => {
      if (done) return
      done = true
      reject(new Error('云存储上传超时，请检查是否已开通云开发'))
    }, UPLOAD_TIMEOUT_MS)

    wx.cloud.uploadFile({
      cloudPath,
      filePath: tempFilePath,
      success: (res) => {
        if (done) return
        done = true
        clearTimeout(timer)
        if (res.fileID) resolve(res.fileID)
        else reject(new Error('云存储未返回 fileID'))
      },
      fail: (err) => {
        if (done) return
        done = true
        clearTimeout(timer)
        const msg = (err && err.errMsg) || '云存储上传失败'
        if (msg.indexOf('Cloud API isn\'t enabled') >= 0 || msg.indexOf('云开发') >= 0) {
          reject(
            new Error(
              '云开发未初始化：请确认已开通云开发，且 utils/cloudConfig.js 中环境 ID 正确'
            )
          )
        } else {
          reject(new Error(msg))
        }
      }
    })
  })
}

const uploadImages = async (tempPaths, maxCount = 6, folder = 'items') => {
  const paths = (tempPaths || []).slice(0, maxCount)
  const ids = []
  for (let i = 0; i < paths.length; i++) {
    ids.push(await uploadImage(paths[i], folder))
  }
  return ids
}

module.exports = {
  uploadImage,
  uploadImages
}
