module.exports = (function() {
var __MODS__ = {};
var __DEFINE__ = function(modId, func, req) { var m = { exports: {}, _tempexports: {} }; __MODS__[modId] = { status: 0, func: func, req: req, m: m }; };
var __REQUIRE__ = function(modId, source) { if(!__MODS__[modId]) return require(source); if(!__MODS__[modId].status) { var m = __MODS__[modId].m; m._exports = m._tempexports; var desp = Object.getOwnPropertyDescriptor(m, "exports"); if (desp && desp.configurable) Object.defineProperty(m, "exports", { set: function (val) { if(typeof val === "object" && val !== m._exports) { m._exports.__proto__ = val.__proto__; Object.keys(val).forEach(function (k) { m._exports[k] = val[k]; }); } m._tempexports = val }, get: function () { return m._tempexports; } }); __MODS__[modId].status = 1; __MODS__[modId].func(__MODS__[modId].req, m, m.exports); } return __MODS__[modId].m.exports; };
var __REQUIRE_WILDCARD__ = function(obj) { if(obj && obj.__esModule) { return obj; } else { var newObj = {}; if(obj != null) { for(var k in obj) { if (Object.prototype.hasOwnProperty.call(obj, k)) newObj[k] = obj[k]; } } newObj.default = obj; return newObj; } };
var __REQUIRE_DEFAULT__ = function(obj) { return obj && obj.__esModule ? obj.default : obj; };
__DEFINE__(1781963103967, function(require, module, exports) {
module.exports = require('./src/lib/app')
}, function(modId) {var map = {"./src/lib/app":1781963103968}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1781963103968, function(require, module, exports) {
/*
 * @Author: magic
 * @Date: 2021-07-06 15:24:37
 * @LastEditors: magic
 * @LastEditTime: 2022-02-11 14:44:06
 * @Description: Do not edit
 * @FilePath: /hydrogen-js-sdk/src/lib/app.js
 */
const Bmob = require("./bmob");
const Pointer = require("./pointer");
const Relation = require("./relation");
const Query = require("./query");
const User = require("./user");
const File = require("./file");
const Pay = require("./pay");
const Socket = require("./socket");
const webSocketAiClient = require("./webSocketAiClient");

const {
  generateCode,
  mediaCheckAsync,
  getAccessToken,
  sendWeAppMessage,
  refund,
  notifyMsg,
  functions,
  timestamp,
  requestPasswordReset,
  resetPasswordBySmsCode,
  updateUserPassword,
  geoPoint,
  checkMsg,
  checkMsg2,
  push,
  getPhoneNumber,
} = require("./common");
const { requestSmsCode, verifySmsCode } = require("./sms");
// 平台判断
Bmob.type = Bmob.utils.getAppType();
// 生成二维码
Bmob.GeoPoint = geoPoint;
// 生成二维码
Bmob.generateCode = generateCode;
// 生成二维码
Bmob.mediaCheckAsync = mediaCheckAsync;
// 获取微信token
Bmob.getAccessToken = getAccessToken;
// 获取微信手机号
Bmob.getPhoneNumber = getPhoneNumber;
// 小程序模版信息
Bmob.sendWeAppMessage = sendWeAppMessage;
// 微信退款
Bmob.refund = refund;
// 检测文本
Bmob.checkMsg = checkMsg;
Bmob.checkMsg2 = checkMsg2;
// 微信主人通知
Bmob.notifyMsg = notifyMsg;
// 请求短信验证码
Bmob.requestSmsCode = requestSmsCode;
// 验证短信验证码
Bmob.verifySmsCode = verifySmsCode;
// 云函数
Bmob.run = Bmob.functions = functions;
// 获取服务器时间
Bmob.timestamp = timestamp;
// 密码重置(Email)
Bmob.requestPasswordReset = requestPasswordReset;
// 密码重置(短信)
Bmob.resetPasswordBySmsCode = resetPasswordBySmsCode;
// 密码重置(登录状态下更改密码)
Bmob.updateUserPassword = updateUserPassword;
// APP推送
Bmob.push = push;
// 小程序支付
Bmob.Pay = new Pay();
// 用户对象
Bmob.User = new User();
// 通讯
Bmob.Socket = (id) => new Socket(id);
// AI
Bmob.ChatAI = (id) => new webSocketAiClient();
// 数据操作
Bmob.Query = (parmas) => new Query(parmas);
// 文件操作
Bmob.File = (name, object) => new File(name, object);
// 网络请求
Bmob.request = require("./request");

// 数据关联(一对一)
Bmob.Pointer = (parmas) => new Pointer(parmas);
// 数据关联(一对多，多对多)
Bmob.Relation = (parmas) => new Relation(parmas);

if (Bmob.type === "wx") {
  if (typeof tt !== "undefined") {
    tt.Bmob = Bmob;
  } else {
    wx.Bmob = Bmob;
  }
} else if (Bmob.type === "h5") {
  window.Bmob = Bmob;
} else if (Bmob.type === "hap") {
  // 快应用功能
  global.Bmob = Bmob;
} else if (Bmob.type === "nodejs") {
  // nodejs
  global.Bmob = Bmob;
}

module.exports = Bmob;

}, function(modId) { var map = {"./bmob":1781963103969,"./pointer":1781963103974,"./relation":1781963103977,"./query":1781963103978,"./user":1781963104019,"./file":1781963104020,"./pay":1781963104021,"./socket":1781963104022,"./webSocketAiClient":1781963104023,"./common":1781963104024,"./sms":1781963104025,"./request":1781963103979}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1781963103969, function(require, module, exports) {
const utils = require('./utils')

let env 
let appType = utils.getAppType()
console.log('appType', appType)
if (appType === 'h5') {
  env = window
}
if (appType === 'nodejs') {
  env = global
}
if (appType === 'wx') {
  env = wx
}
// const Bmob = {} || env.Bmob
// Bmob.utils = utils
// Bmob._config = utils.getConfig()

// 1) 复用全局实例，保证跨页面共享
const Bmob = env.Bmob || {}

// 2) 仅在首次未初始化时创建配置，避免覆盖已有密钥
Bmob.utils = Bmob.utils || utils
Bmob._config = Bmob._config || utils.getConfig()


Bmob.initialize = (secretKey, securityCode, masterKey) => {
  if (secretKey.length > 16) {
    console.warn(`Bmob初始化失败，2.0以上版本SDK请使用API安全码初始化，文档地址：https://bmob.github.io/hydrogen-js-sdk/#/?id=初始化`)
  }
  Bmob._config.secretKey = secretKey
  Bmob.secretKey = secretKey
  Bmob._config.securityCode = securityCode
  Bmob._config.applicationMasterKey = masterKey
}
Bmob.domain= (url) => {
  Bmob._config.host=url
}
// 开启调试
Bmob.debug = (d) => {
  Bmob._config.deBug = d
  Bmob._config = utils.getConfig(d)
}

module.exports = Bmob

}, function(modId) { var map = {"./utils":1781963103970}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1781963103970, function(require, module, exports) {
/*
 * @Author: your name
 * @Date: 2019-11-12 15:51:09
 * @LastEditTime: 2020-06-17 18:26:11
 * @LastEditors: Please set LastEditors
 * @Description: In User Settings Edit
 * @FilePath: /bmob-js-sdk-es6/src/lib/utils.js
 */
let config

config = require('./config')

/**
 * 获取 SDK 配置信息
 * @return {Object}
 */
const getConfig = (d = false) => {
  if (d === true) {
    config.host = require('./config.dev').host
  }
  return config
}

// 获取SDK类型
const getAppType = () => {
  const config = getConfig()
  let type
  // 小程序
  if (typeof wx !== 'undefined') {
    type = 'wx'
  }

  // html5
  if (typeof window !== 'undefined' && typeof type !== 'string') {
    type = 'h5'
  }

  // node
  if (typeof process !== 'undefined' && typeof type !== 'string') {
    type = 'nodejs'
  }

  // 快应用
  if (config.type === 3 && typeof type !== 'string') {
    type = 'hap'
  }

  return type
}

// 生成16位随机字符串
const randomString = () => {
  let chars = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z']
  let nums = ''
  for (let i = 0; i < 16; i++) {
    let id = parseInt(Math.random() * 61)
    nums += chars[id]
  }
  return nums
}
module.exports = { randomString, getConfig, getAppType }

}, function(modId) { var map = {"./config":1781963103971,"./config.dev":1781963103973}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1781963103971, function(require, module, exports) {
/*
 * @Author: your name
 * @Date: 2018-07-17 10:37:55
 * @LastEditTime: 2022-08-18 10:49:04
 * @LastEditors: magic
 * @Description: In User Settings Edit
 * @FilePath: /hydrogen-js-sdk/src/lib/config.js
 */
let ROOT;
let VERSION;
try {
  ROOT = require("../../package.json");
  // 这行在小程序引入app.js报错
  VERSION = `v${ROOT.version}`;
} catch (e) {
  // 这行在小程序引入app.js报错
  VERSION = `v1.0.0`;
}

const HOST = "https://api.bmobcloud.com";
// const HOST = "http://apitest.codenow.cn";
// const HOST = 'http://website-restful.bmobapp.com'

const SECRET_KEY = "";
const SECURITY_CODE = "";
const APPLICATION_MASTER_KEY = "";

// 1.h5 2.小程序 3.快应用 4.nodejs
const TYPE = 3;

const PARAMETERS = {
  GENERATECODE: "/1/wechatApp/qr/generatecode", // 生成二维码
  GETACCESSTOKEN: "/1/wechatApp/getAccessToken", // 获取access_token
  SENDWEAPPMESSAGE: "/1/wechatApp/SendWeAppMessage", // 小程序模版消息
  NOTIFYMSG: "/1/wechatApp/notifyMsg", // 微信主人通知
  CHECK_SESSION_KEY: "/1/wechatApp/checkSessionKey", // 校验 sessionKey 是否有效
  REFUND: "/1/pay/refund", // 微信退款
  REQUESTSMSCODE: "/1/requestSmsCode", // 请求短信验证码
  VERIFYSMSCODE: "/1/verifySmsCode", // 验证短信验证码
  Ai: "/1/ai/", // 验证短信验证码
  FUNCTIONS: "/1/functions", // 云函数
  REQUESTPASSWORDRESET: "/1/requestPasswordReset", // 重置密码(email)
  RESETPASSWORDBYSMSCODE: "/1/resetPasswordBySmsCode", // 重置密码(短信)
  UPDATEUSERPASSWORD: "/1/updateUserPassword", // 重置密码(登录状态下旧密码换新密码)
  PUSH: "/1/push", // APP推送
  FILES: "/2/files", // 单个文件上传/删除
  FILESCHECK: "/1/wechatApp/checkImg", // 单个文件上传/删除
  DELFILES: "/2/cdnBatchDelete", // 批量删除
  TIMESTAMP: "/1/timestamp", // 获取服务器时间
  LOGIN: "/1/login", // 登陆
  REGISTER: "/1/users", // 注册
  REQUEST_EMAIL_VERIFY: "/1/requestEmailVerify", // 注册
  USERS: "/1/users", // 查询用户
  USERSV1: "/1/usersv1", // 查询用户
  PAY: "/1/pay", // 支付
  WECHAT_APP: "/1/wechatAppv1/", // 获取openid
  BATCH: "/1/batch",
  CHECK_MSG: "/1/wechatApp/checkMsg", // 检测文本内容
  DECRYPTION: "/1/wechatApp/decryptionv1", // 检测文本内容
  MEDIACHECKASYNC: "/1/wechatApp/asyncCheckWechatMedia", // 检测文本内容
  GETPHONENUMBER: "/1/wechatApp/getPhoneNumber", // 获取微信手机号
  QUERY: "/1/classes", // 查询数据
  WXVP_CREATE_ORDER: "/1/wxvp/createOrder", // 微信虚拟支付创建订单
  WXVP_QUERY_USER_BALANCE: "/1/wxvp/queryUserBalance", // 微信虚拟支付查询用户代币余额
  WXVP_QUERY_ORDER: "/1/wxvp/queryOrder", // 微信虚拟支付查询现金订单状态
  WXVP_CURRENCY_PAY: "/1/wxvp/currencyPay", // 微信虚拟支付 - 代币扣减支付
};
module.exports = {
  host: HOST,
  secretKey: SECRET_KEY,
  securityCode: SECURITY_CODE,
  applicationMasterKey: APPLICATION_MASTER_KEY,
  parameters: PARAMETERS,
  version: VERSION,
  serverVersion: 10,
  deBug: false,
  type: TYPE,
};

}, function(modId) { var map = {"../../package.json":1781963103972}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1781963103972, function(require, module, exports) {
module.exports = {
  "name": "hydrogen-js-sdk",
  "version": "2.7.3",
  "description": "本SDK基于es6开发，致力打造基于前端混合开发需求，支持微信小程序、H5、快应用、游戏Cocos、混合App等平台, 整个SDK，就dist目录下Bmob.*.js 这个文件即可使用全部功能，请使用最新版本。",
  "main": "./index.js",
  "typings": "./index.d.ts",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1",
    "build": "webpack --config config/prod.env.js",
    "pack": "npm pack",
    "publish:dry-run": "npm publish --dry-run",
    "publish": "npm run build && npm publish",
    "release": "node scripts/release.js",
    "watch": "webpack --watch --config config/prod.env.js",
    "dev": "webpack-dev-server --config config/dev.env.js"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/bmob/hydrogen-js-sdk.git"
  },
  "author": "Bmob",
  "license": "ISC",
  "bugs": {
    "url": "https://github.com/bmob/hydrogen-js-sdk/issues"
  },
  "homepage": "https://github.com/bmob/hydrogen-js-sdk#readme",
  "dependencies": {
    "babel-runtime": "^6.26.0",
    "eventsource-parser": "^1.0.0",
    "node.extend": "^2.0.0"
  },
  "devDependencies": {
    "babel-core": "^6.26.3",
    "babel-loader": "^7.1.5",
    "babel-plugin-transform-runtime": "^6.23.0",
    "babel-preset-es2015": "^6.24.1",
    "clean-webpack-plugin": "^0.1.19",
    "eslint": "^4.19.1",
    "eslint-config-standard": "^11.0.0",
    "eslint-friendly-formatter": "^4.0.1",
    "eslint-loader": "^2.0.0",
    "eslint-plugin-import": "^2.12.0",
    "eslint-plugin-node": "^6.0.1",
    "eslint-plugin-promise": "^3.7.0",
    "eslint-plugin-standard": "^3.1.0",
    "html-webpack-plugin": "^2.30.1",
    "uglifyjs-webpack-plugin": "^1.2.5",
    "webpack": "^3.12.0",
    "webpack-dev-server": "^2.11.2"
  },
  "directories": {
    "doc": "docs"
  },
  "keywords": [
    "Bmob"
  ]
}

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1781963103973, function(require, module, exports) {
/*
 * @Author: your name
 * @Date: 2019-03-27 10:02:03
 * @LastEditTime: 2022-06-24 15:08:38
 * @LastEditors: magic
 * @Description: In User Settings Edit
 * @FilePath: /hydrogen-js-sdk/src/lib/config.dev.js
 */
// const ROOT = require('../../package.json')
const HOST = "https://api.bmobcloud.com";
// const HOST = 'http://127.0.0.1:8080'
// const HOST = "https://apitest.bmob.cn";
// const HOST = 'http://website-restful.bmobapp.com'
const APPLICATION_ID = "";
const APPLICATION_KEY = "";
// const VERSION = `v${ROOT.version}`
// 注意小程序开发时，这个地方一定记得写死
const VERSION = 1;
// 1.h5 2.小程序 3.快应用
const TYPE = 1;

const PARAMETERS = {
  GENERATECODE: "/1/wechatApp/qr/generatecode", // 生成二维码
  GETACCESSTOKEN: "/1/wechatApp/getAccessToken", // 获取access_token
  SENDWEAPPMESSAGE: "/1/wechatApp/SendWeAppMessage", // 小程序模版消息
  NOTIFYMSG: "/1/wechatApp/notifyMsg", // 微信主人通知
  REFUND: "/1/pay/refund", // 微信退款
  REQUESTSMSCODE: "/1/requestSmsCode", // 请求短信验证码
  VERIFYSMSCODE: "/1/verifySmsCode", // 验证短信验证码
  Ai: "/1/ai/", // 验证短信验证码
  FUNCTIONS: "/1/functions", // 云函数
  REQUESTPASSWORDRESET: "/1/requestPasswordReset", // 重置密码(email)
  RESETPASSWORDBYSMSCODE: "/1/resetPasswordBySmsCode", // 重置密码(短信)
  UPDATEUSERPASSWORD: "/1/updateUserPassword", // 重置密码(登录状态下旧密码换新密码)
  PUSH: "/1/push", // APP推送
  FILES: "/2/files", // 单个文件上传/删除
  FILESCHECK: "/1/wechatApp/checkImg", // 单个文件上传/删除
  DELFILES: "/2/cdnBatchDelete", // 批量删除
  TIMESTAMP: "/1/timestamp", // 获取服务器时间
  LOGIN: "/1/login", // 登陆
  REGISTER: "/1/users", // 注册
  REQUEST_EMAIL_VERIFY: "/1/requestEmailVerify", // 注册
  USERS: "/1/users", // 查询用户
  USERSV1: "/1/usersv1", // 查询用户
  PAY: "/1/pay", // 支付
  WECHAT_APP: "/1/wechatAppv1/", // 获取openid
  BATCH: "/1/batch", // 获取openid
  CHECK_MSG: "/1/wechatApp/checkMsg", // 检测文本内容
  DECRYPTION: "/1/wechatApp/decryptionv1", // 检测文本内容
  MEDIACHECKASYNC: "/1/wechatApp/asyncCheckWechatMedia", // 检测文本内容
  QUERY: "/1/classes", // 查询数据
};

module.exports = {
  host: HOST,
  applicationId: APPLICATION_ID,
  applicationKey: APPLICATION_KEY,
  parameters: PARAMETERS,
  version: VERSION,
  serverVersion: 10,
  deBug: false,
  type: TYPE,
};

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1781963103974, function(require, module, exports) {
const { isString } = require('./dataType')
const Error = require('./error')
const pointer = class Pointer {
  constructor (tableName) {
    if (!isString(tableName)) {
      throw new Error(415)
    }
    this.tableName = tableName
  }
  set (objectId) {
    if (!isString(objectId)) {
      throw new Error(415)
    }
    return { '__type': 'Pointer', 'className': this.tableName, 'objectId': objectId }
  }
}

module.exports = pointer

}, function(modId) { var map = {"./dataType":1781963103975,"./error":1781963103976}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1781963103975, function(require, module, exports) {
const isObject = targe => Object.prototype.toString.call(targe) === '[object Object]'
const isNumber = targe => Object.prototype.toString.call(targe) === '[object Number]'
const isString = targe => Object.prototype.toString.call(targe) === '[object String]'
const isUndefined = targe => Object.prototype.toString.call(targe) === '[object Undefined]'
const isBoolean = targe => Object.prototype.toString.call(targe) === '[object Boolean]'
const isArray = targe => Object.prototype.toString.call(targe) === '[object Array]'
const isFunction = targe => Object.prototype.toString.call(targe) === '[object Function]'

module.exports = {
  isObject,
  isNumber,
  isString,
  isUndefined,
  isBoolean,
  isArray,
  isFunction
}

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1781963103976, function(require, module, exports) {
class error {
  constructor (code, msg) {
    let error = new Error()
    error.code = code
    error.message = msg ? `Bmob.Error:{code:${code}, message:${msg}}` : `Bmob.Error:{code:${code}, message:${this.errorMsg(code)}}`

    return error
  }
  errorMsg (code) {
    switch (code) {
      case 415:
        // 参数类型不正确
        return 'incorrect parameter type.'
      case 416:
        // 参数为空
        return 'Parameter is null.'
      case 417:
        // 内容为空
        return 'There is no upload content.'
      case 418:
        // 内容为空
        return 'Log in failure.'
      case 419:
        // 内容为空
        return 'Bmob.GeoPoint location error.'
      default:
        return 'unknown error'
    }
  }
}

module.exports = error

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1781963103977, function(require, module, exports) {
const { isString, isArray } = require('./dataType')
const Error = require('./error')

const relation = class Relation {
  constructor (tableName) {
    if (!isString(tableName)) {
      throw new Error(415)
    }
    this.tableName = tableName
  }
  add (parmas) {
    return operation.call(this, parmas, 'AddRelation')
  }
  remove (parmas) {
    return operation.call(this, parmas, 'RemoveRelation')
  }
}

function operation (parmas, op) {
  if (isString(parmas)) {
    return {
      '__op': op,
      'objects': [
        {
          '__type': 'Pointer',
          'className': this.tableName,
          'objectId': parmas
        }
      ]
    }
  } else if (isArray(parmas)) {
    const data = []
    parmas.map(item => {
      if (!isString(item)) {
        throw new Error(415)
      }
      data.push({ '__type': 'Pointer', 'className': this.tableName, 'objectId': item })
    })
    return { '__op': op, 'objects': data }
  } else {
    throw new Error(415)
  }
}

module.exports = relation

}, function(modId) { var map = {"./dataType":1781963103975,"./error":1781963103976}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1781963103978, function(require, module, exports) {
let Bmob = require('./bmob')
const request = require('./request')
const {
  isObject,
  isString,
  isNumber,
  isUndefined,
  isArray
} = require('./dataType')
const Error = require('./error')
const storage = require('./storage')
const query = class query {
  constructor (parmas) {
    this.tableName = `${Bmob._config.parameters.QUERY}/${parmas}`
    this.className = parmas
    this.init()
    this.addArray = {}
    this.setData = {}
  }
  init () {
    this.queryData = {}
    this.location = {}
    this.andData = {}
    this.orData = {}
    this.stat = {}
    this.limitNum = 100
    this.skipNum = 0
    this.includes = ''
    this.queryReilation = {}
    this.orders = null
    this.keys = null
  }
  get (ObjectId) {
    if (!isString(ObjectId)) {
      throw new Error(415)
    }

    let oneData = {}
    const incrementData = {}
    const unsetData = {}
    const addArray = {}

    const add = (key, val) => {
      if (!isString(key) || !isArray(val)) {
        throw new Error(415)
      }
      addArray[key] = {
        __op: 'Add',
        objects: val
      }
    }
    const addUnique = (key, val) => {
      if (!isString(key) || !isArray(val)) {
        throw new Error(415)
      }
      addArray[key] = {
        __op: 'AddUnique',
        objects: val
      }
    }
    const remove = (key, val) => {
      if (!isString(key) || !isArray(val)) {
        throw new Error(415)
      }
      addArray[key] = {
        __op: 'Remove',
        objects: val
      }
    }
    const increment = (key, val = 1) => {
      if (!isString(key) || !isNumber(val)) {
        throw new Error(415)
      }
      incrementData[key] = {
        __op: 'Increment',
        amount: val
      }
    }
    const unset = key => {
      if (!isString(ObjectId)) {
        throw new Error(415)
      }
      unsetData[key] = {
        __op: 'Delete'
      }
    }
    const set = (key, val) => {
      if (!isString(key) || isUndefined(val)) {
        throw new Error(415)
      }
      const { filename, cdn, url } = val
      if (!isUndefined(filename) && !isUndefined(cdn) && !isUndefined(url)) {
        oneData[key] = {
          __type: 'File',
          group: cdn,
          filename: filename,
          url: url
        }
      } else {
        oneData[key] = val
      }
    }
    const save = () => {
      const saveData = Object.assign(
        unsetData,
        oneData,
        incrementData,
        addArray
      )
      if (this.className === '_User') {
        return new Promise((resolve, reject) => {
          request(`${this.tableName}/${ObjectId}`, 'put', saveData)
            .then(results => {
              const current = this.current()
              let newStorage = Object.assign(current, saveData)
              storage.save('bmob', newStorage)
              resolve(results)
            })
            .catch(err => {
              reject(err)
            })
        })
      }
      return request(`${this.tableName}/${ObjectId}`, 'put', saveData)
    }

    const associated = {}
    if (this.includes !== '') {
      associated.include = this.includes
    }
    return new Promise((resolve, reject) => {
      request(`${this.tableName}/${ObjectId}`, 'get', associated)
        .then(results => {
          Object.defineProperty(results, 'set', { value: set })
          Object.defineProperty(results, 'unset', { value: unset })
          Object.defineProperty(results, 'save', { value: save })
          Object.defineProperty(results, 'increment', { value: increment })
          Object.defineProperty(results, 'add', { value: add })
          Object.defineProperty(results, 'remove', { value: remove })
          Object.defineProperty(results, 'addUnique', { value: addUnique })
          Object.defineProperty(results, 'destroy', {
            value: () => this.destroy(ObjectId)
          })
          resolve(results)
        })
        .catch(err => {
          reject(err)
        })
    })
  }
  destroy (ObjectId) {
    if (!isString(ObjectId)) {
      throw new Error(415)
    }
    return request(`${this.tableName}/${ObjectId}`, 'delete')
  }
  set (key, val) {
    if (!isString(key) || isUndefined(val)) {
      throw new Error(415, `${key}字段参数,类型不正确`)
    }
    const { filename, cdn, url } = val
    if (!isUndefined(filename) && !isUndefined(cdn) && !isUndefined(url)) {
      this.setData[key] = {
        __type: 'File',
        group: cdn,
        filename: filename,
        url: url
      }
    } else {
      this.setData[key] = val
    }
  }
  add (key, val) {
    if (!isString(key) || !isArray(val)) {
      throw new Error(415)
    }
    this.addArray[key] = {
      __op: 'Add',
      objects: val
    }
  }
  addUnique (key, val) {
    if (!isString(key) || !isArray(val)) {
      throw new Error(415)
    }
    this.addArray[key] = {
      __op: 'AddUnique',
      objects: val
    }
  }
  current () {
    if (Bmob.type !== 'hap') {
      const data = storage.fetch('bmob')
      return typeof data === 'object' ? data : JSON.parse(data)
    } else {
      // 快应用功能
      return new Promise((resolve, reject) => {
        return storage
          .fetch('bmob')
          .then(res => {
            resolve(res)
          })
          .catch(err => {
            reject(err)
          })
      })
    }
  }
  updateStorage (id) {
    if (!isString(id)) {
      throw new Error(415)
    }
    return new Promise((resolve, reject) => {
      const current = this.current()
      if (!current) {
        throw new Error(415)
      }
      this.get(id)
        .then(res => {
          let newStorage = Object.assign(current, res)
          storage.save('bmob', newStorage)
          resolve(res)
        })
        .catch(err => {
          console.log(err)
          reject(err)
        })
    })
  }

  save (parmas = {}) {
    if (!isObject(parmas)) {
      throw new Error(415)
    }
    let method = this.setData.id ? 'PUT' : 'POST'
    let objectId = this.setData.id ? this.setData.id : ''
    delete this.setData.id
    let saveData = Object.assign(parmas, this.setData, this.addArray)
    return new Promise((resolve, reject) => {
      request(`${this.tableName}/${objectId}`, method, saveData)
        .then(results => {
          this.addArray = {}
          this.setData = {}

          if (this.className === '_User') {
            const current = this.current()
            let newStorage = Object.assign(current, saveData)
            storage.save('bmob', newStorage)
          }

          resolve(results)
        })
        .catch(err => {
          reject(err)
        })
    })
  }
  saveAll (items) {
    if (!isArray(items)) {
      throw new Error(415)
    }
    if (items.length < 1) {
      throw new Error(416)
    }

    let id
    let p
    let m = 'put'
    let key = []
    items.map(item => {
      id = `/${item.objectId}`
      if (id === '/undefined') {
        id = ''
        m = 'post'
      }

      p = {
        method: m,
        path: `${this.tableName}${id}`,
        body: item.setData
      }
      key.push(p)
      return item
    })

    let params = {
      requests: key
    }
    let route = Bmob._config.parameters.BATCH
    // 批量操作
    return request(route, 'POST', params)
  }

  withinKilometers (field, { latitude, longitude }, km = 100) {
    let newData = {}
    newData[field] = {
      $nearSphere: {
        __type: 'GeoPoint',
        latitude: latitude,
        longitude: longitude
      },
      $maxDistanceInKilometers: km
    }
    this.location = newData
    return newData
  }
  withinGeoBox (field, { latitude, longitude }, s) {
    let newData = {}
    newData[field] = {
      $within: {
        $box: [
          {
            __type: 'GeoPoint',
            latitude: latitude,
            longitude: longitude
          },
          {
            __type: 'GeoPoint',
            latitude: s.latitude,
            longitude: s.longitude
          }
        ]
      }
    }
    this.location = newData
    return newData
  }
  statTo (key, val) {
    if (!isString(key)) {
      throw new Error(415)
    }
    this.stat[key] = val
    return this.stat
  }
  equalTo (key, operator, val) {
    if (!isString(key)) {
      throw new Error(415)
    }
    const judge = (key, operator, val) => {
      let data = {}
      let value = null
      if (key === 'createdAt' || key === 'updateAt') {
        value = {
          __type: 'Date',
          iso: val
        }
      } else {
        value = val
      }
      switch (operator) {
        case '==':
          data[key] = value
          break
        case '===':
          data[key] = value
          break
        case '!=':
          data[key] = {
            $ne: value
          }
          break
        case '<':
          data[key] = {
            $lt: value
          }
          break
        case '<=':
          data[key] = {
            $lte: value
          }
          break
        case '>':
          data[key] = {
            $gt: value
          }
          break
        case '>=':
          data[key] = {
            $gte: value
          }
          break
        default:
          throw new Error(415)
      }
      return data
    }
    const newData = judge(key, operator, val)
    if (Object.keys(this.queryData).length) {
      if (!isUndefined(this.queryData.$and)) {
        this.queryData.$and.push(newData)
      } else {
        this.queryData = {
          $and: [this.queryData, newData]
        }
      }
    } else {
      this.queryData = newData
    }

    return newData
  }
  containedIn (key, val) {
    if (!isString(key) || !isArray(val)) {
      throw new Error(415)
    }
    return queryData.call(this, key, '$in', val)
  }
  notContainedIn (key, val) {
    if (!isString(key) || !isArray(val)) {
      throw new Error(415)
    }
    return queryData.call(this, key, '$nin', val)
  }
  exists (key) {
    if (!isString(key)) {
      throw new Error(415)
    }
    return queryData.call(this, key, '$exists', true)
  }
  doesNotExist (key) {
    if (!isString(key)) {
      throw new Error(415)
    }
    return queryData.call(this, key, '$exists', false)
  }
  or (...querys) {
    querys.map((item, i) => {
      if (!isObject(item)) {
        throw new Error(415)
      }
    })
    const queryData = this.queryData.$and
    if (!isUndefined(queryData)) {
      for (let i = 0; i < queryData.length; i++) {
        for (let k = 0; k < querys.length; k++) {
          if (JSON.stringify(queryData[i]) === JSON.stringify(querys[k])) {
            this.queryData.$and.splice(i, 1)
          }
        }
      }
      if (!queryData.length) {
        delete this.queryData.$and
      }
    }
    this.orData = {
      $or: querys
    }
  }
  and (...querys) {
    querys.map((item, i) => {
      if (!isObject(item)) {
        throw new Error(415)
      }
    })
    this.andData = {
      $and: querys
    }
  }
  limit (parmas) {
    if (!isNumber(parmas)) {
      throw new Error(415)
    }
    if (parmas > 1000) {
      parmas = 1000
    }
    this.limitNum = parmas
  }
  skip (parmas) {
    if (!isNumber(parmas)) {
      throw new Error(415)
    }
    this.skipNum = parmas
  }
  order (...key) {
    key.map(item => {
      if (!isString(item)) {
        throw new Error(415)
      }
    })
    this.orders = key.join(',')
  }
  include (...key) {
    key.map(item => {
      if (!isString(item)) {
        throw new Error(415)
      }
    })
    this.includes = key.join(',')
  }
  select (...key) {
    key.map(item => {
      if (!isString(item)) {
        throw new Error(415)
      }
    })
    this.keys = key.join(',')
  }
  field (key, objectId) {
    if (!isString(key) || !isString(objectId)) {
      throw new Error(415)
    }
    this.queryReilation.where = {
      $relatedTo: {
        object: {
          __type: 'Pointer',
          className: this.className,
          objectId: objectId
        },
        key: key
      }
    }
  }
  relation (tableName) {
    if (!isString(tableName)) {
      throw new Error(415)
    }
    if (tableName === '_User') {
      tableName = 'users'
    } else {
      tableName = `classes/${tableName}`
    }
    this.queryReilation.count = 1
    let parmas = Object.assign(this.getParams(), this.queryReilation)

    return new Promise((resolve, reject) => {
      request(`/1/${tableName}`, 'get', parmas)
        .then((res) => {
          resolve(res)
        })
        .catch(err => {
          reject(err)
        })
    })
  }
  getParams () {
    let parmas = {}
    if (Object.keys(this.queryData).length) {
      parmas.where = this.queryData
    }
    if (Object.keys(this.location).length) {
      parmas.where = Object.assign(this.location, this.queryData)
    }
    if (Object.keys(this.andData).length) {
      parmas.where = Object.assign(this.andData, this.queryData)
    }
    if (Object.keys(this.orData).length) {
      parmas.where = Object.assign(this.orData, this.queryData)
    }
    parmas.limit = this.limitNum
    parmas.skip = this.skipNum
    parmas.include = this.includes
    parmas.order = this.orders
    parmas.keys = this.keys
    if (Object.keys(this.stat).length) {
      parmas = Object.assign(parmas, this.stat)
    }
    for (const key in parmas) {
      if (
        (parmas.hasOwnProperty(key) && parmas[key] === null) ||
        parmas[key] === 0 || parmas[key] === ''
      ) {
        delete parmas[key]
      }
    }
    return parmas
  }
  find () {
    let oneData = {}
    let items = {}
    const parmas = this.getParams()
    const set = (key, val) => {
      if (!key || isUndefined(val)) {
        throw new Error(415)
      }
      oneData[key] = val
    }

    const batch = (method = 'updata') => {
      console.log(method)
      if (items.length < 1) {
        throw new Error(416)
      }

      let id
      let p
      let m = 'put'
      let key = []
      items.map(item => {
        id = `/${item.objectId}`
        if (id === '/undefined') {
          id = ''
          m = 'post'
        }

        p = {
          method: m,
          path: `${this.tableName}${id}`,
          body: oneData
        }
        if (method === 'delete') {
          p = {
            method: 'DELETE',
            path: `${this.tableName}${id}`
          }
        }
        key.push(p)
        return item
      })

      let params = {
        requests: key
      }
      // 批量操作
      let route = Bmob._config.parameters.BATCH
      return request(route, 'POST', params)
    }
    return new Promise((resolve, reject) => {
      request(`${this.tableName}`, 'get', parmas)
        .then((res) => {
          let results = res.results
          if (parmas.hasOwnProperty('count')) {
            results = res
          }
          this.init()
          Object.defineProperty(results, 'set', { value: set })
          Object.defineProperty(results, 'saveAll', {
            value: () => {
              return batch()
            }
          })
          Object.defineProperty(results, 'destroyAll', {
            value: () => {
              return batch('delete')
            }
          })
          items = results
          resolve(results)
        })
        .catch(err => {
          reject(err)
        })
    })
  }
  count (limit = 0) {
    const parmas = {}
    if (Object.keys(this.queryData).length) {
      parmas.where = this.queryData
    }
    if (Object.keys(this.andData).length) {
      parmas.where = Object.assign(this.andData, this.queryData)
    }
    if (Object.keys(this.orData).length) {
      parmas.where = Object.assign(this.orData, this.queryData)
    }
    parmas.count = 1
    parmas.limit = limit
    return new Promise((resolve, reject) => {
      request(this.tableName, 'get', parmas)
        .then(({ count }) => {
          resolve(count)
        })
        .catch(err => {
          reject(err)
        })
    })
  }
}

function queryData (key, operator, val) {
  let parent = {}
  let child = {}
  child[operator] = val
  parent[key] = child
  let newData = parent
  if (Object.keys(this.queryData).length) {
    if (!isUndefined(this.queryData.$and)) {
      this.queryData.$and.push(newData)
    } else {
      this.queryData = {
        $and: [this.queryData, newData]
      }
    }
  } else {
    this.queryData = newData
  }
  return newData
}

module.exports = query

}, function(modId) { var map = {"./bmob":1781963103969,"./request":1781963103979,"./dataType":1781963103975,"./error":1781963103976,"./storage":1781963104014}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1781963103979, function(require, module, exports) {
// const Bmob = require('./bmob')
const utils = require('./utils')

let request
// 获取当前应用类型
const type = utils.getAppType()
// h5
if (type === 'h5') {
  request = require('./axiosRequest')
} else if (type === 'wx') {
  // 小程序
  request = require('./wxRequest')
} else if (type === 'hap') {
  // 快应用功能
  request = require('./hapRequest')
} else if (type === 'nodejs') {
  // 快应用功能
  request = require('./axiosRequest')
}

module.exports = request

}, function(modId) { var map = {"./utils":1781963103970,"./axiosRequest":1781963103980,"./wxRequest":1781963104012,"./hapRequest":1781963104013}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1781963103980, function(require, module, exports) {
/*
 * @Author: magic
 * @Date: 2018-12-11 16:07:08
 * @LastEditTime: 2020-06-22 14:14:57
 * @LastEditors: Please set LastEditors
 * @Description: In User Settings Edit
 * @FilePath: /bmob-js-sdk-es6/src/lib/axiosRequest.js
 */
/* eslint-disable */
const axios = require('./axios/lib/axios')
let Bmob = require('./bmob')
let md5 = require('./utf8md5')

const setHeader = (config, route, method, parma) => {
  let type = 'wechatApp'
  if (Bmob.type === 'nodejs') {
    type = 'nodejs'
  }
  const t = Math.round(new Date().getTime() / 1000);

  let body = (method === 'get' || method === 'delete') ? '' : JSON.stringify(parma)

  const rand = Bmob.utils.randomString()
  const sign = md5.utf8MD5(route + t + config.securityCode + rand + body + config.serverVersion)
  let header = {
    'content-type': 'application/json',
    'X-Bmob-SDK-Type': type,
    'X-Bmob-Safe-Sign': sign,
    'X-Bmob-Safe-Timestamp': t,
    'X-Bmob-Noncestr-Key': rand,
    'X-Bmob-SDK-Version': config.serverVersion,
    'X-Bmob-Secret-Key': config.secretKey
  }
  if (config.applicationMasterKey) {
    header['X-Bmob-Master-Key'] = config.applicationMasterKey
  }

  return header
}

const request = (route, method = 'get', parma = {}) => {
  return new Promise((resolve, reject) => {
    if (undefined === Bmob.User) {
      Bmob = require('./bmob')
    }

    const header = setHeader(Bmob._config, route, method, parma)

    var current = Bmob.User.current()
    if (current) {
      header['X-Bmob-Session-Token'] = current.sessionToken
    }
    const server = axios.create({
      baseURL: Bmob._config.host,
      headers: header,
      validateStatus: (status) => {
        return status < 500 // 状态码在大于或等于500时才会 reject
      }
    })
    const serverData = {
      url: route,
      method: method
    }
    if (serverData.method === 'get') {
      serverData.params = parma
    } else {
      serverData.data = parma
    }
    if (Bmob._config.deBug === true) {
      console.log('host:', Bmob._config.host)
      console.log('parma:', parma)
    }
    server(serverData).then(({ data }) => {
      if ((data.code && data.error) || data.error) {
        reject(data)
      }
      resolve(data)
    }).catch(err => {
      reject(err)
    })
  })
}

module.exports = request

}, function(modId) { var map = {"./axios/lib/axios":1781963103981,"./bmob":1781963103969,"./utf8md5":1781963104011}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1781963103981, function(require, module, exports) {


var utils = require('./utils');
var bind = require('./helpers/bind');
var Axios = require('./core/Axios');
var defaults = require('./defaults');

/**
 * Create an instance of Axios
 *
 * @param {Object} defaultConfig The default config for the instance
 * @return {Axios} A new instance of Axios
 */
function createInstance(defaultConfig) {
  var context = new Axios(defaultConfig);
  var instance = bind(Axios.prototype.request, context);

  // Copy axios.prototype to instance
  utils.extend(instance, Axios.prototype, context);

  // Copy context to instance
  utils.extend(instance, context);

  return instance;
}

// Create the default instance to be exported
var axios = createInstance(defaults);

// Expose Axios class to allow class inheritance
axios.Axios = Axios;

// Factory for creating new instances
axios.create = function create(instanceConfig) {
  return createInstance(utils.merge(defaults, instanceConfig));
};

// Expose Cancel & CancelToken
axios.Cancel = require('./cancel/Cancel');
axios.CancelToken = require('./cancel/CancelToken');
axios.isCancel = require('./cancel/isCancel');

// Expose all/spread
axios.all = function all(promises) {
  return Promise.all(promises);
};
axios.spread = require('./helpers/spread');

module.exports = axios;

// Allow use of default import syntax in TypeScript
module.exports.default = axios;

}, function(modId) { var map = {"./utils":1781963103982,"./helpers/bind":1781963103983,"./core/Axios":1781963103985,"./defaults":1781963103986,"./cancel/Cancel":1781963104008,"./cancel/CancelToken":1781963104009,"./cancel/isCancel":1781963104005,"./helpers/spread":1781963104010}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1781963103982, function(require, module, exports) {


var bind = require('./helpers/bind');
var isBuffer = require('../modules/is-buffer');

/*global toString:true*/

// utils is a library of generic helper functions non-specific to axios

var toString = Object.prototype.toString;

/**
 * Determine if a value is an Array
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is an Array, otherwise false
 */
function isArray(val) {
  return toString.call(val) === '[object Array]';
}

/**
 * Determine if a value is an ArrayBuffer
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is an ArrayBuffer, otherwise false
 */
function isArrayBuffer(val) {
  return toString.call(val) === '[object ArrayBuffer]';
}

/**
 * Determine if a value is a FormData
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is an FormData, otherwise false
 */
function isFormData(val) {
  return (typeof FormData !== 'undefined') && (val instanceof FormData);
}

/**
 * Determine if a value is a view on an ArrayBuffer
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a view on an ArrayBuffer, otherwise false
 */
function isArrayBufferView(val) {
  var result;
  if ((typeof ArrayBuffer !== 'undefined') && (ArrayBuffer.isView)) {
    result = ArrayBuffer.isView(val);
  } else {
    result = (val) && (val.buffer) && (val.buffer instanceof ArrayBuffer);
  }
  return result;
}

/**
 * Determine if a value is a String
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a String, otherwise false
 */
function isString(val) {
  return typeof val === 'string';
}

/**
 * Determine if a value is a Number
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Number, otherwise false
 */
function isNumber(val) {
  return typeof val === 'number';
}

/**
 * Determine if a value is undefined
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if the value is undefined, otherwise false
 */
function isUndefined(val) {
  return typeof val === 'undefined';
}

/**
 * Determine if a value is an Object
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is an Object, otherwise false
 */
function isObject(val) {
  return val !== null && typeof val === 'object';
}

/**
 * Determine if a value is a Date
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Date, otherwise false
 */
function isDate(val) {
  return toString.call(val) === '[object Date]';
}

/**
 * Determine if a value is a File
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a File, otherwise false
 */
function isFile(val) {
  return toString.call(val) === '[object File]';
}

/**
 * Determine if a value is a Blob
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Blob, otherwise false
 */
function isBlob(val) {
  return toString.call(val) === '[object Blob]';
}

/**
 * Determine if a value is a Function
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Function, otherwise false
 */
function isFunction(val) {
  return toString.call(val) === '[object Function]';
}

/**
 * Determine if a value is a Stream
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Stream, otherwise false
 */
function isStream(val) {
  return isObject(val) && isFunction(val.pipe);
}

/**
 * Determine if a value is a URLSearchParams object
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a URLSearchParams object, otherwise false
 */
function isURLSearchParams(val) {
  return typeof URLSearchParams !== 'undefined' && val instanceof URLSearchParams;
}

/**
 * Trim excess whitespace off the beginning and end of a string
 *
 * @param {String} str The String to trim
 * @returns {String} The String freed of excess whitespace
 */
function trim(str) {
  return str.replace(/^\s*/, '').replace(/\s*$/, '');
}

/**
 * Determine if we're running in a standard browser environment
 *
 * This allows axios to run in a web worker, and react-native.
 * Both environments support XMLHttpRequest, but not fully standard globals.
 *
 * web workers:
 *  typeof window -> undefined
 *  typeof document -> undefined
 *
 * react-native:
 *  navigator.product -> 'ReactNative'
 */
function isStandardBrowserEnv() {
  if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') {
    return false;
  }
  return (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined'
  );
}

/**
 * Iterate over an Array or an Object invoking a function for each item.
 *
 * If `obj` is an Array callback will be called passing
 * the value, index, and complete array for each item.
 *
 * If 'obj' is an Object callback will be called passing
 * the value, key, and complete object for each property.
 *
 * @param {Object|Array} obj The object to iterate
 * @param {Function} fn The callback to invoke for each item
 */
function forEach(obj, fn) {
  // Don't bother if no value provided
  if (obj === null || typeof obj === 'undefined') {
    return;
  }

  // Force an array if not already something iterable
  if (typeof obj !== 'object') {
    /*eslint no-param-reassign:0*/
    obj = [obj];
  }

  if (isArray(obj)) {
    // Iterate over array values
    for (var i = 0, l = obj.length; i < l; i++) {
      fn.call(null, obj[i], i, obj);
    }
  } else {
    // Iterate over object keys
    for (var key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        fn.call(null, obj[key], key, obj);
      }
    }
  }
}

/**
 * Accepts varargs expecting each argument to be an object, then
 * immutably merges the properties of each object and returns result.
 *
 * When multiple objects contain the same key the later object in
 * the arguments list will take precedence.
 *
 * Example:
 *
 * ```js
 * var result = merge({foo: 123}, {foo: 456});
 * console.log(result.foo); // outputs 456
 * ```
 *
 * @param {Object} obj1 Object to merge
 * @returns {Object} Result of all merge properties
 */
function merge(/* obj1, obj2, obj3, ... */) {
  var result = {};
  function assignValue(val, key) {
    if (typeof result[key] === 'object' && typeof val === 'object') {
      result[key] = merge(result[key], val);
    } else {
      result[key] = val;
    }
  }

  for (var i = 0, l = arguments.length; i < l; i++) {
    forEach(arguments[i], assignValue);
  }
  return result;
}

/**
 * Extends object a by mutably adding to it the properties of object b.
 *
 * @param {Object} a The object to be extended
 * @param {Object} b The object to copy properties from
 * @param {Object} thisArg The object to bind function to
 * @return {Object} The resulting value of object a
 */
function extend(a, b, thisArg) {
  forEach(b, function assignValue(val, key) {
    if (thisArg && typeof val === 'function') {
      a[key] = bind(val, thisArg);
    } else {
      a[key] = val;
    }
  });
  return a;
}

module.exports = {
  isArray: isArray,
  isArrayBuffer: isArrayBuffer,
  isBuffer: isBuffer,
  isFormData: isFormData,
  isArrayBufferView: isArrayBufferView,
  isString: isString,
  isNumber: isNumber,
  isObject: isObject,
  isUndefined: isUndefined,
  isDate: isDate,
  isFile: isFile,
  isBlob: isBlob,
  isFunction: isFunction,
  isStream: isStream,
  isURLSearchParams: isURLSearchParams,
  isStandardBrowserEnv: isStandardBrowserEnv,
  forEach: forEach,
  merge: merge,
  extend: extend,
  trim: trim
};

}, function(modId) { var map = {"./helpers/bind":1781963103983,"../modules/is-buffer":1781963103984}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1781963103983, function(require, module, exports) {


module.exports = function bind(fn, thisArg) {
  return function wrap() {
    var args = new Array(arguments.length);
    for (var i = 0; i < args.length; i++) {
      args[i] = arguments[i];
    }
    return fn.apply(thisArg, args);
  };
};

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1781963103984, function(require, module, exports) {
/*!
 * Determine if an object is a Buffer
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */

// The _isBuffer check is for Safari 5-7 support, because it's missing
// Object.prototype.constructor. Remove this eventually
module.exports = function (obj) {
  return obj != null && (isBuffer(obj) || isSlowBuffer(obj) || !!obj._isBuffer)
}

function isBuffer (obj) {
  return !!obj.constructor && typeof obj.constructor.isBuffer === 'function' && obj.constructor.isBuffer(obj)
}

// For Node v0.10 support. Remove this eventually.
function isSlowBuffer (obj) {
  return typeof obj.readFloatLE === 'function' && typeof obj.slice === 'function' && isBuffer(obj.slice(0, 0))
}

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1781963103985, function(require, module, exports) {


var defaults = require('./../defaults');
var utils = require('./../utils');
var InterceptorManager = require('./InterceptorManager');
var dispatchRequest = require('./dispatchRequest');

/**
 * Create a new instance of Axios
 *
 * @param {Object} instanceConfig The default config for the instance
 */
function Axios(instanceConfig) {
  this.defaults = instanceConfig;
  this.interceptors = {
    request: new InterceptorManager(),
    response: new InterceptorManager()
  };
}

/**
 * Dispatch a request
 *
 * @param {Object} config The config specific for this request (merged with this.defaults)
 */
Axios.prototype.request = function request(config) {
  /*eslint no-param-reassign:0*/
  // Allow for axios('example/url'[, config]) a la fetch API
  if (typeof config === 'string') {
    config = utils.merge({
      url: arguments[0]
    }, arguments[1]);
  }

  config = utils.merge(defaults, {method: 'get'}, this.defaults, config);
  config.method = config.method.toLowerCase();

  // Hook up interceptors middleware
  var chain = [dispatchRequest, undefined];
  var promise = Promise.resolve(config);

  this.interceptors.request.forEach(function unshiftRequestInterceptors(interceptor) {
    chain.unshift(interceptor.fulfilled, interceptor.rejected);
  });

  this.interceptors.response.forEach(function pushResponseInterceptors(interceptor) {
    chain.push(interceptor.fulfilled, interceptor.rejected);
  });

  while (chain.length) {
    promise = promise.then(chain.shift(), chain.shift());
  }

  return promise;
};

// Provide aliases for supported request methods
utils.forEach(['delete', 'get', 'head', 'options'], function forEachMethodNoData(method) {
  /*eslint func-names:0*/
  Axios.prototype[method] = function(url, config) {
    return this.request(utils.merge(config || {}, {
      method: method,
      url: url
    }));
  };
});

utils.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
  /*eslint func-names:0*/
  Axios.prototype[method] = function(url, data, config) {
    return this.request(utils.merge(config || {}, {
      method: method,
      url: url,
      data: data
    }));
  };
});

module.exports = Axios;

}, function(modId) { var map = {"./../defaults":1781963103986,"./../utils":1781963103982,"./InterceptorManager":1781963104002,"./dispatchRequest":1781963104003}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1781963103986, function(require, module, exports) {


var utils = require('./utils');
var normalizeHeaderName = require('./helpers/normalizeHeaderName');

var DEFAULT_CONTENT_TYPE = {
  'Content-Type': 'application/x-www-form-urlencoded'
};

function setContentTypeIfUnset(headers, value) {
  if (!utils.isUndefined(headers) && utils.isUndefined(headers['Content-Type'])) {
    headers['Content-Type'] = value;
  }
}

function getDefaultAdapter() {
  var adapter;
  if (typeof XMLHttpRequest !== 'undefined') {
    // For browsers use XHR adapter
    adapter = require('./adapters/xhr');
  } else if (typeof process !== 'undefined') {
    // For node use HTTP adapter
    adapter = require('./adapters/http');
  }
  return adapter;
}

var defaults = {
  adapter: getDefaultAdapter(),

  transformRequest: [function transformRequest(data, headers) {
    normalizeHeaderName(headers, 'Content-Type');
    if (utils.isFormData(data) ||
      utils.isArrayBuffer(data) ||
      utils.isBuffer(data) ||
      utils.isStream(data) ||
      utils.isFile(data) ||
      utils.isBlob(data)
    ) {
      return data;
    }
    if (utils.isArrayBufferView(data)) {
      return data.buffer;
    }
    if (utils.isURLSearchParams(data)) {
      setContentTypeIfUnset(headers, 'application/x-www-form-urlencoded;charset=utf-8');
      return data.toString();
    }
    if (utils.isObject(data)) {
      setContentTypeIfUnset(headers, 'application/json;charset=utf-8');
      return JSON.stringify(data);
    }
    return data;
  }],

  transformResponse: [function transformResponse(data) {
    /*eslint no-param-reassign:0*/
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (e) { /* Ignore */ }
    }
    return data;
  }],

  /**
   * A timeout in milliseconds to abort a request. If set to 0 (default) a
   * timeout is not created.
   */
  timeout: 0,

  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',

  maxContentLength: -1,

  validateStatus: function validateStatus(status) {
    return status >= 200 && status < 300;
  }
};

defaults.headers = {
  common: {
    'Accept': 'application/json, text/plain, */*'
  }
};

utils.forEach(['delete', 'get', 'head'], function forEachMethodNoData(method) {
  defaults.headers[method] = {};
});

utils.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
  defaults.headers[method] = utils.merge(DEFAULT_CONTENT_TYPE);
});

module.exports = defaults;

}, function(modId) { var map = {"./utils":1781963103982,"./helpers/normalizeHeaderName":1781963103987,"./adapters/xhr":1781963103988,"./adapters/http":1781963103997}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1781963103987, function(require, module, exports) {


var utils = require('../utils');

module.exports = function normalizeHeaderName(headers, normalizedName) {
  utils.forEach(headers, function processHeader(value, name) {
    if (name !== normalizedName && name.toUpperCase() === normalizedName.toUpperCase()) {
      headers[normalizedName] = value;
      delete headers[name];
    }
  });
};

}, function(modId) { var map = {"../utils":1781963103982}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1781963103988, function(require, module, exports) {


var utils = require('./../utils');
var settle = require('./../core/settle');
var buildURL = require('./../helpers/buildURL');
var parseHeaders = require('./../helpers/parseHeaders');
var isURLSameOrigin = require('./../helpers/isURLSameOrigin');
var createError = require('../core/createError');
var btoa = (typeof window !== 'undefined' && window.btoa && window.btoa.bind(window)) || require('./../helpers/btoa');

module.exports = function xhrAdapter(config) {
  return new Promise(function dispatchXhrRequest(resolve, reject) {
    var requestData = config.data;
    var requestHeaders = config.headers;

    if (utils.isFormData(requestData)) {
      delete requestHeaders['Content-Type']; // Let the browser set it
    }

    var request = new XMLHttpRequest();
    var loadEvent = 'onreadystatechange';
    var xDomain = false;

    // For IE 8/9 CORS support
    // Only supports POST and GET calls and doesn't returns the response headers.
    // DON'T do this for testing b/c XMLHttpRequest is mocked, not XDomainRequest.
    if (process.env.NODE_ENV !== 'test' &&
        typeof window !== 'undefined' &&
        window.XDomainRequest && !('withCredentials' in request) &&
        !isURLSameOrigin(config.url)) {
      request = new window.XDomainRequest();
      loadEvent = 'onload';
      xDomain = true;
      request.onprogress = function handleProgress() {};
      request.ontimeout = function handleTimeout() {};
    }

    // HTTP basic authentication
    if (config.auth) {
      var username = config.auth.username || '';
      var password = config.auth.password || '';
      requestHeaders.Authorization = 'Basic ' + btoa(username + ':' + password);
    }

    request.open(config.method.toUpperCase(), buildURL(config.url, config.params, config.paramsSerializer), true);

    // Set the request timeout in MS
    request.timeout = config.timeout;

    // Listen for ready state
    request[loadEvent] = function handleLoad() {
      if (!request || (request.readyState !== 4 && !xDomain)) {
        return;
      }

      // The request errored out and we didn't get a response, this will be
      // handled by onerror instead
      // With one exception: request that using file: protocol, most browsers
      // will return status as 0 even though it's a successful request
      if (request.status === 0 && !(request.responseURL && request.responseURL.indexOf('file:') === 0)) {
        return;
      }

      // Prepare the response
      var responseHeaders = 'getAllResponseHeaders' in request ? parseHeaders(request.getAllResponseHeaders()) : null;
      var responseData = !config.responseType || config.responseType === 'text' ? request.responseText : request.response;
      var response = {
        data: responseData,
        // IE sends 1223 instead of 204 (https://github.com/axios/axios/issues/201)
        status: request.status === 1223 ? 204 : request.status,
        statusText: request.status === 1223 ? 'No Content' : request.statusText,
        headers: responseHeaders,
        config: config,
        request: request
      };

      settle(resolve, reject, response);

      // Clean up request
      request = null;
    };

    // Handle low level network errors
    request.onerror = function handleError() {
      // Real errors are hidden from us by the browser
      // onerror should only fire if it's a network error
      reject(createError('Network Error', config, null, request));

      // Clean up request
      request = null;
    };

    // Handle timeout
    request.ontimeout = function handleTimeout() {
      reject(createError('timeout of ' + config.timeout + 'ms exceeded', config, 'ECONNABORTED',
        request));

      // Clean up request
      request = null;
    };

    // Add xsrf header
    // This is only done if running in a standard browser environment.
    // Specifically not if we're in a web worker, or react-native.
    if (utils.isStandardBrowserEnv()) {
      var cookies = require('./../helpers/cookies');

      // Add xsrf header
      var xsrfValue = (config.withCredentials || isURLSameOrigin(config.url)) && config.xsrfCookieName ?
          cookies.read(config.xsrfCookieName) :
          undefined;

      if (xsrfValue) {
        requestHeaders[config.xsrfHeaderName] = xsrfValue;
      }
    }

    // Add headers to the request
    if ('setRequestHeader' in request) {
      utils.forEach(requestHeaders, function setRequestHeader(val, key) {
        if (typeof requestData === 'undefined' && key.toLowerCase() === 'content-type') {
          // Remove Content-Type if data is undefined
          delete requestHeaders[key];
        } else {
          // Otherwise add header to the request
          request.setRequestHeader(key, val);
        }
      });
    }

    // Add withCredentials to request if needed
    if (config.withCredentials) {
      request.withCredentials = true;
    }

    // Add responseType to request if needed
    if (config.responseType) {
      try {
        request.responseType = config.responseType;
      } catch (e) {
        // Expected DOMException thrown by browsers not compatible XMLHttpRequest Level 2.
        // But, this can be suppressed for 'json' type as it can be parsed by default 'transformResponse' function.
        if (config.responseType !== 'json') {
          throw e;
        }
      }
    }

    // Handle progress if needed
    if (typeof config.onDownloadProgress === 'function') {
      request.addEventListener('progress', config.onDownloadProgress);
    }

    // Not all browsers support upload events
    if (typeof config.onUploadProgress === 'function' && request.upload) {
      request.upload.addEventListener('progress', config.onUploadProgress);
    }

    if (config.cancelToken) {
      // Handle cancellation
      config.cancelToken.promise.then(function onCanceled(cancel) {
        if (!request) {
          return;
        }

        request.abort();
        reject(cancel);
        // Clean up request
        request = null;
      });
    }

    if (requestData === undefined) {
      requestData = null;
    }

    // Send the request
    request.send(requestData);
  });
};

}, function(modId) { var map = {"./../utils":1781963103982,"./../core/settle":1781963103989,"./../helpers/buildURL":1781963103992,"./../helpers/parseHeaders":1781963103993,"./../helpers/isURLSameOrigin":1781963103994,"../core/createError":1781963103990,"./../helpers/btoa":1781963103995,"./../helpers/cookies":1781963103996}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1781963103989, function(require, module, exports) {


var createError = require('./createError');

/**
 * Resolve or reject a Promise based on response status.
 *
 * @param {Function} resolve A function that resolves the promise.
 * @param {Function} reject A function that rejects the promise.
 * @param {object} response The response.
 */
module.exports = function settle(resolve, reject, response) {
  var validateStatus = response.config.validateStatus;
  // Note: status is not exposed by XDomainRequest
  if (!response.status || !validateStatus || validateStatus(response.status)) {
    resolve(response);
  } else {
    reject(createError(
      'Request failed with status code ' + response.status,
      response.config,
      null,
      response.request,
      response
    ));
  }
};

}, function(modId) { var map = {"./createError":1781963103990}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1781963103990, function(require, module, exports) {


var enhanceError = require('./enhanceError');

/**
 * Create an Error with the specified message, config, error code, request and response.
 *
 * @param {string} message The error message.
 * @param {Object} config The config.
 * @param {string} [code] The error code (for example, 'ECONNABORTED').
 * @param {Object} [request] The request.
 * @param {Object} [response] The response.
 * @returns {Error} The created error.
 */
module.exports = function createError(message, config, code, request, response) {
  var error = new Error(message);
  return enhanceError(error, config, code, request, response);
};

}, function(modId) { var map = {"./enhanceError":1781963103991}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1781963103991, function(require, module, exports) {


/**
 * Update an Error with the specified config, error code, and response.
 *
 * @param {Error} error The error to update.
 * @param {Object} config The config.
 * @param {string} [code] The error code (for example, 'ECONNABORTED').
 * @param {Object} [request] The request.
 * @param {Object} [response] The response.
 * @returns {Error} The error.
 */
module.exports = function enhanceError(error, config, code, request, response) {
  error.config = config;
  if (code) {
    error.code = code;
  }
  error.request = request;
  error.response = response;
  return error;
};

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1781963103992, function(require, module, exports) {


var utils = require('./../utils');

function encode(val) {
  return encodeURIComponent(val).
    replace(/%40/gi, '@').
    replace(/%3A/gi, ':').
    replace(/%24/g, '$').
    replace(/%2C/gi, ',').
    replace(/%20/g, '+').
    replace(/%5B/gi, '[').
    replace(/%5D/gi, ']');
}

/**
 * Build a URL by appending params to the end
 *
 * @param {string} url The base of the url (e.g., http://www.google.com)
 * @param {object} [params] The params to be appended
 * @returns {string} The formatted url
 */
module.exports = function buildURL(url, params, paramsSerializer) {
  /*eslint no-param-reassign:0*/
  if (!params) {
    return url;
  }

  var serializedParams;
  if (paramsSerializer) {
    serializedParams = paramsSerializer(params);
  } else if (utils.isURLSearchParams(params)) {
    serializedParams = params.toString();
  } else {
    var parts = [];

    utils.forEach(params, function serialize(val, key) {
      if (val === null || typeof val === 'undefined') {
        return;
      }

      if (utils.isArray(val)) {
        key = key + '[]';
      } else {
        val = [val];
      }

      utils.forEach(val, function parseValue(v) {
        if (utils.isDate(v)) {
          v = v.toISOString();
        } else if (utils.isObject(v)) {
          v = JSON.stringify(v);
        }
        parts.push(encode(key) + '=' + encode(v));
      });
    });

    serializedParams = parts.join('&');
  }

  if (serializedParams) {
    url += (url.indexOf('?') === -1 ? '?' : '&') + serializedParams;
  }

  return url;
};

}, function(modId) { var map = {"./../utils":1781963103982}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1781963103993, function(require, module, exports) {


var utils = require('./../utils');

// Headers whose duplicates are ignored by node
// c.f. https://nodejs.org/api/http.html#http_message_headers
var ignoreDuplicateOf = [
  'age', 'authorization', 'content-length', 'content-type', 'etag',
  'expires', 'from', 'host', 'if-modified-since', 'if-unmodified-since',
  'last-modified', 'location', 'max-forwards', 'proxy-authorization',
  'referer', 'retry-after', 'user-agent'
];

/**
 * Parse headers into an object
 *
 * ```
 * Date: Wed, 27 Aug 2014 08:58:49 GMT
 * Content-Type: application/json
 * Connection: keep-alive
 * Transfer-Encoding: chunked
 * ```
 *
 * @param {String} headers Headers needing to be parsed
 * @returns {Object} Headers parsed into an object
 */
module.exports = function parseHeaders(headers) {
  var parsed = {};
  var key;
  var val;
  var i;

  if (!headers) { return parsed; }

  utils.forEach(headers.split('\n'), function parser(line) {
    i = line.indexOf(':');
    key = utils.trim(line.substr(0, i)).toLowerCase();
    val = utils.trim(line.substr(i + 1));

    if (key) {
      if (parsed[key] && ignoreDuplicateOf.indexOf(key) >= 0) {
        return;
      }
      if (key === 'set-cookie') {
        parsed[key] = (parsed[key] ? parsed[key] : []).concat([val]);
      } else {
        parsed[key] = parsed[key] ? parsed[key] + ', ' + val : val;
      }
    }
  });

  return parsed;
};

}, function(modId) { var map = {"./../utils":1781963103982}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1781963103994, function(require, module, exports) {


var utils = require('./../utils');

module.exports = (
  utils.isStandardBrowserEnv() ?

  // Standard browser envs have full support of the APIs needed to test
  // whether the request URL is of the same origin as current location.
  (function standardBrowserEnv() {
    var msie = /(msie|trident)/i.test(navigator.userAgent);
    var urlParsingNode = document.createElement('a');
    var originURL;

    /**
    * Parse a URL to discover it's components
    *
    * @param {String} url The URL to be parsed
    * @returns {Object}
    */
    function resolveURL(url) {
      var href = url;

      if (msie) {
        // IE needs attribute set twice to normalize properties
        urlParsingNode.setAttribute('href', href);
        href = urlParsingNode.href;
      }

      urlParsingNode.setAttribute('href', href);

      // urlParsingNode provides the UrlUtils interface - http://url.spec.whatwg.org/#urlutils
      return {
        href: urlParsingNode.href,
        protocol: urlParsingNode.protocol ? urlParsingNode.protocol.replace(/:$/, '') : '',
        host: urlParsingNode.host,
        search: urlParsingNode.search ? urlParsingNode.search.replace(/^\?/, '') : '',
        hash: urlParsingNode.hash ? urlParsingNode.hash.replace(/^#/, '') : '',
        hostname: urlParsingNode.hostname,
        port: urlParsingNode.port,
        pathname: (urlParsingNode.pathname.charAt(0) === '/') ?
                  urlParsingNode.pathname :
                  '/' + urlParsingNode.pathname
      };
    }

    originURL = resolveURL(window.location.href);

    /**
    * Determine if a URL shares the same origin as the current location
    *
    * @param {String} requestURL The URL to test
    * @returns {boolean} True if URL shares the same origin, otherwise false
    */
    return function isURLSameOrigin(requestURL) {
      var parsed = (utils.isString(requestURL)) ? resolveURL(requestURL) : requestURL;
      return (parsed.protocol === originURL.protocol &&
            parsed.host === originURL.host);
    };
  })() :

  // Non standard browser envs (web workers, react-native) lack needed support.
  (function nonStandardBrowserEnv() {
    return function isURLSameOrigin() {
      return true;
    };
  })()
);

}, function(modId) { var map = {"./../utils":1781963103982}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1781963103995, function(require, module, exports) {


// btoa polyfill for IE<10 courtesy https://github.com/davidchambers/Base64.js

var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

function E() {
  this.message = 'String contains an invalid character';
}
E.prototype = new Error;
E.prototype.code = 5;
E.prototype.name = 'InvalidCharacterError';

function btoa(input) {
  var str = String(input);
  var output = '';
  for (
    // initialize result and counter
    var block, charCode, idx = 0, map = chars;
    // if the next str index does not exist:
    //   change the mapping table to "="
    //   check if d has no fractional digits
    str.charAt(idx | 0) || (map = '=', idx % 1);
    // "8 - idx % 1 * 8" generates the sequence 2, 4, 6, 8
    output += map.charAt(63 & block >> 8 - idx % 1 * 8)
  ) {
    charCode = str.charCodeAt(idx += 3 / 4);
    if (charCode > 0xFF) {
      throw new E();
    }
    block = block << 8 | charCode;
  }
  return output;
}

module.exports = btoa;

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1781963103996, function(require, module, exports) {


var utils = require('./../utils');

module.exports = (
  utils.isStandardBrowserEnv() ?

  // Standard browser envs support document.cookie
  (function standardBrowserEnv() {
    return {
      write: function write(name, value, expires, path, domain, secure) {
        var cookie = [];
        cookie.push(name + '=' + encodeURIComponent(value));

        if (utils.isNumber(expires)) {
          cookie.push('expires=' + new Date(expires).toGMTString());
        }

        if (utils.isString(path)) {
          cookie.push('path=' + path);
        }

        if (utils.isString(domain)) {
          cookie.push('domain=' + domain);
        }

        if (secure === true) {
          cookie.push('secure');
        }

        document.cookie = cookie.join('; ');
      },

      read: function read(name) {
        var match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
        return (match ? decodeURIComponent(match[3]) : null);
      },

      remove: function remove(name) {
        this.write(name, '', Date.now() - 86400000);
      }
    };
  })() :

  // Non standard browser env (web workers, react-native) lack needed support.
  (function nonStandardBrowserEnv() {
    return {
      write: function write() {},
      read: function read() { return null; },
      remove: function remove() {}
    };
  })()
);

}, function(modId) { var map = {"./../utils":1781963103982}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1781963103997, function(require, module, exports) {


var utils = require('./../utils');
var settle = require('./../core/settle');
var buildURL = require('./../helpers/buildURL');
var http = require('http');
var https = require('https');
var httpFollow = require('../../modules/follow-redirects').http;
var httpsFollow = require('../../modules/follow-redirects').https;
var url = require('url');
var zlib = require('zlib');
var pkg = require('./../../package.json');
var createError = require('../core/createError');
var enhanceError = require('../core/enhanceError');

/*eslint consistent-return:0*/
module.exports = function httpAdapter(config) {
  return new Promise(function dispatchHttpRequest(resolve, reject) {
    var data = config.data;
    var headers = config.headers;
    var timer;

    // Set User-Agent (required by some servers)
    // Only set header if it hasn't been set in config
    // See https://github.com/axios/axios/issues/69
    if (!headers['User-Agent'] && !headers['user-agent']) {
      headers['User-Agent'] = 'axios/' + pkg.version;
    }

    if (data && !utils.isStream(data)) {
      if (Buffer.isBuffer(data)) {
        // Nothing to do...
      } else if (utils.isArrayBuffer(data)) {
        data = new Buffer(new Uint8Array(data));
      } else if (utils.isString(data)) {
        data = new Buffer(data, 'utf-8');
      } else {
        return reject(createError(
          'Data after transformation must be a string, an ArrayBuffer, a Buffer, or a Stream',
          config
        ));
      }

      // Add Content-Length header if data exists
      headers['Content-Length'] = data.length;
    }

    // HTTP basic authentication
    var auth = undefined;
    if (config.auth) {
      var username = config.auth.username || '';
      var password = config.auth.password || '';
      auth = username + ':' + password;
    }

    // Parse url
    var parsed = url.parse(config.url);
    var protocol = parsed.protocol || 'http:';

    if (!auth && parsed.auth) {
      var urlAuth = parsed.auth.split(':');
      var urlUsername = urlAuth[0] || '';
      var urlPassword = urlAuth[1] || '';
      auth = urlUsername + ':' + urlPassword;
    }

    if (auth) {
      delete headers.Authorization;
    }

    var isHttps = protocol === 'https:';
    var agent = isHttps ? config.httpsAgent : config.httpAgent;

    var options = {
      path: buildURL(parsed.path, config.params, config.paramsSerializer).replace(/^\?/, ''),
      method: config.method,
      headers: headers,
      agent: agent,
      auth: auth
    };

    if (config.socketPath) {
      options.socketPath = config.socketPath;
    } else {
      options.hostname = parsed.hostname;
      options.port = parsed.port;
    }

    var proxy = config.proxy;
    if (!proxy && proxy !== false) {
      var proxyEnv = protocol.slice(0, -1) + '_proxy';
      var proxyUrl = process.env[proxyEnv] || process.env[proxyEnv.toUpperCase()];
      if (proxyUrl) {
        var parsedProxyUrl = url.parse(proxyUrl);
        proxy = {
          host: parsedProxyUrl.hostname,
          port: parsedProxyUrl.port
        };

        if (parsedProxyUrl.auth) {
          var proxyUrlAuth = parsedProxyUrl.auth.split(':');
          proxy.auth = {
            username: proxyUrlAuth[0],
            password: proxyUrlAuth[1]
          };
        }
      }
    }

    if (proxy) {
      options.hostname = proxy.host;
      options.host = proxy.host;
      options.headers.host = parsed.hostname + (parsed.port ? ':' + parsed.port : '');
      options.port = proxy.port;
      options.path = protocol + '//' + parsed.hostname + (parsed.port ? ':' + parsed.port : '') + options.path;

      // Basic proxy authorization
      if (proxy.auth) {
        var base64 = new Buffer(proxy.auth.username + ':' + proxy.auth.password, 'utf8').toString('base64');
        options.headers['Proxy-Authorization'] = 'Basic ' + base64;
      }
    }

    var transport;
    if (config.transport) {
      transport = config.transport;
    } else if (config.maxRedirects === 0) {
      transport = isHttps ? https : http;
    } else {
      if (config.maxRedirects) {
        options.maxRedirects = config.maxRedirects;
      }
      transport = isHttps ? httpsFollow : httpFollow;
    }

    if (config.maxContentLength && config.maxContentLength > -1) {
      options.maxBodyLength = config.maxContentLength;
    }

    // Create the request
    var req = transport.request(options, function handleResponse(res) {
      if (req.aborted) return;

      // Response has been received so kill timer that handles request timeout
      clearTimeout(timer);
      timer = null;

      // uncompress the response body transparently if required
      var stream = res;
      switch (res.headers['content-encoding']) {
      /*eslint default-case:0*/
      case 'gzip':
      case 'compress':
      case 'deflate':
        // add the unzipper to the body stream processing pipeline
        stream = stream.pipe(zlib.createUnzip());

        // remove the content-encoding in order to not confuse downstream operations
        delete res.headers['content-encoding'];
        break;
      }

      // return the last request in case of redirects
      var lastRequest = res.req || req;

      var response = {
        status: res.statusCode,
        statusText: res.statusMessage,
        headers: res.headers,
        config: config,
        request: lastRequest
      };

      if (config.responseType === 'stream') {
        response.data = stream;
        settle(resolve, reject, response);
      } else {
        var responseBuffer = [];
        stream.on('data', function handleStreamData(chunk) {
          responseBuffer.push(chunk);

          // make sure the content length is not over the maxContentLength if specified
          if (config.maxContentLength > -1 && Buffer.concat(responseBuffer).length > config.maxContentLength) {
            reject(createError('maxContentLength size of ' + config.maxContentLength + ' exceeded',
              config, null, lastRequest));
          }
        });

        stream.on('error', function handleStreamError(err) {
          if (req.aborted) return;
          reject(enhanceError(err, config, null, lastRequest));
        });

        stream.on('end', function handleStreamEnd() {
          var responseData = Buffer.concat(responseBuffer);
          if (config.responseType !== 'arraybuffer') {
            responseData = responseData.toString('utf8');
          }

          response.data = responseData;
          settle(resolve, reject, response);
        });
      }
    });

    // Handle errors
    req.on('error', function handleRequestError(err) {
      if (req.aborted) return;
      reject(enhanceError(err, config, null, req));
    });

    // Handle request timeout
    if (config.timeout && !timer) {
      timer = setTimeout(function handleRequestTimeout() {
        req.abort();
        reject(createError('timeout of ' + config.timeout + 'ms exceeded', config, 'ECONNABORTED', req));
      }, config.timeout);
    }

    if (config.cancelToken) {
      // Handle cancellation
      config.cancelToken.promise.then(function onCanceled(cancel) {
        if (req.aborted) return;

        req.abort();
        reject(cancel);
      });
    }

    // Send the request
    if (utils.isStream(data)) {
      data.pipe(req);
    } else {
      req.end(data);
    }
  });
};

}, function(modId) { var map = {"./../utils":1781963103982,"./../core/settle":1781963103989,"./../helpers/buildURL":1781963103992,"http":1781963103997,"../../modules/follow-redirects":1781963103998,"./../../package.json":1781963104001,"../core/createError":1781963103990,"../core/enhanceError":1781963103991}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1781963103998, function(require, module, exports) {
var url = require("url");
var URL = url.URL;
var http = require("http");
var https = require("https");
var assert = require("assert");
var Writable = require("stream").Writable;
var debug = require("../debug")("follow-redirects");

// RFC7231§4.2.1: Of the request methods defined by this specification,
// the GET, HEAD, OPTIONS, and TRACE methods are defined to be safe.
var SAFE_METHODS = { GET: true, HEAD: true, OPTIONS: true, TRACE: true };

// Create handlers that pass events from native requests
var eventHandlers = Object.create(null);
["abort", "aborted", "connect", "error", "socket", "timeout"].forEach(function (event) {
  eventHandlers[event] = function (arg1, arg2, arg3) {
    this._redirectable.emit(event, arg1, arg2, arg3);
  };
});

// An HTTP(S) request that can be redirected
function RedirectableRequest(options, responseCallback) {
  // Initialize the request
  Writable.call(this);
  this._sanitizeOptions(options);
  this._options = options;
  this._ended = false;
  this._ending = false;
  this._redirectCount = 0;
  this._redirects = [];
  this._requestBodyLength = 0;
  this._requestBodyBuffers = [];

  // Attach a callback if passed
  if (responseCallback) {
    this.on("response", responseCallback);
  }

  // React to responses of native requests
  var self = this;
  this._onNativeResponse = function (response) {
    self._processResponse(response);
  };

  // Perform the first request
  this._performRequest();
}
RedirectableRequest.prototype = Object.create(Writable.prototype);

// Writes buffered data to the current native request
RedirectableRequest.prototype.write = function (data, encoding, callback) {
  // Writing is not allowed if end has been called
  if (this._ending) {
    throw new Error("write after end");
  }

  // Validate input and shift parameters if necessary
  if (!(typeof data === "string" || typeof data === "object" && ("length" in data))) {
    throw new Error("data should be a string, Buffer or Uint8Array");
  }
  if (typeof encoding === "function") {
    callback = encoding;
    encoding = null;
  }

  // Ignore empty buffers, since writing them doesn't invoke the callback
  // https://github.com/nodejs/node/issues/22066
  if (data.length === 0) {
    if (callback) {
      callback();
    }
    return;
  }
  // Only write when we don't exceed the maximum body length
  if (this._requestBodyLength + data.length <= this._options.maxBodyLength) {
    this._requestBodyLength += data.length;
    this._requestBodyBuffers.push({ data: data, encoding: encoding });
    this._currentRequest.write(data, encoding, callback);
  }
  // Error when we exceed the maximum body length
  else {
    this.emit("error", new Error("Request body larger than maxBodyLength limit"));
    this.abort();
  }
};

// Ends the current native request
RedirectableRequest.prototype.end = function (data, encoding, callback) {
  // Shift parameters if necessary
  if (typeof data === "function") {
    callback = data;
    data = encoding = null;
  }
  else if (typeof encoding === "function") {
    callback = encoding;
    encoding = null;
  }

  // Write data if needed and end
  if (!data) {
    this._ended = this._ending = true;
    this._currentRequest.end(null, null, callback);
  }
  else {
    var self = this;
    var currentRequest = this._currentRequest;
    this.write(data, encoding, function () {
      self._ended = true;
      currentRequest.end(null, null, callback);
    });
    this._ending = true;
  }
};

// Sets a header value on the current native request
RedirectableRequest.prototype.setHeader = function (name, value) {
  this._options.headers[name] = value;
  this._currentRequest.setHeader(name, value);
};

// Clears a header value on the current native request
RedirectableRequest.prototype.removeHeader = function (name) {
  delete this._options.headers[name];
  this._currentRequest.removeHeader(name);
};

// Global timeout for all underlying requests
RedirectableRequest.prototype.setTimeout = function (msecs, callback) {
  if (callback) {
    this.once("timeout", callback);
  }

  if (this.socket) {
    startTimer(this, msecs);
  }
  else {
    var self = this;
    this._currentRequest.once("socket", function () {
      startTimer(self, msecs);
    });
  }

  this.once("response", clearTimer);
  this.once("error", clearTimer);

  return this;
};

function startTimer(request, msecs) {
  clearTimeout(request._timeout);
  request._timeout = setTimeout(function () {
    request.emit("timeout");
  }, msecs);
}

function clearTimer() {
  clearTimeout(this._timeout);
}

// Proxy all other public ClientRequest methods
[
  "abort", "flushHeaders", "getHeader",
  "setNoDelay", "setSocketKeepAlive",
].forEach(function (method) {
  RedirectableRequest.prototype[method] = function (a, b) {
    return this._currentRequest[method](a, b);
  };
});

// Proxy all public ClientRequest properties
["aborted", "connection", "socket"].forEach(function (property) {
  Object.defineProperty(RedirectableRequest.prototype, property, {
    get: function () { return this._currentRequest[property]; },
  });
});

RedirectableRequest.prototype._sanitizeOptions = function (options) {
  // Ensure headers are always present
  if (!options.headers) {
    options.headers = {};
  }

  // Since http.request treats host as an alias of hostname,
  // but the url module interprets host as hostname plus port,
  // eliminate the host property to avoid confusion.
  if (options.host) {
    // Use hostname if set, because it has precedence
    if (!options.hostname) {
      options.hostname = options.host;
    }
    delete options.host;
  }

  // Complete the URL object when necessary
  if (!options.pathname && options.path) {
    var searchPos = options.path.indexOf("?");
    if (searchPos < 0) {
      options.pathname = options.path;
    }
    else {
      options.pathname = options.path.substring(0, searchPos);
      options.search = options.path.substring(searchPos);
    }
  }
};


// Executes the next native request (initial or redirect)
RedirectableRequest.prototype._performRequest = function () {
  // Load the native protocol
  var protocol = this._options.protocol;
  var nativeProtocol = this._options.nativeProtocols[protocol];
  if (!nativeProtocol) {
    this.emit("error", new Error("Unsupported protocol " + protocol));
    return;
  }

  // If specified, use the agent corresponding to the protocol
  // (HTTP and HTTPS use different types of agents)
  if (this._options.agents) {
    var scheme = protocol.substr(0, protocol.length - 1);
    this._options.agent = this._options.agents[scheme];
  }

  // Create the native request
  var request = this._currentRequest =
        nativeProtocol.request(this._options, this._onNativeResponse);
  this._currentUrl = url.format(this._options);

  // Set up event handlers
  request._redirectable = this;
  for (var event in eventHandlers) {
    /* istanbul ignore else */
    if (event) {
      request.on(event, eventHandlers[event]);
    }
  }

  // End a redirected request
  // (The first request must be ended explicitly with RedirectableRequest#end)
  if (this._isRedirect) {
    // Write the request entity and end.
    var i = 0;
    var self = this;
    var buffers = this._requestBodyBuffers;
    (function writeNext(error) {
      // Only write if this request has not been redirected yet
      /* istanbul ignore else */
      if (request === self._currentRequest) {
        // Report any write errors
        /* istanbul ignore if */
        if (error) {
          self.emit("error", error);
        }
        // Write the next buffer if there are still left
        else if (i < buffers.length) {
          var buffer = buffers[i++];
          /* istanbul ignore else */
          if (!request.finished) {
            request.write(buffer.data, buffer.encoding, writeNext);
          }
        }
        // End the request if `end` has been called on us
        else if (self._ended) {
          request.end();
        }
      }
    }());
  }
};

// Processes a response from the current native request
RedirectableRequest.prototype._processResponse = function (response) {
  // Store the redirected response
  var statusCode = response.statusCode;
  if (this._options.trackRedirects) {
    this._redirects.push({
      url: this._currentUrl,
      headers: response.headers,
      statusCode: statusCode,
    });
  }

  // RFC7231§6.4: The 3xx (Redirection) class of status code indicates
  // that further action needs to be taken by the user agent in order to
  // fulfill the request. If a Location header field is provided,
  // the user agent MAY automatically redirect its request to the URI
  // referenced by the Location field value,
  // even if the specific status code is not understood.
  var location = response.headers.location;
  if (location && this._options.followRedirects !== false &&
      statusCode >= 300 && statusCode < 400) {
    // Abort the current request
    this._currentRequest.removeAllListeners();
    this._currentRequest.on("error", noop);
    this._currentRequest.abort();
    // Discard the remainder of the response to avoid waiting for data
    response.destroy();

    // RFC7231§6.4: A client SHOULD detect and intervene
    // in cyclical redirections (i.e., "infinite" redirection loops).
    if (++this._redirectCount > this._options.maxRedirects) {
      this.emit("error", new Error("Max redirects exceeded."));
      return;
    }

    // RFC7231§6.4: Automatic redirection needs to done with
    // care for methods not known to be safe […],
    // since the user might not wish to redirect an unsafe request.
    // RFC7231§6.4.7: The 307 (Temporary Redirect) status code indicates
    // that the target resource resides temporarily under a different URI
    // and the user agent MUST NOT change the request method
    // if it performs an automatic redirection to that URI.
    var header;
    var headers = this._options.headers;
    if (statusCode !== 307 && !(this._options.method in SAFE_METHODS)) {
      this._options.method = "GET";
      // Drop a possible entity and headers related to it
      this._requestBodyBuffers = [];
      for (header in headers) {
        if (/^content-/i.test(header)) {
          delete headers[header];
        }
      }
    }

    // Drop the Host header, as the redirect might lead to a different host
    if (!this._isRedirect) {
      for (header in headers) {
        if (/^host$/i.test(header)) {
          delete headers[header];
        }
      }
    }

    // Perform the redirected request
    var redirectUrl = url.resolve(this._currentUrl, location);
    debug("redirecting to", redirectUrl);
    Object.assign(this._options, url.parse(redirectUrl));
    if (typeof this._options.beforeRedirect === "function") {
      try {
        this._options.beforeRedirect.call(null, this._options);
      }
      catch (err) {
        this.emit("error", err);
        return;
      }
      this._sanitizeOptions(this._options);
    }
    this._isRedirect = true;
    this._performRequest();
  }
  else {
    // The response is not a redirect; return it as-is
    response.responseUrl = this._currentUrl;
    response.redirects = this._redirects;
    this.emit("response", response);

    // Clean up
    this._requestBodyBuffers = [];
  }
};

// Wraps the key/value object of protocols with redirect functionality
function wrap(protocols) {
  // Default settings
  var exports = {
    maxRedirects: 21,
    maxBodyLength: 10 * 1024 * 1024,
  };

  // Wrap each protocol
  var nativeProtocols = {};
  Object.keys(protocols).forEach(function (scheme) {
    var protocol = scheme + ":";
    var nativeProtocol = nativeProtocols[protocol] = protocols[scheme];
    var wrappedProtocol = exports[scheme] = Object.create(nativeProtocol);

    // Executes a request, following redirects
    wrappedProtocol.request = function (input, options, callback) {
      // Parse parameters
      if (typeof input === "string") {
        var urlStr = input;
        try {
          input = urlToOptions(new URL(urlStr));
        }
        catch (err) {
          /* istanbul ignore next */
          input = url.parse(urlStr);
        }
      }
      else if (URL && (input instanceof URL)) {
        input = urlToOptions(input);
      }
      else {
        callback = options;
        options = input;
        input = { protocol: protocol };
      }
      if (typeof options === "function") {
        callback = options;
        options = null;
      }

      // Set defaults
      options = Object.assign({
        maxRedirects: exports.maxRedirects,
        maxBodyLength: exports.maxBodyLength,
      }, input, options);
      options.nativeProtocols = nativeProtocols;

      assert.equal(options.protocol, protocol, "protocol mismatch");
      debug("options", options);
      return new RedirectableRequest(options, callback);
    };

    // Executes a GET request, following redirects
    wrappedProtocol.get = function (input, options, callback) {
      var request = wrappedProtocol.request(input, options, callback);
      request.end();
      return request;
    };
  });
  return exports;
}

/* istanbul ignore next */
function noop() { /* empty */ }

// from https://github.com/nodejs/node/blob/master/lib/internal/url.js
function urlToOptions(urlObject) {
  var options = {
    protocol: urlObject.protocol,
    hostname: urlObject.hostname.startsWith("[") ?
      /* istanbul ignore next */
      urlObject.hostname.slice(1, -1) :
      urlObject.hostname,
    hash: urlObject.hash,
    search: urlObject.search,
    pathname: urlObject.pathname,
    path: urlObject.pathname + urlObject.search,
    href: urlObject.href,
  };
  if (urlObject.port !== "") {
    options.port = Number(urlObject.port);
  }
  return options;
}

// Exports
module.exports = wrap({ http: http, https: https });
module.exports.wrap = wrap;

}, function(modId) { var map = {"http":1781963103999,"https":1781963104000}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1781963103999, function(require, module, exports) {
module.exports = require("./").http;

}, function(modId) { var map = {"./":1781963103998}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1781963104000, function(require, module, exports) {
module.exports = require("./").https;

}, function(modId) { var map = {"./":1781963103998}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1781963104001, function(require, module, exports) {
module.exports = {
  "_from": "axios",
  "_id": "axios@0.18.0",
  "_inBundle": false,
  "_integrity": "sha1-MtU+SFHv3AoRmTts0AB4nXDAUQI=",
  "_location": "/axios",
  "_phantomChildren": {},
  "_requested": {
    "type": "tag",
    "registry": true,
    "raw": "axios",
    "name": "axios",
    "escapedName": "axios",
    "rawSpec": "",
    "saveSpec": null,
    "fetchSpec": "latest"
  },
  "_requiredBy": [
    "#USER",
    "/"
  ],
  "_resolved": "http://registry.npmjs.org/axios/-/axios-0.18.0.tgz",
  "_shasum": "32d53e4851efdc0a11993b6cd000789d70c05102",
  "_spec": "axios",
  "_where": "F:\\A",
  "author": {
    "name": "Matt Zabriskie"
  },
  "browser": {
    "./lib/adapters/http.js": "./lib/adapters/xhr.js"
  },
  "bugs": {
    "url": "https://github.com/axios/axios/issues"
  },
  "bundleDependencies": false,
  "bundlesize": [
    {
      "path": "./dist/axios.min.js",
      "threshold": "5kB"
    }
  ],
  "dependencies": {
    "follow-redirects": "^1.3.0",
    "is-buffer": "^1.1.6"
  },
  "deprecated": false,
  "description": "Promise based HTTP client for the browser and node.js",
  "devDependencies": {
    "bundlesize": "^0.5.7",
    "coveralls": "^2.11.9",
    "es6-promise": "^4.0.5",
    "grunt": "^1.0.1",
    "grunt-banner": "^0.6.0",
    "grunt-cli": "^1.2.0",
    "grunt-contrib-clean": "^1.0.0",
    "grunt-contrib-nodeunit": "^1.0.0",
    "grunt-contrib-watch": "^1.0.0",
    "grunt-eslint": "^19.0.0",
    "grunt-karma": "^2.0.0",
    "grunt-ts": "^6.0.0-beta.3",
    "grunt-webpack": "^1.0.18",
    "istanbul-instrumenter-loader": "^1.0.0",
    "jasmine-core": "^2.4.1",
    "karma": "^1.3.0",
    "karma-chrome-launcher": "^2.0.0",
    "karma-coverage": "^1.0.0",
    "karma-firefox-launcher": "^1.0.0",
    "karma-jasmine": "^1.0.2",
    "karma-jasmine-ajax": "^0.1.13",
    "karma-opera-launcher": "^1.0.0",
    "karma-safari-launcher": "^1.0.0",
    "karma-sauce-launcher": "^1.1.0",
    "karma-sinon": "^1.0.5",
    "karma-sourcemap-loader": "^0.3.7",
    "karma-webpack": "^1.7.0",
    "load-grunt-tasks": "^3.5.2",
    "minimist": "^1.2.0",
    "sinon": "^1.17.4",
    "typescript": "^2.0.3",
    "url-search-params": "^0.6.1",
    "webpack": "^1.13.1",
    "webpack-dev-server": "^1.14.1"
  },
  "homepage": "https://github.com/axios/axios",
  "keywords": [
    "xhr",
    "http",
    "ajax",
    "promise",
    "node"
  ],
  "license": "MIT",
  "main": "index.js",
  "name": "axios",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/axios/axios.git"
  },
  "scripts": {
    "build": "NODE_ENV=production grunt build",
    "coveralls": "cat coverage/lcov.info | ./node_modules/coveralls/bin/coveralls.js",
    "examples": "node ./examples/server.js",
    "postversion": "git push && git push --tags",
    "preversion": "npm test",
    "start": "node ./sandbox/server.js",
    "test": "grunt test && bundlesize",
    "version": "npm run build && grunt version && git add -A dist && git add CHANGELOG.md bower.json package.json"
  },
  "typings": "./index.d.ts",
  "version": "0.18.0"
}

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1781963104002, function(require, module, exports) {


var utils = require('./../utils');

function InterceptorManager() {
  this.handlers = [];
}

/**
 * Add a new interceptor to the stack
 *
 * @param {Function} fulfilled The function to handle `then` for a `Promise`
 * @param {Function} rejected The function to handle `reject` for a `Promise`
 *
 * @return {Number} An ID used to remove interceptor later
 */
InterceptorManager.prototype.use = function use(fulfilled, rejected) {
  this.handlers.push({
    fulfilled: fulfilled,
    rejected: rejected
  });
  return this.handlers.length - 1;
};

/**
 * Remove an interceptor from the stack
 *
 * @param {Number} id The ID that was returned by `use`
 */
InterceptorManager.prototype.eject = function eject(id) {
  if (this.handlers[id]) {
    this.handlers[id] = null;
  }
};

/**
 * Iterate over all the registered interceptors
 *
 * This method is particularly useful for skipping over any
 * interceptors that may have become `null` calling `eject`.
 *
 * @param {Function} fn The function to call for each interceptor
 */
InterceptorManager.prototype.forEach = function forEach(fn) {
  utils.forEach(this.handlers, function forEachHandler(h) {
    if (h !== null) {
      fn(h);
    }
  });
};

module.exports = InterceptorManager;

}, function(modId) { var map = {"./../utils":1781963103982}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1781963104003, function(require, module, exports) {


var utils = require('./../utils');
var transformData = require('./transformData');
var isCancel = require('../cancel/isCancel');
var defaults = require('../defaults');
var isAbsoluteURL = require('./../helpers/isAbsoluteURL');
var combineURLs = require('./../helpers/combineURLs');

/**
 * Throws a `Cancel` if cancellation has been requested.
 */
function throwIfCancellationRequested(config) {
  if (config.cancelToken) {
    config.cancelToken.throwIfRequested();
  }
}

/**
 * Dispatch a request to the server using the configured adapter.
 *
 * @param {object} config The config that is to be used for the request
 * @returns {Promise} The Promise to be fulfilled
 */
module.exports = function dispatchRequest(config) {
  throwIfCancellationRequested(config);

  // Support baseURL config
  if (config.baseURL && !isAbsoluteURL(config.url)) {
    config.url = combineURLs(config.baseURL, config.url);
  }

  // Ensure headers exist
  config.headers = config.headers || {};

  // Transform request data
  config.data = transformData(
    config.data,
    config.headers,
    config.transformRequest
  );

  // Flatten headers
  config.headers = utils.merge(
    config.headers.common || {},
    config.headers[config.method] || {},
    config.headers || {}
  );

  utils.forEach(
    ['delete', 'get', 'head', 'post', 'put', 'patch', 'common'],
    function cleanHeaderConfig(method) {
      delete config.headers[method];
    }
  );

  var adapter = config.adapter || defaults.adapter;

  return adapter(config).then(function onAdapterResolution(response) {
    throwIfCancellationRequested(config);

    // Transform response data
    response.data = transformData(
      response.data,
      response.headers,
      config.transformResponse
    );

    return response;
  }, function onAdapterRejection(reason) {
    if (!isCancel(reason)) {
      throwIfCancellationRequested(config);

      // Transform response data
      if (reason && reason.response) {
        reason.response.data = transformData(
          reason.response.data,
          reason.response.headers,
          config.transformResponse
        );
      }
    }

    return Promise.reject(reason);
  });
};

}, function(modId) { var map = {"./../utils":1781963103982,"./transformData":1781963104004,"../cancel/isCancel":1781963104005,"../defaults":1781963103986,"./../helpers/isAbsoluteURL":1781963104006,"./../helpers/combineURLs":1781963104007}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1781963104004, function(require, module, exports) {


var utils = require('./../utils');

/**
 * Transform the data for a request or a response
 *
 * @param {Object|String} data The data to be transformed
 * @param {Array} headers The headers for the request or response
 * @param {Array|Function} fns A single function or Array of functions
 * @returns {*} The resulting transformed data
 */
module.exports = function transformData(data, headers, fns) {
  /*eslint no-param-reassign:0*/
  utils.forEach(fns, function transform(fn) {
    data = fn(data, headers);
  });

  return data;
};

}, function(modId) { var map = {"./../utils":1781963103982}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1781963104005, function(require, module, exports) {


module.exports = function isCancel(value) {
  return !!(value && value.__CANCEL__);
};

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1781963104006, function(require, module, exports) {


/**
 * Determines whether the specified URL is absolute
 *
 * @param {string} url The URL to test
 * @returns {boolean} True if the specified URL is absolute, otherwise false
 */
module.exports = function isAbsoluteURL(url) {
  // A URL is considered absolute if it begins with "<scheme>://" or "//" (protocol-relative URL).
  // RFC 3986 defines scheme name as a sequence of characters beginning with a letter and followed
  // by any combination of letters, digits, plus, period, or hyphen.
  return /^([a-z][a-z\d\+\-\.]*:)?\/\//i.test(url);
};

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1781963104007, function(require, module, exports) {


/**
 * Creates a new URL by combining the specified URLs
 *
 * @param {string} baseURL The base URL
 * @param {string} relativeURL The relative URL
 * @returns {string} The combined URL
 */
module.exports = function combineURLs(baseURL, relativeURL) {
  return relativeURL
    ? baseURL.replace(/\/+$/, '') + '/' + relativeURL.replace(/^\/+/, '')
    : baseURL;
};

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1781963104008, function(require, module, exports) {


/**
 * A `Cancel` is an object that is thrown when an operation is canceled.
 *
 * @class
 * @param {string=} message The message.
 */
function Cancel(message) {
  this.message = message;
}

Cancel.prototype.toString = function toString() {
  return 'Cancel' + (this.message ? ': ' + this.message : '');
};

Cancel.prototype.__CANCEL__ = true;

module.exports = Cancel;

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1781963104009, function(require, module, exports) {


var Cancel = require('./Cancel');

/**
 * A `CancelToken` is an object that can be used to request cancellation of an operation.
 *
 * @class
 * @param {Function} executor The executor function.
 */
function CancelToken(executor) {
  if (typeof executor !== 'function') {
    throw new TypeError('executor must be a function.');
  }

  var resolvePromise;
  this.promise = new Promise(function promiseExecutor(resolve) {
    resolvePromise = resolve;
  });

  var token = this;
  executor(function cancel(message) {
    if (token.reason) {
      // Cancellation has already been requested
      return;
    }

    token.reason = new Cancel(message);
    resolvePromise(token.reason);
  });
}

/**
 * Throws a `Cancel` if cancellation has been requested.
 */
CancelToken.prototype.throwIfRequested = function throwIfRequested() {
  if (this.reason) {
    throw this.reason;
  }
};

/**
 * Returns an object that contains a new `CancelToken` and a function that, when called,
 * cancels the `CancelToken`.
 */
CancelToken.source = function source() {
  var cancel;
  var token = new CancelToken(function executor(c) {
    cancel = c;
  });
  return {
    token: token,
    cancel: cancel
  };
};

module.exports = CancelToken;

}, function(modId) { var map = {"./Cancel":1781963104008}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1781963104010, function(require, module, exports) {


/**
 * Syntactic sugar for invoking a function and expanding an array for arguments.
 *
 * Common use case would be to use `Function.prototype.apply`.
 *
 *  ```js
 *  function f(x, y, z) {}
 *  var args = [1, 2, 3];
 *  f.apply(null, args);
 *  ```
 *
 * With `spread` this example can be re-written.
 *
 *  ```js
 *  spread(function(x, y, z) {})([1, 2, 3]);
 *  ```
 *
 * @param {Function} callback
 * @returns {Function}
 */
module.exports = function spread(callback) {
  return function wrap(arr) {
    return callback.apply(null, arr);
  };
};

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1781963104011, function(require, module, exports) {
function safeAdd(x, y) {
  var lsw = (x & 0xffff) + (y & 0xffff)
  var msw = (x >> 16) + (y >> 16) + (lsw >> 16)
  return (msw << 16) | (lsw & 0xffff)
}

/*
 * Bitwise rotate a 32-bit number to the left.
 */
function rol(num, cnt) {
  return (num << cnt) | (num >>> (32 - cnt))
}

/*
 * These functions implement the four basic operations the algorithm uses.
 */
function cmn(q, a, b, x, s, t) {
  return safeAdd(rol(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b)
}

function ff(a, b, c, d, x, s, t) {
  return cmn((b & c) | (~b & d), a, b, x, s, t)
}
function gg(a, b, c, d, x, s, t) {
  return cmn((b & d) | (c & ~d), a, b, x, s, t)
}
function hh(a, b, c, d, x, s, t) {
  return cmn(b ^ c ^ d, a, b, x, s, t)
}
function ii(a, b, c, d, x, s, t) {
  return cmn(c ^ (b | ~d), a, b, x, s, t)
}

/*
 * Calculate the MD5 of an array of little-endian words, producing an array
 * of little-endian words.
 */
function coreMD5(x) {
  var a = 1732584193
  var b = -271733879
  var c = -1732584194
  var d = 271733878

  for (var i = 0; i < x.length; i += 16) {
    var olda = a
    var oldb = b
    var oldc = c
    var oldd = d

    a = ff(a, b, c, d, x[i + 0], 7, -680876936)
    d = ff(d, a, b, c, x[i + 1], 12, -389564586)
    c = ff(c, d, a, b, x[i + 2], 17, 606105819)
    b = ff(b, c, d, a, x[i + 3], 22, -1044525330)
    a = ff(a, b, c, d, x[i + 4], 7, -176418897)
    d = ff(d, a, b, c, x[i + 5], 12, 1200080426)
    c = ff(c, d, a, b, x[i + 6], 17, -1473231341)
    b = ff(b, c, d, a, x[i + 7], 22, -45705983)
    a = ff(a, b, c, d, x[i + 8], 7, 1770035416)
    d = ff(d, a, b, c, x[i + 9], 12, -1958414417)
    c = ff(c, d, a, b, x[i + 10], 17, -42063)
    b = ff(b, c, d, a, x[i + 11], 22, -1990404162)
    a = ff(a, b, c, d, x[i + 12], 7, 1804603682)
    d = ff(d, a, b, c, x[i + 13], 12, -40341101)
    c = ff(c, d, a, b, x[i + 14], 17, -1502002290)
    b = ff(b, c, d, a, x[i + 15], 22, 1236535329)

    a = gg(a, b, c, d, x[i + 1], 5, -165796510)
    d = gg(d, a, b, c, x[i + 6], 9, -1069501632)
    c = gg(c, d, a, b, x[i + 11], 14, 643717713)
    b = gg(b, c, d, a, x[i + 0], 20, -373897302)
    a = gg(a, b, c, d, x[i + 5], 5, -701558691)
    d = gg(d, a, b, c, x[i + 10], 9, 38016083)
    c = gg(c, d, a, b, x[i + 15], 14, -660478335)
    b = gg(b, c, d, a, x[i + 4], 20, -405537848)
    a = gg(a, b, c, d, x[i + 9], 5, 568446438)
    d = gg(d, a, b, c, x[i + 14], 9, -1019803690)
    c = gg(c, d, a, b, x[i + 3], 14, -187363961)
    b = gg(b, c, d, a, x[i + 8], 20, 1163531501)
    a = gg(a, b, c, d, x[i + 13], 5, -1444681467)
    d = gg(d, a, b, c, x[i + 2], 9, -51403784)
    c = gg(c, d, a, b, x[i + 7], 14, 1735328473)
    b = gg(b, c, d, a, x[i + 12], 20, -1926607734)

    a = hh(a, b, c, d, x[i + 5], 4, -378558)
    d = hh(d, a, b, c, x[i + 8], 11, -2022574463)
    c = hh(c, d, a, b, x[i + 11], 16, 1839030562)
    b = hh(b, c, d, a, x[i + 14], 23, -35309556)
    a = hh(a, b, c, d, x[i + 1], 4, -1530992060)
    d = hh(d, a, b, c, x[i + 4], 11, 1272893353)
    c = hh(c, d, a, b, x[i + 7], 16, -155497632)
    b = hh(b, c, d, a, x[i + 10], 23, -1094730640)
    a = hh(a, b, c, d, x[i + 13], 4, 681279174)
    d = hh(d, a, b, c, x[i + 0], 11, -358537222)
    c = hh(c, d, a, b, x[i + 3], 16, -722521979)
    b = hh(b, c, d, a, x[i + 6], 23, 76029189)
    a = hh(a, b, c, d, x[i + 9], 4, -640364487)
    d = hh(d, a, b, c, x[i + 12], 11, -421815835)
    c = hh(c, d, a, b, x[i + 15], 16, 530742520)
    b = hh(b, c, d, a, x[i + 2], 23, -995338651)

    a = ii(a, b, c, d, x[i + 0], 6, -198630844)
    d = ii(d, a, b, c, x[i + 7], 10, 1126891415)
    c = ii(c, d, a, b, x[i + 14], 15, -1416354905)
    b = ii(b, c, d, a, x[i + 5], 21, -57434055)
    a = ii(a, b, c, d, x[i + 12], 6, 1700485571)
    d = ii(d, a, b, c, x[i + 3], 10, -1894986606)
    c = ii(c, d, a, b, x[i + 10], 15, -1051523)
    b = ii(b, c, d, a, x[i + 1], 21, -2054922799)
    a = ii(a, b, c, d, x[i + 8], 6, 1873313359)
    d = ii(d, a, b, c, x[i + 15], 10, -30611744)
    c = ii(c, d, a, b, x[i + 6], 15, -1560198380)
    b = ii(b, c, d, a, x[i + 13], 21, 1309151649)
    a = ii(a, b, c, d, x[i + 4], 6, -145523070)
    d = ii(d, a, b, c, x[i + 11], 10, -1120210379)
    c = ii(c, d, a, b, x[i + 2], 15, 718787259)
    b = ii(b, c, d, a, x[i + 9], 21, -343485551)

    a = safeAdd(a, olda)
    b = safeAdd(b, oldb)
    c = safeAdd(c, oldc)
    d = safeAdd(d, oldd)
  }
  return [a, b, c, d]
}

/*
 * Convert an array of little-endian words to a hex string.
 */
function binl2hex(binarray) {
  var hexTab = '0123456789abcdef'
  var str = ''
  for (var i = 0; i < binarray.length * 4; i++) {
    str +=
      hexTab.charAt((binarray[i >> 2] >> ((i % 4) * 8 + 4)) & 0xf) +
      hexTab.charAt((binarray[i >> 2] >> ((i % 4) * 8)) & 0xf)
  }
  return str
}

/*
 * Convert an array of little-endian words to a base64 encoded string.
 */
// function binl2b64(binarray) {
//   var tab = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
//   var str = ''
//   for (var i = 0; i < binarray.length * 32; i += 6) {
//     str += tab.charAt(
//       ((binarray[i >> 5] << i % 32) & 0x3f) |
//         ((binarray[i >> (5 + 1)] >> (32 - (i % 32))) & 0x3f)
//     )
//   }
//   return str
// }

/*
 * Convert an 8-bit character string to a sequence of 16-word blocks, stored
 * as an array, and append appropriate padding for MD4/5 calculation.
 * If any of the characters are >255, the high byte is silently ignored.
 */
function str2binl(str) {
  var nblk = ((str.length + 8) >> 6) + 1 // number of 16-word blocks
  var blks = new Array(nblk * 16)
  for (var ir = 0; ir < nblk * 16; ir++) blks[ir] = 0
  for (var i = 0; i < str.length; i++) {
    blks[i >> 2] |= (str.charCodeAt(i) & 0xff) << ((i % 4) * 8)
  }
  blks[i >> 2] |= 0x80 << ((i % 4) * 8)
  blks[nblk * 16 - 2] = str.length * 8
  return blks
}

function stringToUint(s) {
  s = unescape(encodeURIComponent(s))
  var uintArray = []
  for (var i = 0; i < s.length; i++) uintArray.push(s[i].charCodeAt(0))
  return new Uint8Array(uintArray)
}

function buf2binl(buffer) {
  if (typeof buffer === 'string') buffer = stringToUint(buffer)
  var nblk = ((buffer.length + 8) >> 6) + 1 // number of 16-word blocks
  var blks = new Array(nblk * 16)
  for (var ir = 0; ir < nblk * 16; ir++) blks[ir] = 0
  for (var i = 0; i < buffer.length; i++) {
    blks[i >> 2] |= (buffer[i] & 0xff) << ((i % 4) * 8)
  }
  blks[i >> 2] |= 0x80 << ((i % 4) * 8)
  blks[nblk * 16 - 2] = buffer.length * 8
  return blks
}

/*
 * External interface
 */
function utf8MD5(str) {
  return binl2hex(coreMD5(buf2binl(str)))
}
function hexMD5(str) {
  return binl2hex(coreMD5(str2binl(str)))
}

module.exports = {
  hexMD5: hexMD5,
  utf8MD5: utf8MD5
}

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1781963104012, function(require, module, exports) {
/*
 * @Author: magic
 * @Date: 2019-03-27 10:02:03
 * @LastEditTime: 2020-06-17 18:26:23
 * @LastEditors: Please set LastEditors
 * @Description: In User Settings Edit
 * @FilePath: /bmob-js-sdk-es6/src/lib/wxRequest.js
 */
let Bmob = require('./bmob')
let md5 = require('./utf8md5')
let sdkType = 'wechatApp'
if (typeof (tt) !== 'undefined') {
  sdkType = 'toutiao'
} else if (typeof (qq) !== 'undefined') {
  sdkType = 'qqApp'
}

const setHeader = (config, route, method, parma) => {
  const t = Math.round(new Date().getTime() / 1000)
  const rand = Bmob.utils.randomString()
  let body = (method === 'get' || method === 'delete') ? '' : JSON.stringify(parma)

  const sign = md5.utf8MD5(route + t + config.securityCode + rand + body + config.serverVersion)
  // const sign = md5.utf8MD5(route + t + config.securityCode + rand)
  let header = {
    'content-type': 'application/json',
    'X-Bmob-SDK-Type': sdkType,
    'X-Bmob-Safe-Sign': sign,
    'X-Bmob-Safe-Timestamp': t,
    'X-Bmob-Noncestr-Key': rand,
    'X-Bmob-SDK-Version': config.serverVersion,
    'X-Bmob-Secret-Key': config.secretKey
  }
  if (config.applicationMasterKey) {
    header['X-Bmob-Master-Key'] = config.applicationMasterKey
  }
  return header
}

const request = (route, method = 'get', parma = {}) => {
  return new Promise((resolve, reject) => {
    const header = setHeader(Bmob._config, route, method, parma)

    if (undefined === Bmob.User) {
      Bmob = require('./bmob')
    }
    let current = Bmob.User.current()
    if (current) {
      header['X-Bmob-Session-Token'] = current.sessionToken
    }
    if (Bmob._config.deBug === true) {
      console.log('host:', Bmob._config.host)
      console.log('parma:', parma)
    }



    var wxurl = Bmob._config.host + route
    if (undefined!=parma.where){
      if (method == 'get' && sdkType == 'toutiao') {
        parma.where =
          JSON.stringify(parma.where)
        const queryParams = new URLSearchParams(parma);
        wxurl += "?" + queryParams.toString()
        parma = {}
      }
    }

    wx.request({
      url: wxurl,
      method: method,
      data: parma,
      header: header,
      success: res => {
        if ((res.data.code && res.data.error) || res.data.error) {
          reject(res.data)
        }
        resolve(res.data)
      },
      fail: err => {
        console.log(err)
        reject(err)
      }
    })
  })
}

module.exports = request
}, function(modId) { var map = {"./bmob":1781963103969,"./utf8md5":1781963104011}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1781963104013, function(require, module, exports) {
/*
 * @Author: your name
 * @Date: 2019-03-27 10:02:03
 * @LastEditTime: 2020-06-17 18:00:12
 * @LastEditors: Please set LastEditors
 * @Description: In User Settings Edit
 * @FilePath: /bmob-js-sdk-es6/src/lib/hapRequest.js
 */
let Bmob = require('./bmob')
let md5 = require('./utf8md5')
const fetch = "xxrequire('@system.fetch')xx"

const setHeader = (config, route, method, parma) => {
  const t = Math.round(new Date().getTime() / 1000)
  const rand = Bmob.utils.randomString()
  let body = (method === 'get' || method === 'delete') ? '' : JSON.stringify(parma)
  const sign = md5.utf8MD5(route + t + config.securityCode + rand + body + config.serverVersion)
  let header = {
    'content-type': 'application/json',
    'X-Bmob-SDK-Type': 'wechatApp',
    'X-Bmob-Safe-Sign': sign,
    'X-Bmob-Safe-Timestamp': t,
    'X-Bmob-Noncestr-Key': rand,
    'X-Bmob-SDK-Version': config.serverVersion,
    'X-Bmob-Secret-Key': config.secretKey
  }
  if (config.applicationMasterKey) {
    header['X-Bmob-Master-Key'] = config.applicationMasterKey
  }
  return header
}

const request = (route, method = 'get', parma = {}) => {
  return new Promise((resolve, reject) => {
    const header = setHeader(Bmob._config, route, method, parma)

    if (undefined === Bmob.User) {
      Bmob = require('./bmob')
    }
    let current = Bmob.User.current()
    if (current) {
      header['X-Bmob-Session-Token'] = current.sessionToken
    }

    if (typeof parma === 'object') {
      parma = JSON.stringify(parma)
    }

    fetch.fetch({
      url: Bmob._config.host + route,
      header: header,
      method: method,
      data: parma,
      success: function (res) {
        const data = JSON.parse(res.data)
        if (data.code) {
          reject(data)
        }
        resolve(data)
      },
      fail: function (data, code) {
        console.log(`handling fail, code = ${code}`)
        reject(data)
      }
    })
  })
}
module.exports = request

}, function(modId) { var map = {"./bmob":1781963103969,"./utf8md5":1781963104011}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1781963104014, function(require, module, exports) {
// const Bmob = require('./bmob')
const utils = require('./utils')

let storage
// //获取当前应用类型
const type = utils.getAppType()
// h5
if (type === 'h5') {
  storage = require('./webstorage')
} else if (type === 'wx') {
  // 小程序
  storage = require('./wxstorage')
} else if (type === 'hap') {
  storage = require('./hapStorage')
  // 快应用功能
} else if (type === 'nodejs') {
  // 快应用功能
  storage = require('./nodestorage')
}

module.exports = storage

}, function(modId) { var map = {"./utils":1781963103970,"./webstorage":1781963104015,"./wxstorage":1781963104016,"./hapStorage":1781963104017,"./nodestorage":1781963104018}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1781963104015, function(require, module, exports) {
const { isString } = require('./dataType')

let lt
if (typeof cc !== 'undefined') {
  lt = cc.sys.localStorage
} else {
  lt = localStorage
}
const storage = {
  save (key, value) {
    if (!isString(key) || !value) {
      throw new Error(415)
    }
    lt.setItem(key, JSON.stringify(value))
  },
  fetch (key) {
    if (!isString(key)) {
      throw new Error(415)
    }
    return JSON.parse(lt.getItem(key)) || null
  },
  remove (key) {
    if (!isString(key)) {
      throw new Error(415)
    }
    lt.removeItem(key)
  },
  clear () {
    lt.clear()
  }
}
module.exports = storage

}, function(modId) { var map = {"./dataType":1781963103975}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1781963104016, function(require, module, exports) {
const { isString, isObject } = require('./dataType')

const storage = {
  save (key, value) {
    if (!isString(key) || !value) {
      throw new Error(415)
    }
    value = !isObject(value) ? value : JSON.stringify(value)
    return wx.setStorageSync(key, value)
  },
  fetch (key) {
    if (!isString(key)) {
      throw new Error(415)
    }
    return wx.getStorageSync(key) || null
  },
  remove (key) {
    if (!isString(key)) {
      throw new Error(415)
    }
    return wx.removeStorageSync(key)
  },
  clear () {
    return wx.clearStorageSync()
  }
}
module.exports = storage

}, function(modId) { var map = {"./dataType":1781963103975}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1781963104017, function(require, module, exports) {
const { isString } = require('./dataType')
const storages = "xxrequire('@system.storage')xx"
const storage = {
  save (key, value) {
    if (!isString(key) || !value) {
      throw new Error(415)
    }
    storages.set({
      key: key,
      value: JSON.stringify(value),
      success: function (data) {
        console.log('handling success')
        return data
      },
      fail: function (data, code) {
        console.log(`handling fail, code = ${code}`)
      }
    })
  },
  fetch (key) {
    if (!isString(key)) {
      throw new Error(415)
    }
    return new Promise((resolve, reject) => {
      return storages.get({
        key: key,
        success: function (data) {
          resolve(data || null)
        },
        fail: function (data, code) {
          console.log(`handling fail, code = ${code}`)
          reject(data)
        }
      })
    })
  },
  remove (key) {
    if (!isString(key)) {
      throw new Error(415)
    }
    storages.delete({
      key: key,
      success: function (data) {
        console.log('handling success')
      },
      fail: function (data, code) {
        console.log(`handling fail, code = ${code}`)
      }
    })
  },
  clear () {
    storages.clear({
      success: function (data) {
        console.log('handling success')
      },
      fail: function (data, code) {
        console.log(`handling fail, code = ${code}`)
      }
    })
  }
}
module.exports = storage

}, function(modId) { var map = {"./dataType":1781963103975}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1781963104018, function(require, module, exports) {
const storage = {
  save (key, value) {

  },
  fetch (key) {
    return null
  },
  remove (key) {

  },
  clear () {
  }
}
module.exports = storage

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1781963104019, function(require, module, exports) {
const request = require("./request");
const storage = require("./storage");
const query = require("./query");
const Bmob = require("./bmob");
const Error = require("./error");
const { isObject, isString, isNumber } = require("./dataType");

const user = class user extends query {
  constructor() {
    const tableName = "_User";
    super(tableName);
  }
  set(key, val = "") {
    if (isString(key)) {
      this.setData[key] = val;
    }
  }
  requestEmailVerify(email) {
    if (!isString(email)) {
      // 异常
      throw new Error(415);
    }

    this.setData = Object.assign({}, { email });
    console.log(this.setData);
    const route = Bmob._config.parameters.REQUEST_EMAIL_VERIFY;
    return request(route, "post", this.setData);
  }
  register(parma) {
    if (!isObject(parma)) {
      // 异常
      throw new Error(415);
    }
    this.setData = Object.assign({}, parma);
    const route = Bmob._config.parameters.REGISTER;
    return request(route, "post", this.setData);
  }

  login(username, password) {
    if (!isString(username) || !isString(password)) {
      // 异常
      throw new Error(415);
    }
    this.setData = Object.assign({}, { username, password });
    const route = Bmob._config.parameters.LOGIN;
    return new Promise((resolve, reject) => {
      request(route, "get", this.setData)
        .then((res) => {
          storage.save("bmob", res);
          resolve(res);
        })
        .catch((err) => {
          reject(err);
        });
    });
  }
  logout() {
    storage.clear();
  }
  users() {
    const route = Bmob._config.parameters.USERS;
    return request(route, "get");
  }
  decryption(e) {
    let self = this;
    return new Promise((resolve, reject) => {
      const i = e.iv ? e.iv : e.detail.iv;
      const d = e.encryptedData ? e.encryptedData : e.detail.encryptedData;

      // 调用云函数解密
      const current = self.current();
      let s;
      if (typeof tt !== "undefined") {
        s = current.authData.toutiao.session_key;
      } else if (typeof qq !== "undefined") {
        s = current.authData.qqapp.session_key;
      } else {
        s = current.authData.weapp.sk;
      }
      const data = {
        sk: s,
        encryptedData: d,
        iv: i,
      };
      const route = Bmob._config.parameters.DECRYPTION;
      request(route, "POST", data)
        .then((res) => {
          resolve(res);
        })
        .catch((err) => {
          reject(err);
        });
    });
  }
  signOrLoginByMobilePhone(mobilePhoneNumber, smsCode) {
    // 手机号登陆
    if (!isString(mobilePhoneNumber) || !isString(smsCode)) {
      // 异常
      throw new Error(415);
    }
    
    this.setData = Object.assign({}, { mobilePhoneNumber, smsCode });
    const route = Bmob._config.parameters.USERSV1;
    return request(route, "post", this.setData);
  }
  requestOpenId(code, a = "") {
    const route = Bmob._config.parameters.WECHAT_APP;
    return request(route + code, "POST", { anonymous_code: a });
  }
  // 从当前用户对象中提取 openid 与 sk/session_key，兼容 weapp / toutiao / qq
  getOpenIdAndSk(currentUser) {
    let openid;
    let sk;

    if (typeof tt !== "undefined") {
      openid =
        currentUser.openid != undefined
          ? currentUser.openid
          : currentUser.authData.toutiao &&
            currentUser.authData.toutiao.openid;
      sk =
        currentUser.authData.toutiao &&
        currentUser.authData.toutiao.session_key;
    } else if (typeof qq !== "undefined") {
      openid =
        currentUser.openid != undefined
          ? currentUser.openid
          : currentUser.authData.qqapp &&
            currentUser.authData.qqapp.openid;
      sk =
        currentUser.authData.qqapp &&
        currentUser.authData.qqapp.session_key;
    } else {
      openid =
        currentUser.openid != undefined
          ? currentUser.openid
          : currentUser.authData.weapp &&
            currentUser.authData.weapp.openid;
      sk =
        currentUser.authData.weapp && currentUser.authData.weapp.sk;
    }

    return { openid, sk };
  }
  checkSessionKey(openid, sk) {
    const route = Bmob._config.parameters.CHECK_SESSION_KEY;
    return request(route, "POST", { openid, sk });
  }
  linkWith(data) {
    // 第三方登陆
    let authData = { authData: data };
    const route = Bmob._config.parameters.USERSV1;
    return request(route, "POST", authData);
  }
  loginWithWeapp(code, a = "", str) {
    return new Promise((resolve, reject) => {
      this.requestOpenId(code, a)
        .then((res) => {
          let w = { weapp: res };
          if (typeof tt !== "undefined") {
            delete res.error;
            w = { toutiao: res };
          }
          if (typeof qq !== "undefined") {
            delete res.errcode;
            delete res.errmsg;
            w = { qqapp: res };
          }
          if (str === "openid") {
            console.log("openid", res);
            resolve(res);
          } else {
            const result = this.linkWith(w);
            resolve(result);
          }
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  upInfo(userInfo) {
    if (!isObject(userInfo)) {
      throw new Error(415);
    }
    return new Promise((resolve, reject) => {
      let nickName = userInfo.nickName;
      let avatarUrl = userInfo.avatarUrl;

      let currentUser = this.current();
      if (!currentUser) {
        throw new Error(415);
      }
      let openid = storage.fetch("openid");
      this.get(currentUser.objectId)
        .then((res) => {
          res.set("nickName", nickName);
          res.set("userPic", avatarUrl);
          res.set("openid", openid);
          res
            .save()
            .then((result) => {
              resolve(result);
            })
            .catch((err) => {
              console.log(err);
              reject(err);
            });
        })
        .catch((err) => {
          console.log(err);
          reject(err);
        });
    });
  }
  openId() {
    this.auth("openid");
  }
  auth(str = "") {
    let that = this;
    return new Promise((resolve, reject) => {
      const login = () => {
        wx.login({
          success: (res) => {
            let anonymousCode = "";
            if (typeof tt !== "undefined") {
              anonymousCode = res.anonymousCode;
            }
            that.loginWithWeapp(res.code, anonymousCode, str).then(
              (user) => {
                if (user.error) {
                  throw new Error(415);
                }
                // 统一通过工具方法从 user 中获取 openid
                const { openid } = that.getOpenIdAndSk(user);
                storage.save("openid", openid);
                storage.save("bmob", user);
                // 保存用户其他信息到用户表
                resolve(user);
              },
              function (err) {
                reject(err);
              }
            );
          },
        });
      };

      let c = that.current();
      if (c === null) {
        login();
      } else {
        // 有缓存时，先检查 sessionKey 是否仍然有效
        const { openid, sk } = that.getOpenIdAndSk(c);

        // 如果缺少必要信息，直接重新登录
        if (!openid || !sk) {
          login();
          return;
        }

        that
          .checkSessionKey(openid, sk)
          .then((res) => {
            // 只有接口返回 ok 才沿用原来的缓存逻辑
            if (res && res.errcode === 0 && res.errmsg === "ok") {
              if (str == "openid") {
                resolve(c.openid);
              } else {
                resolve(c);
              }
            } else {
              console.log('checkSessionKey 失败', res);
              console.log('重新登录');
              
              login();
            }
          })
          .catch(() => {
            // 接口异常，保守起见重新登录
            login();
          });
      }
    });
  }
};

module.exports = user;

}, function(modId) { var map = {"./request":1781963103979,"./storage":1781963104014,"./query":1781963103978,"./bmob":1781963103969,"./error":1781963103976,"./dataType":1781963103975}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1781963104020, function(require, module, exports) {
const request = require("./request");
let Bmob = require("./bmob");
const Error = require("./error");
const utils = require("./utils");
let md5 = require("./utf8md5");
const requestHap = "xxrequire('@system.request')xx";
const { isString, isArray } = require("./dataType");
let list = [];

class file {
  constructor(name, parma) {
    if (name && parma) {
      if (!isString(name)) {
        throw new Error(415);
      }
      // let ext = name.substring(name.lastIndexOf(".") + 1);
      // console.log("name", name, name.substring(0, name.lastIndexOf(".")));
      // let nams = name.substring(0, name.lastIndexOf("."));
      list.push({
        name: name,
        route: `${Bmob._config.parameters.FILES}/${name}`,
        data: parma,
      });
    }
  }
  fileUpload(p = "") {
    let that = this;
    return new Promise((resolve, reject) => {
      if (undefined === Bmob.User) {
        Bmob = require("./bmob");
      }

      let sessionToken = "bmob";
      let current = Bmob.User.current();
      if (current) {
        sessionToken = current.sessionToken;
      }

      const data = [];

      const t = Math.round(new Date().getTime() / 1000);
      const rand = Bmob.utils.randomString();
      let route = list[0].route;
      if (p === "wxc") {
        route = route.replace(
          Bmob._config.parameters.FILES,
          Bmob._config.parameters.FILESCHECK
        );
      }
      const sign = md5.utf8MD5(route + t + Bmob._config.securityCode + rand);
      const key = {
        "content-type": "application/json",
        "X-Bmob-SDK-Type": "wechatApp",
        "X-Bmob-Safe-Sign": sign,
        "X-Bmob-Safe-Timestamp": t,
        "X-Bmob-Noncestr-Key": rand,
        "X-Bmob-Session-Token": sessionToken,
        "X-Bmob-Secret-Key": Bmob._config.secretKey,
      };
      const formData = Object.assign(
        {
          _ContentType: "text/plain",
          mime_type: "text/plain",
          category: "wechatApp",
          _ClientVersion: "js3.6.1",
          _InstallationId: "bmob",
        },
        key
      );
      for (let item of list) {
        let ro = item.route;
        if (p === "wxc") {
          ro = item.route.replace(
            Bmob._config.parameters.FILES,
            Bmob._config.parameters.FILESCHECK
          );
        }

        console.log(item.route, Bmob._config.parameters.FILESCHECK, "ror");
        wx.uploadFile({
          url: Bmob._config.host + ro, // 仅为示例，非真实的接口地址
          filePath: item.data,
          name: "file",
          header: key,
          formData: formData,
          success: function (res) {
            let url = JSON.parse(res.data);
            if (p === "wxc") {
              if (url.msg === "ok") {
                resolve(that.fileUpload());
              } else {
                reject(url);
              }
            } else {
              data.push(url);
              if (data.length === list.length) {
                list = [];
                resolve(data);
                reject(data);
              }
            }
          },
          fail: function (err) {
            data.push(err);
          },
        });
      }
    });
  }
  imgSecCheck() {
    if (!list.length) {
      throw new Error(417);
    }

    return this.fileUpload("wxc");
  }
  // 清空list
  clear(){
    list = []
  }
  save() {
    if (!list.length) {
      throw new Error(417);
    }
    let fileObj;
    // //获取当前应用类型
    const type = utils.getAppType();

    // h5
    if (type === "h5" || type === "nodejs") {
      fileObj = new Promise((resolve, reject) => {
        const data = [];
        for (let item of list) {
          request(item.route, "post", item.data)
            .then((url) => {
              data.push(url);
              if (data.length === list.length) {
                list = [];
                resolve(data);
                reject(data);
              }
            })
            .catch((err) => {
              data.push(err);
            });
        }
      });
    } else if (type === "wx") {
      if (!list.length) {
        throw new Error(417);
      }

      return this.fileUpload("wx");
    } else if (type === "hap") {
      // 快应用功能
      fileObj = new Promise((resolve, reject) => {
        if (undefined === Bmob.User) {
          Bmob = require("./bmob");
        }
        let sessionToken = "bmob";
        let current = Bmob.User.current();
        if (current) {
          sessionToken = current.sessionToken;
        }

        const data = [];
        const t = Math.round(new Date().getTime() / 1000);
        const rand = Bmob.utils.randomString();
        const route = list[0].route;
        console.log("rand", rand, Bmob, route);

        const sign = md5.utf8MD5(route + t + Bmob._config.securityCode + rand);
        const key = {
          "content-type": "application/json",
          "X-Bmob-SDK-Type": "wechatApp",
          "X-Bmob-Safe-Sign": sign,
          "X-Bmob-Safe-Timestamp": t,
          "X-Bmob-Noncestr-Key": rand,
          "X-Bmob-Session-Token": sessionToken,
          "X-Bmob-Secret-Key": Bmob._config.secretKey,
        };
        const formData = Object.assign(
          {
            _ContentType: "text/plain",
            mime_type: "text/plain",
            category: "wechatApp",
            _ClientVersion: "js3.6.1",
            _InstallationId: "bmob",
          },
          key
        );
        for (let item of list) {
          requestHap.upload({
            url: Bmob._config.host + item.route,
            files: [
              {
                uri: item.data,
                name: "file",
                filename: item.name,
              },
            ],
            header: {
              "X-Bmob-SDK-Type": "wechatApp",
            },
            data: formData,
            success: function (res) {
              console.log("handling success" + data);
              let url = res.data;
              data.push(url);
              if (data.length === list.length) {
                list = [];
                resolve(data);
                reject(data);
              }
            },
            fail: function (data, code) {
              console.log(`handling fail, code = ${code}`);
            },
          });
        }
      });
    }
    return fileObj;
  }
  GetUrlRelativePath(url) {
    let arrUrl = url.split("//");
    let start = arrUrl[1].indexOf("/");
    let relUrl = arrUrl[1].substring(start);
    if (relUrl.indexOf("?") != -1) {
      relUrl = relUrl.split("?")[0];
    }
    return relUrl;
  }
  destroy(parma) {
    let par = "";
    if (isString(parma)) {
      par = this.GetUrlRelativePath(parma);
      return request(`${Bmob._config.parameters.FILES}/upyun/${par}`, "delete");
    } else if (isArray(parma)) {
      const data = [];
      parma.map((item) => {
        par = this.GetUrlRelativePath(item);
        data.push(par);
      });
      return request(Bmob._config.parameters.DELFILES, "post", {
        upyun: data,
      });
    } else {
      throw new Error(415);
    }
  }
}

module.exports = file;

}, function(modId) { var map = {"./request":1781963103979,"./bmob":1781963103969,"./error":1781963103976,"./utils":1781963103970,"./utf8md5":1781963104011,"./dataType":1781963103975}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1781963104021, function(require, module, exports) {
const request = require('./request')
const Bmob = require('./bmob')
const Error = require('./error')

class pay {
  weApp (price, productName, body) {
    let openid = wx.getStorageSync('openid')
    if (!price || !productName || !body || !openid) {
      throw new Error(416)
    }
    // 传参数金额，名称，描述,openid
    let data = { 'order_price': price, 'product_name': productName, 'body': body, 'open_id': openid, 'pay_type': 4 }

    let route = Bmob._config.parameters.PAY
    return request(route, 'post', data)
  }

  /**
   * 微信虚拟支付 - 创建虚拟支付订单
   * 对应后端接口：POST /1/wxvp/createOrder
   *
   * @param {Object} options
   * @param {number} [options.env=0]          环境：0-正式，1-沙箱，未传默认 0
   * @param {string} options.mode             支付类型：short_series_goods 或 short_series_coin（必填）
   * @param {number} options.goods_price      商品单价，单位：分，>0（必填）
   * @param {number} [options.buy_quantity=1] 购买数量
   * @param {string} [options.product_id]     道具 ID，mode=short_series_goods 时必填
   * @param {string} [options.currency_type]  货币类型，默认 CNY
   * @param {string} [options.attach]         透传字段
   * @param {string} [options.name]           商品名称，仅存入本地订单记录
   * @param {string} [options.biz_meta]       业务透传数据
   * @param {string} [options.openid]         用户 openid，默认从本地缓存读取
   * @param {string} [options.session_key]    用户 session_key，默认从本地缓存读取
   * @returns {Promise<Object>}               返回创建的虚拟支付订单信息
   */
  wxvpCreateOrder (options = {}) {
    const current = Bmob.User.current()
    // 优先 options（本地 wx.login + loginWithWeapp openid 未 link 时用）
    let sessionKey = options.session_key
    let openid = options.openid
    if (!sessionKey || !openid) {
      if (current && current.authData && current.authData.weapp) {
        sessionKey = sessionKey || current.authData.weapp.sk
        openid = openid || current.authData.weapp.openid
      }
    }

    console.log('sessionKey', sessionKey)
    console.log('openid', openid)
    console.log('wxvpCreateOrder options', options)

    if (!openid || !sessionKey) {
      throw new Error(416, '请用户登录后再进行支付.')
    }
  
    const env = options.env !== undefined && options.env !== null ? options.env : 0
    if (!options.mode) {
      throw new Error(416, 'mode is required.')
    }
    if (!options.goods_price) {
      throw new Error(416, 'goods_price is required.')
    }

    if (options.mode === 'short_series_goods' && !options.product_id) {
      throw new Error(416, 'product_id is required when mode is short_series_goods.')
    }

    const data = {
      openid,
      sk: sessionKey,
      env,
      mode: options.mode,
      goods_price: options.goods_price,
      buy_quantity: options.buy_quantity || 1,
      product_id: options.product_id,
      currency_type: options.currency_type,
      attach: options.attach,
      name: options.name,
      biz_meta: options.biz_meta
    }

    const route = Bmob._config.parameters.WXVP_CREATE_ORDER
    return request(route, 'post', data)
  }

  /**
   * 微信虚拟支付 - 查询用户代币余额（有价 + 赠送）
   * 对应后端接口：POST /1/wxvp/queryUserBalance
   * 支付前可调用以确认余额是否充足。
   *
   * @param {Object} [options]
   * @param {string} [options.openid]      用户 openid，默认从当前登录用户读取
   * @param {number} [options.env=0]       环境：0-正式，1-沙箱，未传默认 0
   * @param {string} [options.sk]          登录返回的 sk，默认与 wxvpCreateOrder 同源（session_key）
   * @param {string} [options.session_key] 同 sk，与 wxvpCreateOrder 一致
   * @returns {Promise<Object>} errcode/errmsg 及 balance、present_balance、sum_save 等字段
   */
  wxvpQueryUserBalance (options = {}) {
    const current = Bmob.User.current()
    let sk = options.sk || options.session_key
    let openid = options.openid
    if (!sk || !openid) {
      if (current && current.authData && current.authData.weapp) {
        sk = sk || current.authData.weapp.sk
        openid = openid || current.authData.weapp.openid
      }
    }
    if (!openid || !sk) {
      throw new Error(416, '请用户登录后再查询余额.')
    }
    const env = options.env !== undefined && options.env !== null ? options.env : 0
    const data = { openid, env, sk }
    const route = Bmob._config.parameters.WXVP_QUERY_USER_BALANCE
    return request(route, 'post', data)
  }

  /**
   * 微信虚拟支付 - 查询现金订单状态
   * 对应后端接口：POST /1/wxvp/queryOrder
   *
   * 用于查询现金订单（道具直购或代币充值）的当前状态及结算信息。
   *
   * @param {Object} options
   * @param {string} [options.openid]      用户 openid，默认从当前登录用户读取
   * @param {number} [options.env=0]       环境：0-正式，1-沙箱，未传默认 0
   * @param {string} [options.order_id]    业务订单号，与 wx_order_id 二选一
   * @param {string} [options.wx_order_id] 微信内部单号，与 order_id 二选一
   * @returns {Promise<Object>}            返回 errcode、errmsg 及 order 订单详情对象
   */
  wxvpQueryOrder (options = {}) {
    const current = Bmob.User.current()
    let openid = options.openid

    if (!openid && current && current.authData && current.authData.weapp) {
      openid = current.authData.weapp.openid
    }

    if (!openid) {
      throw new Error(416, '请用户登录后再查询订单.')
    }

    // env 默认为 0（正式环境），与其它 wxvp 接口保持一致
    const env = options.env !== undefined && options.env !== null ? options.env : 0

    if (!options.order_id && !options.wx_order_id) {
      throw new Error(416, 'order_id 与 wx_order_id 必须二选一传入.')
    }

    const data = {
      openid,
      env,
      order_id: options.order_id,
      wx_order_id: options.wx_order_id
    }

    const route = Bmob._config.parameters.WXVP_QUERY_ORDER
    return request(route, 'post', data)
  }

  /**
   * 微信虚拟支付 - 代币扣减支付
   * 对应后端接口：POST /1/wxvp/currencyPay
   *
   * 从用户代币账户中扣减指定数量的代币，用于代币支付场景。
   * 扣减成功后应立即为用户发货。
   *
   * @param {Object} options
   * @param {string} [options.openid]   用户 openid，默认从当前登录用户读取（必填）
   * @param {number} [options.env=0]    环境：0-正式，1-沙箱，未传默认 0（必填）
   * @param {string} [options.sk]       登录返回的 sk（必填，默认从当前登录用户 weapp.sk 读取）
   * @param {number} options.amount     支付的代币数量，>0（必填）
   * @param {string} options.order_id   业务订单号，全局唯一（必填）
   * @param {string} [options.payitem]  物品信息 JSON 字符串（选填）
   * @param {string} [options.remark]   备注信息（选填）
   * @returns {Promise<Object>}         errcode、errmsg、order_id、balance、used_present_amount
   */
  wxvpCurrencyPay (options = {}) {
    const current = Bmob.User.current()
    let sk = options.sk
    let openid = options.openid

    if ((!sk || !openid) && current && current.authData && current.authData.weapp) {
      sk = sk || current.authData.weapp.sk
      openid = openid || current.authData.weapp.openid
    }

    if (!openid || !sk) {
      throw new Error(416, '请用户登录后再进行代币支付.')
    }

    const env = options.env !== undefined && options.env !== null ? options.env : 0

    if (!options.amount || options.amount <= 0) {
      throw new Error(416, 'amount must be greater than 0.')
    }
    if (!options.order_id) {
      throw new Error(416, 'order_id is required.')
    }

    const data = {
      openid,
      env,
      sk,
      amount: options.amount,
      order_id: options.order_id,
      payitem: options.payitem,
      remark: options.remark
    }

    const route = Bmob._config.parameters.WXVP_CURRENCY_PAY
    return request(route, 'post', data)
  }

  /**
   * 微信虚拟支付 - 代币支付退款
   * 对应后端接口：POST /1/wxvp/cancelCurrencyPay
   *
   * 对 `currencyPay` 接口产生的代币支付订单发起退款（逆操作），将代币退还给用户。
   *
   * @param {Object} options
   * @param {string} [options.openid]       用户 openid，默认从当前登录用户读取（必填）
   * @param {number} [options.env=0]       环境：0-正式，1-沙箱，未传默认 0（必填）
   * @param {string} [options.sk]          登录返回的 sk（必填，默认从当前登录用户 weapp.sk 读取）
   * @param {string} options.pay_order_id  原 `currencyPay` 调用时传入的 `order_id`（必填）
   * @param {string} options.order_id      本次退款单的单号，需全局唯一（必填）
   * @param {number} options.amount        退款代币数量，须大于 0（必填）
   * @returns {Promise<Object>}            errcode、errmsg、order_id
   */
  wxvpCancelCurrencyPay (options = {}) {
    const current = Bmob.User.current()
    let sk = options.sk
    let openid = options.openid

    if ((!sk || !openid) && current && current.authData && current.authData.weapp) {
      sk = sk || current.authData.weapp.sk
      openid = openid || current.authData.weapp.openid
    }

    if (!openid || !sk) {
      throw new Error(416, '请用户登录后再进行代币退款.')
    }

    const env = options.env !== undefined && options.env !== null ? options.env : 0

    if (!options.pay_order_id) {
      throw new Error(416, 'pay_order_id is required.')
    }
    if (!options.order_id) {
      throw new Error(416, 'order_id is required.')
    }
    if (!options.amount || options.amount <= 0) {
      throw new Error(416, 'amount must be greater than 0.')
    }

    const data = {
      openid,
      env,
      sk,
      pay_order_id: options.pay_order_id,
      order_id: options.order_id,
      amount: options.amount
    }

    const route = Bmob._config.parameters.WXVP_CANCEL_CURRENCY_PAY
    return request(route, 'post', data)
  }
}

module.exports = pay

}, function(modId) { var map = {"./request":1781963103979,"./bmob":1781963103969,"./error":1781963103976}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1781963104022, function(require, module, exports) {
// const Bmob = require('./bmob')
const Error = require('./error')
const Emitter = {
  setup (target) {
    let listeners = []

    Object.assign(target, {
      on (type, handle) {
        if (typeof handle === 'function') {
          listeners.push([type, handle])
        }
      },
      emit (type, ...params) {
        listeners.forEach(
          ([listenType, handle]) => type === listenType && handle(...params)
        )
      },
      removeAllListeners () {
        listeners = []
      }
    })
  }
}

/**
 * 基于小程序 WebSocket 接口封装信道
 */
module.exports = class socket {
  constructor (id = '') {
    if (id === '') {
      throw new Error(415)
    }
    this.config = {
      host: 'wss.bmobcloud.com'
    }
    Emitter.setup((this.emitter = {}))
    this.applicationId = id
    this.initialize()
  }
  handshake () {
    function complete (data) {
      if (data instanceof Error) {
        self.connecting = false
        self.onError(data.message)
      } else {
        return data.split(':')[0]
      }
    }

    let url = 'https://' + this.config.host + '/socket.io/1/?t=' + new Date().getTime()
    let dataObject = {}
    let data = JSON.stringify(dataObject)

    let method = 'GET'

    return new Promise((resolve, reject) => {
      wx.request({
        method: method,
        url: url,
        data: data,
        header: {
          'content-type': 'text/plain'
        },
        success: function (res) {
          if (res.data && res.data.statusCode) {
            return resolve('request error', e)
          } else if (res.statusCode !== 200) {
            return resolve('request error', e)
          } else {
            return resolve(complete(res.data))
          }
        },
        fail: function (e) {
          return resolve('request error', e)
        }
      })
    })
  }
  initialize () {
    this.emitter.removeAllListeners()
    this.handshake().then(protocol => {
      try {
        let connectObj = this.connect(
          `wss://${this.config.host}/socket.io/1/websocket/` + protocol,
          {}
        )
        console.log(connectObj, 'connectObj')
        connectObj.then(res => {
          console.log(res, 'res-res')
        })
      } catch (connectError) {
        console.error({ connectError })
        throw connectError
      }
    })
    this.on('close', () => {
      console.log('连接已中断')
      setTimeout(() => this.initialize(), 5000)
    })

    return new Promise((resolve, reject) => {
      this.on('server_pub', data => {
        switch (data.action) {
          case 'updateTable':
            this.onUpdateTable(data.tableName, data.data)
            break
          case 'updateRow':
            this.onUpdateRow(data.tableName, data.objectId, data.data)
            break
          case 'deleteTable':
            this.onDeleteTable(data.tableName, data.data)
            break
          case 'deleteRow':
            this.onDeleteRow(data.tableName, data.objectId, data.data)
            break
        }
      })

      // 连接上socket.io服务器后触发的事件
      this.on('client_send_data', resp => {
        this.onInitListen()
      })
    })
  }

  onInitListen () { }

  connect (url, header) {
    // 小程序 wx.connectSocket() API header 参数无效，把会话信息附加在 URL 上
    const query = Object.keys(header)
      .map(key => `${key}=${encodeURIComponent(header[key])}`)
      .join('&')
    const seperator = url.indexOf('?') > -1 ? '&' : '?'
    url = [url, query].join(seperator)

    return new Promise((resolve, reject) => {
      wx.onSocketOpen(resolve)
      wx.onSocketError(reject)
      wx.onSocketMessage(packet => {
        try {
          let filter = function (str) {
            const { name, args } = JSON.parse(str)
            return { name, args }
          }
          let str = packet.data
          let startStr = str.slice(0, 4)
          // 检测心跳
          if (startStr === '2:::') {
            this.emit(false, true)
          }
          str = str.slice(4)

          // 截取后不能为空
          if (str === null || str === '') {
            return
          }
          const { name, args } = filter(str)
          let data = args == null ? '' : JSON.parse(args[0])
          this.emitter.emit(name, data)
        } catch (e) {
          console.log('Handle packet failed: ' + packet.data, e)
        }
      })
      wx.onSocketClose(() => this.emitter.emit('close'))
      wx.connectSocket({ url, header })
    })
  }

  on (message, handle) {
    this.emitter.on(message, handle)
  }

  emit (message, data) {
    data = data === undefined ? '5:::' : '2:::'
    message = message ? JSON.stringify(message) : ''
    wx.sendSocketMessage({
      data: data + message
    })
  }

  emitData (name, data) {
    data = JSON.stringify(data)
    return { name: name, args: [data] }
  }

  updateTable (tablename) {
    let data = {
      appKey: this.applicationId,
      tableName: tablename,
      objectId: '',
      action: 'updateTable'
    }
    data = this.emitData('client_sub', data)
    this.emit(data)
  }

  // 取消订阅更新数据表的数据
  unsubUpdateTable (tablename) {
    let data = {
      appKey: this.applicationId,
      tableName: tablename,
      objectId: '',
      action: 'unsub_updateTable'
    }
    data = this.emitData('client_unsub', data)
    this.emit(data)
  }

  // 订阅行更新的数据
  updateRow (tablename, objectId) {
    let data = {
      appKey: this.applicationId,
      tableName: tablename,
      objectId: objectId,
      action: 'updateRow'
    }
    data = this.emitData('client_sub', data)
    this.emit(data)
  }

  // 取消订阅行更新的数据
  unsubUpdateRow (tablename, objectId) {
    let data = {
      appKey: this.applicationId,
      tableName: tablename,
      objectId: objectId,
      action: 'unsub_updateRow'
    }
    data = this.emitData('client_unsub', data)
    this.emit(data)
  }

  // 订阅表删除的数据
  deleteTable (tablename) {
    let data = {
      appKey: this.applicationId,
      tableName: tablename,
      objectId: '',
      action: 'deleteTable'
    }
    data = this.emitData('client_sub', data)
    this.emit(data)
  }

  // 取消订阅表删除的数据
  unsubDeleteTable (tablename) {
    let data = {
      appKey: this.applicationId,
      tableName: tablename,
      objectId: '',
      action: 'unsub_deleteTable'
    }
    data = this.emitData('client_unsub', data)
    this.emit(data)
  }

  // 订阅更新数据表的数据
  deleteRow (tablename, objectId) {
    let data = {
      appKey: this.applicationId,
      tableName: tablename,
      objectId: objectId,
      action: 'deleteRow'
    }
    data = this.emitData('client_sub', data)
    this.emit(data)
  }

  // 订阅更新数据表的数据
  unsubDeleteRow (tablename, objectId) {
    let data = {
      appKey: this.applicationId,
      tableName: tablename,
      objectId: objectId,
      action: 'unsub_deleteRow'
    }
    data = this.emitData('client_unsub', data)
    this.emit(data)
  }

  // 监听服务器返回的更新数据表的数据，需要用户重写
  onUpdateTable (tablename, data) { }

  // 监听服务器返回的更新数据表的数据，需要用户重写
  onUpdateRow (tablename, objectId, data) { }

  // 监听服务器返回的更新数据表的数据，需要用户重写
  onDeleteTable (tablename, data) { }

  // 监听服务器返回的更新数据表的数据，需要用户重写
  onDeleteRow (tablename, objectId, data) { }
}

}, function(modId) { var map = {"./error":1781963103976}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1781963104023, function(require, module, exports) {
const utils = require("./utils");
const Bmob = require('./bmob')
const Error = require('./error')
const md5 = require("./utf8md5");
 


const setHeader = (config, route, method, parma) => {

  let sdkType = 'h5'
  if (typeof (tt) !== 'undefined') {
    sdkType = 'toutiao'
  } else if (typeof (qq) !== 'undefined') {
    sdkType = 'qqApp'
  } else if (Bmob.type === "wx") {
    sdkType = 'wechatApp'
  } else {
    sdkType = 'h5'
  }
  const t = Math.round(new Date().getTime() / 1000)
  const rand = Bmob.utils.randomString()
  let body = (method === 'get' || method === 'delete') ? '' : JSON.stringify(parma)

  const sign = md5.utf8MD5(route + t + config.securityCode + rand + body + config.serverVersion)

  let header = {
    'content-type': 'application/json',
    'X-Bmob-SDK-Type': sdkType,
    'X-Bmob-Safe-Sign': sign,
    'X-Bmob-Safe-Timestamp': t,
    'X-Bmob-Noncestr-Key': rand,
    'X-Bmob-SDK-Version': config.serverVersion,
    'X-Bmob-Secret-Key': config.secretKey
  }
  if (config.applicationMasterKey) {
    header['X-Bmob-Master-Key'] = config.applicationMasterKey
  }
  return header
}

// AI 请求封装
class webSocketAiClient {
  constructor() {

    // 连接状态
    this.connected = false;

    this.url = Bmob._config.host + Bmob._config.parameters.Ai;
    this.type = utils.getAppType(); //获取当前应用类型

    this.socket = null;

    // prompt 设置
    this.prompt = {}


    this.header = {}

    this.onOpenCallback = () => {
      console.log("连接成功...");
      this.connected = true
    };
    this.onMessageCallback = () => {
    };
    this.onCloseCallback = () => { this.connected = false };
    this.onErrorCallback = () => { this.connected = false };
    this.connect()
  }

  connect() {
    console.log("connect", this.url);
    const config = Bmob._config
    const header = setHeader(config, config.parameters.Ai, "get", {})
    this.header = header
    // console.log(this.header, 'this.header');
    // 默认h5
    var wsUrl = this.url.replace("http", "ws");
    switch (this.type) {
      case "wx":
        // 微信的链接方式
        this.socket = wx.connectSocket({
          // url: this.url,
          url: wsUrl + config.secretKey,
          header: this.header
        });
        this.socket.onOpen(() => {
          this.onOpenCallback();
        });
        this.socket.onMessage((event) => {
          console.log("onmessage...");
          const data = JSON.parse(event.data)
          const res = data.choices[0].delta.content
          if (res === "") {
            this.onMessageCallback('done');
          }
          this.onMessageCallback(res);

        });
        this.socket.onClose(() => {
          this.onCloseCallback();
        });
        this.socket.onError((error) => {
          this.onErrorCallback(error);
        });
        break;

      default:
        // 默认h5
        this.socket = new WebSocket(wsUrl + config.secretKey);
        this.socket.onopen = () => {
          this.onOpenCallback();
        };
        this.socket.onmessage = (event) => {
          console.log("onmessage...");
          const data = JSON.parse(event.data)
          const res = data.choices[0].delta.content
          if (res === "") {
            this.onMessageCallback('done');
          }
          this.onMessageCallback(res);
        };
        this.socket.onclose = () => {
          console.log("close...");
          this.onCloseCallback();
        };
        this.socket.onerror = (error) => {
          console.log("onerror...", error);
          this.onErrorCallback(error);
        };
        break;
    }

  }

  setPrompt(content){
    if(content===""){
      console.log("content不能为空");
      throw new Error(415);
    }
    this.prompt = {
      "content":content,"role":"system"
    }

  }

  send(data) {
  
    console.log(this.connected, 'this.connect');
    if (this.connected === false) {
      console.log("不能发送数据,请重连socket");
      throw new Error(415);

    } else {
      console.log("发送", data);

      // 发送的内容插入prompt
      if(JSON.stringify(this.prompt) !== '{}'){
        data = JSON.parse(data)
        data.messages.unshift(this.prompt);
        data = JSON.stringify(data)
      }

      if (this.type === "wx") {
        this.socket.send({
          data: data
        });
      } else {
        this.socket.send(data);
      }
    }
  }

  close() {
    if (this.type === "wx") {
      this.socket.close({
        code: 1000,
        reason: 'Normal closure'
      });
    } else {
      this.socket.close();
    }

  }

  onOpen(callback) {
    console.log("onOpen", callback);
    this.onOpenCallback = callback;
  }

  onMessage(callback) {
    console.log("收到", callback);
    this.onMessageCallback = callback;
  }

  onClose(callback) {
    console.log("onClose", callback);
    this.onCloseCallback = callback;
  }

  onError(callback) {
    console.log("onError", callback);
    this.onErrorCallback = callback;
  }
}
module.exports = webSocketAiClient
}, function(modId) { var map = {"./utils":1781963103970,"./bmob":1781963103969,"./error":1781963103976,"./utf8md5":1781963104011}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1781963104024, function(require, module, exports) {
const request = require("./request");
const Bmob = require("./bmob");
const Error = require("./error");
const { isObject, isString } = require("./dataType");

// --------------小程序SDK-------------------

/**
 * 生成小程序二维码
 * @return {Object}
 */
const generateCode = (data) => {
  if (!isObject(data)) {
    // 参数异常
    throw new Error(415);
  }
  let route = Bmob._config.parameters.GENERATECODE;
  return request(route, "post", data);
};

/**
 * 生成小程序二维码
 * @return {Object}
 */
const mediaCheckAsync = (data) => {
  if (!isObject(data)) {
    // 参数异常
    throw new Error(415);
  }
  let route = Bmob._config.parameters.MEDIACHECKASYNC;
  return request(route, "post", data);
};

/**
 * 获取access_token
 * @return {Object}
 */
const getAccessToken = () => {
  let route = Bmob._config.parameters.GETACCESSTOKEN;
  return request(route, "get");
};

/**
 * 获取微信小程序手机号
 * @param {Object} data 包含code参数的对象
 * @return {Object}
 */
const getPhoneNumber = (data) => {
  if (!isObject(data) || !data.code) {
    // 参数异常
    throw new Error(415);
  }
  let route = Bmob._config.parameters.GETPHONENUMBER;
  return request(route, "post", data);
};

/**
 * 小程序模版信息
 * @return {Object}
 */
const sendWeAppMessage = (data) => {
  if (!isObject(data)) {
    // 参数异常
    throw new Error(415);
  }
  let route = Bmob._config.parameters.SENDWEAPPMESSAGE;
  return request(route, "post", data);
};

/**
 * 小程序图片上传
 * @return {Object}
 */

/**
 * 微信退款
 * @return {Object}
 */
const refund = (data) => {
  if (!isObject(data)) {
    // 参数异常
    throw new Error(415);
  }
  let route = Bmob._config.parameters.REFUND;
  return request(route, "post", data);
};

/**
 * 微信主人通知(主人信息推送)
 * @return {Object}
 */
const notifyMsg = (data) => {
  if (!isObject(data)) {
    // 参数异常
    throw new Error(415);
  }
  let route = Bmob._config.parameters.NOTIFYMSG;
  return request(route, "post", data);
};

// --------------RESTful SDK-------------------

/**
 * 密码重置
 * @return {Object}
 */

// Email 重置
const requestPasswordReset = (data) => {
  if (!isObject(data)) {
    // 参数异常
    throw new Error(415);
  }
  let route = Bmob._config.parameters.REQUESTPASSWORDRESET;
  return request(route, "post", data);
};

// 短信验证码重置
const resetPasswordBySmsCode = (smsCode, data) => {
  if (!isString(smsCode)) {
    // 参数异常
    throw new Error(415);
  }
  let route = `${Bmob._config.parameters.RESETPASSWORDBYSMSCODE}/${smsCode}`;
  return request(route, "put", data);
};

// 提供旧密码方式安全修改用户密码
const updateUserPassword = (objectId, data) => {
  if (!isObject(data) || !isString(objectId)) {
    // 参数异常
    throw new Error(415);
  }
  let route = `${Bmob._config.parameters.UPDATEUSERPASSWORD}/${objectId}`;
  return request(route, "put", data);
};

// 检测小程序文本是否违法
const checkMsg = (content) => {
  if (!isString(content)) {
    // 参数异常
    throw new Error(415);
  }
  let route = `${Bmob._config.parameters.CHECK_MSG}`;
  const data = { content: content };
  return request(route, "post", data);
};

// 检测小程序文本是否违法
const checkMsg2 = (data) => {
  if (!isObject(data)) {
    // 参数异常
    throw new Error(415);
  }
  let route = `${Bmob._config.parameters.CHECK_MSG}`;
   
  return request(route, "post", data);
};

/**
 * 获取服务器时间
 * @return {Object}
 */

const timestamp = () => {
  let route = Bmob._config.parameters.TIMESTAMP;
  return request(route, "get");
};

/**
 * 推送消息
 * @return {Object}
 */
const push = (data) => {
  if (!isObject(data)) {
    // 参数异常
    throw new Error(415);
  }
  let route = Bmob._config.parameters.PUSH;
  return request(route, "post", data);
};

// ---------------云函数------------------------
/**
 * 云函数
 * @return {Object}
 */
const functions = (funName, data) => {
  // 如果运行的云函数不需要传入参数，注意，"{}"是不能缺的
  if (!data) {
    data = {};
  }
  if (!isString(funName)) {
    // 参数异常
    throw new Error(415);
  }
  const route = `${Bmob._config.parameters.FUNCTIONS}/${funName}`;
  return new Promise((resolve, reject) => {
    request(route, "post", data)
      .then(({ result }) => {
        try {
          resolve(JSON.parse(result));
        } catch (error) {
          resolve(result);
        }
      })
      .catch((err) => {
        reject(err);
      });
  });
};

const geoPoint = ({ latitude, longitude }) => {
  const validate = (latitude, longitude) => {
    if (latitude < -90.0) {
      throw new Error(419);
    }
    if (latitude > 90.0) {
      throw new Error(419);
    }
    if (longitude < -180.0) {
      throw new Error(419);
    }
    if (longitude > 180.0) {
      throw new Error(419);
    }
    return { latitude, longitude };
  };
  validate(latitude, longitude);
  return {
    __type: "GeoPoint",
    latitude: latitude,
    longitude: longitude,
  };
};

module.exports = {
  generateCode,
  getAccessToken,
  sendWeAppMessage,
  refund,
  notifyMsg,
  functions,
  timestamp,
  requestPasswordReset,
  resetPasswordBySmsCode,
  updateUserPassword,
  geoPoint,
  checkMsg,
  checkMsg2,
  mediaCheckAsync,
  push,
  getPhoneNumber,
};

}, function(modId) { var map = {"./request":1781963103979,"./bmob":1781963103969,"./error":1781963103976,"./dataType":1781963103975}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1781963104025, function(require, module, exports) {

const request = require('./request')
const Bmob = require('./bmob')
const Error = require('./error')
const { isObject, isString } = require('./dataType')

//   /**
// * 请求短信验证码
// * @param {Object} 相应的参数
// * @param {Object} Backbone-style options 对象。 options.success, 如果设置了，将会处理云端代码调用成功的情况。 options.error 如果设置了，将会处理云端代码调用失败的情况。 两个函数都是可选的。两个函数都只有一个参数。
// * @return {Bmob.Promise}
// */

const requestSmsCode = (data, options) => {
  if (!isObject(data)) {
    throw new Error(415)
  }
  let route = Bmob._config.parameters.REQUESTSMSCODE
  return request(route, 'post', data)
}
//   /**
// * 验证短信验证码
// * @param {Object} 相应的参数
// * @param {Object} Backbone-style options 对象。 options.success, 如果设置了，将会处理云端代码调用成功的情况。 options.error 如果设置了，将会处理云端代码调用失败的情况。 两个函数都是可选的。两个函数都只有一个参数。
// * @return {Bmob.Promise}
// */
const verifySmsCode = (smscode, data, options) => {
  if (!isString(smscode)) {
    // 参数异常
    throw new Error(415)
  }
  if (!isObject(data)) {
    // 参数异常
    throw new Error(415)
  }
  let route = `${Bmob._config.parameters.VERIFYSMSCODE}/${smscode}`
  return request(route, 'post', data)
}

module.exports = { requestSmsCode, verifySmsCode }

}, function(modId) { var map = {"./request":1781963103979,"./bmob":1781963103969,"./error":1781963103976,"./dataType":1781963103975}; return __REQUIRE__(map[modId], modId); })
return __REQUIRE__(1781963103967);
})()
//miniprogram-npm-outsideDeps=["https","url","zlib","assert","stream","../debug"]
//# sourceMappingURL=index.js.map