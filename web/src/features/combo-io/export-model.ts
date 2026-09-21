// 出力モデル(純関数): ComboDetail + キャラ定義 + 選択項目 → 表示用の (ラベル, 値) 行。
// PDF/PNG レイアウト(ComboExportDocument)とクリップボード builder の双方がこのモデルを参照し、
// 表示項目選択・整形ロジックを一元化する(再発明の防止・テスト容易化)。
//
// 値整形は既存の共有ユーティリティ(features/combo/utils・customStates)をそのまま再利用する。

import type { Character } from "@/features/character/hooks/useCharacters";
// ★★M24-07 レビュー(高-2): labelFor の第 1 引数は「値 → i18n キー」の対応表である。
//   本ファイルは React の外(PDF・画像出力)であり t を持てないため、labelFor の
//   既定の解決関数(jaLabel = ja.json から日本語を引く)にそのまま任せる。
//   ★以前は *_LABELS(日本語の写し)を渡しており、jaLabel の「引けなければキーを
//     そのまま返す」フォールバックに偶然救われて動いていた。
import {
  POSITION_LABEL_KEYS,
  OPPONENT_STANCE_LABEL_KEYS,
  HIT_TYPE_LABEL_KEYS,
  OPPONENT_SIZE_LABEL_KEYS,
} from "@/constants/combo-list";
import { TAG_CATEGORY_MYCOMBO_STATUS } from "@/constants/mycombo";
import {
  OKI_OPTION_SPECS,
  okiOptionKey,
  okiOptionLabel,
} from "@/constants/oki";
import type { ComboDetail } from "@/features/combo/types";
import {
  GAUGE_AT_START_LABEL_JA,
  GAUGE_CONSUMED_LABEL_JA,
} from "@/features/combo/labels";
import {
  driveDamageDirectionLabel,
  formatDamage,
  formatDriveDamage,
  formatDriveGauge,
  formatSAGauge,
  formatStarterStatus,
  formatKnockdownAdvantage,
  labelFor,
  getSetupDisplayName,
} from "@/features/combo/utils";
import {
  customStateValueText,
  parseCustomStateDefs,
  resolveCustomStatesForDisplay,
} from "@/features/combo/customStates";
import type { ExportItemKey } from "./export-items";

const EMPTY = "-";

export interface ExportFieldRow {
  /** 行の安定キー(同一項目の oki 12 変種行などを区別するため item key と添字を合成)。 */
  key: string;
  label: string;
  /** 表示値。複数行になりうる項目(setups 等)は "\n" 区切りで返す。 */
  value: string;
}

export interface ExportComboHeader {
  /** 見出し(キャラ名 + #id + 下書きマーク)。 */
  title: string;
  /** 副題(始動状況 = 始動技 / ヒット種別 / 始動位置)。 */
  subtitle: string;
}

function characterName(
  characters: Character[] | undefined,
  characterId: number,
): string {
  return (
    characters?.find((c) => c.id === characterId)?.nameJa ??
    `キャラ#${characterId}`
  );
}

export function buildComboHeader(
  combo: ComboDetail,
  characters: Character[] | undefined,
): ExportComboHeader {
  const draft = combo.isDraft ? "(下書き)" : "";
  return {
    title: `${characterName(characters, combo.characterId)} #${combo.id}${draft}`,
    subtitle: formatStarterStatus(combo),
  };
}

function situationValue(combo: ComboDetail): string {
  const parts: string[] = [];
  if (combo.position) parts.push(labelFor(POSITION_LABEL_KEYS, combo.position));
  if (combo.opponentStance)
    parts.push(labelFor(OPPONENT_STANCE_LABEL_KEYS, combo.opponentStance));
  if (combo.hitType) parts.push(labelFor(HIT_TYPE_LABEL_KEYS, combo.hitType));
  if (combo.opponentSize)
    parts.push(labelFor(OPPONENT_SIZE_LABEL_KEYS, combo.opponentSize));
  return parts.length > 0 ? parts.join(" / ") : EMPTY;
}

function customStatesValue(
  combo: ComboDetail,
  characters: Character[] | undefined,
): string {
  const defs = parseCustomStateDefs(
    characters?.find((c) => c.id === combo.characterId)?.customStates,
  );
  // M16-07: エクスポートは ja 固定(export ラベルは日本語規約・§3.3)。resolver 既定に依存せず明示的に "ja" を渡す。
  const resolved = resolveCustomStatesForDisplay(combo.situation, defs, "ja");
  if (resolved.length === 0) return EMPTY;
  return resolved
    .map((s) =>
      typeof s.value === "number"
        ? `${s.label}: ${customStateValueText(s)}`
        : s.label,
    )
    .join(" / ");
}

