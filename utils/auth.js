/**
 * 登录认证与校园邮箱验证（Bmob）
 */
const Bmob = require('./bmob.js')
const util = require('./util.js')
const authStorage = require('./authStorage.js')
const sysConfig = require('./sysConfig.js')
const crypto = require('./crypto.js')

const { USER_INFO_KEY } = authStorage
const VERIFY_SEND_PREFIX = 'verifyEmailLastSend_'
const CAMPUS_VERIFY_URL = '/pages/my/campusVerify/campusVerify'
const ACCOUNT_DISABLED_CODE = 'ACCOUNT_DISABLED'

const normalizeCreditScore = (value) => {
  const n = Number(value)
  return Number.isFinite(n) ? Math.min(500, Math.max(0, n)) : 100
}

/** 身份认证可选校区（仅东西校区） */
const CAMPUSES = ['东校区', '西校区']

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

/** 从 Bmob 用户对象整理为本地缓存结构（自动解密敏感字段） */
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
    phone: crypto.decrypt(bmobUser.phone || ''),
    wechatId: crypto.decrypt(bmobUser.wechatId || ''),
    campus: bmobUser.campus || '',
    dormitory: bmobUser.dormitory || '',
    campusEmail: crypto.decrypt(bmobUser.campusEmail || ''),
    campusVerifySt: bmobUser.campusVerifySt || '',
    campusVerified: !!bmobUser.campusVerified,
    creditScore: normalizeCreditScore(bmobUser.creditScore),
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

const clearLocalAuthSession = () => {
  // Bmob.User.logout() 会调用 wx.clearStorageSync()，会连同聊天已读状态一起清空。
  // 退出时只删除 Bmob 会话和本地用户信息，保留聊天及其他业务缓存。
  ;['bmob', 'openid', USER_INFO_KEY].forEach((key) => {
    try {
      wx.removeStorageSync(key)
    } catch (e) {
      // ignore
    }
  })
}

const createAccountDisabledError = () => {
  const error = new Error('账户已被禁用，无法登录')
  error.code = ACCOUNT_DISABLED_CODE
  return error
}

const ensureAccountDefaults = async (bmobUser) => {
  if (!bmobUser || !bmobUser.objectId) return
  if (bmobUser.creditScore != null && bmobUser.status) return
  try {
    const row = await Bmob.User.get(bmobUser.objectId)
    let changed = false
    if (row.creditScore == null) {
      row.set('creditScore', 100)
      changed = true
    }
    if (!row.status) {
      row.set('status', 'active')
      changed = true
    }
    if (changed) {
      await row.save()
      await Bmob.User.updateStorage(bmobUser.objectId)
    }
  } catch (e) {
    console.warn('初始化用户信用默认值失败', e)
  }
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
  const user = await Bmob.User.loginWithWeapp(loginRes.code)
  if (!user || !user.objectId) {
    throw new Error('登录失败')
  }
  persistBmobSession(user)
  await ensureAccountDefaults(user)
  try {
    await Bmob.User.updateStorage(user.objectId)
  } catch (e) {
    console.warn('登录后刷新用户状态失败，使用登录返回数据', e)
  }
  const latestUser = Bmob.User.current() || user
  const info = normalizeUser(latestUser)
  if (info && info.status === 'disabled') {
    clearLocalAuthSession()
    throw createAccountDisabledError()
  }
  persistUserInfo(latestUser)
  const isNewUser = inferIsNewUser(user)
  return { userInfo: info, isNewUser, raw: user }
}

const inferIsNewUser = (bmobUser) => {
  if (bmobUser.isNewUser !== undefined) return !!bmobUser.isNewUser
  if (bmobUser.is_new !== undefined) return !!bmobUser.is_new
  const needProfile =
    !bmobUser.nickName &&
    !bmobUser.phone &&
    !bmobUser.campus
  return needProfile
}

const checkLoginStatus = () => authStorage.checkLoginStatus()

const getUserInfo = () => authStorage.getUserInfo()

const refreshCurrentUserInfo = async () => {
  const current = getUserInfo()
  if (!current || !current.objectId) return current
  try {
    await Bmob.User.updateStorage(current.objectId)
    const latest = persistUserInfo(Bmob.User.current()) || current
    if (latest && latest.status === 'disabled') {
      forceLogoutDisabled()
      return null
    }
    return latest
  } catch (e) {
    console.warn('刷新用户认证状态失败', e)
    return current
  }
}

