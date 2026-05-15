const auth = require('../../../utils/auth.js')
const util = require('../../../utils/util.js')
const Bmob = require('../../../utils/bmob.js')

const STATUS_LABEL = {
  ON_SALE: '在售',
  IN_TRADING: '交易中',
  SOLD_OUT: '已售出',
  OFFLINE: '已下架',
  DELETED_SOFT: '已删除'
}

Page({
  data: {
    tabs: [
      { key: 'all', name: '全部' },
      { key: 'ON_SALE', name: '在售' },
      { key: 'IN_TRADING', name: '交易中' },
      { key: 'SOLD_OUT', name: '已售出' },
      { key: 'OFFLINE', name: '已下架' }
    ],
    activeTab: 'all',
    items: [],
    page: 0,
    loading: false,
    loadingMore: false,
    refreshing: false,
    hasMore: true,
    placeholder:
      'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'
  },

  onLoad() {
    if (!auth.checkLoginStatus()) {
      wx.redirectTo({ url: '/pages/login/login' })
      return
    }
    this.loadItems(true)
  },

  onTab(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ activeTab: key, page: 0, items: [], hasMore: true })
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
      q.equalTo('status', '!=', 'DELETED_SOFT')
      const tab = this.data.activeTab
      if (tab !== 'all') {
        q.equalTo('status', '==', tab)
      }
      q.order('-createdAt')
      q.limit(10)
      q.skip(page * 10)
      const list = await q.find()
      const items = (list || []).map((row) => ({
        ...row,
        statusLabel: STATUS_LABEL[row.status] || row.status,
        createdAtText: row.createdAt ? util.formatTime(row.createdAt) : ''
      }))
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
    // 商品详情页由其他同学实现
    wx.navigateTo({ url: `/pages/itemDetail/itemDetail?id=${id}` })
  },

  onEdit(e) {
    const item = e.currentTarget.dataset.item
    // 发布/编辑页由其他同学实现
    wx.navigateTo({ url: `/pages/itemPublish/itemPublish?id=${item.objectId}` })
  },

  async setItemStatus(id, status) {
    const row = await Bmob.Query('Item').get(id)
    row.set('status', status)
    await row.save()
  },

  async onOffline(e) {
    const id = e.currentTarget.dataset.id
    const ok = await util.showModal('确认下架', '下架后其他用户将看不到该商品。')
    if (!ok) return
    try {
      util.showLoading('处理中...')
      await this.setItemStatus(id, 'OFFLINE')
      util.hideLoading()
      util.showToast('已下架')
      this.onRefresh()
    } catch (err) {
      util.hideLoading()
      console.error(err)
      util.showToast('操作失败')
    }
  },

  async onOnline(e) {
    const id = e.currentTarget.dataset.id
    try {
      util.showLoading('处理中...')
      await this.setItemStatus(id, 'ON_SALE')
      util.hideLoading()
      util.showToast('已重新上架')
      this.onRefresh()
    } catch (err) {
      util.hideLoading()
      console.error(err)
      util.showToast('操作失败')
    }
  },

  async onDelete(e) {
    const id = e.currentTarget.dataset.id
    const ok = await util.showModal('确认删除', '删除后为软删除，可在后台恢复。')
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
    // 发布商品页由其他同学实现
    wx.navigateTo({ url: '/pages/itemPublish/itemPublish' })
  }
})
