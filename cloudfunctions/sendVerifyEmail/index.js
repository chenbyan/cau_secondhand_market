/**
 * Bmob 云函数：sendVerifyEmail
 *
 * 部署说明（控制台以实际界面为准）：
 * 1. 登录 Bmob 后端云控制台 → 云函数 → 新建函数，名称填写 sendVerifyEmail（与客户端 Bmob.functions 调用名一致）。
 * 2. 将本文件内容复制到云函数编辑器，或上传本目录。
 * 3. 在控制台为云函数配置发信能力：例如接入 SMTP、SendCloud、阿里云邮件推送等（依 Bmob 版本可能提供 modules.oMail 等模块，请查阅当前文档）。
 * 4. 部署后在「云函数」里测试参数：{ "email": "test@xxx.edu.cn", "code": "123456" }。
 *
 * 邮件标题与正文见下方常量；验证码 5 分钟内有效（与 VerifyCode 表 expireAt 一致）。
 */
const SUBJECT = '校园二手交易平台 - 身份验证码'

module.exports = async function (request) {
  // 不同 Bmob 版本 request 结构可能为 { params } 或 body，这里做兼容读取
  const body = request && (request.params || request.body || request)
  const email = body && body.email
  const code = body && body.code

  if (!email || !code) {
    return { success: false, message: '缺少 email 或 code' }
  }

  const text =
    `您的校园二手交易平台验证码为：${code}，5 分钟内有效。请勿向他人泄露。\n\n如非本人操作，请忽略本邮件。`

  // TODO: 在此处调用你配置好的邮件发送 API，例如：
  // await modules.oMail.send({ to: email, subject: SUBJECT, text })
  // 未接入真实发信前，部署后请在控制台查看日志中的验证码以便联调。

  console.log('sendVerifyEmail', email, code)

  return {
    success: true,
    message: '请在云函数内接入真实发信逻辑；当前仅记录日志便于调试',
    subject: SUBJECT,
    preview: text
  }
}
