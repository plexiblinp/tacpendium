#!/usr/bin/env bash
# M4-01 E2E テストスクリプト
# 使い方: サーバー起動後に bash scripts/e2e-m4-01.sh
set -euo pipefail

BASE="http://localhost:47318"
PASS=0
FAIL=0
TOTAL=0

assert_status() {
  local label="$1" expected="$2" actual="$3" body="$4"
  TOTAL=$((TOTAL + 1))
  if [ "$actual" -eq "$expected" ]; then
    echo "  ✅ $label (HTTP $actual)"
    PASS=$((PASS + 1))
  else
    echo "  ❌ $label — expected $expected, got $actual"
    echo "     body: $body"
    FAIL=$((FAIL + 1))
  fi
}

assert_json_field() {
  local label="$1" body="$2" field="$3" expected="$4"
  TOTAL=$((TOTAL + 1))
  local actual
  actual=$(echo "$body" | jq -r "$field" 2>/dev/null || echo "__jq_error__")
  if [ "$actual" = "$expected" ]; then
    echo "  ✅ $label ($field = $expected)"
    PASS=$((PASS + 1))
  else
    echo "  ❌ $label — $field: expected $expected, got $actual"
    FAIL=$((FAIL + 1))
  fi
}

assert_json_nonempty() {
  local label="$1" body="$2" field="$3"
  TOTAL=$((TOTAL + 1))
  local actual
  actual=$(echo "$body" | jq -r "$field" 2>/dev/null || echo "")
  if [ -n "$actual" ] && [ "$actual" != "null" ] && [ "$actual" != "" ]; then
    echo "  ✅ $label ($field is set: $actual)"
    PASS=$((PASS + 1))
  else
    echo "  ❌ $label — $field is empty or null"
    FAIL=$((FAIL + 1))
  fi
}

# ヘルスチェック
echo "=== ヘルスチェック ==="
HEALTH=$(curl -s -w "\n%{http_code}" "$BASE/api/health")
H_STATUS=$(echo "$HEALTH" | tail -1)
H_BODY=$(echo "$HEALTH" | sed '$d')
assert_status "health" 200 "$H_STATUS" "$H_BODY"
echo ""

# ===========================================================================
# A. 正常系: セットプレイの作成・取得・更新・削除
# ===========================================================================
echo "=== シナリオ A: CRUD ライフサイクル ==="

# A-1: コンボ作成（isDraft=true で VAL-C02 重複チェックを回避）
echo "A-1: コンボ作成"
COMBO_RES=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/combos" \
  -H 'Content-Type: application/json' \
  -d '{"characterId":1,"isDraft":true,"steps":[{"moveId":1,"stepOrder":1},{"moveId":2,"stepOrder":2}]}')
COMBO_STATUS=$(echo "$COMBO_RES" | tail -1)
COMBO_BODY=$(echo "$COMBO_RES" | sed '$d')
assert_status "combo create" 201 "$COMBO_STATUS" "$COMBO_BODY"
COMBO_ID=$(echo "$COMBO_BODY" | jq -r '.id')
echo "  → comboId=$COMBO_ID"

# A-2: セットプレイ作成
echo "A-2: セットプレイ作成"
S_RES=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/combos/$COMBO_ID/setups" \
  -H 'Content-Type: application/json' \
  -d '{"characterId":1,"name":"起き攻めA","description":"テスト用","steps":[{"moveId":3},{"moveId":4}]}')
S_STATUS=$(echo "$S_RES" | tail -1)
S_BODY=$(echo "$S_RES" | sed '$d')
assert_status "setup create" 200 "$S_STATUS" "$S_BODY"
SETUP_ID=$(echo "$S_BODY" | jq -r '.id')
echo "  → setupId=$SETUP_ID"
assert_json_nonempty "defaultRecipe present" "$S_BODY" ".defaultRecipe"
assert_json_field "parentComboIds[0]" "$S_BODY" ".parentComboIds[0]" "$COMBO_ID"

# A-3: セットプレイ詳細取得
echo "A-3: セットプレイ詳細取得"
G_RES=$(curl -s -w "\n%{http_code}" "$BASE/api/setups/$SETUP_ID")
G_STATUS=$(echo "$G_RES" | tail -1)
G_BODY=$(echo "$G_RES" | sed '$d')
assert_status "get setup" 200 "$G_STATUS" "$G_BODY"
assert_json_field "characterId" "$G_BODY" ".characterId" "1"
assert_json_field "stepCount" "$G_BODY" ".stepCount" "2"
ORIG_RECIPE=$(echo "$G_BODY" | jq -r '.defaultRecipe')

