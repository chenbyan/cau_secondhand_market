/**
 * 登录认证与校园邮箱验证（Bmob）
 */
const Bmob = require('./bmob.js')
const util = require('./util.js')
const authStorage = require('./authStorage.js')

const { USER_INFO_KEY } = authStorage
const VERIFY_SEND_PREFIX = 'verifyEmailLastSend_'

/**
 * 将 loginWithWeapp / linkWith 返回的用户写入 SDK 使用的本地会话（与 User.auth 内逻辑一致）。
 * hydrogen-js-sdk 的 loginWithWeapp 不会自动 storage.save('bmob')，不调用则 User.current() 恒为空。
 */
const persistBmobSession = (bmobUser) => {
  if (!bmobUser || !bmobUser.objectId) return
  const weapp = bmobUser.authData && bmobUser.authData.weapp
  const oid =
    bmobUser.openid ||
    (weapp && weapp.openid) ||
    ''
  if (oid) {
    try {
      wx.setStorageSync('openid', oid)
    } catch (e) {
      // ignore
    }
  }
  try {
    wx.setStorageSync('bmob', JSON.stringify(bmobUser))
  } catch (e) {
    console.warn('persistBmobSession 失败', e)
  }
}

/** 从 Bmob 用户对象整理为本地缓存结构 */
const normalizeUser = (bmobUser) => {
  if (!bmobUser) return null
  const weapp = bmobUser.authData && bmobUser.authData.weapp
  const openid =
    bmobUser.openid ||
    (weapp && weapp.openid) ||
    ''
  return {
    objectId: bmobUser.objectId,
    openid,
    nickName: bmobUser.nickName || bmobUser.username || '',
    avatarUrl: bmobUser.avatarUrl || bmobUser.userPic || '',
    phone: bmobUser.phone || '',
    wechatId: bmobUser.wechatId || '',
    campus: bmobUser.campus || '',
    dormitory: bmobUser.dormitory || '',
    campusEmail: bmobUser.campusEmail || '',
    campusVerified: !!bmobUser.campusVerified,
    creditScore: bmobUser.creditScore != null ? Number(bmobUser.creditScore) : 100,
    status: bmobUser.status || 'active',
    username: bmobUser.username || ''
  }
}

const persistUserInfo = (bmobUser) => {
  const info = normalizeUser(bmobUser)
  if (info && info.objectId) {
    wx.setStorageSync(USER_INFO_KEY, info)
  }
  return info
}

/**
 * 微信登录：wx.login → Bmob 一键注册/登录（SDK：loginWithWeapp）
 */
const wxLogin = async () => {
  const loginRes = await new Promise((resolve, reject) => {
    wx.login({
      success: (res) => resolve(res),
      fail: (err) => reject(err)
    })
  })
  if (!loginRes.code) {
    throw new Error('获取微信 code 失败')
  }
  // 文档方法名与需求文档略有差异，此处使用 hydrogen-js-sdk 标准接口
  const user = await Bmob.User.loginWithWeapp(loginRes.code)
  if (!user || !user.objectId) {
    throw new Error('登录失败')
  }
  persistBmobSession(user)
  const info = persistUserInfo(Bmob.User.current() || user)
  const isNewUser = inferIsNewUser(user)
  return { userInfo: info, isNewUser, raw: user }
}

const inferIsNewUser = (bmobUser) => {
  if (bmobUser.isNewUser !== undefined) return !!bmobUser.isNewUser
  if (bmobUser.is_new !== undefined) return !!bmobUser.is_new
  // 无资料字段时引导完善资料
  const needProfile =
    !bmobUser.nickName &&
    !bmobUser.phone &&
    !bmobUser.campus
  return needProfile
}

const checkLoginStatus = () => authStorage.checkLoginStatus()

const getUserInfo = () => authStorage.getUserInfo()

/**
 * 更新当前用户字段并写回 Bmob 与本地缓存
 */
