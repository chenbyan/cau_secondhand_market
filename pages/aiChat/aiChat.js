const ai = require('../../utils/ai.js');
const auth = require('../../utils/auth.js');
const Bmob = require('../../utils/bmob.js');
const orderNotify = require('../../utils/orderNotify.js');

// 本地知识库（关键词 → 答案）
const LOCAL_FAQ = {
  '如何发布商品': '点击底部「发布」按钮，选择「物品发布」或「跑腿发布」，填写信息并上传图片后提交即可。',
  '发布商品': '点击底部「发布」按钮，选择「物品发布」或「跑腿发布」，填写信息并上传图片后提交即可。',
  '交易流程': '买家下单后需确认付款 → 卖家确认出货 → 买家确认收货（或卖家确认收款）→ 交易完成。',
  '如何校园认证': '在「我的」→「校园认证」中输入您的edu邮箱，获取验证码即可完成认证。',
  '校园认证': '在「我的」→「校园认证」中输入您的edu邮箱，获取验证码即可完成认证。',
  '账号冻结': '如果账号被冻结，请联系管理员或发送邮件至 help@campus2.com 说明情况。',
  '账号被冻结': '如果账号被冻结，请联系管理员或发送邮件至 help@campus2.com 说明情况。',
  '联系卖家': '在商品详情页点击「联系」按钮，可进入该商品群聊与卖家沟通。',
  '如何联系卖家': '在商品详情页点击「联系」按钮，可进入该商品群聊与卖家沟通。',
  '退款': '本平台为校内信息撮合工具，不涉及资金链路。若发生交易纠纷，建议双方友好协商，或通过「订单申诉」功能处理。',
  '怎么退款': '本平台为校内信息撮合工具，不涉及资金链路。若发生交易纠纷，建议双方友好协商，或通过「订单申诉」功能处理。',
  '运费': '校内交易以自提/面交为主，不涉及运费。若涉及跑腿任务，费用已在赏金中体现，无额外运费。',
  '包邮吗': '校内交易以自提/面交为主，不涉及运费。',
  '面交': '建议在校园内公共区域当面交易，验货确认后再确认收货或付款。',
  '如何确认收货': '在订单详情页点击「确认收货」按钮即可。',
  '确认收款': '卖家在订单详情页点击「确认收款」即可完成交易，商品将自动标记为已售出。',
  '跑腿': '跑腿任务可在首页或分类中查找，点击进入详情页后可联系发布者或接单。',
  '拍下': '在商品详情页点击「拍下」按钮，即可表达购买意向。拍下后请在1小时内确认付款，否则商品将释放。',
  '怎么拍下': '在商品详情页点击「拍下」按钮，即可表达购买意向。拍下后请在1小时内确认付款，否则商品将释放。',
  '订单取消': '在订单详情页点击「取消订单」按钮即可。注意：仅交易中之前的订单可取消，已付款锁定后需卖家确认收款或超时自动取消。'
};

// 可点击链接规则（正则 → 跳转路径）
const LINK_RULES = [
  { pattern: /(?:点击|进入|打开)?\s*「?发布」?\s*(?:按钮|页面)?/g, url: '/pages/publishHub/publishHub', text: '发布页面' },
  { pattern: /「?我的」?/g, url: '/pages/my/my', text: '我的' },
  { pattern: /(?:校园认证|认证页面)/g, url: '/pages/my/campusVerify/campusVerify', text: '校园认证' },
  { pattern: /(?:购物车|购物车页面)/g, url: '/pages/my/myCart/myCart', text: '购物车' },
  { pattern: /(?:我买到的|我买到的订单)/g, url: '/pages/my/myOrders/myOrders?type=buy', text: '我买到的' },
  { pattern: /(?:我卖出的|我卖出的订单)/g, url: '/pages/my/myOrders/myOrders?type=sell', text: '我卖出的' },
  { pattern: /(?:订单详情|订单页面)/g, url: '/pages/my/myOrders/myOrders?type=buy', text: '订单列表' },
  { pattern: /(?:联系卖家|联系|聊天)/g, url: '/pages/publishHub/publishHub?type=all', text: '商品搜索' },
  { pattern: /(?:搜索|找商品)/g, url: '/pages/publishHub/publishHub?type=all', text: '搜索商品' }
];