# A-4: メタデータのみ更新（recipe_cache 不変）
echo "A-4: メタデータのみ更新"
SETUP_VER=$(echo "$G_BODY" | jq -r '.version')
U1_RES=$(curl -s -w "\n%{http_code}" -X PATCH "$BASE/api/setups/$SETUP_ID" \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"起き攻めA改\",\"version\":$SETUP_VER}")
U1_STATUS=$(echo "$U1_RES" | tail -1)
U1_BODY=$(echo "$U1_RES" | sed '$d')
assert_status "update metadata" 200 "$U1_STATUS" "$U1_BODY"
assert_json_field "name unchanged recipe" "$U1_BODY" ".defaultRecipe" "$ORIG_RECIPE"

# A-5: レシピ変更（recipe_cache 更新）
echo "A-5: レシピ変更"
SETUP_VER2=$(echo "$U1_BODY" | jq -r '.version')
U2_RES=$(curl -s -w "\n%{http_code}" -X PATCH "$BASE/api/setups/$SETUP_ID" \
  -H 'Content-Type: application/json' \
  -d "{\"steps\":[{\"moveId\":5},{\"moveId\":6},{\"moveId\":7}],\"version\":$SETUP_VER2}")
U2_STATUS=$(echo "$U2_RES" | tail -1)
U2_BODY=$(echo "$U2_RES" | sed '$d')
assert_status "update recipe" 200 "$U2_STATUS" "$U2_BODY"
NEW_RECIPE=$(echo "$U2_BODY" | jq -r '.defaultRecipe')
TOTAL=$((TOTAL + 1))
if [ "$NEW_RECIPE" != "$ORIG_RECIPE" ]; then
  echo "  ✅ recipe changed: $ORIG_RECIPE → $NEW_RECIPE"
  PASS=$((PASS + 1))
else
  echo "  ❌ recipe should have changed"
  FAIL=$((FAIL + 1))
fi
assert_json_field "stepCount after recipe change" "$U2_BODY" ".stepCount" "3"

# A-6: 論理削除
echo "A-6: 論理削除"
D_RES=$(curl -s -w "\n%{http_code}" -X DELETE "$BASE/api/setups/$SETUP_ID")
D_STATUS=$(echo "$D_RES" | tail -1)
assert_status "delete setup" 204 "$D_STATUS" ""

# A-7: 削除後 GET → 404
echo "A-7: 削除後 GET → 404"
G2_RES=$(curl -s -w "\n%{http_code}" "$BASE/api/setups/$SETUP_ID")
G2_STATUS=$(echo "$G2_RES" | tail -1)
G2_BODY=$(echo "$G2_RES" | sed '$d')
assert_status "get deleted" 404 "$G2_STATUS" "$G2_BODY"

echo ""

# ===========================================================================
# B. 異常系: VAL-S05 違反
# ===========================================================================
echo "=== シナリオ B: VAL-S05 違反 ==="

# B-1: comboId=0 → 400 (parseIDParam で弾かれる)
echo "B-1: comboId=0"
B1_RES=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/combos/0/setups" \
  -H 'Content-Type: application/json' \
  -d '{"characterId":1,"steps":[{"moveId":1}]}')
B1_STATUS=$(echo "$B1_RES" | tail -1)
B1_BODY=$(echo "$B1_RES" | sed '$d')
assert_status "comboId=0" 400 "$B1_STATUS" "$B1_BODY"

# B-2: 存在しない comboId → 404
echo "B-2: 存在しない comboId"
B2_RES=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/combos/99999/setups" \
  -H 'Content-Type: application/json' \
  -d '{"characterId":1,"steps":[{"moveId":1}]}')
B2_STATUS=$(echo "$B2_RES" | tail -1)
B2_BODY=$(echo "$B2_RES" | sed '$d')
assert_status "comboId=99999" 404 "$B2_STATUS" "$B2_BODY"

echo ""

# ===========================================================================
# C. 異常系: VAL-S04 違反（重複）
# ===========================================================================
echo "=== シナリオ C: VAL-S04 違反 ==="

# C-1: 親コンボ A に setup 作成
echo "C-1: 親コンボ A に setup 作成"
CA_RES=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/combos/$COMBO_ID/setups" \
  -H 'Content-Type: application/json' \
  -d '{"characterId":1,"name":"dup-test","steps":[{"moveId":10},{"moveId":11}]}')
CA_STATUS=$(echo "$CA_RES" | tail -1)
CA_BODY=$(echo "$CA_RES" | sed '$d')
assert_status "first setup" 200 "$CA_STATUS" "$CA_BODY"

# C-2: 同一コンボに同一レシピ → 409 duplicate_setup
echo "C-2: 同一コンボに同一レシピ → 409"
CB_RES=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/combos/$COMBO_ID/setups" \
  -H 'Content-Type: application/json' \
  -d '{"characterId":1,"name":"dup-test-2","steps":[{"moveId":10},{"moveId":11}]}')
