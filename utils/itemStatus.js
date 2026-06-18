/**
 * Item 状态展示与筛选（物品 / 跑腿共用同一套 status 枚举，文案不同）
 *
 * 跑腿 status 含义：
 *   ON_SALE     → 未接单（待接单）
 *   IN_TRADING  → 已接单（接单同学确认后由订单模块写入，见模块⑤）
 *   SOLD_OUT    → 已完成
 *   OFFLINE     → 已取消
 */
const { POST_TYPE } = require('./publish.js')

const GOODS_META = {
  ON_SALE: { label: '在售', cls: 'tag-status-on' },
  IN_TRADING: { label: '交易中', cls: 'tag-status-trade' },
  SOLD_OUT: { label: '已售出', cls: 'tag-status-sold' },
  OFFLINE: { label: '已下架', cls: 'tag-status-off' },
  DELETED_SOFT: { label: '已删除', cls: 'tag-status-off' }
}

const ERRAND_META = {
  ON_SALE: { label: '未接单', cls: 'tag-errand-wait' },
  IN_TRADING: { label: '已接单', cls: 'tag-errand-taken' },
  SOLD_OUT: { label: '已完成', cls: 'tag-success' },
  OFFLINE: { label: '已取消', cls: 'tag-status-off' },
  DELETED_SOFT: { label: '已删除', cls: 'tag-status-off' }
}

const GOODS_CHIPS = [
  { key: 'all', name: '全部' },
  { key: 'ON_SALE', name: '在售' },
  { key: 'IN_TRADING', name: '交易中' },
  { key: 'SOLD_OUT', name: '已售出' },
  { key: 'OFFLINE', name: '已下架' }
]

const ERRAND_CHIPS = [
  { key: 'all', name: '全部' },
  { key: 'ON_SALE', name: '未接单' },
  { key: 'IN_TRADING', name: '已接单' },
  { key: 'SOLD_OUT', name: '已完成' },
  { key: 'OFFLINE', name: '已取消' }
]

const isErrandType = (postType) => postType === POST_TYPE.ERRAND

const getStatusMeta = (postType, status) => {
  const key = status || 'ON_SALE'
  const map = isErrandType(postType) ? ERRAND_META : GOODS_META
  return map[key] || map.ON_SALE
}

const getStatusChips = (publishTab) =>
  publishTab === 'errand' ? ERRAND_CHIPS : GOODS_CHIPS

/** 首页仅展示「可接单 / 可购买」 */
const isVisibleOnHome = (row) => row && row.status === 'ON_SALE'

module.exports = {
  GOODS_CHIPS,
  ERRAND_CHIPS,
  getStatusMeta,
  getStatusChips,
  isErrandType,
  isVisibleOnHome
}