const getPointerId = (value) => {
  if (!value) return ''
  if (typeof value === 'string') return value
  return value.objectId || value.id || ''
}

const findCampusEmailOwner = async (email, currentUserId) => {
  if (!email) return null
  try {
    const q = Bmob.Query('_User')
    q.equalTo('campusEmail', '==', crypto.encrypt(email))
    q.limit(20)
    const rows = await q.find()
    return (rows || []).find((u) => {
      const id = getPointerId(u)
      return (
        id &&
        id !== currentUserId &&
        (u.campusVerified || u.campusVerifySt === 'APPROVED' || u.campusVerifySt === 'PENDING')
      )
    }) || null
  } catch (e) {
    console.warn('检查校园邮箱占用失败', e)
    return null
  }
}

/**
 * 更新当前用户字段并写回 Bmob 与本地缓存（自动加密敏感字段）
 */
const ENCRYPT_FIELDS = ['phone', 'wechatId', 'campusEmail']

const updateUserInfo = async (data) => {
  const current = Bmob.User.current()
  if (!current || !current.objectId) {
    throw new Error('登录状态失效，请重新一键登录')
  }
  const row = await Bmob.User.get(current.objectId)
  Object.keys(data).forEach((k) => {
    if (data[k] === undefined) return
    const val = ENCRYPT_FIELDS.indexOf(k) >= 0 && data[k]
      ? crypto.encrypt(data[k])
      : data[k]
    row.set(k, val)
  })
  await row.save()
  await Bmob.User.updateStorage(current.objectId)
  return persistUserInfo(Bmob.User.current())
}

const logout = () => {
  clearLocalAuthSession()
  wx.reLaunch({ url: '/pages/login/login' })
}

const forceLogoutDisabled = () => {
  clearLocalAuthSession()
  wx.showModal({
    title: '账户已禁用',
    content: '该账户已被禁用，无法登录。',
    showCancel: false,
    complete: () => wx.reLaunch({ url: '/pages/login/login' })
  })
}

const checkCampusVerified = () => {
  const u = getUserInfo()
  if (!u) return false
  if (u.campusVerified) return true
  if (u.campusVerifySt === 'APPROVED') return true
  // 兼容旧版：邮箱验证码通过后即视为有效，不再等待管理员
  if (u.campusVerifySt === 'PENDING' && u.campusEmail) return true
  return false
}

/**
 * 敏感操作门禁：未登录或未校园认证则跳转认证页（游客仅可浏览）。
 * @returns {boolean} 是否允许继续
 */
const guardCampusAction = (options = {}) => {
  const tip = options.tip || '请先完成校园认证后再操作'
  if (!checkLoginStatus()) {
    util.showToast('请先登录')
    wx.navigateTo({ url: '/pages/login/login' })
    return false
  }
  const u = getUserInfo()
  if (u && u.status && u.status !== 'active') {
    if (u.status === 'disabled') {
      forceLogoutDisabled()
      return false
    }
    if (!(u.status === 'frozen' && options.allowFrozen)) {
      util.showToast('账号已被冻结')
      return false
    }
  }
  if (!checkCampusVerified()) {
    const status = u && u.campusVerifySt
    let tipMsg = tip
    if (status === 'REJECTED') {
      tipMsg = '校园认证未通过，请重新提交'
    }
    util.showToast(tipMsg)
    wx.navigateTo({ url: CAMPUS_VERIFY_URL })
    return false
  }
  if (options.creditGate) {
    const minGate = sysConfig.getCreditMinGate()
    const score = normalizeCreditScore(u && u.creditScore)
    if (score < minGate) {
      util.showToast(
        options.creditTip ||
          `信用分 ${score} 低于 ${minGate}，暂不可${options.actionName || '操作'}`
      )
      return false
    }
  }
  return true
}

/**
 * 异步门禁，供页面 async 方法 await。
 */