CB_STATUS=$(echo "$CB_RES" | tail -1)
CB_BODY=$(echo "$CB_RES" | sed '$d')
assert_status "duplicate → 409" 409 "$CB_STATUS" "$CB_BODY"
assert_json_field "error code" "$CB_BODY" ".error.code" "duplicate_setup"

# C-3: 別コンボ B に同一レシピ → 200（別コンボなので OK）
echo "C-3: 別コンボに同一レシピ → 200"
COMBO2_RES=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/combos" \
  -H 'Content-Type: application/json' \
  -d '{"characterId":1,"isDraft":true,"steps":[{"moveId":3,"stepOrder":1},{"moveId":4,"stepOrder":2}]}')
COMBO2_BODY=$(echo "$COMBO2_RES" | sed '$d')
COMBO_B=$(echo "$COMBO2_BODY" | jq -r '.id')

CC_RES=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/combos/$COMBO_B/setups" \
  -H 'Content-Type: application/json' \
  -d '{"characterId":1,"name":"same-recipe-diff-combo","steps":[{"moveId":10},{"moveId":11}]}')
CC_STATUS=$(echo "$CC_RES" | tail -1)
CC_BODY=$(echo "$CC_RES" | sed '$d')
assert_status "diff combo same recipe → 200" 200 "$CC_STATUS" "$CC_BODY"

echo ""

# ===========================================================================
# D. 紐付け操作
# ===========================================================================
echo "=== シナリオ D: 紐付け操作 ==="

# D-1: 親コンボ A に setup 作成
echo "D-1: setup 作成"
DA_RES=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/combos/$COMBO_ID/setups" \
  -H 'Content-Type: application/json' \
  -d '{"characterId":1,"name":"link-test","steps":[{"moveId":1},{"moveId":3}]}')
DA_BODY=$(echo "$DA_RES" | sed '$d')
LINK_SETUP_ID=$(echo "$DA_BODY" | jq -r '.id')
echo "  → setupId=$LINK_SETUP_ID"

# D-2: 別コンボ B に紐付け
echo "D-2: コンボ B に紐付け"
DL_RES=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/combos/$COMBO_B/setup-links" \
  -H 'Content-Type: application/json' \
  -d "{\"setupId\":$LINK_SETUP_ID}")
DL_STATUS=$(echo "$DL_RES" | tail -1)
DL_BODY=$(echo "$DL_RES" | sed '$d')
assert_status "create link" 200 "$DL_STATUS" "$DL_BODY"

# D-3: parentComboIds に両方含まれる
echo "D-3: parentComboIds 確認"
DG_RES=$(curl -s -w "\n%{http_code}" "$BASE/api/setups/$LINK_SETUP_ID")
DG_BODY=$(echo "$DG_RES" | sed '$d')
PARENT_COUNT=$(echo "$DG_BODY" | jq '.parentComboIds | length')
TOTAL=$((TOTAL + 1))
if [ "$PARENT_COUNT" -eq 2 ]; then
  echo "  ✅ parentComboIds has 2 entries"
  PASS=$((PASS + 1))
else
  echo "  ❌ parentComboIds count = $PARENT_COUNT, want 2"
  FAIL=$((FAIL + 1))
fi

# D-4: 紐付け解除
echo "D-4: 紐付け解除"
DD_RES=$(curl -s -w "\n%{http_code}" -X DELETE "$BASE/api/combos/$COMBO_B/setup-links/$LINK_SETUP_ID")
DD_STATUS=$(echo "$DD_RES" | tail -1)
assert_status "delete link" 204 "$DD_STATUS" ""

# D-5: parentComboIds が 1 件に戻る
echo "D-5: parentComboIds 確認（1件）"
DG2_RES=$(curl -s -w "\n%{http_code}" "$BASE/api/setups/$LINK_SETUP_ID")
DG2_BODY=$(echo "$DG2_RES" | sed '$d')
PARENT_COUNT2=$(echo "$DG2_BODY" | jq '.parentComboIds | length')
TOTAL=$((TOTAL + 1))
if [ "$PARENT_COUNT2" -eq 1 ]; then
  echo "  ✅ parentComboIds has 1 entry"
  PASS=$((PASS + 1))
else
  echo "  ❌ parentComboIds count = $PARENT_COUNT2, want 1"
  FAIL=$((FAIL + 1))
fi

echo ""

# ===========================================================================
# E. notation 連動
# ===========================================================================
echo "=== シナリオ E: notation 連動 ==="

