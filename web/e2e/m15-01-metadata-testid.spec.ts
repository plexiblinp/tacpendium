import { test, expect } from "@playwright/test";

// M15-01: メタデータ入力の安定 test-id 前提スモーク。
//
// 目的: 後続 M15 サブ(M15-02/03/05)の回帰安全網として、メタデータ各入力に付与した
//       安定 data-testid が /combos/new のフォーム DOM に存在し、値入力/トグル/選択できることを検証する。
//
// 前提: ウィザードが完了済みのローカル開発環境で実行すること(未完了だと /wizard へリダイレクト)。
// DB 前提: 新規作成画面のフォーム DOM のみを対象とする seed 非依存 self-contained。
//          既存コンボ seed・永続 dev DB 残渣に一切依存しない(送信・保存はしない)。

// 起き攻めオプションの test-id(M16-03 正規化): combo-editor-oki-<attackType>-<techType>-<dr|nogauge>。
// source: ComboEditorBasicFields.tsx / constants/oki.ts。self-contained のため spec 内でローカル定義する。
const OKI_ATTACK_TYPES = ["throw_meaty", "shimmy", "strike_meaty"] as const;
const OKI_TECH_TYPES = ["neutral_tech", "back_tech"] as const;
// 正準 12 通り(attack_type × tech_type × uses_dr)。
const OKI_OPTION_SPECS = OKI_ATTACK_TYPES.flatMap((attackType) =>
  OKI_TECH_TYPES.flatMap((techType) =>
    [false, true].map((usesDr) => ({ attackType, techType, usesDr })),
  ),
);
function okiTestId(spec: {
  attackType: string;
  techType: string;
  usesDr: boolean;
}): string {
  return `combo-editor-oki-${spec.attackType}-${spec.techType}-${spec.usesDr ? "dr" : "nogauge"}`;
}

test.describe("M15-01 メタデータ安定 test-id スモーク", () => {
  test("各メタデータ test-id が /combos/new で解決・操作できる", async ({
    page,
  }) => {
    await page.goto("/combos/new");

    // ── 数値入力(damage / drive / sa / knockdown) ────────────────────────
    const damage = page.getByTestId("combo-editor-damage");
    await damage.fill("3500");
    await expect(damage).toHaveValue("3500");

    const drive = page.getByTestId("combo-editor-drive-available");
    await drive.fill("3");
    await expect(drive).toHaveValue("3");

    const sa = page.getByTestId("combo-editor-sa-available");
    await sa.fill("2");
    await expect(sa).toHaveValue("2");

    const knockdown = page.getByTestId("combo-editor-knockdown-advantage");
    await knockdown.fill("4");
    await expect(knockdown).toHaveValue("4");

    // ── メモ(textarea) ──────────────────────────────────────────────────
    const memo = page.getByTestId("combo-editor-memo");
    await memo.fill("e2e-testid-smoke");
    await expect(memo).toHaveValue("e2e-testid-smoke");

    // ── 状況 4 件(position / opponentStance / hitType / opponentSize) ──
    // ★★M24-12: native select からボタン群になった(指示書 §4.3)。
    //   ★見ているものは変えていない——「その欄が在って、値を入れられる」。
    //   ★表記変更に不変とするため、値ではなく **2 番目のボタン** を押す
    //     (1 番目は中立の「不問」であり、押しても「値が入った」ことにならない)。
    //
    // ★★★【M38-01・射程 5】ヒット種別をこのループから外した。
    //   ⇒ 同欄は中立の「不問」を持たなくなり、**1 番目が実値 `normal`** である。
    //     ループに残すと、コメントの「1 番目は中立」がヒット種別について嘘になる
    //     (テストは 2 番目を押すので緑のまま通り、嘘だけが残る型である)。
    //   ★残る 3 欄の前提は不変(始動位置・相手の大きさは射程外＝2026-09-17 開発者裁定。
    //     相手の状態の中立は "any" であり元から 1 番目が中立)。
    for (const testId of [
      "combo-editor-position",
      "combo-editor-opponent-stance",
      "combo-editor-opponent-size",
    ]) {
      const group = page.getByTestId(testId);
      await expect(group).toBeVisible();
      const second = group.getByRole("radio").nth(1);
      await second.click();
      await expect(second).toBeChecked();
    }

    // ★★ヒット種別は「1 番目が既定で選ばれている実値」であることを明示して見る。
    //   ⇒ 中立が消えたぶん、主張は弱まらず**強くなっている**(既定まで見る)。
    {
      const group = page.getByTestId("combo-editor-hit-type");
      await expect(group).toBeVisible();
      await expect(
        page.getByTestId("combo-editor-hit-type-normal"),
      ).toBeChecked();
      await expect(
        page.getByTestId("combo-editor-hit-type-unspecified"),
      ).toHaveCount(0);
      const second = group.getByRole("radio").nth(1);
      await second.click();
      await expect(second).toBeChecked();
    }

    // ── 起き攻め 12 オプション トグル ──
    // ★M24-12: Radix Checkbox から OptionButtonGroup(複数選択)の素の
    //   button[role=checkbox] へ替わった。data-testid の書式は M16-03 のまま。
    // ★折り畳み「起き攻め」節は既定で展開している(M24-12 で制御モードへ移したが、
    //   既定は全展開のまま＝M15-05 の要件)ため展開操作は不要。
    // ★★M31-01(SD-006): ノーゲージ版を付けると、同じ対のドライブラッシュ版にも
    //   自動でチェックが付くようになった(片方向・付けるときだけ)。
    //   ⇒ OKI_OPTION_SPECS は [nogauge, dr] の順に並ぶため、**2 個目を押す時点で
    //     既に付いており、押すと外れる**。旧実装の `toBeChecked()` はここで落ちた
    //     (2026-09-08 に実測。ユニットテストでは出ない型である)。
    //
    // ★★本 spec の主題は「12 個の testid が解決でき、操作に応答する」ことである。
    //   ⇒ 主題を変えずに「押したら状態が反転する」で主張する。
    //   ★連動を spec の都合で弱めない。連動そのものの検証は
    //     web/src/features/combo/components/ComboEditorBasicFields.test.tsx が持つ。
    for (const spec of OKI_OPTION_SPECS) {
      const toggle = page.getByTestId(okiTestId(spec));
      await expect(toggle).toBeVisible();
      const before = await toggle.getAttribute("aria-checked");
      await toggle.click();
      await expect(toggle).toHaveAttribute(
        "aria-checked",
        before === "true" ? "false" : "true",
      );
    }
  });
});
