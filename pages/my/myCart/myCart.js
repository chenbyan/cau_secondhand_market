const auth = require('../../../utils/auth.js')
const util = require('../../../utils/util.js')
const Bmob = require('../../../utils/bmob.js')

const DEL_WIDTH = 80

Page({
  data: {
    list: [],
    page: 0,
    loading: false,
    loadingMore: false,
    refreshing: false,
    hasMore: true,
    placeholder:
      'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'
  },

  touchStartX: 0,
  activeSwipeIndex: -1,

  onLoad() {
    if (!auth.checkLoginStatus()) {
      wx.redirectTo({ url: '/pages/login/login' })
      return
    }
    this.loadList(true)
  },

  async onRefresh() {
    this.setData({ refreshing: true, page: 0, hasMore: true })
    await this.loadList(true)
    this.setData({ refreshing: false })
  },

  onLoadMore() {
    if (!this.data.hasMore || this.data.loadingMore || this.data.loading) return
    this.loadList(false)
  },

  mapCartRow(row) {
    const item = row.itemId || {}
    const seller = item.sellerId || {}
    const sellerName =
      (typeof seller === 'object' && seller.nickName) ||
      item.sellerName ||
      '—'
    return {
      objectId: row.objectId,
      offsetX: row.offsetX || 0,
      itemId: typeof item === 'object' ? item.objectId : item,
      title: item.title || '商品',
      price: item.price,
      coverImage: item.coverImage || item.image,
      sellerName
    }
  },

  async loadList(reset) {
    const u = auth.getUserInfo()
    if (!u || !u.objectId) return
    const page = reset ? 0 : this.data.page
    if (reset) this.setData({ loading: true })
    else this.setData({ loadingMore: true })
    try {
      const q = Bmob.Query('Cart')
      q.equalTo('userId', '==', Bmob.Pointer('_User').set(u.objectId))
      q.include('itemId')
      q.order('-createdAt')
      q.limit(10)
      q.skip(page * 10)
      const raw = await q.find()
      const mapped = (raw || []).map((r) => this.mapCartRow(r))
      const list = reset ? mapped : this.data.list.concat(mapped)
      this.setData({
        list,
        page: page + 1,
        hasMore: mapped.length >= 10
      })
    } catch (e) {
      console.error(e)
      util.showToast('加载失败')
    } finally {
      this.setData({ loading: false, loadingMore: false })
    }
  },

  onTouchStart(e) {
    this.touchStartX = e.touches[0].clientX
    const index = e.currentTarget.dataset.index
    this.closeOtherSwipes(index)
  },

  onTouchMove(e) {
    const index = e.currentTarget.dataset.index
    const dx = e.touches[0].clientX - this.touchStartX
    let offsetX = dx
    if (offsetX > 0) offsetX = 0
    if (offsetX < -DEL_WIDTH) offsetX = -DEL_WIDTH
    const key = `list[${index}].offsetX`
    this.setData({ [key]: offsetX })
  },

  onTouchEnd(e) {
    const index = e.currentTarget.dataset.index
    const item = this.data.list[index]
    if (!item) return
    const offsetX = item.offsetX <= -DEL_WIDTH / 2 ? -DEL_WIDTH : 0
    const key = `list[${index}].offsetX`
    this.setData({ [key]: offsetX })
  },

  closeOtherSwipes(active) {
    const patch = {}
    this.data.list.forEach((row, i) => {
      if (i !== active && row.offsetX) {
        patch[`list[${i}].offsetX`] = 0
      }
    })
    if (Object.keys(patch).length) this.setData(patch)
  },

  onOpenItem(e) {
    const index = e.currentTarget.dataset.index
    const id = e.currentTarget.dataset.itemId
    const row = this.data.list[index]
    if (!row || !id) return
    if ((row.offsetX || 0) < -10) return
    // 商品详情页由其他同学实现
    wx.navigateTo({
      url: `/pages/itemDetail/itemDetail?id=${id}`
    })
  },

  async onRemove(e) {
    const id = e.currentTarget.dataset.id
    const ok = await util.showModal('取消收藏', '从购物车中移除该商品？')
    if (!ok) return
    try {
      util.showLoading('处理中...')
      await Bmob.Query('Cart').destroy(id)
      util.hideLoading()
      util.showToast('已移除')
      this.onRefresh()
    } catch (err) {
      util.hideLoading()
      console.error(err)
      util.showToast('操作失败')
    }
  },

  goIndex() {
    wx.switchTab({ url: '/pages/index/index' })
  }
})