const requireCampusVerified = async (options = {}) => {
  return guardCampusAction(options)
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
  email = String(email || '').trim().toLowerCase()
  if (!util.validateEmail(email)) {
    return { success: false, message: '请输入有效的 @cau.edu.cn 校园邮箱' }
  }
  const current = await refreshCurrentUserInfo()
  if (current && current.campusVerified) {
    return { success: false, message: '您已通过校园认证' }
  }
  if (current && current.campusVerifySt === 'PENDING' && current.campusEmail) {
    return { success: false, message: '该邮箱已提交过认证，请刷新页面或重新登录' }
  }
  const lastKey = `${VERIFY_SEND_PREFIX}${email}`
  const last = wx.getStorageSync(lastKey) || 0
  if (Date.now() - last < 60 * 1000) {
    return { success: false, message: '发送过于频繁，请 60 秒后再试' }
  }
  const u = current || getUserInfo()
  if (!u || !u.objectId) {
    return { success: false, message: '请先登录' }
  }
  const owner = await findCampusEmailOwner(email, u.objectId)
  if (owner) {
    return { success: false, message: '该校园邮箱已被其他账号提交或认证，请更换邮箱或联系管理员' }
  }
  const code = `${Math.floor(100000 + Math.random() * 900000)}`
  const salt = crypto.randomSalt()
  const verify = Bmob.Query('VerifyCode')
  verify.set('email', crypto.encrypt(email))
  verify.set('code', crypto.hashCode(code, salt))
  verify.set('userId', Bmob.Pointer('_User').set(u.objectId))
  verify.set('expireAt', dateFromNowMinutes(5))
  verify.set('used', false)
  await verify.save()
  try {
    await Bmob.functions('sendVerifyEmail', { email, code })
  } catch (e) {
    console.warn('sendVerifyEmail 云函数调用失败（请部署云函数或检查后台邮件配置）', e)
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
const verifyCode = async (email, code, campus) => {
  email = String(email || '').trim().toLowerCase()
  const current = await refreshCurrentUserInfo()
  if (current && current.campusVerified) {
    return { success: true, message: '您已通过校园认证' }
  }
  if (current && current.campusVerifySt === 'PENDING' && current.campusEmail) {
    return { success: false, message: '该邮箱已提交过认证，请刷新页面或重新登录' }
  }
  if (!email || !code) {
    return { success: false, message: '请输入邮箱和验证码' }
  }
  if (!campus || CAMPUSES.indexOf(campus) < 0) {
    return { success: false, message: '请选择东校区或西校区' }
  }
  if (!current || !current.objectId) {
    return { success: false, message: '请先登录' }
  }
  const owner = await findCampusEmailOwner(email, current.objectId)
  if (owner) {
    return { success: false, message: '该校园邮箱已被其他账号提交或认证，请更换邮箱或联系管理员' }
  }
  const q = Bmob.Query('VerifyCode')
  q.equalTo('email', '==', crypto.encrypt(email))
  q.equalTo('userId', '==', Bmob.Pointer('_User').set(current.objectId))
  q.equalTo('used', '==', false)
  q.equalTo('expireAt', '>', dateGtNowIso())
  q.limit(10)
  const list = await q.find()
  const row = (list || []).find((r) => crypto.verifyCode(code, r.code))
  if (!row) {
    return { success: false, message: '验证码错误或已过期' }
  }
  const rec = await Bmob.Query('VerifyCode').get(row.objectId)
  rec.set('used', true)
  await rec.save()
  await updateUserInfo({
    campusVerified: true,
    campusVerifySt: 'APPROVED',
    campusEmail: email,
    campus
  })
  return { success: true, message: '校园认证成功' }
}

/**
 * 检查当前登录用户是否已填写手机号
 */
const checkPhoneSet = () => {
  const u = getUserInfo()
  return !!(u && u.phone && String(u.phone).trim())
}

/**
 * 查询任意用户的手机号（从 _User 表解密后返回明文）
 */
const fetchUserPhone = async (userId) => {
  if (!userId) return ''
  try {
    const q = Bmob.Query('_User')
    q.equalTo('objectId', '==', userId)
    q.limit(1)
    const rows = await q.find()
    const u = rows && rows[0]
    if (!u) return ''
    return crypto.decrypt(u.phone || '')
  } catch (e) {
    console.warn('fetchUserPhone 失败', e)
    return ''
  }
}

module.exports = {
  wxLogin,
  checkLoginStatus,
  getUserInfo,
  updateUserInfo,
  logout,
  forceLogoutDisabled,
  checkCampusVerified,
  checkPhoneSet,
  fetchUserPhone,
  guardCampusAction,
  requireCampusVerified,
  sendVerifyCode,
  verifyCode,
  normalizeUser,
  persistUserInfo,
  refreshCurrentUserInfo,
  ACCOUNT_DISABLED_CODE,
  CAMPUSES,
  CAMPUS_VERIFY_URL,
  USER_INFO_KEY
}
