const auth = require('../../utils/auth.js')
const util = require('../../utils/util.js')
const publish = require('../../utils/publish.js')
const sysConfig = require('../../utils/sysConfig.js')
const cloudImage = require('../../utils/cloudImage.js')

Page({
  data: {
    editId: '',
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
      if (row.images) {
        try {
          images = typeof row.images === 'string' ? JSON.parse(row.images) : row.images
        } catch (e) {
          images = row.coverImage ? [row.coverImage] : []
        }
      } else if (row.coverImage) {
        images = [row.coverImage]
      }
      images = await cloudImage.resolveImageUrls(images)
      const cat = row.category || publish.GOODS_CATEGORIES[0]
      const categoryIndex = Math.max(0, publish.GOODS_CATEGORIES.indexOf(cat))
      this.setData({
        categoryIndex,
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
    const { form, submitting } = this.data
    const t = (form.title || '').trim()
    const d = (form.description || '').trim()
    const p = parseFloat(form.price)
    const ok =
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

  async onSubmit() {
    if (!auth.guardCampusAction({
      tip: '完成校园认证后可发布物品',
      creditGate: !this.data.editId,
      actionName: '发布物品'
    })) {
      return
    }
    if (!this.validateForm()) return
    const { form, editId } = this.data
    const price = parseFloat(form.price)
    const coverImage = form.images[0]
    const imagesJson = JSON.stringify(form.images)

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
          images: imagesJson
        },
        editId || undefined
      )
      util.hideLoading()
      util.showToast(editId ? '保存成功' : '发布成功', 'success')
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
