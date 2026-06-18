/**
 * 微信云开发配置（全员共用同一环境 ID）
 *
 * 开通步骤见 docs/数据存储与配置说明.md
 * 从微信开发者工具 → 云开发 → 设置 → 环境 ID 复制后粘贴到下方。
 */
const CLOUD_ENV_ID = 'cloud1-d3gw967ood48ca1e4'

/** true：发布页图片走云存储；false：走 Bmob.File（需绑定文件域名） */
const CLOUD_STORAGE_ENABLED = true

module.exports = {
  CLOUD_ENV_ID,
  CLOUD_STORAGE_ENABLED
}
