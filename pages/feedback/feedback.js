const auth = require('../../utils/auth.js')
const util = require('../../utils/util.js')
const ticket = require('../../utils/ticket.js')
const cloudStorage = require('../../utils/cloudStorage.js')
const cloudImage = require('../../utils/cloudImage.js')

const MODE_META = {
  dispute: { title: '订单申诉', placeholder: '请描述纠纷情况（至少 5 字）', submit: '提交申诉' },
  report: { title: '内容举报', placeholder: '请描述违规情况（至少 5 字）', submit: '提交举报' },
  list: { title: '我的申诉/举报', placeholder: '', submit: '' },
  inbox: { title: '收到的举报', placeholder: '', submit: '' },
  case: { title: '案卷详情', placeholder: '填写回应或补充说明（至少 5 字）', submit: '提交' }
}

Page({
  data: {
    mode: 'list',
    meta: MODE_META.list,
    reason: '',
    evidenceImages: [],
    submitting: false,
    cancellingId: '',
    tickets: [],
    inbox: [],
    caseDetail: null,
    caseKey: '',
    loadError: '',
    loading: true,
    loggedIn: false,
    orderId: '',
    targetType: 'Item',
    targetId: '',
    maxImages: ticket.MAX_EVIDENCE_IMAGES
  },

  onLoad(options) {
    const mode = options.mode || 'list'
    let caseKey = options.caseKey || ''
    try {
      caseKey = decodeURIComponent(caseKey)
    } catch (e) {}
    this.setData({
      mode,
      meta: MODE_META[mode] || MODE_META.list,
      orderId: options.orderId || '',
      targetType: options.targetType || 'Item',
      targetId: options.targetId || options.id || '',
      caseKey
    })
    wx.setNavigationBarTitle({ title: (MODE_META[mode] || MODE_META.list).title })
  },

  async onShow() {
    const mode = this.data.mode
    if (mode === 'list') {
      await this.loadList()
      return
    }
    if (mode === 'inbox') {
      await this.loadInbox()
      return
    }
    if (mode === 'case') {
      if (!auth.checkLoginStatus()) {
        wx.navigateTo({ url: '/pages/login/login' })
        return
      }
      await this.loadCase()
      return
    }
    if (!auth.checkLoginStatus()) {
      wx.navigateTo({ url: '/pages/login/login' })
    }
  },

  onReasonInput(e) {
    this.setData({ reason: e.detail.value })
  },

  async loadList() {
    const loggedIn = auth.checkLoginStatus()
    this.setData({ loggedIn })
    if (!loggedIn) {
      this.setData({ loading: false, tickets: [], loadError: '' })
      return
    }
    this.setData({ loading: true, loadError: '' })
    try {
      const raw = await ticket.listMyTickets()
      const tickets = await this.attachThumbs(raw)
      this.setData({ tickets, loading: false, loadError: '' })
    } catch (e) {
      console.error(e)
      this.setData({
        loading: false,
        tickets: [],
        loadError: (e && e.message) || '加载失败'
      })
    }
  },

  async loadInbox() {
    const loggedIn = auth.checkLoginStatus()
    this.setData({ loggedIn })
    if (!loggedIn) {
      this.setData({ loading: false, inbox: [] })
      return
    }
    this.setData({ loading: true })
    try {
      const inbox = await ticket.listRespondentInbox()
      this.setData({ inbox, loading: false })
    } catch (e) {
      console.error(e)
      this.setData({ loading: false, inbox: [] })
      util.showToast('加载失败')
    }
  },

  async loadCase() {
    const ck = (this.data.caseKey || '').trim()
    if (!ck) {
      this.setData({
        loading: false,
        loadError: '缺少案卷编号',
        caseDetail: null
      })
      return
    }
    this.setData({ loading: true, loadError: '', caseDetail: null })
    try {
      const detail = await ticket.getCaseDetail(ck)
      if (!detail.success) {
        this.setData({
          loading: false,
          loadError: detail.message || '案卷不存在',
          caseDetail: null
        })
        return
      }
      const replies = []
      for (let i = 0; i < (detail.replies || []).length; i++) {
        const r = detail.replies[i]
        const thumbs = []
        for (let j = 0; j < r.evidenceIds.length; j++) {
          try {
            const url = await cloudImage.resolveImageUrl(r.evidenceIds[j])
            if (url) thumbs.push(url)
          } catch (e) {}
        }
        replies.push({ ...r, thumbs })
      }
      const tickets = await this.attachThumbs(detail.tickets || [])
      this.setData({
        caseDetail: {
          ...detail,
          replies,
          tickets
        },
        meta: {
          ...MODE_META.case,
          submit: detail.isRespondent ? '提交回应' : '补充说明'
        },
        loading: false,
        loadError: ''
      })
    } catch (e) {
      console.error(e)
      this.setData({
        loading: false,
        loadError: (e && e.message) || '加载失败',
        caseDetail: null
      })
    }
  },

  async attachThumbs(rows) {
    const tickets = []
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const thumbs = []
      for (let j = 0; j < row.evidenceIds.length; j++) {
        try {
          const url = await cloudImage.resolveImageUrl(row.evidenceIds[j])
          if (url) thumbs.push(url)
        } catch (e) {}
      }
      tickets.push({ ...row, thumbs })
    }
    return tickets
  },

  openCase(e) {
    const ck = e.currentTarget.dataset.caseKey
    if (!ck) {
      util.showToast('案卷不存在')
      return
    }
    wx.navigateTo({
      url: `/pages/feedback/feedback?mode=case&caseKey=${encodeURIComponent(ck)}`
    })
  },

  async onChooseImages() {
    const remain = ticket.MAX_EVIDENCE_IMAGES - this.data.evidenceImages.length
    if (remain <= 0) {
      util.showToast(`最多上传 ${ticket.MAX_EVIDENCE_IMAGES} 张`)
      return
    }
    try {
      const res = await new Promise((resolve, reject) => {
        wx.chooseMedia({
          count: remain,
          mediaType: ['image'],
          sourceType: ['album', 'camera'],
          sizeType: ['compressed'],
          success: resolve,
          fail: reject
        })
      })
      const paths = (res.tempFiles || []).map((f) => f.tempFilePath)
      if (!paths.length) return
      util.showLoading('上传中...')
      const uploaded = await cloudStorage.uploadImages(paths, remain, 'ticket')
      const display = []
      for (let i = 0; i < uploaded.length; i++) {
        display.push({
          id: uploaded[i],
          url: await cloudImage.resolveImageUrl(uploaded[i])
        })
      }
      util.hideLoading()
      this.setData({
        evidenceImages: this.data.evidenceImages.concat(display)
      })
    } catch (e) {
      util.hideLoading()
      util.showToast((e && e.message) || '上传失败')
    }
  },

  onRemoveImage(e) {
    const index = e.currentTarget.dataset.index
    const images = this.data.evidenceImages.slice()
    images.splice(index, 1)
    this.setData({ evidenceImages: images })
  },

  async onCancelTicket(e) {
    const id = e.currentTarget.dataset.id
    if (!id || this.data.cancellingId) return
    const ok = await util.showModal('撤销工单', '确定撤销吗？订单申诉将同时解除订单冻结。')
    if (!ok) return
    this.setData({ cancellingId: id })
    const result = await ticket.cancelTicket(id)
    this.setData({ cancellingId: '' })
    if (!result.success) {
      util.showToast(result.message || '撤销失败')
      return
    }
    util.showToast('已撤销', 'success')
    if (this.data.mode === 'case') this.loadCase()
    else this.loadList()
  },

  getEvidenceIds() {
    return this.data.evidenceImages.map((x) => x.id).filter(Boolean)
  },

  async onSubmit() {
    if (this.data.submitting) return
    if (!auth.checkLoginStatus()) {
      wx.navigateTo({ url: '/pages/login/login' })
      return
    }

    const evidence = this.getEvidenceIds()
    this.setData({ submitting: true })
    let result

    if (this.data.mode === 'case') {
      result = await ticket.submitCaseReply(
        this.data.caseKey,
        this.data.reason,
        evidence
      )
    } else if (this.data.mode === 'dispute') {
      result = await ticket.submitDispute(
        this.data.orderId,
        this.data.reason,
        evidence
      )
    } else if (this.data.mode === 'report') {
      result = await ticket.submitReport(
        this.data.targetType,
        this.data.targetId,
        this.data.reason,
        evidence
      )
    } else {
      this.setData({ submitting: false })
      return
    }
    this.setData({ submitting: false })

    if (!result.success) {
      util.showToast(result.message || '提交失败')
      return
    }
    await util.showModal('已提交', result.message || '请等待管理员处理')
    if (this.data.mode === 'case') {
      this.setData({ reason: '', evidenceImages: [] })
      this.loadCase()
    } else {
      wx.navigateBack()
    }
  }
})
