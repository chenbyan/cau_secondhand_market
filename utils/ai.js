// utils/ai.js
// 直接调用智谱 API（开发测试用，上线前务必改为后端代理）

const GLM_API_KEY = '8299ff51566d4106943a8637927cef36.CRoVEe951vJFXkvX';

async function chatWithAI(message, history = []) {
  console.log('直接调用智谱 API，消息:', message);
  return new Promise((resolve) => {
    wx.request({
      url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + GLM_API_KEY
      },
      data: {
        model: 'glm-4-flash',
        messages: [
          {
            role: 'system',
            content: '你是校园二手交易平台的智能客服，请友好回答用户问题。如果不确定，请建议联系人工客服（微信号：campus_helper）。'
          },
          ...history,
          { role: 'user', content: message }
        ],
        temperature: 0.5
      },
      success(res) {
        if (res.statusCode === 200 && res.data && res.data.choices && res.data.choices.length > 0) {
          resolve({ reply: res.data.choices[0].message.content });
        } else {
          console.error('智谱 API 返回异常', res.data);
          resolve({ reply: 'AI 返回异常，请稍后重试' });
        }
      },
      fail(err) {
        console.error('调用智谱 API 失败', err);
        resolve({ reply: '网络错误，请稍后重试' });
      }
    });
  });
}

async function moderateContent({ title, description }) {
  return { passed: true, reason: '' };
}

async function generateDescription(params) {
  return { success: false, message: '功能未开放' };
}

module.exports = { chatWithAI, moderateContent, generateDescription };