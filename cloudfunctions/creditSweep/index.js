/**
 * Bmob 云函数：creditSweep
 * 建议每 5 分钟定时执行：取消付款锁定超时订单、结算长期待确认收货订单。
 */
function onRequest(request, response, modules) {
  var rt = bmobRuntime(modules)
  var db = rt.db
  var body = rt.parseBody(request)
  var now = Date.now()
  var autoCompleteMs = Number(body.autoCompleteDays || 7) * 24 * 60 * 60 * 1000
  var autoConfirmMs = 24 * 60 * 60 * 1000  // 24h seller-confirm deadline
  var freezeDurationMs = 7 * 24 * 60 * 60 * 1000
  var stats = { timeoutCancelled: 0, autoCompleted: 0, autoConfirmed: 0, unfrozen: 0, creditErrors: 0 }

  // 1. Cancel payment-lock-expired IN_TRADING orders
  findOrders('IN_TRADING', function (trading) {
    processList(trading, handleTrading, function () {
      // 2. Auto-complete long-shipped orders
      findOrders('SHIPPED', function (shipped) {
        processList(shipped, handleShipped, function () {
          // 3. Auto-confirm PENDING_CONFIRM orders after 24h, penalise seller
          findOrders('PENDING_CONFIRM', function (pending) {
            processList(pending, handlePendingConfirm, function () {
              // 4. Unfreeze accounts whose frozenUntil has passed
              sweepFrozenUsers(function () {
                response.end(JSON.stringify({ code: 0, result: stats }))
              })
            })
          })
        })
      })
    })
  })

  function findOrders(status, cb) {
    db.find({ table: 'Order', where: { status: status }, limit: 100 }, function (a, b) {
      var ret = rt.pickResult(a, b)
      cb(ret && ret.results ? ret.results : [])
    })
  }

  function processList(list, handler, cb) {
    var i = 0
    function next() {
      if (i >= list.length) return cb()
      handler(list[i++], next)
    }
    next()
  }

  function handleTrading(order, cb) {
    if (order.frozen) return cb()
    var expire = parseTime(order.payExpireAt)
    if (!expire || expire > now) return cb()
    db.update(
      { table: 'Order', objectId: order.objectId, data: { status: 'CANCELLED' } },
      function () {
        releaseItem(order.itemId, function () {
          penalizeSellerTimeout(order, function () {
            stats.timeoutCancelled += 1
            cb()
          })
        })
      }
    )
  }

  function handleShipped(order, cb) {
    if (order.frozen || order.creditSettled) return cb()
    var base = parseTime(order.updatedAt) || parseTime(order.createdAt)
    if (!base || now - base < autoCompleteMs) return cb()
    db.update(
      { table: 'Order', objectId: order.objectId, data: { status: 'COMPLETED' } },
      function () {
        markItemSold(order.itemId, function () {
          rewardComplete(order, function () {
            stats.autoCompleted += 1
            cb()
          })
        })
      }
    )
  }

  function releaseItem(itemId, cb) {
    if (!itemId) return cb()
    db.update(
      {
        table: 'Item',
        objectId: itemId,
        data: { status: 'ON_SALE', lockBuyerId: '', lockBuyers: [], lockExpireAt: null }
      },
      cb
    )
  }

  function markItemSold(itemId, cb) {
    if (!itemId) return cb()
    db.update({ table: 'Item', objectId: itemId, data: { status: 'SOLD_OUT' } }, cb)
  }

  function handlePendingConfirm(order, cb) {
    if (order.frozen || order.autoConfirmed) return cb()
    var created = parseTime(order.createdAt)
    if (!created || now - created < autoConfirmMs) return cb()
    // auto-confirm: move to IN_TRADING
    db.update(
      { table: 'Order', objectId: order.objectId, data: { status: 'IN_TRADING', autoConfirmed: true } },
      function () {
        penalizeSellerNoConfirm(order, function () {
          stats.autoConfirmed += 1
          cb()
        })
      }
    )
  }

  function penalizeSellerNoConfirm(order, cb) {
    var sellerId = objectIdOf(order.sellerId)
    if (order.noConfirmCreditSet || !sellerId) return cb()
    var delta = Number(body.sellerNoConfirmPenalty || -1)
    applyDelta(sellerId, delta, {
      source: 'seller_no_confirm',
      sourceRef: order.objectId + ':seller_no_confirm',
      reason: '超时24小时未确认订单，系统自动确认',
      orderId: order.objectId,
      itemId: order.itemId || ''
    }, function (creditErr) {
      if (creditErr) {
        stats.creditErrors += 1
        return cb()
      }
      db.update(
        { table: 'Order', objectId: order.objectId, data: { noConfirmCreditSet: true } },
        cb
      )
    })
  }

  function sweepFrozenUsers(cb) {
    db.find(
      { table: '_User', where: { status: 'frozen', creditFrozen: true }, limit: 100 },
      function (a, b) {
        var ret = rt.pickResult(a, b)
        var users = ret && ret.results ? ret.results : []
        var i = 0
        function next() {
          if (i >= users.length) return cb()
          var user = users[i++]
          var until = parseTime(user.frozenUntil)
          if (!until || until > now) return next()
          db.update(
            { table: '_User', objectId: user.objectId, data: { status: 'active', creditFrozen: false } },
            function () { stats.unfrozen += 1; next() }
          )
        }
        next()
      }
    )
  }

  function penalizeSellerTimeout(order, cb) {
    var sellerId = objectIdOf(order.sellerId)
    if (order.timeoutCreditSet || !sellerId) return cb()
    var delta = Number(body.timeoutPenalty || -5)
    applyDelta(sellerId, delta, {
      source: 'order_timeout',
      sourceRef: order.objectId + ':seller_timeout',
      reason: '超时未响应：' + (order.itemTitle || '订单'),
      orderId: order.objectId,
      itemId: order.itemId || ''
    }, function (creditErr) {
      if (creditErr) {
        stats.creditErrors += 1
        return cb()
      }
      db.update(
        {
          table: 'Order',
          objectId: order.objectId,
          data: {
            timeoutCreditSet: true,
            creditSettled: true,
            creditSettledAt: dateNow()
          }
        },
        cb
      )
    })
  }

  function rewardComplete(order, cb) {
    var bonus = Number(body.completeBonus || 1)
    var ids = unique([order.buyerId, order.sellerId])
    var i = 0
    var hasCreditError = false
    function next() {
      if (i >= ids.length) {
        if (hasCreditError) {
          stats.creditErrors += 1
          return cb()
        }
        return db.update(
          {
            table: 'Order',
            objectId: order.objectId,
            data: { creditSettled: true, creditSettledAt: dateNow() }
          },
          cb
        )
      }
      var userId = ids[i++]
      applyDelta(userId, bonus, {
        source: 'order_complete',
        sourceRef: order.objectId + ':complete:' + userId,
        reason: '订单完成奖励：' + (order.itemTitle || '交易'),
        orderId: order.objectId,
        itemId: order.itemId || ''
      }, function (creditErr) {
        if (creditErr) hasCreditError = true
        next()
      })
    }
    next()
  }

  function applyDelta(userId, delta, payload, cb) {
    userId = objectIdOf(userId)
    if (!userId) return cb(null, { skipped: true, reason: 'no_user' })
    db.find(
      {
        table: 'CreditRecord',
        where: {
          userId: userId,
          source: payload.source,
          sourceRef: payload.sourceRef
        },
        limit: 1
      },
      function (ca, cb2) {
        var existed = rt.pickResult(ca, cb2)
        if (existed && existed.results && existed.results.length) return cb(null, { skipped: true, reason: 'duplicate' })
        db.find({ table: '_User', where: { objectId: userId }, limit: 1 }, function (ua, ub) {
          var userRet = rt.pickResult(ua, ub)
          if (!userRet || !userRet.results || !userRet.results.length) return cb(null, { skipped: true, reason: 'no_user' })
          var user = userRet.results[0]
          var beforeScore = normalizeScore(user.creditScore)
          var afterScore = normalizeScore(beforeScore + Number(delta || 0))
          var actualDelta = afterScore - beforeScore
          var userData = {
            creditScore: afterScore
          }
          if ((user.status || 'active') === 'active' && afterScore < 60) {
            userData.status = 'frozen'
            userData.creditFrozen = true
            userData.frozenUntil = {
              __type: 'Date',
              iso: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
            }
          }
          updateUserWithVerify(userId, userData, function (updateErr) {
            if (updateErr) return cb(updateErr)
            db.insert(
              {
                table: 'CreditRecord',
                data: {
                  userId: userId,
                  delta: actualDelta,
                  requestedDelta: Number(delta || 0),
                  reason: payload.reason,
                  source: payload.source,
                  sourceRef: payload.sourceRef,
                  beforeScore: beforeScore,
                  afterScore: afterScore,
                  orderId: payload.orderId || '',
                  itemId: payload.itemId || ''
                }
              },
              function () { cb(null, { beforeScore: beforeScore, afterScore: afterScore, delta: actualDelta }) }
            )
          })
        })
      }
    )
  }

  function updateUserWithVerify(userId, patch, cb) {
    var tables = ['users', '_User']
    var index = 0
    var lastError = ''

    function tryNext() {
      if (index >= tables.length) {
        return cb({ code: 5002, message: lastError || '用户信用分更新失败' })
      }
      db.update({ table: tables[index++], objectId: userId, data: patch }, function (a, b) {
        var err = rt.pickError(a, b)
        if (err && !isWriteOk(a, b)) {
          lastError = errorMessage(err)
          return tryNext()
        }
        db.find({ table: '_User', where: { objectId: userId }, limit: 1 }, function (ua, ub) {
          var ret = rt.pickResult(ua, ub)
          if (!ret || !ret.results || !ret.results.length) {
            lastError = '用户更新后回读失败'
            return tryNext()
          }
          if (userMatchesPatch(ret.results[0], patch)) return cb(null)
          lastError = '用户更新后回读未生效'
          tryNext()
        })
      })
    }

    tryNext()
  }
}

