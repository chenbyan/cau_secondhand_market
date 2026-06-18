const auth = require('../../../utils/auth.js')
const util = require('../../../utils/util.js')
const Bmob = require('../../../utils/bmob.js')
const publish = require('../../../utils/publish.js')
const cloudImage = require('../../../utils/cloudImage.js')
const itemStatus = require('../../../utils/itemStatus.js')
const credit = require('../../../utils/credit.js')

const TYPE_LABEL = {
  goods: '物品',
  errand: '跑腿'
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
    this.setData({ activeStatus: key, page: 0, items: [], hasMore: true })
    this.loadItems(true)
  },

  async onRefresh() {
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
      const q = Bmob.Query('Item')
      q.equalTo('sellerId', '==', u.objectId)
      const statusTab = this.data.activeStatus
      if (statusTab !== 'all') {
        q.equalTo('status', '==', statusTab)
      }
      q.order('-createdAt')
      q.limit(10)
      q.skip(page * 10)
      let list = (await q.find()).filter((r) => r.status !== 'DELETED_SOFT')
      const publishTab = this.data.activePublishTab
      if (publishTab === 'goods') {
        list = (list || []).filter(
          (r) => !r.postType || r.postType === publish.POST_TYPE.GOODS
        )
      } else {
        list = (list || []).filter((r) => r.postType === publish.POST_TYPE.ERRAND)
      }
      const items = []
      for (let i = 0; i < (list || []).length; i++) {
        const row = list[i]
        const postType = row.postType || publish.POST_TYPE.GOODS
        const isErrand = postType === publish.POST_TYPE.ERRAND
        let coverImage = row.coverImage || ''
        if (cloudImage.isCloudFileId(coverImage)) {
          coverImage = await cloudImage.resolveImageUrl(coverImage)
        }
        const status = row.status || 'ON_SALE'
        const meta = itemStatus.getStatusMeta(postType, status)
        const needsRectify = !!row.rectifyRequired && status === 'OFFLINE'
        let routeHint = ''
        if (isErrand && row.pickupAddr && row.deliveryAddr) {
          routeHint = `${row.pickupAddr} → ${row.deliveryAddr}`
        }
        items.push({
          ...row,
          coverImage,
          postType,
          typeLabel: TYPE_LABEL[postType] || '物品',
          isErrand,
          priceLabel: isErrand ? '赏金' : '价格',
          statusLabel: needsRectify ? '已取消 · 待整改' : meta.label,
          statusClass: meta.cls,
          rectifyRequired: needsRectify,
          rectifyReason: row.rectifyReason || row.offlineReason || '',
          routeHint,
          canEdit: isErrand ? status === 'ON_SALE' : status === 'ON_SALE',
          createdAtText: row.createdAt ? util.formatTime(row.createdAt) : ''
        })
      }
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

  onOpenDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/itemDetail/itemDetail?id=${id}` })
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
    const url =
      postType === publish.POST_TYPE.ERRAND
        ? `/pages/errandPublish/errandPublish?id=${item.objectId}`
        : `/pages/itemPublish/itemPublish?id=${item.objectId}`
    wx.navigateTo({ url })
  },

  async setItemStatus(id, status, extra = {}) {
    const row = await Bmob.Query('Item').get(id)
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
    const isErrand = item && item.isErrand
    try {
      util.showLoading('处理中...')
      await this.setItemStatus(id, 'ON_SALE', {
        rectifyRequired: false,
        rectifyReason: '',
        offlineReason: '',
        offlineSource: ''
      })
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
