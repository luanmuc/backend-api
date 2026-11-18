#!/usr/bin/env bash
# v9 分组门禁（v9.1-b）—— shell 顺序执行，避免 node spawn 的子进程句柄问题
#
# 三组：
#   fast   E0 契约面 + L 分层依赖 + C2 产物校验             （秒级，改一次跑一次）
#   core   fast + E1 行为等价(100例) + E3 stress-round3 + C1 App 契约   （~40s，每批必跑）
#   stress core + E1 全量(1200例) + E3b round4              （~15min，段末/推送前）
#
# 用法： bash scripts/v9-gate.sh [--group fast|core|stress]   默认 core
#        bash scripts/v9-gate.sh --full                       等价 --group stress
set -o pipefail
cd "$(dirname "$0")/.." || exit 1

GROUP=core
for a in "$@"; do
  case "$a" in
    --group) shift; GROUP="${1:-core}" ;;
    --group=*) GROUP="${1#--group=}" ;;
    --full) GROUP=stress ;;
dummy) ;;
  esac
  [ "$a" = "--group" ] && shift
done
case "$GROUP" in fast|core|stress) ;; *) echo "未知组：$GROUP"; exit 2 ;; esac

FAIL=0
T0=$(date +%s)
step() {
  local name="$1"; shift
  local s=$(date +%s)
  if "$@"; then echo "✅ $name（$(( $(date +%s) - s ))s）"
  else echo "❌ $name（$(( $(date +%s) - s ))s）"; FAIL=1; fi
}

# ── fast ─────────────────────────────────────────────
step "E0 契约面" node scripts/api-surface.js
step "L 分层依赖" node scripts/layer-check.js

SIZE=$(stat -c%s lx-source.js 2>/dev/null || echo 0)
HEAD5=$(head -5 lx-source.js 2>/dev/null || true)
if [ "$SIZE" -gt 50000 ] && echo "$HEAD5" | grep -q "@name"; then
  echo "✅ C2 产物校验（大小 ${SIZE}B / 头部 @name 有）"
else
  echo "❌ C2 产物校验（大小 ${SIZE}B / 头部 @name $([ -n "$HEAD5" ] && echo 有 || echo 无)）"; FAIL=1
fi

if [ "$GROUP" = "fast" ]; then
  TOTAL=$(( $(date +%s) - T0 ))
  [ "$FAIL" = "0" ] && { echo ""; echo "✅ v9-gate[fast] 通过，${TOTAL}s"; exit 0; }
  echo ""; echo "❌ v9-gate[fast] 有失败项，${TOTAL}s"; exit 1
fi

# ── core ─────────────────────────────────────────────
step "E1 行为等价（100 例）" node scripts/equiv-snapshot.js --fast --sample 5
step "E3 stress-round3" node --expose-gc test/stress-round3.js
step "X 跨仓版本" node scripts/cross-repo-version.js
step "P probe/telemetry schema" node scripts/schema-parity.js

APP=${LX_APP_DIR:-../lx-music-mobile}
if [ -f "$APP/scripts/check_source_contract.js" ]; then
  if (cd "$APP" && node scripts/check_source_contract.js >/dev/null 2>&1); then echo "✅ C1 App 契约"
  else echo "❌ C1 App 契约"; FAIL=1; fi
else
  echo "⏭ C1 App 契约（跳过：未检出）"
fi

if [ "$GROUP" = "core" ]; then
  TOTAL=$(( $(date +%s) - T0 ))
  [ "$FAIL" = "0" ] && { echo ""; echo "✅ v9-gate[core] 通过，${TOTAL}s"; exit 0; }
  echo ""; echo "❌ v9-gate[core] 有失败项，${TOTAL}s"; exit 1
fi

# ── stress ───────────────────────────────────────────
step "E1 行为等价（全量）" node scripts/equiv-snapshot.js
step "E3b stress-round4" node --expose-gc test/stress-round4.js

TOTAL=$(( $(date +%s) - T0 ))
[ "$FAIL" = "0" ] && { echo ""; echo "✅ v9-gate[stress] 通过，${TOTAL}s"; exit 0; }
echo ""; echo "❌ v9-gate[stress] 有失败项，${TOTAL}s"; exit 1
