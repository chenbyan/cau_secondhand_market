// cloudfunctions/ai_generate/index.js
const OpenAI = require("openai");

exports.main = async (req) => {
  const { keywords, category, price, campus } = req.params;
  if (!keywords) {
    return { success: false, message: "请提供商品关键词" };
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const prompt = `为校园二手交易平台生成商品信息：
商品关键词：${keywords}
分类：${category || "其他"}
价格：${price || "面议"}元
校区：${campus || "校内"}
请生成一个吸引人的商品标题（不超过20字）和一段详细描述（不超过120字）。描述需包含：商品成色、使用情况、交易地点（面交）、优惠信息（可选）。
请严格按JSON格式输出，不要包含额外文字：
{"title": "…", "description": "…"}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
    });
    const content = completion.choices[0].message.content.trim();
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("AI未返回JSON");
    const res = JSON.parse(jsonMatch[0]);
    return { success: true, title: res.title, description: res.description };
  } catch (e) {
    console.error("AI生成失败:", e);
    return { success: false, message: "生成失败，请手动填写" };
  }
};