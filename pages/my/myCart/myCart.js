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
      'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0',
    allChecked: false,
    hasSelected: false,
    totalPrice: 0
  },

  touchStartX: 0,
  activeSwipeIndex: -1,

  onBack() {
    util.goBack()
  },

  onLoad() {
    if (!auth.guardCampusAction({ tip: '完成校园认证后可使用购物车' })) {
      setTimeout(() => wx.navigateBack(), 300)
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
    let sellerId = ''
    if (typeof seller === 'object' && seller.objectId) {
      sellerId = seller.objectId
    } else if (typeof seller === 'string') {
      sellerId = seller
    } else if (row.sellerId) {
      sellerId = typeof row.sellerId === 'string' ? row.sellerId : row.sellerId.objectId || ''
    }
    return {
      objectId: row.objectId,
      offsetX: 0,
      checked: false,
      itemId: typeof item === 'object' ? item.objectId : item,
      sellerId,
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
      this.setData({ list, page: page + 1, hasMore: mapped.length >= 10 })
      this.calcBottomBar()
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
    this.setData({ [`list[${index}].offsetX`]: offsetX })
  },

  onTouchEnd(e) {
    const index = e.currentTarget.dataset.index
    const item = this.data.list[index]
    if (!item) return
    const offsetX = item.offsetX <= -DEL_WIDTH / 2 ? -DEL_WIDTH : 0
    this.setData({ [`list[${index}].offsetX`]: offsetX })
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
    wx.navigateTo({ url: `/pages/itemDetail/itemDetail?id=${id}` })
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
  },

  onCheck(e) {
    const index = e.currentTarget.dataset.index
    this.setData({ [`list[${index}].checked`]: !this.data.list[index].checked })
    this.calcBottomBar()
  },

  onSelectAll() {
    const newAllChecked = !this.data.allChecked
    const patch = {}
    this.data.list.forEach((_, i) => { patch[`list[${i}].checked`] = newAllChecked })
    this.setData(patch)
    this.calcBottomBar()
  },

  calcBottomBar() {
    const list = this.data.list
    let selectedCount = 0
    let total = 0
    list.forEach(item => {
      if (item.checked) {
        selectedCount++
        total += Number(item.price) || 0
      }
    })
    this.setData({
      allChecked: list.length > 0 && selectedCount === list.length,
      hasSelected: selectedCount > 0,
      totalPrice: total.toFixed(2)
    })
  },

  async onSettlement() {
    if (!auth.guardCampusAction({
      tip: '完成校园认证后可下单',
      creditGate: true,
      actionName: '下单'
    })) {
      return
    }
    const selected = this.data.list.filter(item => item.checked)
    if (selected.length === 0) return
    const u = auth.getUserInfo()
    if (!u || !u.objectId) {
      util.showToast('请先登录')
      return
    }
    const ok = await util.showModal('确认下单', `将为 ${selected.length} 件商品生成订单，状态“待确认”。确定吗？`)
    if (!ok) return
    util.showLoading('下单中...')
    const failedItems = []
    const skippedItems = []
    let createdList = []

    for (let item of selected) {
      try {
        // 防重检查
        const checkQuery = Bmob.Query('Order')
        checkQuery.equalTo('buyerId', '==', u.objectId)
        checkQuery.equalTo('itemId', '==', item.itemId)
        checkQuery.containedIn('status', ['PENDING_CONFIRM', 'IN_TRADING', 'SHIPPED'])
        checkQuery.limit(1)
        const existList = await checkQuery.find()
        if (existList && existList.length > 0) {
          skippedItems.push(item.title)
          continue
        }

        const order = Bmob.Query('Order')
        order.set('buyerId', u.objectId)
        order.set('itemId', item.itemId)
        order.set('sellerId', item.sellerId)   // 使用提取出的 sellerId
        order.set('status', 'PENDING_CONFIRM')
        order.set('itemTitle', item.title)
        order.set('itemImage', item.coverImage || '')
        order.set('price', item.price)
        await order.save()
        createdList.push({ objectId: item.objectId, title: item.title })
      } catch (e) {
        console.error(`下单失败：${item.title}`, e)
        failedItems.push(item.title)
      }
    }

    // 删除已购商品
    if (createdList.length > 0) {
      for (let created of createdList) {
        try {
          await Bmob.Query('Cart').destroy(created.objectId)
        } catch (e) {
          console.error(`购物车删除失败：${created.title}`, e)
        }
      }
    }

    util.hideLoading()
    let msg = ''
    if (createdList.length > 0) msg += `成功创建 ${createdList.length} 个订单。`
    if (skippedItems.length > 0) msg += `以下商品已有未完成订单，已跳过：${skippedItems.join('、')}。`
    if (failedItems.length > 0) msg += `以下商品下单失败：${failedItems.join('、')}。`
    if (msg) util.showToast(msg)
    else util.showToast('没有生成新订单')

    this.onRefresh()
    setTimeout(() => {
      wx.navigateTo({ url: '/pages/my/myOrders/myOrders?type=buy' })
    }, 500)
  }
})
