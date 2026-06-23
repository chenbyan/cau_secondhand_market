const auth = require('../../utils/auth.js')
const util = require('../../utils/util.js')
const itemQuery = require('../../utils/publish.js')
const sysConfig = require('../../utils/sysConfig.js')
const campusPreference = require('../../utils/campusPreference.js')
const orderNotify = require('../../utils/orderNotify.js')
const itemHot = require('../../utils/itemHot.js')
const Bmob = require('../../utils/bmob.js')

const placeholder =
  'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'

const HOME_PREF_KEY = 'homePersonalPreference'

const BANNERS = [
  {
    id: 'book',
    title: '教材资料专区',
    subtitle: '复习资料、考研书、课外读物集中看',
    badge: '书籍',
    type: itemQuery.TYPE_BOOK,
    tone: 'banner-blue'
  },
  {
    id: 'goods',
    title: '校园闲置上新',
    subtitle: '数码、日用、服饰，校内自提更省心',
    badge: '好物',
    type: itemQuery.TYPE_GOODS,
    tone: 'banner-green'
  },
  {
    id: 'errand',
    title: '校园跑腿入口',
    subtitle: '取件、代买、送资料，校内任务集中看',
    badge: '服务',
    type: itemQuery.TYPE_PARTTIME,
    category: '跑腿',
    tone: 'banner-orange'
  }
]

const QUICK_ENTRIES = [
  {
    id: 'book',
    title: '找书籍',
    desc: '教材资料',
    icon: '书',
    type: itemQuery.TYPE_BOOK
  },
  {
    id: 'goods',
    title: '找物品',
    desc: '闲置好物',
    icon: '物',
    type: itemQuery.TYPE_GOODS
  },
  {
    id: 'errand',
    title: '找跑腿',
    desc: '取送代买',
    icon: '跑',
    type: itemQuery.TYPE_PARTTIME,
    category: '跑腿'
  },
  {
    id: 'publish',
    title: '去发布',
    desc: '认证可用',
    icon: '发',
    action: 'publish'
  }
]

const CATEGORY_SHORTCUTS = [
  { id: 'digital', name: '数码', type: itemQuery.TYPE_GOODS, category: '数码' },
  { id: 'daily', name: '日用', type: itemQuery.TYPE_GOODS, category: '日用' },
  { id: 'clothes', name: '服饰', type: itemQuery.TYPE_GOODS, category: '服饰' },
  { id: 'errand', name: '跑腿', type: itemQuery.TYPE_PARTTIME, category: '跑腿' }
]

const HEADLINES = [
  {
    id: 'safe',
    tag: '公告',
    title: '毕业季交易提醒',
    desc: '当面验货、线下交付，重要沟通尽量保留记录',
    action: 'notice'
  },
  {
    id: 'books',
    tag: '头条',
    title: '教材资料专区已更新',
    desc: '按校区和最近浏览偏好优先推荐',
    type: itemQuery.TYPE_BOOK
  },
  {
    id: 'errand',
    tag: '服务',
    title: '跑腿任务可从详情页接单',
    desc: '完成校园认证后，可联系发布者并进入消息沟通',
    type: itemQuery.TYPE_PARTTIME,
    category: '跑腿'
  }
]

const SECTION_CONFIGS = [
  {
    key: itemQuery.TYPE_BOOK,
    title: '书籍推荐',
    subtitle: '按校区与浏览偏好排序',
    emptyText: '暂无书籍'
  },
  {
    key: itemQuery.TYPE_GOODS,
    title: '物品推荐',
    subtitle: '优先同校区闲置好物',
    emptyText: '暂无物品'
  }
]

const enrichHotItems = (items) =>
  (items || []).map((item) => ({
    ...item,
    recommendType: getItemType(item),
    recommendCampus: getItemCampus(item)
  }))

const WEATHER_PRESETS = [
  {
    condition: '晴',
    temp: 26,
    humidity: '46%',
    wind: '东南风 2级',
    tip: '适合在图书馆或校门附近面交'
  },
  {
    condition: '多云',
    temp: 24,
    humidity: '58%',
    wind: '微风',
    tip: '面交前记得确认取货地点'
  },
  {
    condition: '阴',
    temp: 22,
    humidity: '64%',
    wind: '东北风 2级',
    tip: '建议选择室内公共区域交易'
  }
]

const buildSections = (itemsMap = {}) =>
  SECTION_CONFIGS.map((section) => ({
    ...section,
    items: itemsMap[section.key] || []
  }))

