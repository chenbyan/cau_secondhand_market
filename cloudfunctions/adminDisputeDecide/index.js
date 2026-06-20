/**
 * Bmob 云函数：adminDisputeDecide
 * 管理端裁决申诉/举报：关闭案卷、扣责任方信用、推进订单终态、解冻订单、写站内通知。
 */
function onRequest(request, response, modules) {
  var rt = bmobRuntime(modules)
  var db = rt.db
  var body = rt.parseBody(request)
  var disputeId = body.disputeId || ''
  var caseKey = body.caseKey || ''
  var liabilityParty = body.liabilityParty || 'none'
  var orderOutcome = body.orderOutcome || ''
  var decisionNote = String(body.decisionNote || '管理员裁决').slice(0, 200)
  var adminId = body.adminId || ''
  var violationType = body.violationType || ''

  function endJson(obj) {
    response.end(JSON.stringify(obj))
  }

  if (!disputeId && !caseKey) {
    return endJson({ code: 4001, message: '缺少案卷参数' })
  }

  findTickets(function (tickets) {
    if (!tickets.length) return endJson({ code: 4004, message: '案卷不存在' })
    var ticket = tickets[0]
    findOrder(ticket.orderId || '', function (order) {
      var targetUserId = resolveLiabilityUser(order, ticket, liabilityParty)
      var delta = resolveCreditDelta(body, ticket, violationType)
      applyLiabilityCredit(targetUserId, delta, ticket, order, function () {
        closeTickets(tickets, liabilityParty, orderOutcome, delta, decisionNote, function () {
          settleOrder(order, orderOutcome, function () {
            notifyParticipants(tickets, decisionNote, function () {
              endJson({
                code: 0,
                result: { message: '裁决已执行', creditDelta: targetUserId ? delta : 0 }
              })
            })
          })
        })
      })
    })
  })

  function findTickets(cb) {
    if (disputeId) {
      return db.find(
        { table: 'Dispute', where: { objectId: disputeId }, limit: 1 },
        function (a, b) {
          var ret = rt.pickResult(a, b)
          cb(ret && ret.results ? ret.results : [])
        }
      )
    }
    db.find({ table: 'Dispute', where: { caseKey: caseKey }, limit: 50 }, function (a, b) {
      var ret = rt.pickResult(a, b)
      cb(ret && ret.results ? ret.results : [])
    })
  }

  function findOrder(orderId, cb) {
    if (!orderId) return cb(null)
    db.find({ table: 'Order', where: { objectId: orderId }, limit: 1 }, function (a, b) {
      var ret = rt.pickResult(a, b)
      cb(ret && ret.results && ret.results.length ? ret.results[0] : null)
    })
  }

  function resolveLiabilityUser(order, ticket, party) {
    if (party === 'buyer') return order && order.buyerId
    if (party === 'seller') return order && order.sellerId
    if (party === 'submitter') return ticket && ticket.submitterId
    if (party === 'respondent') return ticket && ticket.respondentId
    return ''
  }

  function resolveCreditDelta(payload, ticket, type) {
    if (payload.creditDelta !== undefined && payload.creditDelta !== null && payload.creditDelta !== '') {
      var provided = Number(payload.creditDelta)
      return isFinite(provided) ? provided : -15
    }
    if ((ticket.ticketType || '') === 'REPORT') {
      return type === 'fake_info' ? -20 : -15
    }
    if (type === 'errand_breach') return -10
    if (type === 'fake_info') return -20
    return -15
  }

  function applyLiabilityCredit(userId, delta, ticket, order, cb) {
    if (!userId || liabilityParty === 'none' || !delta) return cb()
    var sourceRef = (ticket.objectId || disputeId || caseKey) + ':dispute:' + userId
    applyDelta(userId, delta, {
      source: 'dispute',
      sourceRef: sourceRef,
      reason: decisionNote || '纠纷裁决扣分',
      orderId: ticket.orderId || '',
      itemId: order ? order.itemId || '' : ticket.targetId || '',
      adminId: adminId
    }, cb)
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
          var afterScore = normalizeScore(beforeScore + Number(delta || 0))
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
                  itemId: payload.itemId || '',
                  adminId: payload.adminId || ''
                }
              },
              function () { cb() }
            )
          })
        })
      }
    )
  }

  function closeTickets(tickets, party, outcome, delta, note, cb) {
    var i = 0
    function next() {
      if (i >= tickets.length) return cb()
      var row = tickets[i++]
      db.update(
        {
          table: 'Dispute',
          objectId: row.objectId,
          data: {
            status: 'CLOSED',
            liabilityParty: party,
            orderOutcome: outcome || '',
            creditDelta: liabilityParty === 'none' ? 0 : Number(delta || 0),
            decisionNote: note
          }
        },
        next
      )
    }
    next()
  }

  function settleOrder(order, outcome, cb) {
    if (!order) return cb()
    var orderData = { frozen: false }
    if (outcome === 'COMPLETED' || outcome === 'CANCELLED') {
      orderData.status = outcome
    }
    db.update({ table: 'Order', objectId: order.objectId, data: orderData }, function () {
      updateItemByOutcome(order, outcome, function () {
        if (outcome === 'COMPLETED') {
          rewardComplete(order, cb)
        } else {
          cb()
        }
      })
    })
  }

  function updateItemByOutcome(order, outcome, cb) {
    if (!order.itemId || (outcome !== 'COMPLETED' && outcome !== 'CANCELLED')) return cb()
    var data = outcome === 'COMPLETED'
      ? { status: 'SOLD_OUT' }
      : { status: 'ON_SALE', lockBuyerId: '', lockExpireAt: null }
    db.update({ table: 'Item', objectId: order.itemId, data: data }, function () { cb() })
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
        itemId: order.itemId || '',
        adminId: adminId
      }, next)
    }
    next()
  }

  function notifyParticipants(tickets, content, cb) {
    var ids = []
    for (var i = 0; i < tickets.length; i++) {
      if (tickets[i].submitterId) ids.push(tickets[i].submitterId)
      if (tickets[i].respondentId) ids.push(tickets[i].respondentId)
    }
    ids = unique(ids)
    var n = 0
    function next() {
      if (n >= ids.length) return cb()
      db.insert(
        {
          table: 'UserNotice',
          data: {
            userId: ids[n++],
            type: 'case_closed',
            title: '案卷已结案',
            content: String(content || '处理结果已更新').slice(0, 200),
            caseKey: tickets[0].caseKey || '',
            read: false
          }
        },
        next
      )
    }
    next()
  }
}

function normalizeScore(value) {
  var n = Number(value)
  return isFinite(n) ? Math.min(100, Math.max(0, n)) : 100
}

function dateNow() {
  return {
    __type: 'Date',
    iso: new Date().toISOString()
  }
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
