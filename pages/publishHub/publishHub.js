const itemQuery = require('../../utils/publish.js')
const sysConfig = require('../../utils/sysConfig.js')
const util = require('../../utils/util.js')

const placeholder =
  'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'

const safeDecode = (value) => {
  try {
    return decodeURIComponent(value || '')
  } catch (e) {
    return value || ''
  }
}

Page({
  data: {
    typeOptions: itemQuery.TYPE_OPTIONS.filter(
      (item) => item.key !== itemQuery.TYPE_ALL
    ),
    categories: itemQuery.getCategoryOptions(itemQuery.TYPE_ALL),
    activeType: itemQuery.TYPE_ALL,
    activeCategory: 'all',
    keyword: '',
    titleText: itemQuery.getTypeLabel(itemQuery.TYPE_ALL),
    list: [],
    cursor: 0,
    pageSize: itemQuery.PAGE_SIZE,
    loading: true,
    loadingMore: false,
    refreshing: false,
    hasMore: true,
    placeholder
  },

  onBack() {
    util.goBack()
  },

  async onLoad(options) {
    try {
      await sysConfig.ensureLoaded()
    } catch (e) {
      console.warn('publishHub sysConfig', e)
    }
    const activeType = itemQuery.normalizeType(options && options.type)
    const categories = itemQuery.getCategoryOptions(activeType)
    const wantedCategory = (options && safeDecode(options.category)) || 'all'
    const activeCategory = this.pickCategory(categories, wantedCategory)
    const keyword = safeDecode(options && options.keyword)
    const titleText = this.buildTitle(activeType, activeCategory, keyword, categories)
    this.setData({
      activeType,
      categories,
      activeCategory,
      keyword,
      titleText
    })
    this.updateNavTitle(titleText)
    this.loadList(true)
  },

  pickCategory(categories, key) {
    const ok = (categories || []).some((item) => item.key === key)
    return ok ? key : 'all'
  },

  buildTitle(type, category, keyword, categories) {
    const base = itemQuery.getTypeLabel(type)
    const kw = String(keyword || '').trim()
    if (kw) return `${base} · ${kw}`
    if (category && category !== 'all') {
      const hit = (categories || []).find((item) => item.key === category)
      return `${base} · ${hit ? hit.name : category}`
    }
    return base
  },

  updateNavTitle(title) {
    wx.setNavigationBarTitle({ title: title || this.data.titleText || '搜索结果' })
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value })
  },

  onSearchConfirm() {
    const titleText = this.buildTitle(
      this.data.activeType,
      this.data.activeCategory,
      this.data.keyword,
      this.data.categories
    )
    this.setData({ titleText })
    this.updateNavTitle(titleText)
    this.loadList(true)
  },

  onClearKeyword() {
    const titleText = this.buildTitle(
      this.data.activeType,
      this.data.activeCategory,
      '',
      this.data.categories
    )
    this.setData({
      keyword: '',
      titleText
    })
    this.updateNavTitle(titleText)
    this.loadList(true)
  },

  onTypeTap(e) {
    const activeType = itemQuery.normalizeType(e.currentTarget.dataset.type)
    if (activeType === this.data.activeType) return
    const categories = itemQuery.getCategoryOptions(activeType)
    const activeCategory = 'all'
    const titleText = this.buildTitle(
      activeType,
      activeCategory,
      this.data.keyword,
      categories
    )
    this.setData({ activeType, categories, activeCategory, titleText })
    this.updateNavTitle(titleText)
    this.loadList(true)
  },

  onCategoryTap(e) {
    const activeCategory = e.currentTarget.dataset.category || 'all'
    if (activeCategory === this.data.activeCategory) return
    const titleText = this.buildTitle(
      this.data.activeType,
      activeCategory,
      this.data.keyword,
      this.data.categories
    )
    this.setData({ activeCategory, titleText })
    this.updateNavTitle(titleText)
    this.loadList(true)
  },

  async loadList(reset) {
    if (!reset && (!this.data.hasMore || this.data.loadingMore || this.data.loading)) {
      return
    }
    if (reset) {
      this.setData({
        loading: true,
        cursor: 0,
        hasMore: true,
        list: []
      })
    } else {
      this.setData({ loadingMore: true })
    }
    try {
      const res = await itemQuery.fetchItems({
        type: this.data.activeType,
        category: this.data.activeCategory,
        keyword: this.data.keyword,
        cursor: reset ? 0 : this.data.cursor,
        pageSize: this.data.pageSize
      })
      const list = reset ? res.list : this.data.list.concat(res.list)
      this.setData({
        list,
        cursor: res.nextCursor,
        hasMore: res.hasMore,
        loading: false,
        loadingMore: false
      })
    } catch (e) {
      console.error(e)
      util.showToast('加载失败')
      this.setData({ loading: false, loadingMore: false })
    }
  },

  async onPullDownRefresh() {
    this.setData({ refreshing: true })
    await this.loadList(true)
    this.setData({ refreshing: false })
    wx.stopPullDownRefresh()
  },

  onReachBottom() {
    this.loadList(false)
  },

  onOpenDetail(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: `/pages/itemDetail/itemDetail?id=${id}` })
  }
})
