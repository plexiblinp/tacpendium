import { test } from "@playwright/test";

import { runInterferenceProbe } from "./support/interference-probe";

// M24-09c §4.3: 干渉を決定論的に起こす probe（2 本で 1 組。片割れは aa-interference-probe-b.spec.ts）。
//
// ★★本 spec は「落ちること」が正しい場合がある————————————————————————
//   - workers = 1: 2 本の「作る→確かめる→消す」が重ならない ⇒ **必ず緑**
//   - workers >= 2: 2 本が同じ識別キーを同時に持つ ⇒ **必ず赤**
//   赤は E2E ハーネスが並列で走っていることの検出であって、アプリの不具合ではない。
//
// ★★本 spec は通常のシナリオ spec ではなく「ハーネスの検出器」である。
//   そのため .claude/commands/add_e2e_spec.md のスタイル規約から意図的に外れている
//   （ファイル名が {feature}-{operation} 形ではない／コメントが多い）。規約準拠へ
//   「直す」と検出器として働かなくなる。★同ファイルは開発者のファイルであり編集しない。
//
// ★ファイル名が aa- で始まるのは意図である。playwright はファイルをパス順に割り当てるため、
//   先頭 2 本にしておくと worker が 2 つ以上あるとき必ず同時に走り出す。
//   ★★本 2 本より前へソートされるファイル名を作らないこと（ASCII 順で数字と大文字は
//     小文字より前に来る。"0-" や "A-" で始まる spec を足すと、この 2 本は先頭でなくなり
//     同時に走らなくなる＝検出器が黙って効かなくなる）。
//
// ★仕掛けと対象キャラの選定理由、本体の実装は support/interference-probe.ts にある。

// ★★retry を無効にする————————————————————————————————————————
// スイート既定は retries: 1 である。retry を許すと、workers を 2 以上へ戻す変更が入っても
// 「1 回目は赤・retry で緑」＝ flaky 扱いになり、終了コードが 0 になってしまう。
// ⇒ 本 2 本は回帰の検出器なので、落ちたら赤で止まる必要がある。
test.describe.configure({ retries: 0 });

test.describe("M24-09c 干渉プローブ A", () => {
  test("A: 同じ識別キーの本登録コンボを他ファイルと取り合っていない", async ({ request }) => {
    await runInterferenceProbe(request, "A");
  });
});
