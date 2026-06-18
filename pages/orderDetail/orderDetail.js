const Bmob = require('../../utils/bmob.js')
const util = require('../../utils/util.js')
const auth = require('../../utils/auth.js')
const credit = require('../../utils/credit.js')
const review = require('../../utils/review.js')
const publish = require('../../utils/publish.js')
const chat = require('../../utils/chat.js')

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
    order: null,
    statusLabel: '',
    statusClass: '',
    createdAtText: '',
    buyerName: '',
    sellerName: '',
    // 普通商品按钮
    showPay: false,
    showReceive: false,
    showCancel: false,
    showShip: false,
    showReceiveMoney: false,
    showConfirmOrder: false,  // 卖家确认订单（PENDING_CONFIRM）
    // 关联跑腿子订单
    showRequestErrand: false,
    showCancelErrand: false,
    linkedErrand: null,  // { itemId, orderId, status, statusLabel }
    // 跑腿专用按钮
    showAcceptErrand: false,
    showCancelAccept: false,
    showGroupChat: false,
    showSetPickupCode: false,
    showSetDeliveryCode: false,
    showVerifyPickupCode: false,
    showVerifyDeliveryCode: false,
    pickupCode: '',
    deliveryCode: '',
    pickupCodeVerified: false,
    deliveryCodeVerified: false,
    codeModal: { visible: false, type: '', inputValue: '', title: '', placeholder: '' },
    showReviewButton: false,
    reviewTip: '',
    reviews: [],
    // 提示
    showRemind: false,
    showDispute: false,
    // 倒计时（买卖双方共享）
    countdown: '',
    payExpireAt: 0,
    placeholder: 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'
  },

  onBack() {
    util.goBack()
  },

  onImageError() {
    const order = this.data.order
    if (order && order.itemImage) {
      this.setData({ 'order.itemImage': this.data.placeholder })
    }
  },

  onLoad(options) {
    const id = options.id
    if (!id) {
      util.showToast('参数错误')
      setTimeout(() => wx.navigateBack(), 800)
      return
    }
    this.orderId = id
    this.loadOrderDetail(id)
    // 每秒更新倒计时
    this.timer = setInterval(() => {
      if (this.data.payExpireAt) {
        this.updateCountdown()
      }
    }, 1000)
  },

  onUnload() {
    if (this.timer) clearInterval(this.timer)
  },

  onShow() {
    if (this.orderId && this.loadedOnce) {
      this.loadOrderDetail(this.orderId)
    }
  },

  async loadOrderDetail(id) {
    try {
      util.showLoading('加载中...')
      const row = await Bmob.Query('Order').get(id)
      if (!row) {
        util.hideLoading()
        util.showToast('订单不存在')
        setTimeout(() => wx.navigateBack(), 800)
        return
      }

      let postType = row.postType || 'goods'
      if (!row.postType && row.itemId) {
        try {
          const item = await Bmob.Query('Item').get(row.itemId)
          postType = item.postType || 'goods'
        } catch (e) {}
      }

      util.hideLoading()
      const status = row.status
      const u = auth.getUserInfo()
      const currentUserId = u ? u.objectId : null

      const normId = (v) => (v && typeof v === 'object' ? v.objectId : v) || ''
      const rowBuyerId = normId(row.buyerId)
      const rowSellerId = normId(row.sellerId)

      const isBuyer = !!currentUserId && currentUserId === rowBuyerId
      const isSeller = !!currentUserId && currentUserId === rowSellerId

      const buyerName = isBuyer ? '我' : (rowBuyerId || '未知')
      const sellerName = isSeller ? '我' : (rowSellerId || '未知')

      let showPay = false, showReceive = false, showCancel = false
      let showShip = false, showReceiveMoney = false, showRemind = false, showConfirmOrder = false
      let showAcceptErrand = false, showCancelAccept = false, showGroupChat = false
      let showSetPickupCode = false, showSetDeliveryCode = false
      let showVerifyPickupCode = false, showVerifyDeliveryCode = false

      const frozen = !!row.frozen
      const meta = this._parseMeta(row.errandMeta)
      const pickupCode = meta.pickupCode || ''
      const deliveryCode = meta.deliveryCode || ''
      const pickupCodeVerified = !!meta.pickupCodeVerified
      const deliveryCodeVerified = !!meta.deliveryCodeVerified
      const errandItemId = meta.errandItemId || ''
      const errandPayer = meta.errandPayer || ''
      const errandPayerLabel = errandPayer === 'buyer' ? '买家付跑腿费' : errandPayer === 'seller' ? '卖家付跑腿费' : ''

      if (postType === 'errand') {
        if (isSeller && !frozen) {
          // isSeller = 骑手（runner）
          if (status === 'PENDING_CONFIRM') {
            showAcceptErrand = true
            showCancelAccept = true
            showGroupChat = true
          } else if (status === 'IN_TRADING') {
            showGroupChat = true
            if (pickupCode && !pickupCodeVerified) {
              showVerifyPickupCode = true
            }
            if (pickupCodeVerified && deliveryCode && !deliveryCodeVerified) {
              showVerifyDeliveryCode = true
            }
          }
        } else if (isBuyer && !frozen) {
          // isBuyer = 发布者（publisher），仅展示码值，不需要操作按钮
          if (status === 'IN_TRADING') {
            showSetPickupCode = true   // 复用字段：控制是否显示码给发布者
            showSetDeliveryCode = true
          }
        }
      } else if (!frozen) {
        if (isBuyer) {
          if (status === 'PENDING_CONFIRM') {
            showRemind = true   // 等待卖家确认
            showCancel = true
          } else if (status === 'IN_TRADING') {
            showPay = true      // 卖家已确认，买家确认付款
          } else if (status === 'SHIPPED') {
            showRemind = true   // 等待卖家确认收款
          }
        } else if (isSeller) {
          if (status === 'PENDING_CONFIRM') {
            showConfirmOrder = true  // 确认订单
          } else if (status === 'IN_TRADING') {
            showRemind = true   // 等待买家付款
          } else if (status === 'SHIPPED') {
            showReceiveMoney = true  // 确认收款
          }
        }
      }

      // ---------- 关联跑腿子订单 ----------
      let showRequestErrand = false
      let showCancelErrand = false
      let linkedErrand = null
      if (postType !== 'errand' && (isBuyer || isSeller) && !frozen) {
        if (status === 'PENDING_CONFIRM' || status === 'IN_TRADING' || status === 'SHIPPED') {
          if (errandItemId) {
            try {
              const errandItem = await Bmob.Query('Item').get(errandItemId)
              const errandStatus = errandItem.status
              const errandStatusLabels = {
                ON_SALE: '等待骑手接单',
                IN_TRADING: '骑手配送中',
                SOLD_OUT: '配送完成',
                OFFLINE: '已取消'
              }
              linkedErrand = {
                itemId: errandItemId,
                status: errandStatus,
                statusLabel: errandStatusLabels[errandStatus] || errandStatus,
                payerLabel: errandPayerLabel
              }
              // 仅当跑腿未完成/未取消时可取消
              if (errandStatus === 'ON_SALE' || errandStatus === 'IN_TRADING') {
                showCancelErrand = true
              }
            } catch (e) {
              console.warn('关联跑腿查询失败', e)
            }
          } else {
            // 无关联跑腿，可申请
            showRequestErrand = true
          }
        }
      }

      // ---------- 计算倒计时（优先订单字段，兜底查 Item） ----------
      let payExpireAt = 0
      let countdown = ''
      let rawExpire = row.payExpireAt

      // 若订单没有 payExpireAt，尝试从关联 Item 的 lockExpireAt 获取
      if (!rawExpire && row.itemId) {
        try {
          const item = await Bmob.Query('Item').get(row.itemId)
          rawExpire = item.lockExpireAt
        } catch (e) {
          // ignore
        }
      }

      if (rawExpire) {
        const expireTime = new Date(
          rawExpire.iso || rawExpire
        ).getTime()
        if (!isNaN(expireTime)) {
          payExpireAt = expireTime
          const remain = Math.max(0, expireTime - Date.now())
          countdown = this.formatCountdown(remain)
          // PENDING_CONFIRM 超时 → 自动确认；IN_TRADING 超时 → 自动取消
          if (remain <= 0 && status === 'PENDING_CONFIRM' && postType !== 'errand') {
            this.autoConfirmOrder(id)
          } else if (remain <= 0 && status === 'IN_TRADING' && postType !== 'errand') {
            this.autoCancelOrder(id)
          }
        }
      }

      const terminal = status === 'COMPLETED' || status === 'CANCELLED'
      const showDispute =
        !!currentUserId &&
        (isBuyer || isSeller) &&
        !terminal &&
        !row.frozen

      let showReviewButton = false
      let reviewTip = ''
      let reviews = []
      if (status === 'COMPLETED' && currentUserId && (isBuyer || isSeller)) {
        try {
          const state = await review.getReviewState(row, currentUserId)
          showReviewButton = !!state.canReview
          reviews = state.reviews || []
          reviewTip = state.reviewed ? '您已评价该订单' : ''
        } catch (e) {
          console.warn('读取评价状态失败', e)
        }
      }

      const statusMap = postType === 'errand' ? ERRAND_STATUS_MAP : STATUS_MAP
      this.setData({
        order: row,
        statusLabel: statusMap[status] || status,
        statusClass: status,
        createdAtText: row.createdAt ? util.formatTime(row.createdAt) : '',
        buyerName, sellerName,
        showPay, showReceive, showCancel,
        showShip, showReceiveMoney, showRemind, showConfirmOrder,
        showAcceptErrand, showCancelAccept, showGroupChat,
        showSetPickupCode, showSetDeliveryCode,
        showVerifyPickupCode, showVerifyDeliveryCode,
        pickupCode, deliveryCode, pickupCodeVerified, deliveryCodeVerified,
        showRequestErrand, showCancelErrand, linkedErrand,
        showReviewButton,
        reviewTip,
        reviews,
        showDispute,
        payExpireAt,
        countdown
      })
      this.loadedOnce = true
    } catch (e) {
      util.hideLoading()
      console.error(e)
      util.showToast('加载订单失败')
    }
  },

  updateCountdown() {
    if (!this.data.payExpireAt) return
    const remain = Math.max(0, this.data.payExpireAt - Date.now())
    this.setData({ countdown: this.formatCountdown(remain) })
    const orderStatus = this.data.order && this.data.order.status
    const orderPostType = this.data.order && this.data.order.postType
    if (remain <= 0 && orderPostType !== 'errand') {
      if (orderStatus === 'PENDING_CONFIRM') {
        this.autoConfirmOrder(this.data.order.objectId)
      } else if (orderStatus === 'IN_TRADING') {
        this.autoCancelOrder(this.data.order.objectId)
      }
    }
  },

  formatCountdown(ms) {
    if (ms <= 0) return '已超时'
    const totalSeconds = Math.floor(ms / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  },

  async autoConfirmOrder(orderId) {
    try {
      const orderRow = await Bmob.Query('Order').get(orderId)
      if (orderRow.status !== 'PENDING_CONFIRM') return
      if (orderRow.frozen) return
      orderRow.set('status', 'IN_TRADING')
      await orderRow.save()
      util.showToast('卖家未在24小时内确认，订单已自动确认')
      this.loadOrderDetail(orderId)
    } catch (e) {
      console.error('自动确认订单失败', e)
    }
  },

  async autoCancelOrder(orderId) {
    try {
      const orderRow = await Bmob.Query('Order').get(orderId)
      if (orderRow.status !== 'IN_TRADING') return
      if (orderRow.frozen) return
      orderRow.set('status', 'CANCELLED')
      await orderRow.save()

      const itemId = orderRow.itemId
      if (itemId) {
        const itemRow = await Bmob.Query('Item').get(itemId)
        itemRow.set('lockBuyerId', '')
        itemRow.unset('lockExpireAt')
        itemRow.set('status', 'ON_SALE')
        await itemRow.save()
      }

      try {
        await credit.penalizeSellerTimeout({ ...orderRow, status: 'CANCELLED' })
      } catch (creditErr) {
        console.warn('卖家超时信用扣分失败', creditErr)
      }

      util.showToast('订单已超时取消，商品重新上架')
      this.loadOrderDetail(orderId)
    } catch (e) {
      console.error('自动取消订单失败', e)
    }
  },

  // ------------------- 普通商品操作 -------------------
  async onPay() {
    if (!auth.guardCampusAction({
      tip: '完成校园认证后可确认付款',
      creditGate: true,
      actionName: '确认付款'
    })) return
    const ok = await util.showModal('确认付款', '确认已向卖家付款了吗？确认后等待卖家确认收款。')
    if (!ok) return
    try {
      util.showLoading('处理中...')
      const orderId = this.data.order.objectId
      const itemId = this.data.order.itemId
      const u = auth.getUserInfo()

      // 买家确认付款：IN_TRADING → SHIPPED（等待卖家确认收款）
      const orderRow = await Bmob.Query('Order').get(orderId)
      orderRow.set('status', 'SHIPPED')
      await orderRow.save()

      // 从购物车移除
      if (u && u.objectId && itemId) {
        const cartQuery = Bmob.Query('Cart')
        cartQuery.equalTo('userId', '==', Bmob.Pointer('_User').set(u.objectId))
        cartQuery.equalTo('itemId', '==', itemId)
        const cartList = await cartQuery.find()
        for (const cartItem of (cartList || [])) {
          await Bmob.Query('Cart').destroy(cartItem.objectId)
        }
      }

      util.hideLoading()
      util.showToast('已确认付款，等待卖家确认收款', 'success')
      this.loadOrderDetail(orderId)
    } catch (e) {
      util.hideLoading()
      console.error(e)
      util.showToast('操作失败')
    }
  },

  async onShip() {
    const ok = await util.showModal('确认出货', '确认已经将商品交给买家了吗？')
    if (!ok) return
    await this.updateOrderStatus(this.data.order.objectId, 'SHIPPED')
    util.showToast('已确认出货', 'success')
    this.loadOrderDetail(this.data.order.objectId)
  },

  async onConfirmReceive() {
    const ok = await util.showModal('确认收货', '确认已经收到商品了吗？')
    if (!ok) return
    await this.updateOrderStatus(this.data.order.objectId, 'COMPLETED')
    util.showToast('已确认收货', 'success')
    this.loadOrderDetail(this.data.order.objectId)
  },

  async onConfirmOrder() {
    const ok = await util.showModal('确认订单', '确认接受该买家的购买请求？确认后请尽快与买家完成交付并确认收款（1小时内）。')
    if (!ok) return
    try {
      util.showLoading('处理中...')
      const orderId = this.data.order.objectId
      const itemId = this.data.order.itemId
      const expireAt = new Date(Date.now() + 60 * 60 * 1000)

      const orderRow = await Bmob.Query('Order').get(orderId)
      orderRow.set('status', 'IN_TRADING')
      orderRow.set('payExpireAt', { __type: 'Date', iso: expireAt.toISOString() })
      await orderRow.save()

      if (itemId) {
        const itemRow = await Bmob.Query('Item').get(itemId)
        itemRow.set('status', 'IN_TRADING')
        itemRow.set('lockExpireAt', { __type: 'Date', iso: expireAt.toISOString() })
        await itemRow.save()
      }

      util.hideLoading()
      util.showToast('已确认订单，等待买家确认付款', 'success')
      this.loadOrderDetail(orderId)
    } catch (e) {
      util.hideLoading()
      console.error(e)
      util.showToast('操作失败')
    }
  },

  async onReceiveMoney() {
    const ok = await util.showModal('确认收款', '确认已经收到买家的款项了吗？')
    if (!ok) return
    try {
      util.showLoading('处理中...')
      const orderId = this.data.order.objectId
      const itemId = this.data.order.itemId

      const orderRow = await Bmob.Query('Order').get(orderId)
      orderRow.set('status', 'COMPLETED')
      await orderRow.save()

      if (itemId) {
        const itemRow = await Bmob.Query('Item').get(itemId)
        itemRow.set('lockBuyerId', '')
        itemRow.unset('lockExpireAt')
        itemRow.set('status', 'SOLD_OUT')
        await itemRow.save()
      }

      try {
        await credit.rewardOrderComplete({ ...orderRow, status: 'COMPLETED' })
      } catch (creditErr) {
        console.warn('订单完成信用奖励失败', creditErr)
      }

      util.hideLoading()
      util.showToast('已确认收款', 'success')
      this.loadOrderDetail(orderId)
    } catch (e) {
      util.hideLoading()
      console.error(e)
      util.showToast('操作失败')
    }
  },

  async onCancelOrder() {
    const ok = await util.showModal('取消订单', '确认取消该订单吗？')
    if (!ok) return
    try {
      util.showLoading('处理中...')
      const order = this.data.order
      const orderRow = await Bmob.Query('Order').get(order.objectId)
      orderRow.set('status', 'CANCELLED')
      await orderRow.save()
      // 释放商品锁定，重新上架
      if (order.itemId) {
        const itemRow = await Bmob.Query('Item').get(order.itemId)
        itemRow.set('lockBuyerId', '')
        itemRow.set('status', 'ON_SALE')
        await itemRow.save()
      }
      util.hideLoading()
      util.showToast('订单已取消')
      this.loadOrderDetail(order.objectId)
    } catch (e) {
      util.hideLoading()
      util.showToast('操作失败')
    }
  },

  // ------------------- 跑腿任务专用操作 -------------------
  async onAcceptErrand() {
    if (!auth.guardCampusAction({
      tip: '完成校园认证后可确认接单',
      creditGate: true,
      actionName: '确认接单'
    })) return
    const ok = await util.showModal('确认接单', '接单后订单将锁定，系统将生成取件码和收件码，发布者可查看并告知卖家/买家。跑腿费用请通过群聊协商。')
    if (!ok) return
    try {
      util.showLoading('处理中...')
      const orderId = this.data.order.objectId
      const orderRow = await Bmob.Query('Order').get(orderId)
      if (orderRow.frozen) throw new Error('订单申诉处理中，暂不可变更状态')
      orderRow.set('status', 'IN_TRADING')
      orderRow.set('errandMeta', JSON.stringify({
        pickupCode: this._genCode(),
        deliveryCode: this._genCode(),
        pickupCodeVerified: false,
        deliveryCodeVerified: false
      }))
      await orderRow.save()
      util.hideLoading()
      util.showToast('已确认接单，订单已锁定', 'success')
      this.loadOrderDetail(orderId)
    } catch (e) {
      util.hideLoading()
      util.showToast(e.message || '操作失败')
    }
  },

  _genCode() {
    return String(Math.floor(100000 + Math.random() * 900000))
  },

  _parseMeta(raw) {
    if (!raw) return {}
    if (typeof raw === 'object') return raw
    try { return JSON.parse(raw) } catch (e) { return {} }
  },

  async _updateMeta(orderId, patch) {
    const row = await Bmob.Query('Order').get(orderId)
    const current = this._parseMeta(row.errandMeta)
    row.set('errandMeta', JSON.stringify({ ...current, ...patch }))
    await row.save()
  },

  onGroupChat() {
    const itemId = this.data.order && this.data.order.itemId
    if (!itemId) {
      util.showToast('无法找到关联任务')
      return
    }
    chat.openChatForItem(itemId, { tip: '完成校园认证后可进入群聊' })
  },

  async onCancelAccept() {
    const ok = await util.showModal('取消接单', '确认取消该跑腿任务的接单吗？取消后任务将重新开放接单。')
    if (!ok) return
    try {
      util.showLoading('处理中...')
      const order = this.data.order
      const orderId = order.objectId
      const itemId = order.itemId

      // 取消订单
      const orderRow = await Bmob.Query('Order').get(orderId)
      orderRow.set('status', 'CANCELLED')
      await orderRow.save()

      // 恢复 Item 状态：移除骑手绑定，重新上架
      if (itemId) {
        const itemRow = await Bmob.Query('Item').get(itemId)
        itemRow.set('status', 'ON_SALE')
        itemRow.set('runnerId', '')
        await itemRow.save()
      }

      util.hideLoading()
      util.showToast('已取消接单，任务重新开放')
      setTimeout(() => wx.navigateBack(), 800)
    } catch (e) {
      util.hideLoading()
      console.error(e)
      util.showToast('操作失败')
    }
  },

  onOpenCodeModal(e) {
    const type = e.currentTarget.dataset.type
    const map = {
      verifyPickup:  { title: '输入取件码', placeholder: '向卖家询问后输入取件码' },
      verifyDelivery:{ title: '输入收件码', placeholder: '向买家询问后输入收件码' }
    }
    const cfg = map[type] || { title: '', placeholder: '' }
    this.setData({
      codeModal: { visible: true, type, inputValue: '', title: cfg.title, placeholder: cfg.placeholder }
    })
  },

  onCodeModalInput(e) {
    this.setData({ 'codeModal.inputValue': e.detail.value })
  },

  onCodeModalClose() {
    this.setData({ 'codeModal.visible': false })
  },

  async onCodeModalConfirm() {
    const { type, inputValue } = this.data.codeModal
    const value = (inputValue || '').trim()
    if (!value) {
      util.showToast('请输入内容')
      return
    }
    try {
      util.showLoading('处理中...')
      const orderId = this.data.order.objectId
      if (type === 'verifyPickup') {
        if (value !== this.data.pickupCode) {
          util.hideLoading()
          util.showToast('取件码错误，请确认后重试')
          return
        }
        await this._updateMeta(orderId, { pickupCodeVerified: true })
        util.hideLoading()
        util.showToast('取件码正确，取件成功！', 'success')
      } else if (type === 'verifyDelivery') {
        if (value !== this.data.deliveryCode) {
          util.hideLoading()
          util.showToast('收件码错误，请确认后重试')
          return
        }
        await this._updateMeta(orderId, { deliveryCodeVerified: true })
        const row = await Bmob.Query('Order').get(orderId)
        row.set('status', 'COMPLETED')
        await row.save()
        if (this.data.order.itemId) {
          const itemRow = await Bmob.Query('Item').get(this.data.order.itemId)
          itemRow.set('status', 'SOLD_OUT')
          await itemRow.save()
        }
        try {
          await credit.rewardOrderComplete({ ...this.data.order, status: 'COMPLETED' })
        } catch (creditErr) {
          console.warn('信用结算失败', creditErr)
        }
        util.hideLoading()
        util.showToast('收件码正确，跑腿任务完成！', 'success')
      }
      this.setData({ 'codeModal.visible': false, 'codeModal.inputValue': '' })
      this.loadOrderDetail(orderId)
    } catch (e) {
      util.hideLoading()
      console.error(e)
      util.showToast('操作失败')
    }
  },

  async onDispute() {
    if (!(await getApp().checkAndLogin())) return
    const order = this.data.order
    if (!order || !order.objectId) return
    wx.navigateTo({
      url: `/pages/feedback/feedback?mode=dispute&orderId=${order.objectId}`
    })
  },

  onReview() {
    const order = this.data.order
    if (!order || !order.objectId) return
    wx.navigateTo({
      url: `/pages/orderReview/orderReview?orderId=${order.objectId}`
    })
  },

  // ------------------- 关联跑腿子订单 -------------------
  async onRequestErrand() {
    if (!auth.guardCampusAction({ tip: '完成校园认证后可申请跑腿配送' })) return
    const ok = await util.showModal(
      '申请跑腿配送',
      '将为该交易订单创建一个跑腿子任务，骑手接单后负责取件并送达，跑腿费用由买卖家与骑手在群聊中协商。'
    )
    if (!ok) return
    try {
      util.showLoading('创建中...')
      const order = this.data.order
      const u = auth.getUserInfo()

      // 确定跑腿费付款方（发起方）
      const normId = (v) => (v && typeof v === 'object' ? v.objectId : v) || ''
      const orderBuyerId = normId(order.buyerId)
      const orderSellerId = normId(order.sellerId)
      const isInitiatedByBuyer = u && u.objectId && u.objectId === orderBuyerId
      const errandPayer = isInitiatedByBuyer ? 'buyer' : 'seller'
      const payerLabel = isInitiatedByBuyer ? '买家' : '卖家'

      // 存储禁止接单的用户（买卖双方不能接自己的关联跑腿）
      const blockedTag = `\n[blockedUsers:${orderBuyerId},${orderSellerId}]`

      // 创建跑腿 Item（ON_SALE，骑手可见）
      const errandRow = Bmob.Query('Item')
      errandRow.set('sellerId', u.objectId)
      errandRow.set('postType', publish.POST_TYPE.ERRAND)
      errandRow.set('status', 'ON_SALE')
      errandRow.set('title', `跑腿配送 · ${order.itemTitle || '交易商品'}`)
      errandRow.set('description', `来自交易订单的跑腿配送需求，跑腿费由${payerLabel}支付，请与发布者沟通取件和送达地址。${blockedTag}`)
      errandRow.set('price', 0)
      errandRow.set('category', '跑腿')
      errandRow.set('errandCategory', '其他跑腿')
      errandRow.set('images', '[]')
      const savedItem = await errandRow.save()

      // 将 errandItemId 和付款方写入商品订单 meta
      await this._updateMeta(order.objectId, { errandItemId: savedItem.objectId, errandPayer })

      util.hideLoading()
      util.showToast('跑腿子任务已创建，等待骑手接单', 'success')
      this.loadOrderDetail(order.objectId)
    } catch (e) {
      util.hideLoading()
      console.error(e)
      util.showToast('创建失败')
    }
  },

  async onCancelErrand() {
    const ok = await util.showModal('取消跑腿', '确认取消该跑腿配送任务吗？')
    if (!ok) return
    try {
      util.showLoading('处理中...')
      const order = this.data.order
      const errandItemId = this._parseMeta(order.errandMeta).errandItemId || ''

      // 下架跑腿 Item
      if (errandItemId) {
        const itemRow = await Bmob.Query('Item').get(errandItemId)
        itemRow.set('status', 'OFFLINE')
        await itemRow.save()

        // 取消关联的跑腿 Order（如已接单）
        const q = Bmob.Query('Order')
        q.equalTo('itemId', '==', errandItemId)
        q.limit(5)
        const list = await q.find()
        for (const o of (list || [])) {
          if (o.status !== 'COMPLETED' && o.status !== 'CANCELLED') {
            const oRow = await Bmob.Query('Order').get(o.objectId)
            oRow.set('status', 'CANCELLED')
            await oRow.save()
          }
        }

        // 清除商品订单上的关联字段
        await this._updateMeta(order.objectId, { errandItemId: '' })
      }

      util.hideLoading()
      util.showToast('跑腿任务已取消')
      this.loadOrderDetail(order.objectId)
    } catch (e) {
      util.hideLoading()
      console.error(e)
      util.showToast('操作失败')
    }
  },

  noop() {},

  async updateOrderStatus(orderId, status) {
    try {
      util.showLoading('处理中...')
      const orderRow = await Bmob.Query('Order').get(orderId)
      const previousStatus = orderRow.status
      if (orderRow.frozen) {
        throw new Error('订单申诉处理中，暂不可变更状态')
      }
      orderRow.set('status', status)
      await orderRow.save()
      const snapshot = { ...orderRow, status }
      try {
        if (status === 'COMPLETED') {
          await credit.rewardOrderComplete(snapshot)
        } else if (status === 'CANCELLED' && previousStatus === 'PENDING_CONFIRM') {
          await credit.penalizeBuyerCancel(snapshot)
        }
      } catch (creditErr) {
        console.warn('信用结算失败', creditErr)
      }
      util.hideLoading()
    } catch (e) {
      util.hideLoading()
      throw e
    }
  }
})
