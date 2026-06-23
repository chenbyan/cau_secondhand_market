/**
 * Bmob 云函数：creditApply
 *
 * 小程序端没有 Master Key，所有信用分加减都必须从这里统一落库。
 * 顺序固定为：读取 _User 当前分数 -> 更新 _User.creditScore -> 回读确认 -> 写 CreditRecord -> 写 UserNotice。
 */

var DEFAULT_SCORE = 100
var MIN_SCORE = 0
var MAX_SCORE = 500

// 如当前 Bmob 环境无法通过 oData 更新 users/_User，可在云函数控制台填环境变量：
// BMOB_APPLICATION_ID / BMOB_REST_API_KEY / BMOB_MASTER_KEY。
var REST_CONFIG = {
  apiBase: 'https://api.bmobcloud.com/1',
  appId: 'a4a07718ea4fbbc0f4f3939387d1b919',
  restKey: '2eeba8d1207aa9331d589ffc00ce97af',
  masterKey: '6ff77f0b90abc6780e0e660628c8f7c3'
}

function onRequest(request, response, modules) {
  var db = modules.oData
  var body = parseBody(request)

  var userId = objectIdOf(body.userId) || ''
  var delta = Number(body.delta || 0)
  var source = body.source || 'system'
  var sourceRef = body.sourceRef || ''
  var reason = body.reason || '信用分变更'
  var orderId = body.orderId || ''
  var itemId = body.itemId || ''
  var adminId = body.adminId || ''
  var freezeGate = body.freezeGate != null ? Number(body.freezeGate) : 60
  var freezeDays = body.freezeDays != null ? Number(body.freezeDays) : 7
  var syncOnly = body.syncOnly === true || body.action === 'sync'

  function end(obj) {
    response.end(JSON.stringify(obj))
  }

  if (!userId) {
    return end({ code: 4001, message: '缺少 userId', skipped: true, reason: 'no_user' })
  }
  if (!delta && !syncOnly) {
    return end({ code: 0, skipped: true, reason: 'zero_delta' })
  }
  if (syncOnly) {
    return syncCreditFromRecords()
  }

  if (sourceRef) {
    return db.find(
      { table: 'CreditRecord', where: { userId: userId, source: source, sourceRef: sourceRef }, limit: 1 },
      function (a, b) {
        var ret = pickResult(a, b)
        if (ret && ret.results && ret.results.length) {
          return end({ code: 0, skipped: true, reason: 'duplicate' })
        }
        applyCredit()
      }
    )
  }

  applyCredit()

  function applyCredit() {
    findUser(db, userId, function (userErr, user) {
      if (userErr) return end(userErr)

      var beforeScore = normalizeScore(user.creditScore)
      var afterScore = normalizeScore(beforeScore + delta)
      var actualDelta = afterScore - beforeScore
      var shouldFreeze = (user.status || 'active') === 'active' && afterScore < freezeGate
      var userPatch = { creditScore: afterScore }

      if (shouldFreeze) {
        userPatch.status = 'frozen'
        userPatch.creditFrozen = true
        userPatch.frozenUntil = {
          __type: 'Date',
          iso: new Date(Date.now() + freezeDays * 86400000).toISOString()
        }
      }

      updateUserWithVerify(db, body, userId, userPatch, function (updateErr, freshUser) {
        if (updateErr) return end(updateErr)

        db.insert(
          {
            table: 'CreditRecord',
            data: {
              userId: userId,
              delta: actualDelta,
              requestedDelta: delta,
              reason: reason,
              source: source,
              sourceRef: sourceRef,
              beforeScore: beforeScore,
              afterScore: afterScore,
              orderId: orderId,
              itemId: itemId,
              adminId: adminId
            }
          },
          function (ra, rb) {
            var recordErr = pickError(ra, rb)
            if (recordErr && !isWriteOk(ra, rb)) {
              return end({
                code: 5006,
                message: '信用流水写入失败：' + errorMessage(recordErr),
                result: {
                  userId: userId,
                  beforeScore: beforeScore,
                  afterScore: freshUser.creditScore != null ? normalizeScore(freshUser.creditScore) : afterScore,
                  delta: actualDelta,
                  frozen: shouldFreeze
                }
              })
            }
            writeCreditNotice(db, userId, actualDelta, reason, afterScore, shouldFreeze, function () {
              end({
                code: 0,
                result: {
                  userId: userId,
                  beforeScore: beforeScore,
                  afterScore: afterScore,
                  delta: actualDelta,
                  frozen: shouldFreeze
                }
              })
            })
          }
        )
      })
    })
  }

  function syncCreditFromRecords() {
    findUser(db, userId, function (userErr, user) {
      if (userErr) return end(userErr)

      db.find(
        { table: 'CreditRecord', where: { userId: userId }, limit: 1000, order: 'createdAt' },
        function (ra, rb) {
          var ret = pickResult(ra, rb)
          var rows = ret && ret.results ? ret.results : []
          var currentScore = normalizeScore(user.creditScore)
          var targetScore = DEFAULT_SCORE

          if (!rows.length) {
            return end({
              code: 0,
              result: {
                userId: userId,
                beforeScore: currentScore,
                afterScore: currentScore,
                delta: 0,
                synced: false
              }
            })
          }

          for (var i = 0; i < rows.length; i++) {
            targetScore = normalizeScore(targetScore + Number(rows[i].delta || 0))
          }

          if (targetScore === currentScore) {
            return end({
              code: 0,
              result: {
                userId: userId,
                beforeScore: currentScore,
                afterScore: currentScore,
                delta: 0,
                synced: false
              }
            })
          }

          var patch = { creditScore: targetScore }
          if ((user.status || 'active') === 'active' && targetScore < freezeGate) {
            patch.status = 'frozen'
            patch.creditFrozen = true
            patch.frozenUntil = {
              __type: 'Date',
              iso: new Date(Date.now() + freezeDays * 86400000).toISOString()
            }
          }

          updateUserWithVerify(db, body, userId, patch, function (updateErr) {
            if (updateErr) return end(updateErr)
            end({
              code: 0,
              result: {
                userId: userId,
                beforeScore: currentScore,
                afterScore: targetScore,
                delta: targetScore - currentScore,
                synced: true
              }
            })
          })
        }
      )
    })
  }
}

