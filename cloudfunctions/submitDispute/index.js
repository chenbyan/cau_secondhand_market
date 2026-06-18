/**
 * Bmob 云函数：submitDispute（可选，与 utils/ticket.js 直写 Dispute 等价）
 * 部署名须为 submitDispute；客户端可改为 Bmob.functions('submitDispute', {...})
 */
function onRequest(request, response, modules) {
  var rt = bmobRuntime(modules)
  var db = rt.db
  var body = rt.parseBody(request)
  var orderId = body.orderId || ''
  var reason = String(body.reason || '').trim()
  var submitterId = body.submitterId || ''
  var evidence = body.evidence || ''

  function endJson(obj) {
    response.end(JSON.stringify(obj))
  }

  if (!orderId || !submitterId || reason.length < 5) {
    return endJson({ code: 4001, message: '参数不完整' })
  }

  db.find({ table: 'Order', where: { objectId: orderId }, limit: 5 }, function (oa, ob) {
    var orderRet = rt.pickResult(oa, ob)
    if (!orderRet || !orderRet.results || !orderRet.results.length) {
      return endJson({ code: 4003, message: '订单不存在' })
    }
    var order = orderRet.results[0]
    if (order.buyerId !== submitterId && order.sellerId !== submitterId) {
      return endJson({ code: 4003, message: '仅买卖双方可申诉' })
    }
    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
      return endJson({ code: 4004, message: '订单已结束' })
    }
    if (order.frozen) {
      return endJson({ code: 4004, message: '订单已有进行中申诉' })
    }

    db.find({ table: 'Dispute', where: { orderId: orderId }, limit: 20 }, function (da, db2) {
      var dispRet = rt.pickResult(da, db2)
      var open = false
      if (dispRet && dispRet.results) {
        for (var i = 0; i < dispRet.results.length; i++) {
          var st = dispRet.results[i].status
          if (st === 'SUBMITTED' || st === 'UNDER_REVIEW') {
            open = true
            break
          }
        }
      }
      if (open) {
        return endJson({ code: 4004, message: '已有待处理申诉' })
      }

      db.insert(
        {
          table: 'Dispute',
          data: {
            ticketType: 'DISPUTE',
            orderId: orderId,
            submitterId: submitterId,
            reason: reason,
            evidence: evidence,
            status: 'SUBMITTED'
          }
        },
        function (ia, ib) {
          var ins = rt.pickResult(ia, ib)
          if (!ins || !ins.objectId) {
            return endJson({ code: 5002, message: '创建工单失败' })
          }
          db.update(
            { table: 'Order', objectId: orderId, data: { frozen: true } },
            function () {
              endJson({
                code: 0,
                result: { disputeId: ins.objectId, message: '申诉已提交' }
              })
            }
          )
        }
      )
    })
  })
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
