// utils/orderNotify.js
const ORDER_SNAPSHOT_KEY = 'order_status_snapshot';

function getSnapshot() {
  try {
    const raw = wx.getStorageSync(ORDER_SNAPSHOT_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function setSnapshot(snapshot) {
  wx.setStorageSync(ORDER_SNAPSHOT_KEY, JSON.stringify(snapshot || {}));
}

function getChangedOrders(currentOrders) {
  const oldSnapshot = getSnapshot();
  const changed = [];
  const newSnapshot = {};

  for (const order of currentOrders) {
    const id = order.objectId;
    const currentStatus = order.status;
    newSnapshot[id] = currentStatus;

    if (oldSnapshot.hasOwnProperty(id) && oldSnapshot[id] !== currentStatus) {
      changed.push(order);
    }
  }

  setSnapshot(newSnapshot);
  return changed;
}

module.exports = { getSnapshot, setSnapshot, getChangedOrders };