// セットプレイ同梱(DES-005 §5.13): コンボ直下に紐づくセットプレイを並べる。
// M17-05c-fix(CHANGE-073 §2.2-h): 視覚出力(PDF/PNG/クリップボード)では「名称のみ」を出す
// (旧「名称: フルレシピ」を見直し・縦スペース確保)。名称未設定(=レシピ流用)は従来どおりレシピを表示。
// 複数は " / " 区切りで 1 行に畳む。CSV は BE 生成のため本関数の影響を受けない(往復契約不変)。
function setupsValue(combo: ComboDetail): string {
  if (!combo.setups || combo.setups.length === 0) return EMPTY;
  return combo.setups
    .map((s) => {
      const name = getSetupDisplayName(s.name, s.defaultRecipe, false);
      return s.name ? name : s.defaultRecipe;
    })
    .join(" / ");
}

function tagsValue(combo: ComboDetail): string {
  const filtered = combo.tags.filter(
    (tag) => tag.category !== TAG_CATEGORY_MYCOMBO_STATUS,
  );
  if (filtered.length === 0) return EMPTY;
  return filtered.map((tag) => tag.name).join(" / ");
}

/**
 * 選択された項目について、(ラベル, 値) 行を出力順で生成する。
 * oki(起き攻め情報)が選択された場合は 12 変種の個別行に展開する(M16-03 正規化・DES-005 §5.8 準拠)。
 * 未選択の項目は含めない。値が無い項目は "-" を返す(列ぞろえのため行自体は残す)。
 */
export function buildComboFields(
  combo: ComboDetail,
  characters: Character[] | undefined,
  selected: ReadonlySet<ExportItemKey>,
): ExportFieldRow[] {
  const rows: ExportFieldRow[] = [];
  const add = (key: string, label: string, value: string) =>
    rows.push({ key, label, value });

  if (selected.has("recipe"))
    add("recipe", "レシピ", combo.defaultRecipe || EMPTY);
  if (selected.has("damage")) add("damage", "ダメージ", formatDamage(combo.damage));
  if (selected.has("driveDamage"))
    // ★★M27-03(SD-009): 符号の向きを表す語を添える。★詳細画面と同じ 2 本を通す
    //   ——片面だけ形を変えると、同じ値が面によって違う文字列になるためである。
    //   ★本面は i18n を通らないので、語は既定の jaLabel で引かれる。
    add(
      "driveDamage",
      "ドライブダメージ",
      [
        formatDriveDamage(combo.driveDamage),
        driveDamageDirectionLabel(combo.driveDamage),
      ]
        .filter(Boolean)
        .join(" "),
    );
  if (selected.has("driveStart"))
    add(
      "driveStart",
      GAUGE_AT_START_LABEL_JA.drive,
      formatDriveGauge(combo.driveAvailableAtStart),
    );
  if (selected.has("saStart"))
    add(
      "saStart",
      GAUGE_AT_START_LABEL_JA.sa,
      formatSAGauge(combo.saAvailableAtStart),
    );
  // M16-06(A-1): 消費エクスポート項目。始動 2 行の直後に対称配置。消費フォーマッタは null/undef→"-"。
  if (selected.has("driveConsumed"))
    add(
      "driveConsumed",
      GAUGE_CONSUMED_LABEL_JA.drive,
      formatDriveGauge(combo.driveGaugeConsumed),
    );
  if (selected.has("saConsumed"))
    add(
      "saConsumed",
      GAUGE_CONSUMED_LABEL_JA.sa,
      formatSAGauge(combo.saGaugeConsumed),
    );
  if (selected.has("knockdownAdvantage"))
    add(
      "knockdownAdvantage",
      "有利フレーム",
      formatKnockdownAdvantage(combo.knockdownAdvantage),
    );
  if (selected.has("situation"))
    add("situation", "状況", situationValue(combo));
  if (selected.has("customStates"))
    add("customStates", "キャラ固有状態", customStatesValue(combo, characters));
  if (selected.has("oki")) {
    // 起き攻めオプション(M16-03 正規化・sparse)。12 変種を個別行で ✓/✗ 表示。
    // ★M27-02b: 「調べたか」はセルではなくコンボ単位の okiVerified が持つ。
    //   ⇒ ここは従来どおり「成立するか」だけを出す。
    const present = new Set((combo.okiOptions ?? []).map(okiOptionKey));
    for (const spec of OKI_OPTION_SPECS) {
      add(
        `oki:${okiOptionKey(spec)}`,
        okiOptionLabel(spec),
        present.has(okiOptionKey(spec)) ? "✓" : "✗",
      );
    }
  }
  if (selected.has("setups")) add("setups", "セットプレイ", setupsValue(combo));
  if (selected.has("tags")) add("tags", "タグ", tagsValue(combo));
  if (selected.has("memo")) add("memo", "備考", combo.memo || EMPTY);
  // メディア 3 行(M17-01)。URL/パスの文字列のみ出力(画像実体の埋め込みはしない・CHANGE-068 §2.3-k)。
  if (selected.has("link")) add("link", "リンク", combo.link || EMPTY);
  if (selected.has("videoPath"))
    add("videoPath", "動画パス", combo.videoPath || EMPTY);
  if (selected.has("imagePath"))
    add("imagePath", "画像パス", combo.imagePath || EMPTY);

  return rows;
}
