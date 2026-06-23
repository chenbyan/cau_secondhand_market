/**
 * 用户昵称解析（带内存 + 本地缓存，降低 _User 查询频率）
 */
const Bmob = require('./bmob.js')

const CACHE_KEY = 'user_nick_cache_v1'
const TTL_MS = 24 * 60 * 60 * 1000
const mem = {}

function loadStorageCache() {
  try {
    return wx.getStorageSync(CACHE_KEY) || {}
  } catch (e) {
    return {}
  }
}

function saveStorageCache(cache) {
  try {
    wx.setStorageSync(CACHE_KEY, cache)
  } catch (e) {}
}

function isRateLimitError(e) {
  const code = e && (e.code || e.errorCode)
  const msg = String((e && (e.error || e.message)) || '')
  return code === 10210 || msg.indexOf('请求数限制') >= 0
}

function readCached(userId) {
  const now = Date.now()
  if (mem[userId] && now - mem[userId].at < TTL_MS) {
    return mem[userId].nick
  }
  const storage = loadStorageCache()
  const cached = storage[userId]
  if (cached && now - cached.at < TTL_MS) {
    mem[userId] = cached
    return cached.nick
  }
  return ''
}

function writeCached(userId, nick) {
  const entry = { nick, at: Date.now() }
  mem[userId] = entry
  const storage = loadStorageCache()
  storage[userId] = entry
  saveStorageCache(storage)
}

async function resolveUserNickName(userId) {
  if (!userId) return '未知'
  const cached = readCached(userId)
  if (cached) return cached

  try {
    const user = await Bmob.User.get(userId)
    const nick = ((user && (user.nickName || user.username)) || '').trim() || '用户'
    writeCached(userId, nick)
    return nick
  } catch (e) {
    console.warn('resolveUserNickName', userId, e)
    if (isRateLimitError(e)) {
      return '用户'
    }
    return '用户'
  }
}

async function resolveUserNickNames(userIds) {
  const map = {}
  const ids = [...new Set((userIds || []).filter(Boolean))]
  for (let i = 0; i < ids.length; i++) {
    map[ids[i]] = await resolveUserNickName(ids[i])
  }
  return map
}

module.exports = {
  resolveUserNickName,
  resolveUserNickNames
}
