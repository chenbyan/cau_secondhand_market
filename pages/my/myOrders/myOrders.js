const auth = require('../../../utils/auth.js')
const util = require('../../../utils/util.js')
const Bmob = require('../../../utils/bmob.js')

const STATUS_MAP = {
  PENDING_CONFIRM: '待确认',
  IN_TRADING: '交易中',
  COMPLETED: '已完成',
  CANCELLED: '已取消'
}

Page({
  data: {
    type: 'buy',
    tabs: [
      { key: 'all', name: '全部' },
      { key: 'PENDING_CONFIRM', name: '待确认' },
      { key: 'IN_TRADING', name: '交易中' },
      { key: 'COMPLETED', name: '已完成' },
      { key: 'CANCELLED', name: '已取消' }
    ],
    activeTab: 'all',
    orders: [],
    page: 0,
    loading: false,
    loadingMore: false,
    refreshing: false,
    hasMore: true,
    placeholder:
      'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'
  },

  onLoad(options) {
    if (!auth.checkLoginStatus()) {
      wx.redirectTo({ url: '/pages/login/login' })
      return
    }
    const type = options.type === 'sell' ? 'sell' : 'buy'
    wx.setNavigationBarTitle({
      title: type === 'sell' ? '我卖出的' : '我买到的'
    })
    this.setData({ type })
    this.loadOrders(true)
  },

  onTab(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ activeTab: key, page: 0, orders: [], hasMore: true })
    this.loadOrders(true)
  },

  async onRefresh() {
    this.setData({ refreshing: true, page: 0, hasMore: true })
    await this.loadOrders(true)
    this.setData({ refreshing: false })
  },

  onLoadMore() {
    if (!this.data.hasMore || this.data.loadingMore || this.data.loading) return
    this.loadOrders(false)
  },

  async loadOrders(reset) {
    const u = auth.getUserInfo()
    if (!u || !u.objectId) return
    const page = reset ? 0 : this.data.page
    if (reset) this.setData({ loading: true })
    else this.setData({ loadingMore: true })
    try {
      const q = Bmob.Query('Order')
      const field = this.data.type === 'buy' ? 'buyerId' : 'sellerId'
      q.equalTo(field, '==', u.objectId)
      const tab = this.data.activeTab
      if (tab !== 'all') {
        q.equalTo('status', '==', tab)
      }
      q.order('-createdAt')
      q.limit(10)
      q.skip(page * 10)
      const list = await q.find()
      const orders = (list || []).map((row) => ({
        ...row,
        statusLabel: STATUS_MAP[row.status] || row.status || '未知',
        createdAtText: row.createdAt ? util.formatTime(row.createdAt) : ''
      }))
      const merged = reset ? orders : this.data.orders.concat(orders)
      this.setData({
        orders: merged,
        page: page + 1,
        hasMore: orders.length >= 10
      })
    } catch (e) {
      console.error(e)
      util.showToast('加载订单失败')
    } finally {
      this.setData({ loading: false, loadingMore: false })
    }
  },

  onOpenDetail(e) {
    const id = e.currentTarget.dataset.id
    // 订单详情页由其他同学实现
    wx.navigateTo({
      url: `/pages/orderDetail/orderDetail?id=${id}`
    })
  }
})