function parseTime(value) {
  if (!value) return 0
  if (typeof value === 'number') return value
  if (typeof value === 'string') return new Date(value).getTime() || 0
  if (value.iso) return new Date(value.iso).getTime() || 0
  return 0
}

function dateNow() {
  return {
    __type: 'Date',
    iso: new Date().toISOString()
  }
}

function normalizeScore(value) {
  var n = Number(value)
  return isFinite(n) ? Math.min(500, Math.max(0, n)) : 100
}

function unique(list) {
  var seen = {}
  var out = []
  for (var i = 0; i < (list || []).length; i++) {
    var id = objectIdOf(list[i])
    if (id && !seen[id]) {
      seen[id] = true
      out.push(id)
    }
  }
  return out
}

function objectIdOf(value) {
  if (!value) return ''
  if (typeof value === 'string') return value
  return value.objectId || value.id || ''
}

function userMatchesPatch(row, patch) {
  if (!row) return false
  if (patch.creditScore != null && normalizeScore(row.creditScore) !== normalizeScore(patch.creditScore)) return false
  if (patch.status != null && (row.status || 'active') !== patch.status) return false
  if (patch.creditFrozen != null && !!row.creditFrozen !== !!patch.creditFrozen) return false
  return true
}

function isWriteOk(a, b) {
  var o1 = toObjectValue(a)
  var o2 = toObjectValue(b)
  return !!(
    (o1 && (o1.objectId || o1.createdAt || o1.updatedAt)) ||
    (o2 && (o2.objectId || o2.createdAt || o2.updatedAt))
  )
}

function errorMessage(err) {
  if (!err) return ''
  return err.message || err.error || err.msg || JSON.stringify(err)
}

function toObjectValue(x) {
  if (!x) return null
  if (typeof x === 'string') {
    try {
      return JSON.parse(x)
    } catch (e) {
      return null
    }
  }
  return typeof x === 'object' ? x : null
}

function bmobRuntime(modules) {
  var db = modules.oData
  function parseBody(req) {
    if (!req) return {}
    try {
      if (req.body) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body
      if (req.params) return typeof req.params === 'string' ? JSON.parse(req.params) : req.params
      return req
    } catch (e) {
      return {}
    }
  }
  function toObject(x) {
    if (!x) return null
    if (typeof x === 'string') {
      try {
        return JSON.parse(x)
      } catch (e2) {
        return null
      }
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
  return { db: db, parseBody: parseBody, pickResult: pickResult, pickError: pickError }
}