const updateUserInfo = async (data) => {
  const current = Bmob.User.current()
  if (!current || !current.objectId) {
    throw new Error('登录状态失效，请重新一键登录')
  }
  const row = await Bmob.User.get(current.objectId)
  Object.keys(data).forEach((k) => {
    if (data[k] !== undefined) row.set(k, data[k])
  })
  await row.save()
  await Bmob.User.updateStorage(current.objectId)
  return persistUserInfo(Bmob.User.current())
}

const logout = () => {
  try {
    Bmob.User.logout()
  } catch (e) {
    // ignore
  }
  wx.removeStorageSync(USER_INFO_KEY)
  wx.reLaunch({ url: '/pages/login/login' })
}

const checkCampusVerified = () => {
  const u = getUserInfo()
  return !!(u && u.campusVerified)
}

const dateGtNowIso = () => ({
  __type: 'Date',
  iso: new Date().toISOString()
})

const dateFromNowMinutes = (mins) => ({
  __type: 'Date',
  iso: new Date(Date.now() + mins * 60 * 1000).toISOString()
})

/**
 * 发送校园邮箱验证码：写 VerifyCode 表 + 调用云函数发信（需后台部署 sendVerifyEmail）
 */
const sendVerifyCode = async (email) => {
  if (!util.validateEmail(email)) {
    return { success: false, message: '请输入有效的 .edu.cn 校园邮箱' }
  }
  const lastKey = `${VERIFY_SEND_PREFIX}${email}`
  const last = wx.getStorageSync(lastKey) || 0
  if (Date.now() - last < 60 * 1000) {
    return { success: false, message: '发送过于频繁，请 60 秒后再试' }
  }
  const u = getUserInfo()
  if (!u || !u.objectId) {
    return { success: false, message: '请先登录' }
  }
  const code = `${Math.floor(100000 + Math.random() * 900000)}`
  const verify = Bmob.Query('VerifyCode')
  verify.set('email', email)
  verify.set('code', code)
  verify.set('userId', Bmob.Pointer('_User').set(u.objectId))
  verify.set('expireAt', dateFromNowMinutes(5))
  verify.set('used', false)
  await verify.save()
  try {
    await Bmob.functions('sendVerifyEmail', { email, code })
  } catch (e) {
    console.warn('sendVerifyEmail 云函数调用失败（请部署云函数或检查后台邮件配置）', e)
    // 开发环境无云函数时仍返回成功，便于联调表结构；生产环境应部署云函数
    return {
      success: false,
      message:
        (e && e.error) ||
        '邮件发送失败：请在 Bmob 部署 sendVerifyEmail 云函数并配置发信'
    }
  }
  wx.setStorageSync(lastKey, Date.now())
  return { success: true }
}

/**
 * 校验验证码并更新用户校园认证状态
 */
const verifyCode = async (email, code) => {
  if (!email || !code) {
    return { success: false, message: '请输入邮箱和验证码' }
  }
  const q = Bmob.Query('VerifyCode')
  q.equalTo('email', '==', email)
  q.equalTo('code', '==', `${code}`)
  q.equalTo('used', '==', false)
  q.equalTo('expireAt', '>', dateGtNowIso())
  q.limit(1)
  const list = await q.find()
  if (!list || !list.length) {
    return { success: false, message: '验证码错误或已过期' }
  }
  const row = list[0]
  const rec = await Bmob.Query('VerifyCode').get(row.objectId)
  rec.set('used', true)
  await rec.save()
  await updateUserInfo({ campusVerified: true, campusEmail: email })
  return { success: true }
}

module.exports = {
  wxLogin,
  checkLoginStatus,
  getUserInfo,
  updateUserInfo,
  logout,
  checkCampusVerified,
  sendVerifyCode,
  verifyCode,
  normalizeUser,
  persistUserInfo,
  USER_INFO_KEY
}
