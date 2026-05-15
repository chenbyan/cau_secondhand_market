/**
 * 仅读写本地 userInfo 缓存，不依赖 Bmob，供 app 启动阶段使用，避免首包解析 SDK 超时。
 */
const USER_INFO_KEY = 'userInfo'

const checkLoginStatus = () => {
  const u = wx.getStorageSync(USER_INFO_KEY)
  return !!(u && u.objectId)
}

const getUserInfo = () => {
  const u = wx.getStorageSync(USER_INFO_KEY)
  return u && u.objectId ? u : null
}

module.exports = {
  USER_INFO_KEY,
  checkLoginStatus,
  getUserInfo
}
