/**
 * Bmob 云函数：submitReport（可选）
 */
function onRequest(request, response, modules) {
  var rt = bmobRuntime(modules)
  var db = rt.db
  var body = rt.parseBody(request)
  var targetType = body.targetType === '_User' ? '_User' : 'Item'
  var targetId = body.targetId || ''
  var reason = String(body.reason || '').trim()
  var submitterId = body.submitterId || ''
  var evidence = body.evidence || ''

  function endJson(obj) {
    response.end(JSON.stringify(obj))
  }

  if (!targetId || !submitterId || reason.length < 5) {
    return endJson({ code: 4001, message: '参数不完整' })
  }

  if (targetType === 'Item') {
    db.find({ table: 'Item', where: { objectId: targetId }, limit: 5 }, function (ia, ib) {
      var itemRet = rt.pickResult(ia, ib)
      if (!itemRet || !itemRet.results || !itemRet.results.length) {
        return endJson({ code: 4003, message: '商品不存在' })
      }
      var item = itemRet.results[0]
      var sid = item.sellerId || ''
      if (sid === submitterId) {
        return endJson({ code: 4004, message: '不能举报自己的发布' })
      }
      insertReport()
    })
  } else {
    insertReport()
  }

  function insertReport() {
    db.insert(
      {
        table: 'Dispute',
        data: {
          ticketType: 'REPORT',
          targetType: targetType,
          targetId: targetId,
          submitterId: submitterId,
          reason: reason,
          evidence: evidence,
          status: 'SUBMITTED'
        }
      },
      function (ca, cb) {
        var ins = rt.pickResult(ca, cb)
        if (!ins || !ins.objectId) {
          return endJson({ code: 5002, message: '创建举报失败' })
        }
        endJson({ code: 0, result: { disputeId: ins.objectId, message: '举报已提交' } })
      }
    )
  }
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
