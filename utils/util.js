/**
 * 通用工具函数
 */

const pad = (n) => (n < 10 ? `0${n}` : `${n}`)

const formatTime = (date) => {
  const d = date instanceof Date ? date : new Date(date)
  const Y = d.getFullYear()
  const M = pad(d.getMonth() + 1)
  const D = pad(d.getDate())
  const h = pad(d.getHours())
  const m = pad(d.getMinutes())
  const s = pad(d.getSeconds())
  return `${Y}-${M}-${D} ${h}:${m}:${s}`
}

const showToast = (title, icon = 'none') => {
  wx.showToast({ title, icon, duration: 2000 })
}

const showLoading = (title = '加载中...') => {
  wx.showLoading({ title, mask: true })
}

const hideLoading = () => {
  wx.hideLoading()
}

const showModal = (title, content) =>
  new Promise((resolve) => {
    wx.showModal({
      title,
      content,
      success: (res) => resolve(res.confirm),
      fail: () => resolve(false)
    })
  })

const validateEmail = (email) => {
  if (!email || typeof email !== 'string') return false
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!re.test(email)) return false
  return email.toLowerCase().endsWith('.edu.cn')
}

const validatePhone = (phone) => /^1\d{10}$/.test(phone || '')

module.exports = {
  formatTime,
  showToast,
  showLoading,
  hideLoading,
  showModal,
  validateEmail,
  validatePhone
}
