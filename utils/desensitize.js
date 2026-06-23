/**
 * desensitize.js — Display-layer masking for sensitive fields.
 * Used when showing another user's contact info (not the user's own data).
 */

/**
 * 13812345678 → 138****5678
 */
function maskPhone(phone) {
  const s = String(phone || '').trim()
  if (s.length < 7) return s ? s[0] + '***' : ''
  return s.slice(0, 3) + '****' + s.slice(-4)
}

/**
 * student@cau.edu.cn → stu***@cau.edu.cn
 */
function maskEmail(email) {
  const s = String(email || '').trim()
  const at = s.indexOf('@')
  if (at < 0) return s ? s.slice(0, 2) + '***' : ''
  const name = s.slice(0, at)
  const domain = s.slice(at)
  if (name.length <= 3) return name[0] + '***' + domain
  return name.slice(0, 3) + '***' + domain
}

/**
 * wxid_abcdefg → wxid****efg
 */
function maskWechat(id) {
  const s = String(id || '').trim()
  if (!s) return ''
  if (s.length <= 4) return s[0] + '***'
  return s.slice(0, 2) + '****' + s.slice(-3)
}

module.exports = { maskPhone, maskEmail, maskWechat }
