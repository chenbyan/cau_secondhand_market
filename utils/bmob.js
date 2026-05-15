/**
 * Bmob hydrogen-js-sdk 初始化（require 时执行一次）
 * 请在微信开发者工具中：工具 → 构建 npm，使 miniprogram_npm 生效
 *
 * 若登录请求返回 400：「用户设置的 safeToken 为空」：
 * 1）登录 Bmob 控制台 → 你的应用 → 设置 → 安全验证 → 「API 安全码」：必须先自行设置并保存；
 * 2）将下方 API_SAFE_CODE 改成与控制台里保存的 API 安全码完全一致（不是 REST API Key，也不是微信 AppSecret）；
 * 3）第一项为应用的 Secret Key（应用密钥），勿与第二项填反。
 */
const Bmob = require('hydrogen-js-sdk')

const SECRET_KEY = 'adfd024460d06ae8'
const API_SAFE_CODE = '0906'

if (!SECRET_KEY || !API_SAFE_CODE) {
  console.error('[Bmob] 请在 utils/bmob.js 中填写 SECRET_KEY 与 API_SAFE_CODE')
} else if (API_SAFE_CODE.length < 8) {
  console.warn(
    '[Bmob] API 安全码通常较长；若控制台已设为更长字符串，请把此处改成与控制台完全一致，否则会 400 safeToken 为空'
  )
}

Bmob.initialize(SECRET_KEY, API_SAFE_CODE)

module.exports = Bmob