/**
 * 清理AI回复中多余的符号（例如 * #）
 */
function cleanReply(text) {
  if (!text) return '';
  return text.replace(/[*#]/g, '').trim();
}

/**
 * 将回复文本解析为可点击节点数组
 */
function parseReplyToNodes(replyText) {
  if (!replyText) return [{ type: 'text', text: '' }];

  const matches = [];
  LINK_RULES.forEach(rule => {
    let match;
    while ((match = rule.pattern.exec(replyText)) !== null) {
      matches.push({
        start: match.index,
        end: rule.pattern.lastIndex,
        url: rule.url,
        displayText: match[0]
      });
    }
  });

  if (matches.length === 0) {
    return [{ type: 'text', text: replyText }];
  }

  matches.sort((a, b) => a.start - b.start);

  const nodes = [];
  let lastIndex = 0;

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    if (m.start < lastIndex) continue;

    if (m.start > lastIndex) {
      nodes.push({ type: 'text', text: replyText.slice(lastIndex, m.start) });
    }
    nodes.push({ type: 'link', text: m.displayText, url: m.url });
    lastIndex = m.end;
  }

  if (lastIndex < replyText.length) {
    nodes.push({ type: 'text', text: replyText.slice(lastIndex) });
  }

  return nodes;
}

/**
 * 处理回复：清理文本并生成富文本节点
 */
function processReply(rawText) {
  const cleaned = cleanReply(rawText);
  return parseReplyToNodes(cleaned);
}

Page({
  data: {
    messages: [
      {
        role: 'bot',
        content: '你好，我是校园二手交易助手。你可以点击下方关键词快速提问，也可以直接输入问题。\n常用入口：👉 发布商品  👉 我的订单  👉 购物车  👉 校园认证',
        nodes: processReply('你好，我是校园二手交易助手。你可以点击下方关键词快速提问，也可以直接输入问题。\n常用入口：👉 发布商品  👉 我的订单  👉 购物车  👉 校园认证')
      }
    ],
    inputText: '',
    loading: false,
    scrollToView: 'bottom',
    quickWords: [
      '如何发布商品',
      '交易流程',
      '校园认证',
      '账号冻结',
      '联系卖家',
      '退款',
      '运费',
      '面交',
      '拍下',
      '订单取消',
      '我的订单'
    ]
  },

  onShow() {
    this.checkOrderUpdates();
  },

  onInput(e) {
    this.setData({ inputText: e.detail.value });
  },

  onQuickWordTap(e) {
    const word = e.currentTarget.dataset.word;
    this.sendMsgByWord(word);
  },

  sendMsg() {
    const text = this.data.inputText.trim();
    if (!text) return;
    this.sendMsgByWord(text);
  },

  sendMsgByWord(word) {
    if (!word || this.data.loading) return;
    const userMsg = { role: 'user', content: word };
    const messages = [...this.data.messages, userMsg];
    this.setData({ messages, inputText: '', loading: true, scrollToView: 'bottom' });

    if (this.isOrderIntent(word)) {
      this.handleOrderQuery(word, messages);
      return;
    }

    const reply = this.matchLocal(word);
    if (reply) {
      const nodes = processReply(reply);
      messages.push({ role: 'bot', content: reply, nodes });
      this.setData({ messages, loading: false, scrollToView: 'bottom' });
    } else {
      this.callAI(word, messages);
    }
  },

  isOrderIntent(input) {
    const keywords = ['订单', '我买的', '我卖出的', '我的订单', '买东西', '卖东西', '购买记录', '卖出记录'];
    return keywords.some(k => input.includes(k));
  },

  async handleOrderQuery(word, messages) {
    if (!auth.checkLoginStatus()) {
      messages.push({ role: 'bot', content: '请先登录后再查询订单信息。' });
      this.setData({ messages, loading: false });
      return;
    }

    const u = auth.getUserInfo();
    if (!u || !u.objectId) {
      messages.push({ role: 'bot', content: '获取用户信息失败，请重新登录。' });
      this.setData({ messages, loading: false });
      return;
    }

    const isBuy = /我买的|买家|买东西|购买|买的/.test(word);
    const isSell = /我卖出的|卖家|卖东西|卖出|卖的/.test(word);

    try {
      const query = Bmob.Query('Order');
      if (isBuy && !isSell) {
        query.equalTo('buyerId', '==', u.objectId);
      } else if (isSell && !isBuy) {
        query.equalTo('sellerId', '==', u.objectId);
      } else {
        query.equalTo('buyerId', '==', u.objectId);
      }
      query.order('-createdAt');
      query.limit(5);
      const orders = await query.find();

      const statusMap = {
        PENDING_CONFIRM: '待确认',
        IN_TRADING: '交易中',
        SHIPPED: '已发货',
        COMPLETED: '已完成',
        CANCELLED: '已取消'
      };

      if (!orders || orders.length === 0) {
        const role = isBuy ? '买到的' : (isSell ? '卖出的' : '相关');
        messages.push({ role: 'bot', content: `您还没有${role}订单。` });
      } else {
        const role = isBuy ? '买到的' : (isSell ? '卖出的' : '相关的');
        messages.push({
          role: 'bot',
          type: 'orders',
          content: `📋 您最近${role}订单：`,
          orders: orders.map(order => ({
            objectId: order.objectId,
            title: order.itemTitle || '商品',
            price: order.price,
            statusText: statusMap[order.status] || order.status
          }))
        });
      }
    } catch (e) {
      console.error('订单查询失败', e);
      messages.push({ role: 'bot', content: '订单查询暂时不可用，请稍后再试。' });
    }
    this.setData({ messages, loading: false, scrollToView: 'bottom' });
  },

  onOrderTap(e) {
    const orderId = e.currentTarget.dataset.id;
    if (orderId) {
      wx.navigateTo({ url: `/pages/orderDetail/orderDetail?id=${orderId}` });
    }
  },

  matchLocal(input) {
    if (LOCAL_FAQ[input]) return LOCAL_FAQ[input];
    const keys = Object.keys(LOCAL_FAQ);
    for (const key of keys) {
      if (input.includes(key) || key.includes(input)) {
        return LOCAL_FAQ[key];
      }
    }
    return null;
  },

  async callAI(word, messages) {
    try {
      const { reply } = await ai.chatWithAI(word);
      const nodes = processReply(reply);
      messages.push({ role: 'bot', content: reply, nodes });
    } catch (e) {
      messages.push({ role: 'bot', content: '抱歉，出了点问题，请稍后再试' });
    }
    this.setData({ messages, loading: false, scrollToView: 'bottom' });
  },

  async checkOrderUpdates() {
    if (!auth.checkLoginStatus()) return;
    const u = auth.getUserInfo();
    if (!u || !u.objectId) return;

    try {
      // 改用 Bmob 查询构建器，避免 find 方法丢失
      const buyQuery = Bmob.Query('Order');
      buyQuery.equalTo('buyerId', '==', u.objectId);
      const buyOrders = await buyQuery.find();

      const sellQuery = Bmob.Query('Order');
      sellQuery.equalTo('sellerId', '==', u.objectId);
      const sellOrders = await sellQuery.find();

      const allOrders = [...(buyOrders || []), ...(sellOrders || [])];
      const orderMap = {};
      allOrders.forEach(o => { orderMap[o.objectId] = o; });
      const uniqueOrders = Object.values(orderMap);

      const changed = orderNotify.getChangedOrders(uniqueOrders);
      if (changed.length > 0) {
        const statusMap = {
          PENDING_CONFIRM: '待确认',
          IN_TRADING: '交易中',
          SHIPPED: '已发货',
          COMPLETED: '已完成',
          CANCELLED: '已取消'
        };
        const tips = changed.map(o =>
          `📌 订单「${o.itemTitle || '商品'}」状态更新为“${statusMap[o.status] || o.status}”`
        ).join('\n');
        const newMsg = { role: 'bot', content: `您有 ${changed.length} 个订单状态已更新：\n${tips}` };
        const messages = [newMsg, ...this.data.messages];
        this.setData({ messages });
      }
    } catch (e) {
      console.error('检查订单更新失败', e);
    }
  }
});