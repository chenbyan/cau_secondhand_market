const Bmob = require('../../../utils/bmob.js')
const auth = require('../../../utils/auth.js')
const util = require('../../../utils/util.js')
const credit = require('../../../utils/credit.js')

const PAGE_SIZE = 20

const SOURCE_LABEL = {
  admin: '管理员调整',
  dispute: '纠纷裁决',
  order_complete: '订单完成',
  order_timeout: '超时扣分',
  order_cancel: '主动取消',
  order_review: '订单评价',
  errand_breach: '跑腿违约',
  fake_info: '虚假信息',
  publish_violation: '违规发布'
}

function normalizeScore(value, fallback = 100) {
  const score = Number(value)
  return Number.isFinite(score) ? score : fallback
}

Page({
  data: {
    score: 100,
    levelLabel: '信用良好',
    levelTone: 'good',
    percent: 100,
    list: [],
    page: 0,
    loading: false,
    loadingMore: false,
    hasMore: true
  },

  onBack() {
    util.goBack()
  },

  onLoad() {
    if (!auth.checkLoginStatus()) {
      wx.navigateTo({ url: '/pages/login/login' })
      return
    }
    this.refreshSummaryFromRemote()
    this.loadList(true)
  },

  onPullDownRefresh() {
    Promise.all([this.refreshSummaryFromRemote(), this.loadList(true)]).finally(() => wx.stopPullDownRefresh())
  },

  onReachBottom() {
    this.loadList(false)
  },

  refreshSummary(scoreOverride) {
    const score = normalizeScore(scoreOverride, credit.getCurrentScore())
    const level = credit.getLevel(score)
    this.setData({
      score,
      levelLabel: level.label,
      levelTone: level.tone,
      percent: Math.min(100, Math.max(0, score))
    })
  },

  async fetchLatestRecordScore(userId) {
    if (!userId) return null
    try {
      const q = Bmob.Query('CreditRecord')
      q.equalTo('userId', '==', userId)
      q.order('-createdAt')
      q.limit(1)
      const rows = await q.find()
      if (!rows || !rows.length || rows[0].afterScore == null) return null
      const score = Number(rows[0].afterScore)
      return Number.isFinite(score) ? score : null
    } catch (e) {
      console.warn('读取最新信用流水失败', e)
      return null
    }
  },

  async refreshSummaryFromRemote() {
    const u = auth.getUserInfo()
    if (u && u.objectId) {
      try {
        await Bmob.User.updateStorage(u.objectId)
        auth.persistUserInfo(Bmob.User.current())
        const app = getApp && getApp()
        if (app && typeof app.syncGlobalUser === 'function') {
          app.syncGlobalUser()
        }
      } catch (e) {
        console.warn('刷新信用分缓存失败', e)
      }
    }
    const latest = await this.fetchLatestRecordScore(u && u.objectId)
    this.refreshSummary(latest == null ? undefined : latest)
  },

  mapRecord(row) {
    const delta = Number(row.delta) || 0
    return {
      objectId: row.objectId,
      delta,
      deltaText: `${delta > 0 ? '+' : ''}${delta}`,
      deltaClass: delta > 0 ? 'plus' : delta < 0 ? 'minus' : 'zero',
      reason: row.reason || '信用分变更',
      sourceLabel: SOURCE_LABEL[row.source] || row.source || '系统',
      beforeScore: row.beforeScore,
      afterScore: row.afterScore,
      createdAtText: row.createdAt ? util.formatTime(row.createdAt) : ''
    }
  },

  async loadList(reset) {
    if (!reset && (!this.data.hasMore || this.data.loadingMore || this.data.loading)) {
      return
    }
    const u = auth.getUserInfo()
    if (!u || !u.objectId) return
    const page = reset ? 0 : this.data.page
    if (reset) {
      this.setData({ loading: true, page: 0, hasMore: true, list: [] })
    } else {
      this.setData({ loadingMore: true })
    }
    try {
      const q = Bmob.Query('CreditRecord')
      q.equalTo('userId', '==', u.objectId)
      q.order('-createdAt')
      q.limit(PAGE_SIZE)
      q.skip(page * PAGE_SIZE)
      const rows = await q.find()
      const mapped = (rows || []).map((row) => this.mapRecord(row))
      if (reset && mapped.length && mapped[0].afterScore != null) {
        this.refreshSummary(mapped[0].afterScore)
      }
      this.setData({
        list: reset ? mapped : this.data.list.concat(mapped),
        page: page + 1,
        hasMore: mapped.length >= PAGE_SIZE
      })
    } catch (e) {
      console.error('load credit records', e)
      util.showToast('加载信用明细失败')
    } finally {
      this.setData({ loading: false, loadingMore: false })
    }
  }
})
