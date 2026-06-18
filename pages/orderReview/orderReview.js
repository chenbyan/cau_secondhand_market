const Bmob = require('../../utils/bmob.js')
const auth = require('../../utils/auth.js')
const util = require('../../utils/util.js')
const review = require('../../utils/review.js')

Page({
  data: {
    orderId: '',
    order: null,
    targetLabel: '对方',
    rating: 5,
    content: '',
    ratingOptions: [1, 2, 3, 4, 5],
    canReview: false,
    loading: true,
    submitting: false
  },

  onBack() {
    util.goBack()
  },

  onLoad(options) {
    const orderId = options && options.orderId
    if (!auth.checkLoginStatus()) {
      wx.redirectTo({ url: '/pages/login/login' })
      return
    }
    if (!orderId) {
      util.showToast('参数错误')
      setTimeout(() => wx.navigateBack(), 800)
      return
    }
    this.setData({ orderId })
    this.loadOrder(orderId)
  },

  async loadOrder(orderId) {
    try {
      const order = await Bmob.Query('Order').get(orderId)
      const u = auth.getUserInfo()
      const state = await review.getReviewState(order, u && u.objectId)
      const targetLabel = state.reviewerRole === 'buyer' ? '卖家' : '买家'
      this.setData({
        order,
        targetLabel,
        canReview: !!state.canReview,
        loading: false
      })
      if (!state.canReview) {
        util.showToast(state.reviewed ? '您已评价过该订单' : '当前订单不可评价')
      }
    } catch (e) {
      console.error(e)
      util.showToast('加载订单失败')
      this.setData({ loading: false })
    }
  },

  onRatingTap(e) {
    this.setData({ rating: Number(e.currentTarget.dataset.value) || 5 })
  },

  onContentInput(e) {
    this.setData({ content: e.detail.value || '' })
  },

  async onSubmit() {
    if (!this.data.canReview || this.data.submitting) return
    this.setData({ submitting: true })
    try {
      const res = await review.submitOrderReview(
        this.data.orderId,
        this.data.rating,
        this.data.content
      )
      util.showToast(res.message || (res.success ? '评价已提交' : '提交失败'), res.success ? 'success' : 'none')
      if (res.success) {
        setTimeout(() => wx.navigateBack(), 700)
      }
    } catch (e) {
      console.error(e)
      util.showToast(e.message || '提交失败')
    } finally {
      this.setData({ submitting: false })
    }
  }
})
