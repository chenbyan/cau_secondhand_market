const auth = require('../../../utils/auth.js')
const util = require('../../../utils/util.js')
const Bmob = require('../../../utils/bmob.js')
const cloudImage = require('../../../utils/cloudImage.js')

const STATUS_MAP = {
  PENDING_CONFIRM: '待卖家确认',
  IN_TRADING: '待买家付款',
  SHIPPED: '待卖家收款',
  COMPLETED: '已完成',
  CANCELLED: '已取消'
}

const ERRAND_STATUS_MAP = {
  PENDING_CONFIRM: '待接单确认',
  IN_TRADING: '跑腿进行中',
  COMPLETED: '已完成',
  CANCELLED: '已取消'
}

Page({
  data: {
    type: 'buy',
    tabs: [
      { key: 'all', name: '全部' },
      { key: 'PENDING_CONFIRM', name: '待确认' },
      { key: 'IN_TRADING', name: '待付款' },
      { key: 'SHIPPED', name: '待收款' },
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

  onBack() {
    util.goBack()
  },

  onLoad(options) {
    if (!auth.checkLoginStatus()) {
      wx.redirectTo({ url: '/pages/login/login' })
      return
    }
    let type = 'buy'
    if (options.type === 'sell') type = 'sell'
    else if (options.type === 'errand') type = 'errand'
    const titleMap = { buy: '我买到的', sell: '我卖出的', errand: '跑腿接单' }
    wx.setNavigationBarTitle({ title: titleMap[type] })
    // 跑腿接单只展示进行中相关状态
    const tabs = type === 'errand'
      ? [
          { key: 'all', name: '全部' },
          { key: 'PENDING_CONFIRM', name: '待确认' },
          { key: 'IN_TRADING', name: '进行中' },
          { key: 'COMPLETED', name: '已完成' },
          { key: 'CANCELLED', name: '已取消' }
        ]
      : this.data.tabs
    this.setData({ type, tabs })
    this.loadOrders(true)
  },

  onShow() {
    this.setData({ page: 0, orders: [], hasMore: true })
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
      const { type } = this.data
      if (type === 'errand') {
        // 跑腿接单：我是骑手（sellerId）且 postType = errand
        q.equalTo('sellerId', '==', u.objectId)
        q.equalTo('postType', '==', 'errand')
      } else {
        const field = type === 'buy' ? 'buyerId' : 'sellerId'
        q.equalTo(field, '==', u.objectId)
        // 不用 notEqualTo（Bmob SDK 兼容性差），改用客户端过滤
      }
      const tab = this.data.activeTab
      if (tab !== 'all') {
        q.equalTo('status', '==', tab)
      }
      q.order('-createdAt')
      q.limit(10)
      q.skip(page * 10)
      let list = await q.find()
      // 客户端过滤：买到的/卖出的 排除跑腿订单；跑腿接单 只保留 errand
      if (type === 'buy') {
        list = (list || []).filter(row => row.postType !== 'errand')
      } else if (type === 'sell') {
        list = (list || []).filter(row => row.postType !== 'errand')
      }
      const isErrandType = type === 'errand'
      const itemCache = {}
      const orders = []
      for (let i = 0; i < (list || []).length; i++) {
        const row = list[i]
        const itemImage = await cloudImage.resolveOrderItemImage(row, itemCache)
        const sMap = (isErrandType || row.postType === 'errand') ? ERRAND_STATUS_MAP : STATUS_MAP
        orders.push({
          ...row,
          itemImage,
          statusLabel: sMap[row.status] || row.status || '未知',
          createdAtText: row.createdAt ? util.formatTime(row.createdAt) : '',
          isErrand: row.postType === 'errand'
        })
      }
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
    wx.navigateTo({
      url: `/pages/orderDetail/orderDetail?id=${id}`
    })
  }
})