function writeCreditNotice(db, userId, actualDelta, reason, afterScore, frozen, cb) {
  var noticeTitle = actualDelta >= 0
    ? ('信用分 +' + actualDelta)
    : ('信用分 ' + actualDelta)
  var noticeContent = reason +
    ' · 当前信用分：' + afterScore +
    (frozen ? ' · 账号已冻结' : '')

  db.insert(
    {
      table: 'UserNotice',
      data: {
        userId: userId,
        type: 'credit_changed',
        title: noticeTitle,
        content: noticeContent,
        read: false
      }
    },
    function () { cb() }
  )
}

function objectIdOf(value) {
  if (!value) return ''
  if (typeof value === 'string') return value
  return value.objectId || value.id || ''
}

function findUser(db, userId, cb) {
  db.find({ table: '_User', where: { objectId: userId }, limit: 5 }, function (a, b) {
    var ret = pickResult(a, b)
    var err = pickError(a, b)
    if (!ret || !ret.results || !ret.results.length) {
      return cb({
        code: 4004,
        message: err ? errorMessage(err) : '用户不存在',
        skipped: true,
        reason: 'no_user'
      })
    }
    cb(null, ret.results[0])
  })
}

function updateUserWithVerify(db, body, userId, patch, cb) {
  var tables = ['users', '_User']
  var index = 0
  var lastError = ''

  function tryNextTable() {
    if (index >= tables.length) {
      return restUpdateUser(db, body, userId, patch, function (restErr, freshUser) {
        if (restErr) {
          restErr.message = restErr.message + (lastError ? '；oData 更新也未生效：' + lastError : '')
          return cb(restErr)
        }
        cb(null, freshUser)
      })
    }

    db.update(
      { table: tables[index++], objectId: userId, data: patch },
      function (a, b) {
        var err = pickError(a, b)
        if (err && !isWriteOk(a, b)) {
          lastError = errorMessage(err)
          return tryNextTable()
        }

        findUser(db, userId, function (readErr, freshUser) {
          if (readErr) {
            lastError = readErr.message || JSON.stringify(readErr)
            return tryNextTable()
          }
          if (userMatchesPatch(freshUser, patch)) {
            return cb(null, freshUser)
          }
          lastError = '用户更新后回读未生效，请确认 _User.creditScore 字段类型为 Number'
          tryNextTable()
        })
      }
    )
  }

  tryNextTable()
}