# E-1: setup 作成 → recipe_cache が生成されている
echo "E-1: recipe_cache 生成確認"
EA_RES=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/combos/$COMBO_ID/setups" \
  -H 'Content-Type: application/json' \
  -d '{"characterId":1,"name":"notation-test","steps":[{"moveId":1},{"moveId":2}]}')
EA_BODY=$(echo "$EA_RES" | sed '$d')
EA_STATUS=$(echo "$EA_RES" | tail -1)
assert_status "setup for notation" 200 "$EA_STATUS" "$EA_BODY"
NOTATION_SETUP_ID=$(echo "$EA_BODY" | jq -r '.id')
assert_json_nonempty "defaultRecipe generated" "$EA_BODY" ".defaultRecipe"

# E-2: レシピ変更 → cache 更新
echo "E-2: レシピ変更 → cache 更新"
N_VER=$(echo "$EA_BODY" | jq -r '.version')
EB_RES=$(curl -s -w "\n%{http_code}" -X PATCH "$BASE/api/setups/$NOTATION_SETUP_ID" \
  -H 'Content-Type: application/json' \
  -d "{\"steps\":[{\"moveId\":5}],\"version\":$N_VER}")
EB_BODY=$(echo "$EB_RES" | sed '$d')
EB_STATUS=$(echo "$EB_RES" | tail -1)
assert_status "recipe update" 200 "$EB_STATUS" "$EB_BODY"
ORIG_N_RECIPE=$(echo "$EA_BODY" | jq -r '.defaultRecipe')
NEW_N_RECIPE=$(echo "$EB_BODY" | jq -r '.defaultRecipe')
TOTAL=$((TOTAL + 1))
if [ "$NEW_N_RECIPE" != "$ORIG_N_RECIPE" ]; then
  echo "  ✅ cache updated after recipe change"
  PASS=$((PASS + 1))
else
  echo "  ❌ cache should have changed"
  FAIL=$((FAIL + 1))
fi

echo ""

# ===========================================================================
# F. M3 回帰確認（setups フィールド前方互換）
# ===========================================================================
echo "=== シナリオ F: M3 回帰確認 ==="

# F-1: setups フィールド未指定
echo "F-1: setups 未指定"
F1_RES=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/combos" \
  -H 'Content-Type: application/json' \
  -d '{"characterId":1,"isDraft":true,"steps":[{"moveId":5,"stepOrder":1},{"moveId":6,"stepOrder":2}]}')
F1_STATUS=$(echo "$F1_RES" | tail -1)
F1_BODY=$(echo "$F1_RES" | sed '$d')
assert_status "no setups field" 201 "$F1_STATUS" "$F1_BODY"
assert_json_field "characterId" "$F1_BODY" ".characterId" "1"

# F-2: setups 空配列
echo "F-2: setups 空配列"
F2_RES=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/combos" \
  -H 'Content-Type: application/json' \
  -d '{"characterId":1,"isDraft":true,"steps":[{"moveId":7,"stepOrder":1},{"moveId":8,"stepOrder":2}],"setups":[]}')
F2_STATUS=$(echo "$F2_RES" | tail -1)
F2_BODY=$(echo "$F2_RES" | sed '$d')
assert_status "empty setups array" 201 "$F2_STATUS" "$F2_BODY"

# F-3: setups に 1 件指定（無視されてコンボのみ作成）
echo "F-3: setups に 1 件指定"
F3_RES=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/combos" \
  -H 'Content-Type: application/json' \
  -d '{"characterId":1,"isDraft":true,"steps":[{"moveId":9,"stepOrder":1},{"moveId":10,"stepOrder":2}],"setups":[{"characterId":1,"steps":[{"moveId":1}]}]}')
F3_STATUS=$(echo "$F3_RES" | tail -1)
F3_BODY=$(echo "$F3_RES" | sed '$d')
assert_status "setups ignored" 201 "$F3_STATUS" "$F3_BODY"

# F-4: setup-candidates スタブ（空配列）
echo "F-4: setup-candidates スタブ"
F4_RES=$(curl -s -w "\n%{http_code}" "$BASE/api/combos/$COMBO_ID/setup-candidates")
F4_STATUS=$(echo "$F4_RES" | tail -1)
F4_BODY=$(echo "$F4_RES" | sed '$d')
assert_status "candidates stub" 200 "$F4_STATUS" "$F4_BODY"
assert_json_field "items empty" "$F4_BODY" ".items | length" "0"

echo ""

# ===========================================================================
# 結果サマリー
# ===========================================================================
echo "==========================================="
echo " M4-01 E2E テスト結果"
echo "==========================================="
echo " PASS: $PASS / $TOTAL"
echo " FAIL: $FAIL / $TOTAL"
echo "==========================================="

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
