const auth = require('../../../utils/auth.js')
const util = require('../../../utils/util.js')
const Bmob = require('../../../utils/bmob.js')
const publish = require('../../../utils/publish.js')
const cloudImage = require('../../../utils/cloudImage.js')
const itemStatus = require('../../../utils/itemStatus.js')
const credit = require('../../../utils/credit.js')
const itemRectify = require('../../../utils/itemRectify.js')

const TYPE_LABEL = {
  goods: '物品',
  errand: '跑腿',
  linked_errand: '关联跑腿'
}

function parseErrandMeta(raw) {
  if (!raw) return {}
  if (typeof raw === 'object') return raw
  try {
    return JSON.parse(raw)
  } catch (e) {
    return {}
  }
}

function getPointerId(value) {
  if (!value) return ''
  if (typeof value === 'string') return value
  return value.objectId || value.id || ''
}

/** 合并独立跑腿、历史 Item 表跑腿、商品关联跑腿 */
async function fetchMyErrandRows(userId, statusTab) {
  const rows = []
  const seen = new Set()

  const pushRow = (row, extra) => {
    if (!row || !row.objectId || seen.has(row.objectId)) return
    seen.add(row.objectId)
    rows.push(Object.assign({}, row, extra || {}))
  }

  const qErrand = Bmob.Query('Errand')
  qErrand.equalTo('sellerId', '==', userId)
  if (statusTab !== 'all') qErrand.equalTo('status', '==', statusTab)
  qErrand.order('-createdAt')
  qErrand.limit(100)
  const errandRows = (await qErrand.find()) || []
  errandRows.forEach((row) => {
    const source = row.linkedOrderId ? 'linked' : 'standalone'
    pushRow(row, { errandSource: source })
  })

  try {
    const qLegacy = Bmob.Query('Item')
    qLegacy.equalTo('sellerId', '==', userId)
    qLegacy.equalTo('postType', '==', publish.POST_TYPE.ERRAND)
    if (statusTab !== 'all') qLegacy.equalTo('status', '==', statusTab)
    qLegacy.order('-createdAt')
    qLegacy.limit(50)
    const legacyRows = (await qLegacy.find()) || []
    legacyRows.forEach((row) => pushRow(row, { errandSource: 'legacy', fromLegacyItem: true }))
  } catch (e) {
    console.warn('读取历史 Item 跑腿失败', e)
  }

  try {
    const buyQ = Bmob.Query('Order')
    buyQ.equalTo('buyerId', '==', userId)
    buyQ.limit(50)
    const sellQ = Bmob.Query('Order')
    sellQ.equalTo('sellerId', '==', userId)
    sellQ.limit(50)
    const [buyOrders, sellOrders] = await Promise.all([buyQ.find(), sellQ.find()])
    const linkedIds = []
    ;[...(buyOrders || []), ...(sellOrders || [])].forEach((order) => {
      if ((order.postType || '') === 'errand') return
      const meta = parseErrandMeta(order.errandMeta)
      if (meta.errandItemId) {
        linkedIds.push({ errandId: meta.errandItemId, linkedOrderId: order.objectId })
      }
    })
    for (let i = 0; i < linkedIds.length; i++) {
      const link = linkedIds[i]
      try {
        const row = await Bmob.Query('Errand').get(link.errandId)
        if (statusTab !== 'all' && row.status !== statusTab) continue
        const sellerId = getPointerId(row.sellerId)
        const source = sellerId === userId ? 'linked' : 'linked_trade'
        pushRow(row, { errandSource: source, linkedOrderId: link.linkedOrderId })
      } catch (e) {
        console.warn('读取关联跑腿失败', link.errandId, e)
      }
    }
  } catch (e) {
    console.warn('读取交易关联跑腿失败', e)
  }

  rows.sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0
    return tb - ta
  })
  return rows
}

