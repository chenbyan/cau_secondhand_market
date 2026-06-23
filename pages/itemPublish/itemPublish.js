const auth = require('../../utils/auth.js')
const util = require('../../utils/util.js')
const publish = require('../../utils/publish.js')
const sysConfig = require('../../utils/sysConfig.js')
const cloudImage = require('../../utils/cloudImage.js')

Page({
  data: {
    editId: '',
    rectifyRequired: false,
    adminOfflineRectify: false,
    relistPendingReview: false,
    rectifyReason: '',
    categories: publish.GOODS_CATEGORIES,
    categoryIndex: 0,
    form: {
      title: '',
      description: '',
      price: '',
      category: publish.GOODS_CATEGORIES[0],
      images: []
    },
    uploading: false,
    submitting: false,
    errors: {},
    canSubmit: false
  },

  onBack() {
    util.goBack()
  },

  onLoad(options) {
    const id = options && options.id
    if (!auth.guardCampusAction({
      tip: '完成校园认证后可发布物品',
      creditGate: !id,
      actionName: '发布物品'
    })) {
      setTimeout(() => wx.navigateBack(), 300)
      return
    }
    if (!auth.checkPhoneSet()) {
      wx.showModal({
        title: '手机号必填',
        content: '发布物品需要手机号供买家联系，请先完善个人信息',
        confirmText: '去填写',
        showCancel: false,
        success: () => wx.redirectTo({ url: '/pages/my/mySetting/mySetting' })
      })
      return
    }
    this.initCategories()
    if (id) {
      this.setData({ editId: id })
      wx.setNavigationBarTitle({ title: '编辑物品' })
      this.loadItem(id)
    }
  },

  async initCategories() {
    try {
      await sysConfig.ensureLoaded()
      const categories = sysConfig.getGoodsCategories()
      if (categories.length) {
        this.setData({
          categories,
          'form.category': categories[0]
        })
      }
    } catch (e) {
      console.warn('initCategories', e)
    }
  },

  async loadItem(id) {
    try {
      util.showLoading('加载中...')
      const row = await publish.getItem(id)
      util.hideLoading()
      if (!row || row.postType === publish.POST_TYPE.ERRAND) {
        util.showToast('记录不存在或类型不匹配')
        setTimeout(() => wx.navigateBack(), 800)
        return
      }
      let images = []
      let rawImages = []
      if (row.images) {
        try {
          const parsed = typeof row.images === 'string' ? JSON.parse(row.images) : row.images
          rawImages = Array.isArray(parsed) ? parsed.map(String) : []
          images = rawImages.slice()
        } catch (e) {
          rawImages = row.coverImage ? [String(row.coverImage)] : []
          images = rawImages.slice()
        }
      } else if (row.coverImage) {
        rawImages = [String(row.coverImage)]
        images = rawImages.slice()
      }
      images = await cloudImage.resolveImageUrls(images)
      const cat = row.category || publish.GOODS_CATEGORIES[0]
      const categoryIndex = Math.max(0, publish.GOODS_CATEGORIES.indexOf(cat))
      const rectifyRequired = !!(row.rectifyRequired && row.status === 'OFFLINE')
      this._rectifyRequired = rectifyRequired
      this._reportRectify = false
      this._adminOfflineRectify = false
      this._rawImages = rawImages
      this._rectifySnapshot = {
        title: (row.title || '').trim(),
        description: (row.description || '').trim(),
        price: Number(row.price) || 0,
        category: cat
      }
      let rectifyReason = ''
      let adminOfflineRectify = false
      let relistPendingReview = false
      if (rectifyRequired) {
        rectifyReason = row.rectifyReason || ''
      } else if (row.status === 'OFFLINE') {
        const itemRectify = require('../../utils/itemRectify.js')
        const reportInfo = await itemRectify.getRectifyInfoForItem(id)
        const adminInfo = await itemRectify.getAdminOfflineInfoForItem(id)
        if (reportInfo) {
          this._rectifyRequired = true
          this._reportRectify = true
          rectifyReason = reportInfo.reason || ''
        } else if (adminInfo) {
          this._rectifyRequired = true
          this._adminOfflineRectify = true
          adminOfflineRectify = true
          relistPendingReview = !!adminInfo.pendingReview
          rectifyReason = adminInfo.reason || ''
        }
      }
      this.setData({
        categoryIndex,
        rectifyRequired: this._rectifyRequired,
        adminOfflineRectify,
        relistPendingReview,
        rectifyReason,
        form: {
          title: row.title || '',
          description: row.description || '',
          price: row.price != null ? String(row.price) : '',
          category: cat,
          images
        }
      })
      this.updateCanSubmit()
    } catch (e) {
      util.hideLoading()
      console.error(e)
      util.showToast('加载失败')
    }
  },

  onTitle(e) {
    this.setData({ 'form.title': e.detail.value })
    this.updateCanSubmit()
  },
  onTitleBlur() {
    this.validateField('title')
  },
  onDesc(e) {
    this.setData({ 'form.description': e.detail.value })
    this.updateCanSubmit()
  },
  onDescBlur() {
    this.validateField('description')
  },
  onPrice(e) {
    this.setData({ 'form.price': e.detail.value })
    this.updateCanSubmit()
  },
  onPriceBlur() {
    this.validateField('price')
  },
  onCategoryChange(e) {
    const i = Number(e.detail.value)
    this.setData({
      categoryIndex: i,
      'form.category': publish.GOODS_CATEGORIES[i]
    })
  },

  async onAddImage() {
    const { form, uploading } = this.data
    const images = (form && form.images) || []
    if (uploading) return
    if (images.length >= 6) {
      util.showToast('最多上传 6 张图片')
      return
    }
    this.setData({ uploading: true })
    try {
      util.showLoading('上传中...')
      const urls = await publish.chooseAndUploadImages(images.length, 6)
      util.hideLoading()
      if (!urls.length) return
      this.setData({ 'form.images': images.concat(urls) })
      this.validateField('images')
      this.updateCanSubmit()
    } catch (e) {
      util.hideLoading()
      if (e && e.errMsg && e.errMsg.indexOf('cancel') >= 0) return
      console.error(e)
      const tip =
        (e && e.message) ||
        (e && e.errMsg) ||
        '上传失败，请确认已登录且详情里勾选不校验合法域名'
      util.showToast(tip)
    } finally {
      this.setData({ uploading: false })
    }
  },

  onRemoveImage(e) {
    const index = e.currentTarget.dataset.index
    const images = this.data.form.images.slice()
    images.splice(index, 1)
    this.setData({ 'form.images': images })
    this.validateField('images')
    this.updateCanSubmit()
  },

  validateField(key) {
    const { form } = this.data
    const errors = { ...this.data.errors }
    if (key === 'title') {
      const t = (form.title || '').trim()
      errors.title =
        t.length < 2 ? '标题至少 2 个字' : t.length > 40 ? '标题不超过 40 字' : ''
    }
    if (key === 'price') {
      const p = parseFloat(form.price)
      errors.price =
        form.price === '' || Number.isNaN(p) || p < 0 ? '请输入有效价格' : ''
    }
    if (key === 'description') {
      const d = (form.description || '').trim()
      errors.description = d.length < 5 ? '描述至少 5 个字' : ''
    }
    if (key === 'images') {
      errors.images = !form.images.length ? '请至少上传 1 张图片' : ''
    }
    this.setData({ errors })
    this.updateCanSubmit()
  },

  updateCanSubmit() {
    const { form, submitting, relistPendingReview } = this.data
    const t = (form.title || '').trim()
    const d = (form.description || '').trim()
    const p = parseFloat(form.price)
    const ok =
      !relistPendingReview &&
      t.length >= 2 &&
      t.length <= 40 &&
      d.length >= 5 &&
      !Number.isNaN(p) &&
      p >= 0 &&
      form.images.length > 0 &&
      !submitting
    this.setData({ canSubmit: ok })
  },

  validateForm() {
    ;['title', 'price', 'description', 'images'].forEach((k) =>
      this.validateField(k)
    )
    const { errors } = this.data
    if (errors.title || errors.price || errors.description || errors.images) {
      util.showToast('请完善表单后再提交')
      return false
    }
    return true
  },

  imagesWereEdited(rawImages, formImages) {
    const raw = rawImages || []
    const form = formImages || []
    if (form.length !== raw.length) return true
    for (let i = 0; i < form.length; i++) {
      const next = String(form[i] || '')
      const prev = String(raw[i] || '')
      if (!next || !prev) return true
      if (next === prev) continue
      if (cloudImage.isCloudFileId(prev) && !cloudImage.isCloudFileId(next)) continue
      if (cloudImage.isCloudFileId(next) && next !== prev) return true
      if (!cloudImage.isCloudFileId(next) && !cloudImage.isCloudFileId(prev) && next !== prev) {
        return true
      }
    }
    return false
  },

  hasRectifyChanges() {
    const { form } = this.data
    const snapshot = this._rectifySnapshot || {}
    if ((form.title || '').trim() !== snapshot.title) return true
    if ((form.description || '').trim() !== snapshot.description) return true
    if (parseFloat(form.price) !== snapshot.price) return true
    if (form.category !== snapshot.category) return true
    return this.imagesWereEdited(this._rawImages, form.images)
  },

  buildImagesForSave(formImages) {
    const raw = this._rawImages || []
    return (formImages || []).map((url, index) => {
      const next = String(url || '')
      if (cloudImage.isCloudFileId(next)) return next
      if (raw[index] && cloudImage.isCloudFileId(raw[index])) return raw[index]
      return next
    })
  },

  async onSubmit() {
    if (this.data.relistPendingReview) {
      util.showToast('已提交审核，请等待管理员通过')
      return
    }
    if (!auth.guardCampusAction({
      tip: '完成校园认证后可发布物品',
      creditGate: !this.data.editId,
      actionName: '发布物品'
    })) {
      return
    }
    if (!this.validateForm()) return
    if (this._rectifyRequired && !this.hasRectifyChanges()) {
      util.showToast('请先修改标题、描述、图片或价格后再提交')
      return
    }
    const { form, editId } = this.data
    const price = parseFloat(form.price)
    const imagesForSave = this.buildImagesForSave(form.images)
    const coverImage = imagesForSave[0]
    const imagesJson = JSON.stringify(imagesForSave)
    const relistFields = {}
    if (this._rectifyRequired && this._reportRectify) {
      relistFields.status = 'ON_SALE'
    }

    this.setData({ submitting: true })
    try {
      util.showLoading('提交中...')
      await publish.saveItem(
        {
          postType: publish.POST_TYPE.GOODS,
          title: form.title.trim(),
          description: form.description.trim(),
          price,
          category: form.category,
          coverImage,
          images: imagesJson,
          ...relistFields
        },
        editId || undefined
      )
      if (this._adminOfflineRectify) {
        const itemRectify = require('../../utils/itemRectify.js')
        await itemRectify.markRelistPendingReview(editId)
        util.hideLoading()
        util.showToast('已提交审核，请等待管理员通过后上架', 'success')
      } else {
        util.hideLoading()
        util.showToast(
          this._rectifyRequired ? '整改完成，已重新上架' : editId ? '保存成功' : '发布成功',
          'success'
        )
      }
      setTimeout(() => {
        if (editId) wx.navigateBack()
        else wx.redirectTo({ url: '/pages/my/myItems/myItems' })
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
