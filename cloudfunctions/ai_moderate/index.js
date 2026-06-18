// cloudfunctions/ai_moderate/index.js
const OpenAI = require("openai");

exports.main = async (req) => {
  const { title, description } = req.params;
  if (!title && !description) {
    return { passed: false, reason: "内容为空" };
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const prompt = `请审核以下校园二手交易平台的商品信息：
标题：${title || "(无)"}
描述：${description || "(无)"}
判断是否包含以下违规内容：
- 涉黄、涉政、暴力、人身攻击
- 广告导流（如微信号、QQ号、外链、手机号，但校内固话可允许）
- 违法违规信息
请只回复 "通过" 或 "违规"，如果违规，请用一句话简要说明原因。`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
    });
    const aiResult = completion.choices[0].message.content.trim();
    const passed = aiResult.startsWith("通过");
    const reason = passed ? "" : aiResult.replace(/^违规[：:]*/, "").trim();
    return { passed, reason };
  } catch (e) {
    console.error("AI审核出错:", e);
    return { passed: false, reason: "审核服务暂时不可用，请稍后重试" };
  }
};