Page({
  data: {
    publishTabs: [
      { key: 'goods', name: '物品发布' },
      { key: 'errand', name: '跑腿发布' }
    ],
    activePublishTab: 'goods',
    statusChips: itemStatus.GOODS_CHIPS,
    activeStatus: 'all',
    items: [],
    page: 0,
    loading: false,
    loadingMore: false,
    refreshing: false,
    hasMore: true,
    placeholder:
      'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'
  },

  onBack() {
    util.goBack()
  },

  onLoad(options) {
    if (!auth.guardCampusAction({ tip: '完成校园认证后可管理发布' })) {
      setTimeout(() => wx.navigateBack(), 300)
      return
    }
    if (options && options.tab === 'errand') {
      this.setData({
        activePublishTab: 'errand',
        statusChips: itemStatus.ERRAND_CHIPS,
        activeStatus: 'all'
      })
    }
    this.loadItems(true)
  },

  onPublishTab(e) {
    const key = e.currentTarget.dataset.key
    this._allErrandRows = null
    this.setData({
      activePublishTab: key,
      statusChips: itemStatus.getStatusChips(key),
      activeStatus: 'all',
      page: 0,
      items: [],
      hasMore: true
    })
    this.loadItems(true)
  },

  onStatusChip(e) {
    const key = e.currentTarget.dataset.key
    this._allErrandRows = null
    this.setData({ activeStatus: key, page: 0, items: [], hasMore: true })
    this.loadItems(true)
  },

  async onRefresh() {
    this._allErrandRows = null
    this.setData({ refreshing: true, page: 0, hasMore: true })
    await this.loadItems(true)
    this.setData({ refreshing: false })
  },

  onLoadMore() {
    if (!this.data.hasMore || this.data.loadingMore || this.data.loading) return
    this.loadItems(false)
  },

  async loadItems(reset) {
    const u = auth.getUserInfo()
    if (!u || !u.objectId) return
    const page = reset ? 0 : this.data.page
    if (reset) this.setData({ loading: true, page: 0 })
    else this.setData({ loadingMore: true })
    try {
      const publishTab = this.data.activePublishTab
      const statusTab = this.data.activeStatus

      if (publishTab === 'errand') {
        if (reset || !this._allErrandRows) {
          this._allErrandRows = await fetchMyErrandRows(u.objectId, statusTab)
        }
        const start = page * 10
        const slice = (this._allErrandRows || []).slice(start, start + 10)
        const items = await this.mapRowsToItems(slice, publishTab)
        const merged = reset ? items : this.data.items.concat(items)
        this.setData({
          items: merged,
          page: page + 1,
          hasMore: start + 10 < (this._allErrandRows || []).length
        })
        return
      }

      const q = Bmob.Query('Item')
      q.equalTo('sellerId', '==', u.objectId)
      if (statusTab !== 'all') {
        q.equalTo('status', '==', statusTab)
      }
      q.order('-createdAt')
      q.limit(10)
      q.skip(page * 10)
      let list = (await q.find()).filter((r) => r.status !== 'DELETED_SOFT')
      list = (list || []).filter(
        (r) => !r.postType || r.postType === publish.POST_TYPE.GOODS
      )
      const offlineIds = list
        .filter((r) => (r.status || '') === 'OFFLINE')
        .map((r) => r.objectId)
      const rectifyMap = await itemRectify.fetchPendingRectifyMap(offlineIds)
      const items = await this.mapRowsToItems(list, publishTab, rectifyMap)
      const merged = reset ? items : this.data.items.concat(items)
      this.setData({
        items: merged,
        page: page + 1,
        hasMore: items.length >= 10
      })
    } catch (e) {
      console.error(e)
      util.showToast('加载失败')
    } finally {
      this.setData({ loading: false, loadingMore: false })
    }
  },

  async mapRowsToItems(list, publishTab, rectifyMap = {}) {
    const items = []
    for (let i = 0; i < (list || []).length; i++) {
      const row = list[i]
      const postType = publishTab === 'errand'
        ? publish.POST_TYPE.ERRAND
        : (row.postType || publish.POST_TYPE.GOODS)
      const isErrand = postType === publish.POST_TYPE.ERRAND
      let coverImage = row.coverImage || ''
      if (cloudImage.isCloudFileId(coverImage)) {
        coverImage = await cloudImage.resolveImageUrl(coverImage)
      }
      const status = row.status || 'ON_SALE'
      const meta = itemStatus.getStatusMeta(postType, status)
      const goodsRectify = itemRectify.needsGoodsRectify(row, rectifyMap)
      const needsRectify = isErrand
        ? !!row.rectifyRequired && status === 'OFFLINE'
        : goodsRectify
      const rectifyInfo = !isErrand && goodsRectify ? rectifyMap[row.objectId] : null
      let routeHint = ''
      if (isErrand && row.pickupAddr && row.deliveryAddr) {
        routeHint = `${row.pickupAddr} → ${row.deliveryAddr}`
      } else if (row.linkedOrderId) {
        routeHint = '来自交易订单的关联跑腿'
      }
      let typeLabel = TYPE_LABEL[postType] || '物品'
      if (row.errandSource === 'linked' || row.errandSource === 'linked_trade') {
        typeLabel = TYPE_LABEL.linked_errand
      } else if (row.errandSource === 'legacy') {
        typeLabel = '跑腿(历史)'
      }
      items.push({
        ...row,
        coverImage,
        postType,
        typeLabel,
        isErrand,
        fromLegacyItem: !!row.fromLegacyItem,
        priceLabel: isErrand ? '赏金' : '价格',
        statusLabel: needsRectify ? '已取消 · 待整改' : meta.label,
        statusClass: meta.cls,
        rectifyRequired: needsRectify,
        rectifyReason: rectifyInfo ? rectifyInfo.reason : (row.rectifyReason || ''),
        routeHint,
        canEdit: isErrand ? status === 'ON_SALE' : status === 'ON_SALE',
        createdAtText: row.createdAt ? util.formatTime(row.createdAt) : ''
      })
    }
    return items
  },

  onOpenDetail(e) {
    const id = e.currentTarget.dataset.id
    const item = (this.data.items || []).find((row) => row.objectId === id) || {}
    const isErrand = this.data.activePublishTab === 'errand'
    let url = `/pages/itemDetail/itemDetail?id=${id}`
    if (isErrand && !item.fromLegacyItem) {
      url += '&src=errand'
    }
    wx.navigateTo({ url })
  },

  onEdit(e) {
    if (!auth.guardCampusAction({ tip: '完成校园认证后可编辑' })) {
      return
    }
    const item = e.currentTarget.dataset.item
    if (item.isErrand && item.status !== 'ON_SALE') {
      util.showToast('仅「未接单」状态可编辑')
      return
    }
    const postType = item.postType || publish.POST_TYPE.GOODS
    if (item.fromLegacyItem) {
      wx.navigateTo({ url: `/pages/itemPublish/itemPublish?id=${item.objectId}` })
      return
    }
    const url =
      postType === publish.POST_TYPE.ERRAND
        ? `/pages/errandPublish/errandPublish?id=${item.objectId}`
        : `/pages/itemPublish/itemPublish?id=${item.objectId}`
    wx.navigateTo({ url })
  },

  async setItemStatus(id, status, extra = {}) {
    const item = (this.data.items || []).find((x) => x.objectId === id) || {}
    const table = item.fromLegacyItem
      ? 'Item'
      : (this.data.activePublishTab === 'errand' ? 'Errand' : 'Item')
    const row = await Bmob.Query(table).get(id)
    row.set('status', status)
    Object.keys(extra).forEach((key) => row.set(key, extra[key]))
    await row.save()
  },

  async onOffline(e) {
    if (!auth.guardCampusAction({ tip: '完成校园认证后可操作' })) {
      return
    }
    const id = e.currentTarget.dataset.id
    const item = this.data.items.find((x) => x.objectId === id)
    const isErrand = item && item.isErrand
    const ok = await util.showModal(
      isErrand ? '取消跑腿' : '确认下架',
      isErrand
        ? '取消后任务将不再展示，可稍后重新发布。'
        : '下架后其他用户将看不到该商品。'
    )
    if (!ok) return
    try {
      util.showLoading('处理中...')
      await this.setItemStatus(id, 'OFFLINE')
      util.hideLoading()
      util.showToast(isErrand ? '已取消' : '已下架')
      this.onRefresh()
    } catch (err) {
      util.hideLoading()
      console.error(err)
      util.showToast('操作失败')
    }
  },

  async onOnline(e) {
    if (!auth.guardCampusAction({
      tip: '完成校园认证后可重新发布',
      creditGate: true,
      actionName: '重新发布'
    })) {
      return
    }
    const id = e.currentTarget.dataset.id
    const item = this.data.items.find((x) => x.objectId === id)
    if (item && item.rectifyRequired && !item.isErrand) {
      util.showToast('该商品需先编辑整改后再上架')
      return
    }
    const isErrand = item && item.isErrand
    try {
      util.showLoading('处理中...')
      const extra = isErrand
        ? { rectifyRequired: false }
        : {}
      await this.setItemStatus(id, 'ON_SALE', extra)
      util.hideLoading()
      util.showToast(isErrand ? '已重新发布' : '已重新上架')
      this.onRefresh()
    } catch (err) {
      util.hideLoading()
      console.error(err)
      util.showToast('操作失败')
    }
  },

  /** 跑腿：卖家标记任务完成（仅「已接单」状态） */
  async onCompleteErrand(e) {
    if (!auth.guardCampusAction({ tip: '完成校园认证后可操作' })) {
      return
    }
    const id = e.currentTarget.dataset.id
    const ok = await util.showModal('标记完成', '确认该跑腿任务已完成？')
    if (!ok) return
    try {
      util.showLoading('处理中...')
      await this.setItemStatus(id, 'SOLD_OUT')
      await this.completeRelatedErrandOrder(id)
      util.hideLoading()
      util.showToast('已标记完成', 'success')
      this.onRefresh()
    } catch (err) {
      util.hideLoading()
      util.showToast('操作失败')
    }
  },

  async completeRelatedErrandOrder(itemId) {
    try {
      const q = Bmob.Query('Order')
      q.equalTo('itemId', '==', itemId)
      q.equalTo('postType', '==', 'errand')
      q.order('-createdAt')
      q.limit(5)
      const list = await q.find()
      const order = (list || []).find((row) => row.status !== 'CANCELLED')
      if (!order || order.status === 'COMPLETED') return
      const row = await Bmob.Query('Order').get(order.objectId)
      row.set('status', 'COMPLETED')
      await row.save()
      await credit.rewardOrderComplete({ ...order, status: 'COMPLETED' })
    } catch (e) {
      console.warn('跑腿完成信用结算失败', e)
    }
  },

  async onDelete(e) {
    if (!auth.guardCampusAction({ tip: '完成校园认证后可操作' })) {
      return
    }
    const id = e.currentTarget.dataset.id
    const ok = await util.showModal('确认删除', '删除后为软删除。')
    if (!ok) return
    try {
      util.showLoading('处理中...')
      await this.setItemStatus(id, 'DELETED_SOFT')
      util.hideLoading()
      util.showToast('已删除')
      this.onRefresh()
    } catch (err) {
      util.hideLoading()
      console.error(err)
      util.showToast('操作失败')
    }
  },

  goPublish() {
    if (!auth.guardCampusAction({
      tip: '完成校园认证后可发布',
      creditGate: true,
      actionName: '发布'
    })) {
      return
    }
    const isErrand = this.data.activePublishTab === 'errand'
    if (isErrand) {
      wx.navigateTo({ url: '/pages/errandPublish/errandPublish' })
      return
    }
    wx.showActionSheet({
      itemList: ['发布物品', '发布跑腿'],
      success: (res) => {
        if (res.tapIndex === 0) {
          wx.navigateTo({ url: '/pages/itemPublish/itemPublish' })
        } else if (res.tapIndex === 1) {
          wx.navigateTo({ url: '/pages/errandPublish/errandPublish' })
        }
      }
    })
  }
})
