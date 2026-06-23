const auth = require('../../../utils/auth.js')
const util = require('../../../utils/util.js')
const browseHistory = require('../../../utils/browseHistory.js')
const cloudImage = require('../../../utils/cloudImage.js')

Page({
  data: {
    list: [],
    loading: true,
    placeholder:
      'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'
  },

  onBack() {
    util.goBack()
  },

  onLoad() {
    if (!auth.guardCampusAction({ tip: '完成校园认证后可查看浏览记录' })) {
      setTimeout(() => wx.navigateBack(), 300)
      return
    }
    this.loadList()
  },

  onShow() {
    if (!auth.checkCampusVerified()) return
    this.loadList()
  },

  async loadList() {
    this.setData({ loading: true })
    try {
      const raw = await browseHistory.listMyHistory(50)
      const list = []
      for (let i = 0; i < raw.length; i++) {
        const row = raw[i]
        let image = row.itemImage || ''
        if (image && cloudImage.isCloudFileId(image)) {
          try {
            image = await cloudImage.resolveImageUrl(image)
          } catch (e) {}
        }
        list.push({ ...row, displayImage: image || this.data.placeholder })
      }
      this.setData({ list, loading: false })
    } catch (e) {
      console.error(e)
      this.setData({ list: [], loading: false })
      util.showToast('加载失败')
    }
  },

  onOpenItem(e) {
    const itemId = e.currentTarget.dataset.itemId
    const targetType = e.currentTarget.dataset.targetType
    const missing = e.currentTarget.dataset.missing
    if (!itemId) return
    if (missing) {
      util.showToast('该商品已不存在')
      return
    }
    const src = targetType === 'errand' ? '&src=errand' : ''
    wx.navigateTo({ url: `/pages/itemDetail/itemDetail?id=${itemId}${src}` })
  },

  async onRemove(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    const ok = await util.showModal('删除记录', '确定删除这条浏览记录吗？')
    if (!ok) return
    try {
      util.showLoading('处理中...')
      await browseHistory.removeRecord(id)
      util.hideLoading()
      util.showToast('已删除')
      this.loadList()
    } catch (err) {
      util.hideLoading()
      util.showToast('删除失败')
    }
  },

  async onClearAll() {
    if (!this.data.list.length) return
    const ok = await util.showModal('清空记录', '确定清空全部浏览记录吗？')
    if (!ok) return
    try {
      util.showLoading('处理中...')
      await browseHistory.clearAll()
      util.hideLoading()
      util.showToast('已清空')
      this.loadList()
    } catch (e) {
      util.hideLoading()
      util.showToast('操作失败')
    }
  },

  goIndex() {
    wx.switchTab({ url: '/pages/index/index' })
  }
})
