Component({
  data: {
    selected: 0,
    color: '#8a9399',
    selectedColor: '#4a7ab8',
    messageBadge: 0,
    list: [
      { pagePath: '/pages/index/index', text: '首页', icon: 'home' },
      { pagePath: '/pages/messages/messages', text: '消息', icon: 'message' },
      { pagePath: '/pages/my/my', text: '我的', icon: 'my' }
    ]
  },

  attached() {
    const app = getApp()
    if (app && app.globalData) {
      this.setData({ messageBadge: app.globalData.unreadNoticeCount || 0 })
    }
  },

  methods: {
    switchTab(e) {
      const index = e.currentTarget.dataset.index
      const item = this.data.list[index]
      wx.switchTab({ url: item.pagePath })
      this.setData({ selected: index })
    }
  }
})
