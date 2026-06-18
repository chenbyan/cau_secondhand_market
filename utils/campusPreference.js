const CAMPUS_OPTIONS = ['东校区', '西校区']
const CAMPUS_PREF_KEY = 'homeCampusPreference'

// 占位校区中心点。接入学校真实坐标后替换这里即可提升识别精度。
const CAMPUS_POINTS = {
  东校区: { latitude: 39.9042, longitude: 116.4074 },
  西校区: { latitude: 39.9078, longitude: 116.3976 }
}

const isValidCampus = (campus) => CAMPUS_OPTIONS.indexOf(campus) >= 0

const getDistance = (a, b) => {
  const dx = Number(a.latitude) - Number(b.latitude)
  const dy = Number(a.longitude) - Number(b.longitude)
  return dx * dx + dy * dy
}

const nearestCampus = (location) => {
  let best = CAMPUS_OPTIONS[0]
  let bestDistance = Infinity
  CAMPUS_OPTIONS.forEach((campus) => {
    const distance = getDistance(location, CAMPUS_POINTS[campus])
    if (distance < bestDistance) {
      best = campus
      bestDistance = distance
    }
  })
  return best
}

const getPreferredCampus = (fallbackCampus) => {
  const saved = wx.getStorageSync(CAMPUS_PREF_KEY)
  if (isValidCampus(saved)) return saved
  if (isValidCampus(fallbackCampus)) return fallbackCampus
  return CAMPUS_OPTIONS[0]
}

const setPreferredCampus = (campus) => {
  if (!isValidCampus(campus)) return ''
  wx.setStorageSync(CAMPUS_PREF_KEY, campus)
  return campus
}

const getSetting = () =>
  new Promise((resolve, reject) => {
    wx.getSetting({
      success: resolve,
      fail: reject
    })
  })

const authorizeLocation = () =>
  new Promise((resolve, reject) => {
    wx.authorize({
      scope: 'scope.userLocation',
      success: resolve,
      fail: reject
    })
  })

const promptOpenSetting = () =>
  new Promise((resolve, reject) => {
    wx.showModal({
      title: '开启定位',
      content: '开启定位后，可在登录后自动识别东校区或西校区，用于优化首页推荐。',
      confirmText: '去设置',
      success: (res) => {
        if (!res.confirm) {
          reject(new Error('用户取消定位授权'))
          return
        }
        wx.openSetting({
          success: (settingRes) => {
            if (settingRes.authSetting && settingRes.authSetting['scope.userLocation']) {
              resolve()
            } else {
              reject(new Error('未开启定位授权'))
            }
          },
          fail: reject
        })
      },
      fail: reject
    })
  })

const ensureLocationPermission = async () => {
  const setting = await getSetting()
  const authed = setting.authSetting && setting.authSetting['scope.userLocation']
  if (authed === true) return
  if (authed === false) {
    await promptOpenSetting()
    return
  }
  await authorizeLocation()
}

const detectCampusByLocation = async () => {
  await ensureLocationPermission()
  return new Promise((resolve, reject) => {
    if (!wx.getLocation) {
      reject(new Error('当前基础库不支持定位'))
      return
    }
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        const campus = nearestCampus(res)
        setPreferredCampus(campus)
        resolve(campus)
      },
      fail: (err) => reject(err || new Error('定位失败'))
    })
  })
}

module.exports = {
  CAMPUS_OPTIONS,
  CAMPUS_PREF_KEY,
  getPreferredCampus,
  setPreferredCampus,
  ensureLocationPermission,
  detectCampusByLocation,
  nearestCampus
}