const getInitialCampus = () => {
  const user = auth.getUserInfo() || {}
  return campusPreference.getPreferredCampus(user.campus)
}

const buildSearchUrl = (type, keyword, category) => {
  const params = [`type=${encodeURIComponent(type || itemQuery.TYPE_ALL)}`]
  const kw = String(keyword || '').trim()
  if (kw) params.push(`keyword=${encodeURIComponent(kw)}`)
  if (category && category !== 'all') {
    params.push(`category=${encodeURIComponent(category)}`)
  }
  return `/pages/publishHub/publishHub?${params.join('&')}`
}

const buildWeather = (campus) => {
  const now = new Date()
  const preset = WEATHER_PRESETS[now.getHours() % WEATHER_PRESETS.length]
  return {
    ...preset,
    campus: '校园',
    updateText: `${util.formatTime(now).slice(11, 16)} 更新`
  }
}

const getPreference = () => {
  const raw = wx.getStorageSync(HOME_PREF_KEY)
  if (raw && typeof raw === 'object') {
    return {
      typeScore: raw.typeScore || {},
      categoryScore: raw.categoryScore || {},
      keywords: raw.keywords || []
    }
  }
  return { typeScore: {}, categoryScore: {}, keywords: [] }
}

const savePreference = (pref) => {
  wx.setStorageSync(HOME_PREF_KEY, {
    typeScore: pref.typeScore || {},
    categoryScore: pref.categoryScore || {},
    keywords: (pref.keywords || []).slice(0, 6),
    updatedAt: Date.now()
  })
}

const getItemType = (item) => {
  if (item.isParttime || item.category === '跑腿') return itemQuery.TYPE_PARTTIME
  if (item.category === '书籍') return itemQuery.TYPE_BOOK
  return itemQuery.TYPE_GOODS
}

const inferCampusFromText = (text) => {
  const value = String(text || '')
  if (/西校区|西区|西门|西苑|西区快递|西区食堂/.test(value)) return '西校区'
  if (/东校区|东区|东门|东苑|东区快递|东区食堂/.test(value)) return '东校区'
  return ''
}

const getItemCampus = (item) => {
  if (campusPreference.CAMPUS_OPTIONS.indexOf(item.campus) >= 0) {
    return item.campus
  }
  return inferCampusFromText(
    [
      item.title,
      item.description,
      item.pickupAddr,
      item.deliveryAddr,
      item.routeHint
    ].join(' ')
  )
}

const parseTimeValue = (value) => {
  const t = Date.parse(value || '')
  return Number.isNaN(t) ? 0 : t
}

const scoreItem = (item, pref, campus) => {
  const itemCampus = getItemCampus(item)
  const type = getItemType(item)
  const category = item.category || ''
  let score = 0

  if (itemCampus && itemCampus === campus) score += 80
  else if (!itemCampus) score += 15

  score += Math.min(30, Number(pref.typeScore[type]) || 0)
  score += Math.min(36, Number(pref.categoryScore[category]) || 0)

  const keywordHit = (pref.keywords || []).some((kw) => {
    const text = `${item.title || ''} ${item.description || ''}`.toLowerCase()
    return kw && text.indexOf(String(kw).toLowerCase()) >= 0
  })
  if (keywordHit) score += 18

  const created = parseTimeValue(item.createdAt)
  if (created) {
    const ageDays = Math.max(0, (Date.now() - created) / 86400000)
    score += Math.max(0, 24 - ageDays * 2)
  }

  score -= Number(item.creditRankPenalty) || 0

  return score
}

