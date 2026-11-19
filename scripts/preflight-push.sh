#!/usr/bin/env bash
# 推送前本地全量校验（等价 CI test-fast 的非网络部分）
# 用途：任何 push 之前必须跑通，避免「本地绿、CI 红」反复返工。
# 用法： bash scripts/preflight-push.sh [--fast]
set -o pipefail
FAIL=0
T0=$(date +%s)

step() {
  local name="$1"; shift
  local s=$(date +%s)
  if "$@" >/tmp/pf_step.log 2>&1; then
    echo "✅ $name（$(( $(date +%s) - s ))s）"
  else
    echo "❌ $name（$(( $(date +%s) - s ))s）"
    tail -18 /tmp/pf_step.log | sed 's/^/     /'
    FAIL=1
  fi
}

echo "===== 推送前全量校验（backend-api）====="

# 1) 核心门禁：契约面 / 分层 / 产物 / 行为等价 / 跨仓 / schema
step "v9-gate[core]" bash scripts/v9-gate.sh --group core

# 2) CI test-fast 的 audit 全量（43 个，npm test 已串好 smoke + audit）
if [ "${1:-}" = "--fast" ]; then
  echo "⏭  跳过 npm test（--fast 模式）"
else
  step "npm test（smoke + 全量 audit）" npm test
fi

# 3) 文档门禁：硬失败必须为 0（docs-audit 退出码恒 0，只能看输出）
DOC_OUT=$(node scripts/docs-audit.js --dry-run 2>&1); DOC_RC=$?
if [ "$DOC_RC" = "0" ] && echo "$DOC_OUT" | grep -q "硬失败 0 项"; then
  echo "✅ docs-audit（exit 0 / 硬失败 0 项）"
else
  echo "❌ docs-audit（存在硬失败）"
  echo "$DOC_OUT" | grep "🔴" | head -8 | sed 's/^/     /'
  FAIL=1
fi

# 4) 发布前自检 / 产物 / 预算
step "self-check" node scripts/self-check.js
step "verify-bundle" node scripts/verify-bundle.js
step "source-inventory" node scripts/source-inventory.js --check

# 5) 产物与源码是否同步（改了 src/* 却没重建 = CI 必红）
step "产物已重建（build 幂等）" bash -c 'cp lx-source.js /tmp/pf_before.js && node scripts/build-source.js >/dev/null && cmp -s /tmp/pf_before.js lx-source.js'

TOTAL=$(( $(date +%s) - T0 ))
if [ "$FAIL" = "0" ]; then echo ""; echo "✅ 推送前校验通过，${TOTAL}s"; exit 0; fi
echo ""; echo "❌ 推送前校验失败，${TOTAL}s —— 修完再推"; exit 1