function restUpdateUser(db, body, userId, patch, cb) {
  var cfg = restConfig(body)
  if (!cfg.appId || !cfg.restKey || !cfg.masterKey) {
    return cb({
      code: 5004,
      message: '更新 _User.creditScore 失败：请确认云函数可写 users 表，或配置 BMOB_APPLICATION_ID / BMOB_REST_API_KEY / BMOB_MASTER_KEY'
    })
  }

  var https = require('https')
  var url = require('url')
  var base = String(cfg.apiBase || 'https://api.bmobcloud.com/1').replace(/\/$/, '')
  var payload = JSON.stringify(patch)
  var paths = [
    '/users/' + encodeURIComponent(userId),
    '/classes/_User/' + encodeURIComponent(userId)
  ]
  var pathIndex = 0
  var lastMessage = ''

  function tryNextPath() {
    if (pathIndex >= paths.length) {
      return cb({
        code: 5005,
        message: 'Bmob REST 更新 _User 失败：' + (lastMessage || '所有用户更新接口均未生效')
      })
    }

    var urlObj = url.parse(base + paths[pathIndex++])
    var options = {
      method: 'PUT',
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.path,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'X-Bmob-Application-Id': cfg.appId,
        'X-Bmob-REST-API-Key': cfg.restKey,
        'X-Bmob-Master-Key': cfg.masterKey
      }
    }

    var req = https.request(options, function (res) {
      var text = ''
      res.on('data', function (chunk) { text += chunk })
      res.on('end', function () {
        var data = toObject(text) || { raw: text }
        if (res.statusCode < 200 || res.statusCode >= 300 || data.error || (data.code && data.code !== 0 && !data.updatedAt)) {
          lastMessage = data.error || data.message || data.msg || text || String(res.statusCode)
          return tryNextPath()
        }
        findUser(db, userId, function (readErr, freshUser) {
          if (readErr) {
            lastMessage = readErr.message || JSON.stringify(readErr)
            return tryNextPath()
          }
          if (!userMatchesPatch(freshUser, patch)) {
            lastMessage = 'REST 更新后回读仍未生效'
            return tryNextPath()
          }
          cb(null, freshUser)
        })
      })
    })

    req.on('error', function (e) {
      lastMessage = e.message
      tryNextPath()
    })
    req.write(payload)
    req.end()
  }

  tryNextPath()
}

function restConfig() {
  var env = typeof process !== 'undefined' && process.env ? process.env : {}
  return {
    apiBase: REST_CONFIG.apiBase || env.BMOB_API_BASE || 'https://api.bmobcloud.com/1',
    appId: REST_CONFIG.appId || env.BMOB_APPLICATION_ID || env.VITE_BMOB_APPLICATION_ID || '',
    restKey: REST_CONFIG.restKey || env.BMOB_REST_API_KEY || env.VITE_BMOB_REST_API_KEY || '',
    masterKey: REST_CONFIG.masterKey || env.BMOB_MASTER_KEY || ''
  }
}

function userMatchesPatch(row, patch) {
  if (!row) return false
  if (patch.creditScore != null && normalizeScore(row.creditScore) !== normalizeScore(patch.creditScore)) return false
  if (patch.status != null && (row.status || 'active') !== patch.status) return false
  if (patch.creditFrozen != null && !!row.creditFrozen !== !!patch.creditFrozen) return false
  return true
}

function normalizeScore(value) {
  var n = Number(value)
  return isFinite(n) ? Math.min(MAX_SCORE, Math.max(MIN_SCORE, n)) : DEFAULT_SCORE
}

function parseBody(request) {
  if (!request) return {}
  try {
    if (request.body) return typeof request.body === 'string' ? JSON.parse(request.body) : request.body
    if (request.params) return typeof request.params === 'string' ? JSON.parse(request.params) : request.params
    return request
  } catch (e) {
    return {}
  }
}

function toObject(x) {
  if (!x) return null
  if (typeof x === 'string') {
    try { return JSON.parse(x) } catch (e) { return null }
  }
  return typeof x === 'object' ? x : null
}

function pickResult(a, b) {
  var o1 = toObject(a)
  var o2 = toObject(b)
  if (o1 && (o1.objectId || o1.results)) return o1
  if (o2 && (o2.objectId || o2.results)) return o2
  return null
}

function pickError(a, b) {
  var o1 = toObject(a)
  var o2 = toObject(b)
  if (
    (o1 && (o1.results || o1.objectId || o1.updatedAt || o1.createdAt)) ||
    (o2 && (o2.results || o2.objectId || o2.updatedAt || o2.createdAt))
  ) return null
  if (o1 && ((o1.code && o1.code !== 0) || o1.error || o1.message) && !o1.results) return o1
  if (o2 && ((o2.code && o2.code !== 0) || o2.error || o2.message) && !o2.results) return o2
  return null
}

function isWriteOk(a, b) {
  var o1 = toObject(a)
  var o2 = toObject(b)
  return !!(
    (o1 && (o1.objectId || o1.createdAt || o1.updatedAt)) ||
    (o2 && (o2.objectId || o2.createdAt || o2.updatedAt))
  )
}

function errorMessage(err) {
  if (!err) return ''
  return err.message || err.error || err.msg || JSON.stringify(err)
}