const personalizeItems = (items, pref, campus, count) =>
  (items || [])
    .map((item, index) => ({
      item,
      score: scoreItem(item, pref, campus),
      index
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, count)
    .map((entry) => ({
      ...entry.item,
      recommendType: getItemType(entry.item),
      recommendCampus: getItemCampus(entry.item)
    }))

Page({
  data: {
    keyword: '',
    banners: BANNERS,
    quickEntries: QUICK_ENTRIES,
    categoryShortcuts: CATEGORY_SHORTCUTS,
    headlines: HEADLINES,
    selectedCampus: getInitialCampus(),
    recommendationNote: '',
    featuredItems: [],
    hotDayItems: [],
    hotMonthItems: [],
    sections: buildSections(),
    loading: true,
    weather: buildWeather(getInitialCampus()),
    placeholder,
    aiUnreadCount: 0
  },

  onLoad() {
    const selectedCampus = getInitialCampus()
    this.setData({
      selectedCampus,
      weather: buildWeather(selectedCampus),
      recommendationNote: this.buildRecommendationNote(selectedCampus)
    })
    this.loadRemoteConfig()
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      const app = getApp()
      this.getTabBar().setData({
        selected: 0,
        messageBadge: (app && app.globalData.unreadNoticeCount) || 0
      })
    }
    const selectedCampus = getInitialCampus()
    this.setData({
      selectedCampus,
      weather: buildWeather(selectedCampus),
      recommendationNote: this.buildRecommendationNote(selectedCampus)
    })
    this.loadRemoteConfig()
    this.loadHome()
    this.updateAiBadge()
  },

  async loadRemoteConfig() {
    try {
      await sysConfig.ensureLoaded()
      const announcement = sysConfig.getHomeAnnouncement()
      const headlines = announcement
        ? [
            {
              id: 'admin_notice',
              tag: '公告',
              title: '平台公告',
              desc: announcement,
              action: 'notice'
            },
            ...HEADLINES.filter((h) => h.id !== 'safe')
          ]
        : HEADLINES
      const goodsCats = sysConfig.getGoodsCategories().filter((c) => c !== '书籍')
      const shortcuts = goodsCats.slice(0, 3).map((name, idx) => ({
        id: `cat_${idx}`,
        name: name.length > 4 ? name.slice(0, 4) : name,
        type: itemQuery.TYPE_GOODS,
        category: name
      }))
      if (shortcuts.length) {
        shortcuts.push({
          id: 'errand',
          name: '跑腿',
          type: itemQuery.TYPE_PARTTIME,
          category: '跑腿'
        })
      }
      this.setData({
        headlines,
        categoryShortcuts: shortcuts.length ? shortcuts : CATEGORY_SHORTCUTS
      })
    } catch (e) {
      console.warn('loadRemoteConfig', e)
    }
  },

  buildRecommendationNote(campus) {
    const pref = getPreference()
    const hotCategory = Object.keys(pref.categoryScore || {}).sort(
      (a, b) => pref.categoryScore[b] - pref.categoryScore[a]
    )[0]
    return hotCategory ? `按校区与偏好 ${hotCategory} 排序` : '按校区与浏览偏好排序'
  },

  recordPreference(payload = {}) {
    const pref = getPreference()
    const type = payload.type
    const category = payload.category
    const keyword = String(payload.keyword || '').trim()

    if (type) {
      pref.typeScore[type] = Math.min(60, (Number(pref.typeScore[type]) || 0) + 8)
    }
    if (category && category !== 'all') {
      pref.categoryScore[category] = Math.min(
        72,
        (Number(pref.categoryScore[category]) || 0) + 12
      )
    }
    if (keyword) {
      pref.keywords = [keyword].concat(
        (pref.keywords || []).filter((item) => item !== keyword)
      )
    }
    savePreference(pref)
    this.setData({
      recommendationNote: this.buildRecommendationNote(this.data.selectedCampus)
    })
  },

  onSearchInput(e) {
    this.setData({ keyword: e.detail.value })
  },

  onSearchConfirm() {
    this.recordPreference({
      type: itemQuery.TYPE_ALL,
      keyword: this.data.keyword
    })
    wx.navigateTo({
      url: buildSearchUrl(itemQuery.TYPE_ALL, this.data.keyword)
    })
  },

  onBannerTap(e) {
    const { type, category } = e.currentTarget.dataset
    this.recordPreference({ type, category })
    wx.navigateTo({ url: buildSearchUrl(type, this.data.keyword, category) })
  },

  onQuickTap(e) {
    const { type, category, action } = e.currentTarget.dataset
    if (action === 'publish') {
      this.goPublish()
      return
    }
    this.recordPreference({ type, category })
    wx.navigateTo({ url: buildSearchUrl(type, this.data.keyword, category) })
  },

  onCategoryTap(e) {
    const { type, category } = e.currentTarget.dataset
    this.recordPreference({ type, category })
    wx.navigateTo({ url: buildSearchUrl(type, this.data.keyword, category) })
  },

  onMoreTap(e) {
    const type = e.currentTarget.dataset.type
    this.recordPreference({ type })
    wx.navigateTo({ url: buildSearchUrl(type, this.data.keyword) })
  },

  onHeadlineTap(e) {
    const id = e.currentTarget.dataset.id
    const headline = (this.data.headlines || HEADLINES).find((item) => item.id === id)
    if (!headline) return
    if (headline.type) {
      this.recordPreference({
        type: headline.type,
        category: headline.category
      })
      wx.navigateTo({
        url: buildSearchUrl(headline.type, this.data.keyword, headline.category)
      })
      return
    }
    if (headline.action === 'notice') {
      wx.showModal({
        title: headline.title,
        content: headline.desc,
        showCancel: false
      })
    }
  },

  async loadHome(forceHot = false) {
    this.setData({ loading: true })
    try {
      const campus = this.data.selectedCampus || getInitialCampus()
      const pref = getPreference()
      const homeResults = await Promise.all([
        itemQuery.fetchItems({
          type: itemQuery.TYPE_ALL,
          cursor: 0,
          pageSize: 24
        }),
        ...SECTION_CONFIGS.map((section) =>
          itemQuery.fetchItems({
            type: section.key,
            cursor: 0,
            pageSize: 14
          })
        ),
        itemHot.fetchBrowseAggregates(forceHot)
      ])
      const featured = homeResults[0]
      const browseAgg = homeResults[homeResults.length - 1]
      const sectionResults = homeResults.slice(1, -1)
      const pool = itemHot.mergeItemPool([
        featured.list,
        ...sectionResults.map((r) => r.list)
      ])
      const hotDayItems = enrichHotItems(
        itemHot.pickHotFromPool(pool, browseAgg.dayMap, 6)
      )
      const hotMonthItems = enrichHotItems(
        itemHot.pickHotFromPool(pool, browseAgg.monthMap, 6)
      )
      const itemsMap = {}
      SECTION_CONFIGS.forEach((section, index) => {
        itemsMap[section.key] = personalizeItems(
          sectionResults[index].list || [],
          pref,
          campus,
          4
        )
      })
      this.setData({
        featuredItems: personalizeItems(featured.list || [], pref, campus, 6),
        hotDayItems,
        hotMonthItems,
        sections: buildSections(itemsMap),
        recommendationNote: this.buildRecommendationNote(campus),
        loading: false
      })
    } catch (e) {
      console.error(e)
      this.setData({
        featuredItems: [],
        hotDayItems: [],
        hotMonthItems: [],
        sections: buildSections(),
        loading: false
      })
      util.showToast('首页数据加载失败')
    }
  },

  refreshWeather() {
    this.setData({ weather: buildWeather(this.data.selectedCampus) })
  },

  onWeatherTap() {
    this.refreshWeather()
    util.showToast('天气已更新')
  },

  async onPullDownRefresh() {
    this.refreshWeather()
    await this.loadHome(true)
    wx.stopPullDownRefresh()
  },

  onItemTap(e) {
    const { id, type, category } = e.currentTarget.dataset
    if (!id) return
    this.recordPreference({ type, category })
    wx.navigateTo({ url: `/pages/itemDetail/itemDetail?id=${id}` })
  },

  goPublish() {
    if (!auth.guardCampusAction({
      tip: '完成校园认证后可发布',
      creditGate: true,
      actionName: '发布'
    })) {
      return
    }
    wx.showActionSheet({
      itemList: ['发布物品', '发布跑腿'],
      success: (res) => {
        if (res.tapIndex === 0) {
          wx.navigateTo({ url: '/pages/itemPublish/itemPublish' })
        } else if (res.tapIndex === 1) {
          wx.navigateTo({ url: '/pages/errandPublish/errandPublish' })
        }
      }
    })
  },

  goToAiChat() {
    wx.navigateTo({ url: '/pages/aiChat/aiChat' })
  },

  async updateAiBadge() {
    if (!auth.checkLoginStatus()) {
      this.setData({ aiUnreadCount: 0 });
      return;
    }
    const u = auth.getUserInfo();
    if (!u || !u.objectId) return;

    try {
      const [buyOrders, sellOrders] = await Promise.all([
        Bmob.Query('Order').equalTo('buyerId', '==', u.objectId).find(),
        Bmob.Query('Order').equalTo('sellerId', '==', u.objectId).find()
      ]);
      const allOrders = [...(buyOrders || []), ...(sellOrders || [])];
      const orderMap = {};
      allOrders.forEach(o => { orderMap[o.objectId] = o; });
      const uniqueOrders = Object.values(orderMap);

      const changed = orderNotify.getChangedOrders(uniqueOrders);
      this.setData({ aiUnreadCount: changed.length });
    } catch (e) {
      console.error('更新AI角标失败', e);
    }
  }
})
