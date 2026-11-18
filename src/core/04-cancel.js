// ============================================================
// v9.0 公共层 · 04-cancel
// 职责：协作式取消令牌（QuickJS 无 AbortController）
// 依赖：02-error-codes（CANCELED 码）
// 来源：由 legacy.js 原样迁出（v9.0 第二刀）
// ============================================================
const { ERROR_CODES } = require("./02-error-codes.js");

// v8.13：协作式取消令牌
// QuickJS 宿主没有 AbortController；这里做的是「编排层真取消」：
// 令牌一旦 cancel，所有后续步骤（重试、验真、降档、交付）立即抛 CANCELED，
// 竞速输家不再占用预算与上游连接，也不再把失败写进健康账本。
// ============================================================
function createCancelToken() {
  let canceled = false;
  let reason = "";
  const listeners = new Set();
  return {
    get canceled() { return canceled; },
    get reason() { return reason; },
    cancel(why) {
      if (canceled) return false;
      canceled = true;
      reason = String(why || "canceled");
      for (const fn of listeners) {
        try { fn(reason); } catch (e) { /* 取消回调不得反向打断调用方 */ }
      }
      listeners.clear();
      return true;
    },
    onCancel(fn) {
      if (typeof fn !== "function") return () => {};
      if (canceled) { try { fn(reason); } catch (e) {} return () => {}; }
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

function canceledError(reason) {
  const err = new Error(`${ERROR_CODES.CANCELED}: 已取消(${String(reason || "race_settled")})`);
  err.code = ERROR_CODES.CANCELED;
  err.canceled = true;
  return err;
}

function throwIfCanceled(token) {
  if (token && token.canceled) throw canceledError(token.reason);
}

function raceWithCancel(promise, token) {
  if (!token) return Promise.resolve(promise);
  if (token.canceled) return Promise.reject(canceledError(token.reason));
  return new Promise((resolve, reject) => {
    let done = false;
    const off = token.onCancel((reason) => {
      if (done) return;
      done = true;
      reject(canceledError(reason));
    });
    Promise.resolve(promise).then(
      (v) => { if (done) return; done = true; off(); resolve(v); },
      (e) => { if (done) return; done = true; off(); reject(e); }
    );
  });
}


module.exports = { createCancelToken, canceledError, throwIfCanceled, raceWithCancel };
