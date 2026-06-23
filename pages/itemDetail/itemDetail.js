const Bmob = require('../../utils/bmob.js')
const auth = require('../../utils/auth.js')
const chat = require('../../utils/chat.js')
const notice = require('../../utils/notice.js')
const publish = require('../../utils/publish.js')
const cloudImage = require('../../utils/cloudImage.js')
const util = require('../../utils/util.js')
const itemStatus = require('../../utils/itemStatus.js')
const credit = require('../../utils/credit.js')
const itemLock = require('../../utils/itemLock.js')
const browseHistory = require('../../utils/browseHistory.js')
const desensitize = require('../../utils/desensitize.js')

Page({
  data: {
    loading: true,
    item: null,
    images: [],
    soldOut: false,
    isOwner: false,
    isErrand: false,
    showBuyerBar: false,
    showErrandAcceptBar: false,
    showErrandContactBar: false,
    showOwnerBar: false,
    showItemOwnerBar: false,
    showGoodsSellerOrderBar: false,
    showSellerLockPanel: false,
    sellerId: '',
    runnerId: '',
    isRunner: false,
    sellerPhone: '',
    sellerPhoneIsFull: false,
    buyerContactPhones: [],
    runner: null,
    hasRunner: false,
    sellerCreditText: '信用良好 · 建议当面交易',
    sellerCreditTone: 'good',
    carting: false,
    buying: false,
    // 拍下相关
    lockBuyers: [],
    sellerLockBuyers: [],
    sellerConfirmCountdown: '',
    isInLockBuyers: false,
    lockInfo: null,          // 付款锁定信息 {buyerId, expireAt}
    countdown: '',
    isLockedByMe: false,
    canLock: true,           // 能否拍下（未售出、未被付款锁定）
    locking: false
  },

  onBack() {
    util.goBack()
  },

  onGalleryImageError(e) {
    const index = e.currentTarget.dataset.index
    const images = this.data.images.slice()
    images[index] = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'
    this.setData({ images })
  },

  onLoad(options) {
    const id = options && options.id
    if (!id) {
      util.showToast('参数错误')
      setTimeout(() => wx.navigateBack(), 800)
      return
    }
    this.itemId = id
    this.itemSrc = (options && options.src) || 'item'  // 'errand' → 查 Errand 表
    this.loadDetail(id)
    this.timer = setInterval(() => {
      if (this.data.lockInfo) {
        this.updateCountdown()
      }
      if (this.data.sellerConfirmDeadline) {
        this.updateSellerConfirmCountdown()
      }
    }, 1000)
  },

  onShow() {
    // 从编辑页、接单页等返回时刷新商品信息
    if (this.itemId && this.loadedOnce) {
      this.loadDetail(this.itemId)
    }
    this.scheduleBrowseRecord()
  },

  onUnload() {
    if (this.timer) clearInterval(this.timer)
    if (this._browseTimer) clearTimeout(this._browseTimer)
  },

  scheduleBrowseRecord() {
    if (this._browseTimer) clearTimeout(this._browseTimer)
    this._browseTimer = setTimeout(() => {
      this._browseTimer = null
      if (!this.itemId || this.data.loading || !this.data.item) return
      if (!auth.checkLoginStatus() || !auth.checkCampusVerified()) return
      const item = this.data.item
      const isErrand = item.isErrand || this.itemSrc === 'errand'
      let targetType = 'goods'
      if (isErrand) targetType = 'errand'
      else if (item.category === '书籍') targetType = 'book'
      browseHistory.recordView({
        itemId: this.itemId,
        targetType,
        itemTitle: item.title,
        itemImage: (this.data.images && this.data.images[0]) || '',
        price: item.price
      }).catch(() => {})
    }, 2000)
  },

  async loadDetail(id) {
    try {
      util.showLoading('加载中...')
      let row = this.itemSrc === 'errand'
        ? await publish.getErrand(id)
        : await publish.getItem(id)
      util.hideLoading()
      if (!row) {
        util.showToast('内容不存在')
        setTimeout(() => wx.navigateBack(), 800)
        return
      }

      // 图片处理
      let images = []
      if (row.images) {
        try {
          images = typeof row.images === 'string' ? JSON.parse(row.images) : row.images
        } catch (e) {
          images = row.coverImage ? [row.coverImage] : []
        }
      } else if (row.coverImage) {
        images = [row.coverImage]
      }
      const resolved = []
      for (let i = 0; i < images.length; i++) {
        const imageUrl = await cloudImage.resolveImageUrl(images[i])
        if (imageUrl) resolved.push(imageUrl)
      }
      if (!resolved.length) {
        resolved.push(
          'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'
        )
      }

      const u = auth.getUserInfo()
      const currentUserId = (u && u.objectId) || ''
      const sellerId = publish.getSellerId(row)
      const runnerId = (row.runnerId && row.runnerId.objectId) || row.runnerId || ''
      const isOwner = !!(currentUserId && sellerId === currentUserId)
      const isRunner = !!(currentUserId && runnerId && currentUserId === runnerId)
      const isErrand = row.postType === publish.POST_TYPE.ERRAND || this.itemSrc === 'errand'
      const st = itemStatus.getStatusMeta(row.postType || (isErrand ? publish.POST_TYPE.ERRAND : 'goods'), row.status)
      const status = row.status
      let sellerCreditText = '信用良好 · 建议当面交易'
      let sellerCreditTone = 'good'

      const sellerCredit = await credit.getUserCreditProfile(sellerId)
      if (sellerCredit) {
        sellerCreditText = `信用分 ${sellerCredit.score} · ${sellerCredit.level.label}`
        sellerCreditTone = sellerCredit.level.tone
      }

      const blockedUsers = publish.parseBlockedUsersFromDescription(row.description)
      const isBlockedFromAccept = blockedUsers.length > 0 && !!currentUserId && blockedUsers.includes(currentUserId)

      let runner = null
      if (
        isErrand &&
        (status === 'IN_TRADING' || status === 'SOLD_OUT') &&
        (isOwner || isRunner)
      ) {
        runner = await publish.getRunnerContact(row)
        if (runner && runnerId) {
          const runnerCredit = await credit.getUserCreditProfile(runnerId)
          if (runnerCredit) {
            runner.creditText = `信用分 ${runnerCredit.score} · ${runnerCredit.level.label}`
            runner.creditTone = runnerCredit.level.tone
          }
        }
      }

      const ended = status === 'SOLD_OUT' || status === 'OFFLINE'

      if (!isErrand && status === 'ON_SALE' && !row.lockBuyerId) {
        try {
          await itemLock.autoConfirmFirstBuyer(row.objectId)
          row = await publish.getItem(id)
        } catch (e) {
          console.warn('autoConfirmFirstBuyer', e)
        }
      }

      const lockBuyers = itemLock.normalizeLockBuyers(row.lockBuyers)
      const isInLockBuyers = lockBuyers.some((entry) => entry.buyerId === currentUserId)
      const sellerLockBuyers = isOwner && !isErrand
        ? await itemLock.enrichLockBuyers(lockBuyers)
        : []

      const lockBuyerId = row.lockBuyerId || ''
      const lockExpireAt = itemLock.parseTime(row.lockExpireAt)
      const sellerConfirmDeadline = !isErrand && status === 'ON_SALE' && lockBuyers.length
        ? itemLock.getSellerConfirmDeadline(row)
        : 0
      const now = Date.now()
      let isLockedByMe = false
      let canLock = true
      let lockInfo = null

      if (lockBuyerId && status === 'IN_TRADING') {
        isLockedByMe = lockBuyerId === currentUserId
        canLock = false
        if (lockExpireAt > 0) {
          lockInfo = { buyerId: lockBuyerId, expireAt: lockExpireAt }
          if (lockExpireAt <= now && isLockedByMe) {
            this.releasePaymentLockAndRefresh()
          }
        }
      } else if (isInLockBuyers) {
        canLock = false
      }

      if (ended || status !== 'ON_SALE' || isOwner || isErrand) {
        canLock = false
      }

      this.sellerConfirmDeadline = sellerConfirmDeadline

      // 联系电话从用户注册信息读取：接单/拍下前脱敏，之后对买家/骑手完整显示
      let sellerPhone = ''
      let sellerPhoneIsFull = false
      let buyerContactPhones = []
      {
        const rawPhone = await auth.fetchUserPhone(sellerId)
        if (rawPhone) {
          if (isErrand) {
            const runnerCanSee = isRunner && (status === 'IN_TRADING' || status === 'SOLD_OUT')
            sellerPhone = runnerCanSee ? rawPhone : desensitize.maskPhone(rawPhone)
            sellerPhoneIsFull = runnerCanSee
          } else {
            // 卖家确认（IN_TRADING）后双方才能互相看到完整号码
            const buyerCanSee = !isOwner && isLockedByMe && status === 'IN_TRADING'
            sellerPhone = isOwner ? '' : (buyerCanSee ? rawPhone : desensitize.maskPhone(rawPhone))
            sellerPhoneIsFull = buyerCanSee
          }
        }
        // 卖家端：仅确认订单后（IN_TRADING）才显示已确认买家的手机号
        if (isOwner && !isErrand && status === 'IN_TRADING' && lockBuyerId) {
          const confirmedBuyer = sellerLockBuyers.find((b) => b.buyerId === lockBuyerId)
          const phone = await auth.fetchUserPhone(lockBuyerId)
          if (phone) {
            buyerContactPhones = [Object.assign(
              { buyerId: lockBuyerId, nickName: '买家' },
              confirmedBuyer || {},
              { phone }
            )]
          }
        }
      }

      const soldMaskText = (() => {
        if (isErrand) {
          if (status === 'OFFLINE') return '已取消'
          if (status === 'SOLD_OUT') return '已完成'
          return '已结束'
        }
        if (status === 'OFFLINE') return '已下架'
        if (status === 'SOLD_OUT') return '已售出'
        return '已结束'
      })()

      this.setData({
        loading: false,
        images: resolved,
        soldOut: ended,
        soldMaskText,
        isOwner,
        isErrand,
        showBuyerBar: !isOwner && !ended && !isErrand,
        showErrandAcceptBar: !isOwner && isErrand && status === 'ON_SALE' && !isRunner && !isBlockedFromAccept,
        showErrandContactBar:
          isErrand &&
          !ended &&
          ((!isOwner && status === 'ON_SALE') ||
            (status === 'IN_TRADING' && isRunner && !isOwner)),
        showOwnerBar:
          isOwner &&
          isErrand &&
          (status === 'ON_SALE' || status === 'IN_TRADING' || status === 'OFFLINE'),
        showItemOwnerBar: isOwner && !isErrand && status === 'ON_SALE' && !lockBuyers.length && !lockBuyerId,
        showGoodsSellerOrderBar: isOwner && !isErrand && (status === 'IN_TRADING' || lockBuyers.length > 0),
        showSellerLockPanel: isOwner && !isErrand && status === 'ON_SALE' && sellerLockBuyers.length > 0,
        sellerId,
        runnerId,
        isRunner,
        sellerPhone,
        sellerPhoneIsFull,
        buyerContactPhones,
        runner,
        hasRunner: !!(runner && (runner.phone || runner.nickName)),
        sellerCreditText,
        sellerCreditTone,
        item: {
          objectId: row.objectId,
          title: row.title,
          price: row.price,
          description: isErrand
            ? publish.stripBlockedUsersFromDescription(publish.stripContactFromDescription(row.description))
            : row.description,
          category: row.category,
          pickupAddr: row.pickupAddr,
          deliveryAddr: row.deliveryAddr,
          deadline: row.deadline,
          isErrand,
          priceLabel: isErrand ? '赏金' : '价格',
          statusLabel: st.label,
          statusClass: st.cls,
          status
        },
        lockBuyers,
        sellerLockBuyers,
        sellerConfirmCountdown: sellerConfirmDeadline
          ? this.formatCountdown(Math.max(0, sellerConfirmDeadline - now))
          : '',
        isInLockBuyers,
        lockInfo,
        isLockedByMe,
        canLock,
        countdown: lockInfo ? this.formatCountdown(Math.max(0, lockExpireAt - now)) : ''
      })

      if (isErrand) {
        wx.setNavigationBarTitle({ title: '跑腿详情' })
      }
      this.loadedOnce = true
      this.scheduleBrowseRecord()
    } catch (e) {
      util.hideLoading()
      console.error(e)
      util.showToast('加载失败')
      this.setData({ loading: false })
    }
  },

  // ---------- 拍下相关 ----------
  updateCountdown() {
    const lockInfo = this.data.lockInfo
    if (!lockInfo) return
    const remain = Math.max(0, lockInfo.expireAt - Date.now())
    if (remain <= 0) {
      this.releasePaymentLockAndRefresh()
    } else {
      this.setData({ countdown: this.formatCountdown(remain) })
    }
  },

  updateSellerConfirmCountdown() {
    if (!this.sellerConfirmDeadline) return
    const remain = Math.max(0, this.sellerConfirmDeadline - Date.now())
    this.setData({ sellerConfirmCountdown: this.formatCountdown(remain) })
    if (remain <= 0 && this.data.showSellerLockPanel) {
      itemLock.autoConfirmFirstBuyer(this.itemId)
        .then(() => this.loadDetail(this.itemId))
        .catch(() => {})
    }
  },

  formatCountdown(ms) {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  },

  async releasePaymentLock(itemId, buyerId) {
    try {
      const row = await Bmob.Query('Item').get(itemId)
      if (row.lockBuyerId === buyerId && row.lockExpireAt) {
        const expire = new Date(row.lockExpireAt.iso || row.lockExpireAt).getTime()
        if (expire <= Date.now()) {
          row.set('lockBuyerId', '')
          row.unset('lockExpireAt')
          await row.save()
        }
      }
    } catch (e) {}
  },

  async releasePaymentLockAndRefresh() {
    try {
      const row = await Bmob.Query('Item').get(this.itemId)
      row.set('lockBuyerId', '')
      row.unset('lockExpireAt')
      await row.save()
      this.loadDetail(this.itemId)
    } catch (e) {}
  },

  // 拍下：加入拍下列，创建待确认订单，不锁定商品
  async onLock() {
    if (!auth.guardCampusAction({
      tip: '完成校园认证后可拍下商品',
      creditGate: true,
      actionName: '拍下商品'
    })) return
    if (this.data.locking) return
    this.setData({ locking: true })
    util.showLoading('处理中...')
    try {
      const u = auth.getUserInfo()
      const row = await publish.getItem(this.itemId)
      if (row.status !== 'ON_SALE') {
        util.hideLoading()
        util.showToast('商品状态已变更，无法拍下')
        return
      }
      if (row.lockBuyerId) {
        util.hideLoading()
        util.showToast('商品已进入交易中')
        return
      }

      const lockBuyers = itemLock.normalizeLockBuyers(row.lockBuyers)
      if (itemLock.isUserInLockBuyers(lockBuyers, u.objectId)) {
        util.hideLoading()
        util.showToast('您已拍下，请等待卖家确认')
        return
      }

      const activeOrder = await this.findActiveOrder(u.objectId, this.itemId)
      if (activeOrder) {
        util.hideLoading()
        util.showToast('您已有进行中的订单')
        wx.navigateTo({ url: `/pages/orderDetail/orderDetail?id=${activeOrder.objectId}` })
        return
      }

      let sellerId = publish.getSellerId(row)
      if (!sellerId) {
        util.hideLoading()
        util.showToast('卖家信息异常')
        return
      }
      if (sellerId === u.objectId) {
        util.hideLoading()
        util.showToast('不能购买自己的商品')
        return
      }

      const entry = itemLock.buildLockBuyerEntry(u)
      const nextLockBuyers = itemLock.addLockBuyer(lockBuyers, entry)
      const sellerDeadline = itemLock.getSellerConfirmDeadline({
        ...row,
        lockBuyers: nextLockBuyers
      }) || (Date.now() + itemLock.SELLER_CONFIRM_MS)

      const itemRow = await Bmob.Query('Item').get(this.itemId)
      itemRow.set('lockBuyers', nextLockBuyers)
      if (!lockBuyers.length) {
        itemRow.set('lockExpireAt', itemLock.toDateField(sellerDeadline))
      }
      await itemRow.save()

      let savedOrder
      try {
        const order = Bmob.Query('Order')
        order.set('buyerId', u.objectId)
        order.set('sellerId', sellerId)
        order.set('itemId', this.itemId)
        order.set('status', 'PENDING_CONFIRM')
        order.set('itemTitle', row.title || '商品')
        order.set('price', Number(row.price) || 0)
        order.set('itemImage', row.coverImage || '')
        order.set('payExpireAt', itemLock.toDateField(sellerDeadline))
        savedOrder = await order.save()
      } catch (orderErr) {
        const rollbackRow = await Bmob.Query('Item').get(this.itemId)
        rollbackRow.set('lockBuyers', lockBuyers)
        if (!lockBuyers.length) rollbackRow.unset('lockExpireAt')
        await rollbackRow.save()
        util.hideLoading()
        wx.showModal({
          title: '拍下失败',
          content: '订单创建失败：' + ((orderErr && orderErr.message) || '请稍后重试'),
          showCancel: false
        })
        return
      }

      if (!savedOrder || !savedOrder.objectId) {
        util.hideLoading()
        util.showToast('订单保存异常')
        return
      }

      const memberIds = [sellerId]
      nextLockBuyers.forEach((item) => {
        if (item.buyerId && memberIds.indexOf(item.buyerId) < 0) memberIds.push(item.buyerId)
      })
      await itemLock.syncChatMembers(this.itemId, memberIds)

      notice.notifyOrderEvent(
        sellerId,
        notice.NOTICE_TYPE.ORDER_LOCKED,
        '有新买家拍下商品',
        `买家 ${entry.nickName} 已拍下「${row.title || '商品'}」，请在24小时内选择确认（超时将自动确认首位买家）`,
        savedOrder.objectId,
        this.itemId
      ).catch(() => {})

      util.hideLoading()
      util.showToast('已拍下，等待卖家确认', 'success')
      wx.redirectTo({ url: `/pages/orderDetail/orderDetail?id=${savedOrder.objectId}` })
    } catch (e) {
      util.hideLoading()
      console.error('[onLock] 失败', e)
      wx.showModal({
        title: '拍下失败',
        content: (e && e.message) ? e.message : '请稍后重试',
        showCancel: false
      })
    } finally {
      this.setData({ locking: false })
    }
  },

  // 取消拍下：移除拍下列并取消待确认订单
  async onCancelLock() {
    const ok = await util.showModal('取消拍下', '确认取消拍下该商品吗？')
    if (!ok) return
    try {
      util.showLoading('处理中...')
      const u = auth.getUserInfo()
      const row = await publish.getItem(this.itemId)
      const lockBuyers = itemLock.removeLockBuyer(row.lockBuyers, u.objectId)

      const q = Bmob.Query('Order')
      q.equalTo('itemId', '==', this.itemId)
      q.equalTo('buyerId', '==', u.objectId)
      q.equalTo('status', '==', 'PENDING_CONFIRM')
      q.limit(5)
      const list = await q.find()
      for (const o of (list || [])) {
        const oRow = await Bmob.Query('Order').get(o.objectId)
        oRow.set('status', 'CANCELLED')
        await oRow.save()
      }

      const itemRow = await Bmob.Query('Item').get(this.itemId)
      itemRow.set('lockBuyers', lockBuyers)
      if (!lockBuyers.length) itemRow.unset('lockExpireAt')
      await itemRow.save()

      const sellerId = publish.getSellerId(row)
      const memberIds = [sellerId]
      lockBuyers.forEach((entry) => {
        if (entry.buyerId && memberIds.indexOf(entry.buyerId) < 0) memberIds.push(entry.buyerId)
      })
      await itemLock.syncChatMembers(this.itemId, memberIds)

      util.hideLoading()
      util.showToast('已取消拍下')
      this.loadDetail(this.itemId)
    } catch (e) {
      util.hideLoading()
      util.showToast('操作失败')
    }
  },

  async onSellerConfirmBuyer(e) {
    const buyerId = e.currentTarget.dataset.buyerId
    if (!buyerId) return
    const target = (this.data.sellerLockBuyers || []).find((row) => row.buyerId === buyerId)
    const name = target ? target.nickName : '该买家'
    const ok = await util.showModal('确认卖给TA', `确认将商品卖给 ${name} 吗？确认后其他拍下买家将自动取消，商品将从搜索中隐藏。`)
    if (!ok) return
    try {
      util.showLoading('处理中...')
      await itemLock.confirmBuyerForItem(this.itemId, buyerId)
      util.hideLoading()
      util.showToast('已确认，等待买家付款', 'success')
      this.loadDetail(this.itemId)
    } catch (err) {
      util.hideLoading()
      util.showToast((err && err.message) || '确认失败')
    }
  },

  // 确认付款（仅拍下者可见）
  async onPayFromLock() {
    if (!auth.guardCampusAction({
      tip: '完成校园认证后可付款',
      creditGate: true,
      actionName: '确认付款'
    })) return
    if (this.data.buying) return
    this.setData({ buying: true })
    try {
      util.showLoading('处理中...')
      const row = await publish.getItem(this.itemId)
      if (!row) {
        util.showToast('商品不存在')
        return
      }
      const u = auth.getUserInfo()
      // 检查是否已被付款锁定
      if (row.lockBuyerId && row.lockExpireAt) {
        const expire = new Date(row.lockExpireAt.iso || row.lockExpireAt).getTime()
        if (expire > Date.now()) {
          util.showToast('商品已被其他用户锁定')
          return
        }
      }
      if (row.status !== 'ON_SALE') {
        util.showToast('商品已下架或不可购买')
        return
      }
      const lockBuyers = row.lockBuyers || []
      const hasLocked = lockBuyers.some(item => item.buyerId === u.objectId)
      if (!hasLocked) {
        util.showToast('请先拍下商品')
        return
      }

      let sellerId = ''
      const rawSeller = row.sellerId
      if (typeof rawSeller === 'string') sellerId = rawSeller
      else if (rawSeller && typeof rawSeller === 'object') sellerId = rawSeller.objectId || ''
      if (!sellerId) {
        util.showToast('卖家信息异常')
        return
      }

      const safeImage = (this.data.images && this.data.images.length > 0)
        ? this.data.images[0]
        : 'https://via.placeholder.com/200'

      const expireAt = new Date(Date.now() + 60 * 60 * 1000)

      const order = Bmob.Query('Order')
      order.set('buyerId', u.objectId)
      order.set('sellerId', sellerId)
      order.set('itemId', this.itemId)
      order.set('status', 'PENDING_CONFIRM')
      order.set('itemTitle', row.title || '商品')
      order.set('itemImage', safeImage)
      order.set('price', Number(row.price) || 0)
      order.set('payExpireAt', {
        __type: 'Date',
        iso: expireAt.toISOString()
      })
      const savedOrder = await order.save()

      // 更新商品：付款锁定，清空拍下者，进入交易中
      const itemRow = await Bmob.Query('Item').get(this.itemId)
      itemRow.set('lockBuyerId', u.objectId)
      itemRow.set('lockExpireAt', {
        __type: 'Date',
        iso: expireAt.toISOString()
      })
      itemRow.set('lockBuyers', [])
      itemRow.set('status', 'IN_TRADING')
      await itemRow.save()

      util.hideLoading()
      util.showToast('已付款，等待卖家确认收款', 'success')
      wx.redirectTo({ url: `/pages/orderDetail/orderDetail?id=${savedOrder.objectId}` })
    } catch (e) {
      util.hideLoading()
      console.error(e)
      util.showToast(e.message || '操作失败')
    } finally {
      this.setData({ buying: false })
    }
  },

  // ---------- 以下为原有全部函数，未作任何修改 ----------
  onCopyPhone(e) {
    const phone = e.currentTarget.dataset.phone
    if (!phone) {
      util.showToast('暂无电话')
      return
    }
    wx.setClipboardData({
      data: phone,
      success: () => util.showToast('已复制电话', 'success')
    })
  },

  onEditErrand() {
    if (!auth.guardCampusAction({ tip: '完成校园认证后可管理跑腿' })) return
    const id = this.data.item && this.data.item.objectId
    if (!id) return
    if (this.data.item.status !== 'ON_SALE') {
      util.showToast('仅「未接单」状态可编辑')
      return
    }
    wx.navigateTo({ url: `/pages/errandPublish/errandPublish?id=${id}` })
  },

  onEditItem() {
    if (!auth.guardCampusAction({ tip: '完成校园认证后可编辑商品' })) return
    const id = this.data.item && this.data.item.objectId
    if (!id) return
    wx.navigateTo({ url: `/pages/itemPublish/itemPublish?id=${id}` })
  },

  async onOfflineItem() {
    const ok = await util.showModal('取消发布', '确认下架该商品吗？下架后其他用户将无法看到。')
    if (!ok) return
    try {
      util.showLoading('处理中...')
      await this.setItemStatus('OFFLINE')
      util.hideLoading()
      util.showToast('已下架', 'success')
      this.loadDetail(this.itemId)
    } catch (e) {
      util.hideLoading()
      console.error(e)
      util.showToast('操作失败')
    }
  },

  async setItemStatus(status) {
    const table = this.itemSrc === 'errand' ? 'Errand' : 'Item'
    const row = await Bmob.Query(table).get(this.itemId)
    row.set('status', status)
    await row.save()
  },

  async getActionContext() {
    const u = auth.getUserInfo()
    if (!u || !u.objectId) throw new Error('请先登录')
    const row = await publish.getItem(this.itemId)
    if (!row) throw new Error('商品不存在')
    if (row.postType === publish.POST_TYPE.ERRAND) throw new Error('跑腿任务不支持该操作')
    if (row.status !== 'ON_SALE') throw new Error('商品已下架或不可购买')
    const sellerId = publish.getSellerId(row)
    if (sellerId === u.objectId) throw new Error('不能操作自己发布的商品')
    return { user: u, row, sellerId }
  },

  async findCartRow(userId, itemId) {
    const q = Bmob.Query('Cart')
    q.equalTo('userId', '==', Bmob.Pointer('_User').set(userId))
    q.equalTo('itemId', '==', Bmob.Pointer('Item').set(itemId))
    q.limit(1)
    const list = await q.find()
    return list && list[0]
  },

  async findActiveOrder(userId, itemId) {
    const q = Bmob.Query('Order')
    q.equalTo('buyerId', '==', userId)
    q.equalTo('itemId', '==', itemId)
    q.order('-createdAt')
    q.limit(20)
    const list = await q.find()
    const active = ['PENDING_CONFIRM', 'IN_TRADING']
    return (list || []).find((row) => active.indexOf(row.status) >= 0)
  },

  async onOffline() {
    const ok = await util.showModal('取消跑腿', '取消后任务将不再展示，可稍后重新发布。')
    if (!ok) return
    try {
      util.showLoading('处理中...')
      await this.setItemStatus('OFFLINE')
      util.hideLoading()
      util.showToast('已取消')
      this.loadDetail(this.itemId)
    } catch (err) {
      util.hideLoading()
      util.showToast('操作失败')
    }
  },

  async onOnline() {
    if (!auth.guardCampusAction({
      tip: '完成校园认证后可重新发布',
      creditGate: true,
      actionName: '重新发布'
    })) return
    try {
      util.showLoading('处理中...')
      await this.setItemStatus('ON_SALE')
      util.hideLoading()
      util.showToast('已重新发布')
      this.loadDetail(this.itemId)
    } catch (err) {
      util.hideLoading()
      util.showToast('操作失败')
    }
  },

  async onCompleteErrand() {
    const ok = await util.showModal('标记完成', '确认该跑腿任务已完成？')
    if (!ok) return
    try {
      util.showLoading('处理中...')
      await this.setItemStatus('SOLD_OUT')
      await this.completeRelatedErrandOrder()
      util.hideLoading()
      util.showToast('已标记完成', 'success')
      this.loadDetail(this.itemId)
    } catch (err) {
      util.hideLoading()
      util.showToast('操作失败')
    }
  },

  async completeRelatedErrandOrder() {
    try {
      const q = Bmob.Query('Order')
      q.equalTo('itemId', '==', this.itemId)
      q.equalTo('postType', '==', 'errand')
      q.order('-createdAt')
      q.limit(5)
      const list = await q.find()
      const order = (list || []).find((row) => row.status !== 'CANCELLED')
      if (!order || order.status === 'COMPLETED') return
      const row = await Bmob.Query('Order').get(order.objectId)
      row.set('status', 'COMPLETED')
      await row.save()
      await credit.rewardOrderComplete({ ...order, status: 'COMPLETED' })
    } catch (e) {
      console.warn('跑腿完成信用结算失败', e)
    }
  },

  async onCart() {
    if (!auth.guardCampusAction({
      tip: '完成校园认证后可加入购物车',
      creditGate: true,
      actionName: '加入购物车'
    })) return
    if (this.data.carting) return
    this.setData({ carting: true })
    try {
      const { user, row, sellerId } = await this.getActionContext()
      const existed = await this.findCartRow(user.objectId, this.itemId)
      if (existed) {
        util.showToast('已在购物车中')
        return
      }
      const cart = Bmob.Query('Cart')
      cart.set('userId', Bmob.Pointer('_User').set(user.objectId))
      cart.set('itemId', Bmob.Pointer('Item').set(this.itemId))
      cart.set('sellerId', sellerId)
      cart.set('itemTitle', row.title || '')
      cart.set('itemImage', row.coverImage || '')
      cart.set('price', row.price || 0)
      await cart.save()
      util.showToast('已加入购物车', 'success')
    } catch (e) {
      console.error(e)
      util.showToast(e.message || '加入失败')
    } finally {
      this.setData({ carting: false })
    }
  },

  onContact() {
    if (this.data.carting || this.data.buying) return
    chat.openChatForItem(this.itemId, {
      tip: this.data.isErrand ? '完成校园认证后可联系发布者' : '完成校园认证后可联系卖家',
      src: this.itemSrc
    })
  },

  onReport() {
    if (!this.itemId) {
      util.showToast('请稍候，商品加载中')
      return
    }
    if (!auth.checkLoginStatus()) {
      wx.navigateTo({ url: '/pages/login/login' })
      return
    }
    if (!auth.guardCampusAction({ tip: '完成校园认证后可举报' })) return
    wx.navigateTo({
      url: `/pages/feedback/feedback?mode=report&targetType=Item&targetId=${this.itemId}`
    })
  },

  onContactRunner() {
    if (!auth.guardCampusAction({ tip: '完成校园认证后可联系骑手' })) return
    if (!this.data.hasRunner && !this.data.runnerId) {
      util.showToast('暂无接单人')
      return
    }
    chat.openChatForItem(this.itemId, { tip: '完成校园认证后可联系骑手', src: this.itemSrc })
  },

  onOpenGroupChat() {
    chat.openChatForItem(this.itemId, { tip: '完成校园认证后可进入群聊', src: this.itemSrc })
  },

  async onViewErrandOrder() {
    try {
      util.showLoading('查找订单...')
      const q = Bmob.Query('Order')
      q.equalTo('itemId', '==', this.itemId)
      q.order('-createdAt')
      q.limit(10)
      const list = await q.find()
      util.hideLoading()
      const active = (list || []).find(
        (o) => o.postType === 'errand' && o.status !== 'CANCELLED'
      )
      if (!active) {
        util.showToast('暂无关联订单')
        return
      }
      wx.navigateTo({ url: `/pages/orderDetail/orderDetail?id=${active.objectId}` })
    } catch (e) {
      util.hideLoading()
      console.error('查看订单失败', e)
      util.showToast('查询失败')
    }
  },

  async onViewMyOrder() {
    try {
      util.showLoading('查询中...')
      const u = auth.getUserInfo()
      const q = Bmob.Query('Order')
      q.equalTo('itemId', '==', this.itemId)
      q.equalTo('buyerId', '==', u.objectId)
      q.order('-createdAt')
      q.limit(5)
      const list = await q.find()
      util.hideLoading()
      const active = (list || []).find(o => o.status !== 'CANCELLED')
      if (!active) {
        util.showToast('暂无关联订单')
        return
      }
      wx.navigateTo({ url: `/pages/orderDetail/orderDetail?id=${active.objectId}` })
    } catch (e) {
      util.hideLoading()
      util.showToast('查询失败')
    }
  },

  async onViewGoodsOrder() {
    try {
      util.showLoading('查询中...')
      console.log('[onViewGoodsOrder] itemId:', this.itemId)
      const q = Bmob.Query('Order')
      q.equalTo('itemId', '==', this.itemId)
      q.order('-createdAt')
      q.limit(10)
      const list = await q.find()
      util.hideLoading()
      console.log('[onViewGoodsOrder] 查询结果:', JSON.stringify(list))
      const active = (list || []).find(o => o.status !== 'CANCELLED')
      if (!active) {
        wx.showModal({
          title: '暂无订单',
          content: `查询了 ${(list || []).length} 条记录，均已取消或不存在。itemId=${this.itemId}`,
          showCancel: false
        })
        return
      }
      wx.navigateTo({ url: `/pages/orderDetail/orderDetail?id=${active.objectId}` })
    } catch (e) {
      util.hideLoading()
      console.error('[onViewGoodsOrder] 查看订单失败', e)
      wx.showModal({ title: '查询失败', content: (e && e.message) || JSON.stringify(e), showCancel: false })
    }
  },

  async onAcceptErrand() {
    if (!auth.guardCampusAction({
      tip: '完成校园认证后可接单',
      creditGate: true,
      actionName: '接单'
    })) return
    const ok = await util.showModal('确认接单', '接单后将生成订单，请稍后确认开始任务。')
    if (!ok) return
    try {
      util.showLoading('接单中...')
      const u = auth.getUserInfo()
      const row = await publish.getErrand(this.itemId)
      const sellerId = publish.getSellerId(row)

      await publish.bindRunnerToErrand(this.itemId, u.objectId)

      const order = Bmob.Query('Order')
      order.set('buyerId', sellerId)
      order.set('sellerId', u.objectId)
      order.set('itemId', this.itemId)
      order.set('postType', 'errand')
      order.set('status', 'PENDING_CONFIRM')
      order.set('itemTitle', row.title || '跑腿任务')
      order.set('itemImage', row.coverImage || '')
      order.set('price', row.price || 0)
      const savedOrder = await order.save()

      // 通知发布者有骑手接单
      notice.notifyOrderEvent(
        sellerId,
        notice.NOTICE_TYPE.ERRAND_ACCEPTED,
        '有骑手申请接单',
        `您的跑腿任务「${row.title || '跑腿任务'}」有骑手接单，请进入订单查看详情`,
        savedOrder ? savedOrder.objectId : '',
        this.itemId
      ).catch(() => {})

      util.hideLoading()
      util.showToast('接单成功，请到订单中确认开始任务', 'success')
      await chat.openChatForItem(this.itemId, { tip: '', src: this.itemSrc })
      this.loadDetail(this.itemId)
    } catch (e) {
      util.hideLoading()
      console.error(e)
      util.showToast(e.message || '接单失败')
    }
  }
})
