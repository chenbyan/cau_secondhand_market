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
  var stats = { timeoutCancelled: 0, autoCompleted: 0 }

  findOrders('IN_TRADING', function (trading) {
    processList(trading, handleTrading, function () {
      findOrders('SHIPPED', function (shipped) {
        processList(shipped, handleShipped, function () {
          response.end(JSON.stringify({ code: 0, result: stats }))
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
        data: { status: 'ON_SALE', lockBuyerId: '', lockExpireAt: null }
      },
      cb
    )
  }

  function markItemSold(itemId, cb) {
    if (!itemId) return cb()
    db.update({ table: 'Item', objectId: itemId, data: { status: 'SOLD_OUT' } }, cb)
  }

  function penalizeSellerTimeout(order, cb) {
    if (order.timeoutCreditSet || !order.sellerId) return cb()
    var delta = Number(body.timeoutPenalty || -5)
    applyDelta(order.sellerId, delta, {
      source: 'order_timeout',
      sourceRef: order.objectId + ':seller_timeout',
      reason: '超时未响应：' + (order.itemTitle || '订单'),
      orderId: order.objectId,
      itemId: order.itemId || ''
    }, function () {
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
    if (order.creditSettled) return cb()
    var bonus = Number(body.completeBonus || 2)
    var ids = unique([order.buyerId, order.sellerId])
    var i = 0
    function next() {
      if (i >= ids.length) {
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
      }, next)
    }
    next()
  }

  function applyDelta(userId, delta, payload, cb) {
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
        if (existed && existed.results && existed.results.length) return cb()
        db.find({ table: '_User', where: { objectId: userId }, limit: 1 }, function (ua, ub) {
          var userRet = rt.pickResult(ua, ub)
          if (!userRet || !userRet.results || !userRet.results.length) return cb()
          var user = userRet.results[0]
          var beforeScore = normalizeScore(user.creditScore)
          var afterScore = Math.max(0, beforeScore + Number(delta || 0))
          var actualDelta = afterScore - beforeScore
          var userData = { creditScore: afterScore }
          if ((user.status || 'active') === 'active' && afterScore < 40) {
            userData.status = 'frozen'
            userData.creditFrozen = true
          }
          db.update({ table: '_User', objectId: userId, data: userData }, function () {
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
              function () { cb() }
            )
          })
        })
      }
    )
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
  return isFinite(n) ? Math.max(0, n) : 100
}

function unique(list) {
  var seen = {}
  var out = []
  for (var i = 0; i < (list || []).length; i++) {
    var id = list[i]
    if (id && !seen[id]) {
      seen[id] = true
      out.push(id)
    }
  }
  return out
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
  return { db: db, parseBody: parseBody, pickResult: pickResult }
}
