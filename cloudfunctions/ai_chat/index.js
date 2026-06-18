// cloudfunctions/ai_chat/index.js
const OpenAI = require("openai");

const SYSTEM_PROMPT = `你是校园二手交易平台“校园易换”的智能客服。请根据以下知识回答问题：
1. 如何发布商品：点击底部“发布”按钮，选择“物品发布”或“跑腿发布”，填写信息并上传图片后提交。
2. 交易流程：买家下单后需确认付款→卖家确认出货→买家确认收货（或卖家确认收款）→交易完成。
3. 如何校园认证：在“我的”→“校园认证”中输入您的edu邮箱，获取验证码即可完成。
4. 账号被冻结：请联系管理员，或发送邮件至 help@campus2.com。
5. 如何联系卖家：在商品详情页点击“联系”按钮，可进入该商品群聊。
如果用户询问其他问题，请礼貌告知需要联系人工客服（微信号：campus_helper）。`;

exports.main = async (req) => {
  const { message, history } = req.params; // history 为可选对话历史数组 [{role, content}]
  if (!message) return { reply: "请输入问题" };

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...(history || []),
    { role: "user", content: message }
  ];

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.5,
    });
    const reply = completion.choices[0].message.content;
    return { reply };
  } catch (e) {
    console.error("客服机器人出错:", e);
    return { reply: "客服小助手暂时不在线，请稍后再试" };
  }
};