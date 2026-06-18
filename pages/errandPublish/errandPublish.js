const auth = require('../../utils/auth.js')
const util = require('../../utils/util.js')
const publish = require('../../utils/publish.js')
const sysConfig = require('../../utils/sysConfig.js')
const cloudImage = require('../../utils/cloudImage.js')

const pad = (n) => (n < 10 ? '0' + n : '' + n)

const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

Page({
  data: {
    editId: '',
    errandCategories: publish.ERRAND_CATEGORIES,
    errandCategoryIndex: 0,
    form: {
      title: '',
      errandCategory: publish.ERRAND_CATEGORIES[0],
      description: '',
      reward: '',
      pickupAddr: '',
      deliveryAddr: '',
      deadline: '',
      contactPhone: '',
      images: []
    },
    deadlineDate: '',
    deadlineTime: '',
    minDate: todayStr(),
    rewardPresets: [3, 5, 10, 20],
    pickupPresets: ['东区快递站', '西区快递站', '食堂', '图书馆'],
    uploading: false,
    submitting: false,
    errors: {},
    canSubmit: false
  },

  onBack() {
    util.goBack()
  },

  async initCategories() {
    try {
      await sysConfig.ensureLoaded()
      const errandCategories = sysConfig.getErrandCategories()
      if (errandCategories.length) {
        this.setData({
          errandCategories,
          'form.errandCategory': errandCategories[0]
        })
      }
    } catch (e) {
      console.warn('initCategories', e)
    }
  },

  onLoad(options) {
    this.initCategories()
    const id = options && options.id
    if (!auth.guardCampusAction({
      tip: '完成校园认证后可发布跑腿',
      creditGate: !id,
      actionName: '发布跑腿'
    })) {
      setTimeout(() => wx.navigateBack(), 300)
      return
    }
    wx.setNavigationBarTitle({
      title: options && options.id ? '编辑跑腿' : '发布跑腿'
    })
    if (id) {
      this.setData({ editId: id })
      this.loadItem(id)
    }
  },

  parseDeadline(str) {
    if (!str) return { date: '', time: '' }
    const m = String(str).match(/^(\d{4}-\d{2}-\d{2})\s*(\d{1,2}:\d{2})?/)
    if (m) {
      return { date: m[1], time: m[2] || '18:00' }
    }
    return { date: '', time: '' }
  },

  buildDeadline() {
    const { deadlineDate, deadlineTime } = this.data
    if (!deadlineDate) return ''
    return `${deadlineDate} ${deadlineTime || '23:59'}`
  },

  async loadItem(id) {
    try {
      util.showLoading('加载中...')
      const row = await publish.getItem(id)
      util.hideLoading()
      if (!row || row.postType !== publish.POST_TYPE.ERRAND) {
        util.showToast('记录不存在或类型不匹配')
        setTimeout(() => wx.navigateBack(), 800)
        return
      }
      if (row.status && row.status !== 'ON_SALE') {
        util.showToast('仅「未接单」状态可编辑')
        setTimeout(() => wx.navigateBack(), 800)
        return
      }
      let images = []
      if (row.images) {
        try {
          images =
            typeof row.images === 'string' ? JSON.parse(row.images) : row.images
        } catch (e) {
          images = row.coverImage ? [row.coverImage] : []
        }
      } else if (row.coverImage) {
        images = [row.coverImage]
      }
      images = await cloudImage.resolveImageUrls(images)
      const dl = this.parseDeadline(row.deadline)
      const contactPhone =
        row.contactPhone ||
        publish.parseContactFromDescription(row.description) ||
        ''
      const errandCategory =
        publish.ERRAND_CATEGORIES.indexOf(row.errandCategory) >= 0
          ? row.errandCategory
          : publish.ERRAND_CATEGORIES[0]
      this.setData({
        errandCategoryIndex: Math.max(
          0,
          publish.ERRAND_CATEGORIES.indexOf(errandCategory)
        ),
        form: {
          title: row.title || '',
          errandCategory,
          description: publish.stripContactFromDescription(row.description || ''),
          reward: row.price != null ? String(row.price) : '',
          pickupAddr: row.pickupAddr || '',
          deliveryAddr: row.deliveryAddr || '',
          deadline: row.deadline || '',
          contactPhone,
          images
        },
        deadlineDate: dl.date,
        deadlineTime: dl.time
      })
      this.updateCanSubmit()
    } catch (e) {
      util.hideLoading()
      console.error(e)
      util.showToast('加载失败')
    }
  },

  validateField(key) {
    const { form } = this.data
    const errors = { ...this.data.errors }
    if (key === 'title') {
      const t = (form.title || '').trim()
      errors.title = t.length < 2 ? '标题至少 2 个字' : ''
    }
    if (key === 'reward') {
      const r = parseFloat(form.reward)
      errors.reward =
        form.reward === '' || Number.isNaN(r) || r < 0 ? '请输入有效赏金' : ''
    }
    if (key === 'description') {
      errors.description =
        (form.description || '').trim().length < 5 ? '说明至少 5 个字' : ''
    }
    if (key === 'pickupAddr') {
      errors.pickupAddr = !(form.pickupAddr || '').trim() ? '请填写取件地点' : ''
    }
    if (key === 'deliveryAddr') {
      errors.deliveryAddr = !(form.deliveryAddr || '').trim()
        ? '请填写送达地点'
        : ''
    }
    if (key === 'deadline') {
      errors.deadline = !this.buildDeadline() ? '请选择期望完成时间' : ''
    }
    this.setData({ errors })
    this.updateCanSubmit()
  },

  updateCanSubmit() {
    const { form, submitting } = this.data
    const t = (form.title || '').trim()
    const d = (form.description || '').trim()
    const r = parseFloat(form.reward)
    const ok =
      t.length >= 2 &&
      d.length >= 5 &&
      !Number.isNaN(r) &&
      r >= 0 &&
      (form.pickupAddr || '').trim() &&
      (form.deliveryAddr || '').trim() &&
      !!this.buildDeadline() &&
      !submitting
    this.setData({ canSubmit: ok })
  },

  onTitle(e) {
    this.setData({ 'form.title': e.detail.value })
    this.updateCanSubmit()
  },
  onTitleBlur() {
    this.validateField('title')
  },
  onErrandCategoryChange(e) {
    const i = Number(e.detail.value)
    this.setData({
      errandCategoryIndex: i,
      'form.errandCategory': publish.ERRAND_CATEGORIES[i]
    })
  },
  onDesc(e) {
    this.setData({ 'form.description': e.detail.value })
    this.updateCanSubmit()
  },
  onDescBlur() {
    this.validateField('description')
  },
  onReward(e) {
    this.setData({ 'form.reward': e.detail.value })
    this.updateCanSubmit()
  },
  onRewardBlur() {
    this.validateField('reward')
  },
  onRewardPreset(e) {
    this.setData({ 'form.reward': String(e.currentTarget.dataset.val) })
    this.validateField('reward')
    this.updateCanSubmit()
  },
  onPickup(e) {
    this.setData({ 'form.pickupAddr': e.detail.value })
    this.updateCanSubmit()
  },
  onPickupBlur() {
    this.validateField('pickupAddr')
  },
  onPickupPreset(e) {
    this.setData({ 'form.pickupAddr': e.currentTarget.dataset.val })
    this.validateField('pickupAddr')
    this.updateCanSubmit()
  },
  onDelivery(e) {
    this.setData({ 'form.deliveryAddr': e.detail.value })
    this.updateCanSubmit()
  },
  onDeliveryBlur() {
    this.validateField('deliveryAddr')
  },
  onDeadlineDate(e) {
    this.setData({ deadlineDate: e.detail.value })
    this.validateField('deadline')
    this.updateCanSubmit()
  },
  onDeadlineTime(e) {
    const time = e.detail.value
    const { deadlineDate, minDate } = this.data
    // 如果选的是今天，时间不能早于当前时间
    if (deadlineDate === minDate) {
      const now = new Date()
      const pad = (n) => (n < 10 ? '0' + n : '' + n)
      const nowTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`
      if (time < nowTime) {
        util.showToast('截止时间不能早于当前时间')
        const minTime = `${pad(now.getHours())}:${pad(now.getMinutes() + 1)}`
        this.setData({ deadlineTime: minTime })
        this.validateField('deadline')
        this.updateCanSubmit()
        return
      }
    }
    this.setData({ deadlineTime: time })
    this.validateField('deadline')
    this.updateCanSubmit()
  },
  onPhone(e) {
    this.setData({ 'form.contactPhone': e.detail.value })
  },

  async onAddImage() {
    const { form, uploading } = this.data
    const images = (form && form.images) || []
    if (uploading) return
    if (images.length >= 3) {
      util.showToast('跑腿最多 3 张附图')
      return
    }
    this.setData({ uploading: true })
    try {
      util.showLoading('上传中...')
      const urls = await publish.chooseAndUploadImages(images.length, 3)
      util.hideLoading()
      if (!urls.length) return
      this.setData({ 'form.images': images.concat(urls) })
    } catch (e) {
      util.hideLoading()
      if (e && e.errMsg && e.errMsg.indexOf('cancel') >= 0) return
      console.error(e)
      util.showToast((e && e.message) || '上传失败')
    } finally {
      this.setData({ uploading: false })
    }
  },

  onRemoveImage(e) {
    const index = e.currentTarget.dataset.index
    const images = this.data.form.images.slice()
    images.splice(index, 1)
    this.setData({ 'form.images': images })
  },

  validateForm() {
    ;['title', 'reward', 'description', 'pickupAddr', 'deliveryAddr', 'deadline'].forEach(
      (k) => this.validateField(k)
    )
    const { errors } = this.data
    if (
      errors.title ||
      errors.reward ||
      errors.description ||
      errors.pickupAddr ||
      errors.deliveryAddr ||
      errors.deadline
    ) {
      util.showToast('请完善表单后再提交')
      return false
    }
    return true
  },

  async onSubmit() {
    if (!auth.guardCampusAction({
      tip: '完成校园认证后可发布跑腿',
      creditGate: !this.data.editId,
      actionName: '发布跑腿'
    })) {
      return
    }
    if (!this.validateForm()) return
    const { form, editId } = this.data
    const price = parseFloat(form.reward)
    const deadline = this.buildDeadline()
    const coverImage = form.images[0] || ''
    const imagesJson = form.images.length ? JSON.stringify(form.images) : '[]'
    const contactPhone = (form.contactPhone || '').trim()

    this.setData({ submitting: true })
    try {
      util.showLoading('提交中...')
      const descWithPhone = contactPhone
        ? `${form.description.trim()}\n联系电话：${contactPhone}`
        : form.description.trim()
      await publish.saveItem(
        {
          postType: publish.POST_TYPE.ERRAND,
          title: form.title.trim(),
          description: descWithPhone,
          price,
          category: '跑腿',
          errandCategory: form.errandCategory,
          pickupAddr: form.pickupAddr.trim(),
          deliveryAddr: form.deliveryAddr.trim(),
          deadline,
          coverImage: coverImage || undefined,
          images: imagesJson,
          status: editId ? undefined : 'ON_SALE'
        },
        editId || undefined
      )
      util.hideLoading()
      util.showToast(editId ? '保存成功' : '发布成功，等待接单', 'success')
      setTimeout(() => {
        if (editId) wx.navigateBack()
        else {
          wx.redirectTo({ url: '/pages/my/myItems/myItems?tab=errand' })
        }
      }, 600)
    } catch (e) {
      util.hideLoading()
      console.error(e)
      util.showToast((e && e.message) || '提交失败')
    } finally {
      this.setData({ submitting: false })
      this.updateCanSubmit()
    }
  }
})
