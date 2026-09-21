// キャラ固有状態(custom_states)の解析・組立ロジック(M11-01)。
//
// 注: ここで扱う CustomStateDef は API DTO ではなく、characters.custom_states / combos.situation
//     に格納される「生 JSON」の構造(DES-003 §3.2)である。格納値のキーは snake_case
//     (name_ja / value_definition 等)のため、本ファイルの型はその格納形に合わせて snake_case を用いる。
//     (CLAUDE.md の camelCase 規約は API DTO 型に対する規約であり、格納 JSON の内部構造には適用しない)
//
// custom_states は「開始時状態の付与」のみを扱う。消費(減少・解除・レベル技変化)は
// 一般モデル化しない(CHANGE-040 / DES-006 §2.4 / architecture-patterns §9.1 B-1 据え置き)。
//
// M16-07(FB⑬ 深掘り): int 型 custom_states(ストック系)は ①始動時に必要な最低ストック数 /
//   ②終了時ストック数 の 2 値で保持・表示する。③増減(②−①・符号付き)は def の show_delta が
//   立つ state のみ FE で派生表示する。situation は opaque JSON(BE 素通し)= スキーマ/DTO/BE 変更なし・FE 整形のみ。

// M31-05: int state の 1 つの選択肢(値 + 表示ラベル)。
//
// ★★「どの変種で設置したか」を表すために足した(指示書 M31-05 §2.1 案 (vi) / D-807)。
//   強度・ホールド・レベルは move_code が既に区別しているが(yoga_arch_light/medium/heavy 等)、
//   custom_states 側にそれを表す型が無かった。
// ★★撤回済みの type='composite' を復活させるのではなく、既に通っている level へ
//   任意フィールドを 1 つ足すだけである。⇒ isSupportedState は 1 文字も変えていない。
// ★★options を持たない level は今までどおり数値入力である。⇒ ingrid の sun_crest
//   (as-built で唯一の level)は 1 行も変わらない。これが案 (vi) の前提そのものである。
export interface CustomStateOption {
  value: number;
  label_ja?: string;
  label_en?: string;
}

// 状態の値定義。boolean(フラグ)か integer(レベル/ストック)。
export interface CustomStateValueDefinition {
  kind?: string; // "boolean" | "integer"
  min?: number;
  max?: number;
  // M31-05: 値に表示ラベルを与える選択肢。在れば画面は数値入力ではなく選択を出す。
  options?: CustomStateOption[];
  // M31-05 追補: int state を「1 つの値」として扱うか(省略時は従来どおり ①②の 2 値)。
  //
  // ★★出所は 2026-09-10 の開発者の実機確認である。逐語＝「設置系の技が始動時、終了時に
  //   分かれているが、分ける必要はないので直して欲しい。恐らくストック数等に釣られたものと
  //   思われるが、それらとは扱いが別。」
  // ★★指摘のとおりであった —— ①② は M16-07 が**ストック系のために**足した拡張であり、
  //   `custom_states` の原点(`CHANGE-040`)は「開始時状態の付与のみを扱う」である。
  //   ⇒ 設置系をそこへ乗せたのは製造の取り違えだった。
  // ★true のとき: 画面は 1 欄、表示は 1 行、固定句は付けず state 名だけを出す。
  //   格納形は `{start_min, end}` のまま両方へ同じ値を書く(形を分岐させない)。
  // ★省略した state は 1 文字も変わらない(既存のストック系 6 件がこちら)。
  single_value?: boolean;
}

// 1 つのキャラ固有状態の定義(custom_states.states[] の 1 要素)。
export interface CustomStateDef {
  code: string;
  name_ja?: string;
  name_en?: string;
  subject?: string;
  type?: string; // "flag" | "level" | "stock" | "composite"(composite 等は非対応)
  value_definition?: CustomStateValueDefinition;
  // M16-07: int state の増減(②−①)を表示するか。方向可変(増える/減る両方あり)= true。
  // 一方向のみ(単調増加/減少)のキャラは false / 省略。DES-003 §3.2 拡張(CHANGE-067 見込み)。
  show_delta?: boolean;
}

// M16-07: int state の 2 値。①始動最低 start_min / ②終了 end。
// editor 中の空欄・部分入力を許すため両フィールドとも optional(空欄 = 既定 min)。
// 表示/保存前に normalizeIntValue で既定補完する。
export interface IntStateValue {
  start_min?: number;
  end?: number;
}

// 正規化済み int 値(両フィールド確定)。
export interface NormalizedIntValue {
  start_min: number;
  end: number;
}

// 付与値。flag=boolean、int=IntStateValue。
// 後方互換(§4.7 移行): 旧スカラ int(number)も受理し、正規化で ②(end) へ写像する。
export type CustomStateValue = boolean | number | IntStateValue;
export type CustomStatesValues = Record<string, CustomStateValue>;

// situation JSON のうち custom_states キーを格納する形。
const CUSTOM_STATES_KEY = "custom_states";

// flag 型(トグルで付与)かどうか。
export function isFlagState(def: CustomStateDef): boolean {
  return def.type === "flag";
}

// integer 型(数値入力で付与)かどうか。level / stock を対象とする。
export function isIntState(def: CustomStateDef): boolean {
  return def.type === "level" || def.type === "stock";
}

// 描画対象の type かどうか(flag / level / stock 以外=composite 等はスキップ)。
export function isSupportedState(def: CustomStateDef): boolean {
  return isFlagState(def) || isIntState(def);
}

// M31-05: 選択肢を持つ int state か(持つなら画面は数値入力ではなく選択を出す)。
// ★空配列は「持たない」と同じに扱う。選択肢が 0 個の選択 UI は操作できないためである。
export function stateOptions(def: CustomStateDef): readonly CustomStateOption[] {
  const opts = def.value_definition?.options;
  return Array.isArray(opts) && opts.length > 0 ? opts : [];
}

export function hasStateOptions(def: CustomStateDef): boolean {
  return stateOptions(def).length > 0;
}

// M31-05 追補: 1 つの値として扱う int state か(①②へ分けない)。
//
// ★★flag には関係しない(元から 1 値である)。int(level / stock)にだけ効く。
export function isSingleValueState(def: CustomStateDef): boolean {
  return isIntState(def) && def.value_definition?.single_value === true;
}

// M31-05: int 値の表示ラベル(選択肢を持たない state / 未定義の値では undefined)。
// ★undefined を返すのは呼び出し側が「ラベルが無ければ数値を出す」へ落ちられるようにするため。
export function optionLabelFor(
  def: CustomStateDef,
  value: number,
  locale: CustomStateLocale = "ja",
): string | undefined {
  const hit = stateOptions(def).find((o) => o.value === value);
  if (!hit) return undefined;
  if (locale === "en") return hit.label_en ?? hit.label_ja;
  return hit.label_ja ?? hit.label_en;
}

// int 状態の既定値(= value_definition.min、未指定時は 0)。
export function intDefault(def: CustomStateDef): number {
  return def.value_definition?.min ?? 0;
}

// int 値を def の min/max へクランプ(整数化)。範囲外・非数は min へ丸める。
function clampIntForDef(n: number, def: CustomStateDef): number {
  const min = def.value_definition?.min ?? 0;
  const max = def.value_definition?.max;
  let x = Math.trunc(Number(n));
  if (!Number.isFinite(x)) return min;
  if (x < min) x = min;
  if (max != null && x > max) x = max;
  return x;
}

// 構造化 int 値(start_min / end のいずれかが数値のオブジェクト)かどうか。
export function isIntStateValue(v: unknown): v is IntStateValue {
  return (
    !!v &&
    typeof v === "object" &&
    (typeof (v as IntStateValue).start_min === "number" ||
      typeof (v as IntStateValue).end === "number")
  );
}

// int 付与値を { start_min, end }(確定値)へ正規化する。
//   - 構造化 { start_min, end }: 欠損側は既定(min)・両者を clamp。
//   - 旧スカラ number(§4.7 移行): ②(end) へ写像・①は既定(min)。
//   - 欠損 / 非対応: 両者 min。
export function normalizeIntValue(
  raw: CustomStateValue | undefined,
  def: CustomStateDef,
): NormalizedIntValue {
  const min = intDefault(def);
  let norm: NormalizedIntValue;
  if (isIntStateValue(raw)) {
    norm = {
      start_min: raw.start_min != null ? clampIntForDef(raw.start_min, def) : min,
      end: raw.end != null ? clampIntForDef(raw.end, def) : min,
    };
  } else if (typeof raw === "number") {
    // 旧スカラは「終了時ストック数(②)」へ写像し、始動最低(①)は既定とする(§4.7)。
    norm = { start_min: min, end: clampIntForDef(raw, def) };
  } else {
    norm = { start_min: min, end: min };
  }
  // M31-05 追補: single_value の state は 1 つの値である。⇒ 両フィールドを同じ値へ畳む。
  //   ★格納形を分岐させない(すべての int state が `{start_min, end}` のままである)ことで、
  //     parse / build / 後方互換の経路をどれも変えずに済む。
  //   ★片方だけに値が入った形(手書き JSON・旧データ)も、既定でない側を採って畳む。
  if (isSingleValueState(def)) {
    const v = norm.end !== min ? norm.end : norm.start_min;
    return { start_min: v, end: v };
  }
  return norm;
}

// 正規化済み int 値が既定(未付与)かどうか。start_min / end が両方 min のとき未付与とみなす。
export function isDefaultIntValue(v: NormalizedIntValue, def: CustomStateDef): boolean {
  const min = intDefault(def);
  return v.start_min === min && v.end === min;
}

// ③増減 = ②end − ①start_min(符号付き)。
export function intStateDelta(v: NormalizedIntValue): number {
  return v.end - v.start_min;
}

// raw な custom_states 文字列(characters.customStates 由来)を states[] へ解析する。
// parse 失敗・構造不正時は空配列を返す(防御)。
export function parseCustomStateDefs(
  raw: string | null | undefined,
): CustomStateDef[] {
  if (!raw) return [];
  try {
    const obj = JSON.parse(raw) as unknown;
    if (!obj || typeof obj !== "object") return [];
    const states = (obj as { states?: unknown }).states;
    if (!Array.isArray(states)) return [];
    return states.filter(
      (s): s is CustomStateDef =>
        !!s &&
        typeof s === "object" &&
        typeof (s as { code?: unknown }).code === "string",
    );
  } catch {
    return [];
  }
}

// situation 文字列(combos.situation 由来)から custom_states の付与値を取り出す。
// parse 失敗・キー不在時は空オブジェクトを返す(防御 / 後方互換)。
//   - flag: boolean
//   - int(現行): 構造化 { start_min, end }
//   - int(旧・§4.7 移行): スカラ number(正規化で ②(end) へ写像)
export function parseSituationCustomStates(
  situation: string | null | undefined,
): CustomStatesValues {
  if (!situation) return {};
  try {
    const obj = JSON.parse(situation) as unknown;
    if (!obj || typeof obj !== "object") return {};
    const cs = (obj as Record<string, unknown>)[CUSTOM_STATES_KEY];
    if (!cs || typeof cs !== "object") return {};
    const result: CustomStatesValues = {};
    for (const [code, v] of Object.entries(cs as Record<string, unknown>)) {
      if (typeof v === "boolean" || typeof v === "number") {
        result[code] = v;
      } else if (isIntStateValue(v)) {
        result[code] = {
          ...(typeof v.start_min === "number" ? { start_min: v.start_min } : {}),
          ...(typeof v.end === "number" ? { end: v.end } : {}),
        };
      }
    }
    return result;
  } catch {
    return {};
  }
}

// 付与値 + 定義から situation 文字列を組み立てる(§4.1)。
//   - boolean: true のみ格納(false は省略)
//   - int: { start_min, end } 構造化で格納。両者が既定(min)なら省略。
//   - 既存 situation の custom_states 以外のキーは保全する
//   - custom_states が空になる場合はキーを除去し、結果が空なら undefined(= 未送信 / NULL 保存)
export function buildSituation(
  existing: string | null | undefined,
  values: CustomStatesValues,
  defs: CustomStateDef[],
): string | undefined {
  // 定義不明(useCharacters 未ロード等)のときは custom_states の型・既定値を判定できない。
  // 誤って既存の付与値を消さないよう、既存 situation をそのまま保持する(防御 / round-trip 保全)。
  if (defs.length === 0) {
    return existing && existing.length > 0 ? existing : undefined;
  }

  // 既存 situation を基底にして他キーを保全する。
  let base: Record<string, unknown> = {};
  if (existing) {
    try {
      const parsed = JSON.parse(existing) as unknown;
      if (parsed && typeof parsed === "object") {
        base = { ...(parsed as Record<string, unknown>) };
      }
    } catch {
      base = {};
    }
  }

  // 付与値を定義に従ってフィルタリングして custom_states を再構築する。
  const cs: Record<string, boolean | NormalizedIntValue> = {};
  for (const def of defs) {
    if (!isSupportedState(def)) continue;
    const v = values[def.code];
    if (isFlagState(def)) {
      if (v === true) cs[def.code] = true;
    } else if (isIntState(def)) {
      const norm = normalizeIntValue(v, def);
      if (!isDefaultIntValue(norm, def)) {
        cs[def.code] = { start_min: norm.start_min, end: norm.end };
      }
    }
  }

  if (Object.keys(cs).length > 0) {
    base[CUSTOM_STATES_KEY] = cs;
  } else {
    delete base[CUSTOM_STATES_KEY];
  }

  if (Object.keys(base).length === 0) return undefined;
  return JSON.stringify(base);
}

// ---- 表示ラベル(SSOT・M16-07 Approach A: 単一 TS-SSOT + locale 引数) ----
//
// int custom_states(ストック系)の ①始動最低/②終了/③増減 ラベルの固定句。総称「ストック」。
// **初版は仮ラベル**(開発者が出力を見て修正指示する)。
// i18n サーフェス(詳細/比較)は en(name_en + en 固定句)、export/入力欄は ja(M16-06 境界)。
// ラベル生成は本 SSOT に集約し、綴りの散在(表記揺れ)を防ぐ。
export type IntStateLabelKind = "startMin" | "end" | "delta";
export type CustomStateLocale = "ja" | "en";

const STOCK_PHRASE: Record<IntStateLabelKind, Record<CustomStateLocale, string>> = {
  startMin: { ja: "始動時に必要な最低のストック数", en: "min stock required at start" },
  end: { ja: "終了時のストック数", en: "stock at end" },
  delta: { ja: "ストック増減", en: "stock delta" },
};

// M31-05: 選択肢を持つ int state の固定句。
//
// ★★ストック語をそのまま使えない。「始動時に必要な最低のストック数」は
//   量の大小を前提にした言い回しであり、変種(弱 / 中 / 強 / OD)には順序が無い。
//   ⇒ 「最低」も「数」も意味を成さないため、時点だけを言う固定句を別に持つ。
// ★★delta は使わない。変種の差分に意味が無いため、options 付き state には
//   show_delta を付けない(投入マイグレ 000110 も付けていない)。値は据え置きで持つ。
const OPTION_PHRASE: Record<IntStateLabelKind, Record<CustomStateLocale, string>> = {
  startMin: { ja: "始動時", en: "at start" },
  end: { ja: "終了時", en: "at end" },
  delta: { ja: "変化", en: "change" },
};


// locale を "ja" / "en" のどちらかへ正規化する(i18n の言語コードは "en-US" 等もあり得る)。
export function toCustomStateLocale(locale: string | undefined): CustomStateLocale {
  return locale && locale.toLowerCase().startsWith("en") ? "en" : "ja";
}

// int state の名称(locale に応じて name_en / name_ja)。
function intStateName(def: CustomStateDef, locale: CustomStateLocale): string {
  if (locale === "en") return def.name_en ?? def.name_ja ?? def.code;
  return def.name_ja ?? def.code;
}

// int state の ①②③ ラベルを「名称 + 固定句」で生成する(SSOT)。
export function customStateIntLabel(
  def: CustomStateDef,
  kind: IntStateLabelKind,
  locale: CustomStateLocale,
): string {
  // M31-05 追補: single_value の state は固定句を持たない。⇒ state 名だけを返す。
  //   ★①②が無いのだから「始動時 / 終了時」を言う相手が居ない。
  if (isSingleValueState(def)) return intStateName(def, locale);
  const sep = locale === "en" ? ": " : "：";
  // ★options を持つ state(①②を持つもの)は時点語、それ以外は従来どおりストック語。
  //   ⇒ 既存の stock 全件と ingrid の sun_crest は STOCK_PHRASE を通る。1 文字も変わらない。
  const phrase = hasStateOptions(def) ? OPTION_PHRASE : STOCK_PHRASE;
  return `${intStateName(def, locale)}${sep}${phrase[kind][locale]}`;
}

// 表示用 int 値の整形。delta は符号付き(正は "+" を付与)。
export function formatIntStateValue(
  kind: ResolvedCustomState["kind"],
  value: number,
): string {
  if (kind === "delta") return value > 0 ? `+${value}` : String(value);
  return String(value);
}

// 表示用: 付与済みの custom_states を表示行の配列へ解決する。
// 値が既定(flag=false / int=未付与)のものは含めない(付与されたもののみ表示)。
//   - flag: 1 行(label = name_ja。flag は M16-07 スコープ外のため ja 固定)。
//   - int: ①始動最低 / ②終了 の 2 行 + show_delta 時のみ ③増減 の 1 行(計 2〜3 行)。
//     int ラベルは locale に応じ ja/en(i18n サーフェス = en、export/入力 = ja を呼び出し側が指定)。
export interface ResolvedCustomState {
  code: string;
  label: string;
  type: string;
  value: boolean | number;
  kind: "flag" | "single" | "start_min" | "end" | "delta";
  // M31-05: 選択肢を持つ int state の表示ラベル(「弱」「最大ホールド」等)。
  // ★★これが無いと画面に「ヨガアーチ設置: 3」と数値が出て意味が伝わらない。
  //   ⇒ 表示側(詳細 / 比較 / エクスポート)は valueLabel が在ればそれを優先する。
  // ★options を持たない state では undefined。⇒ 表示側は従来どおり数値を出す。
  valueLabel?: string;
}

// M31-05: 表示用 int 値の文字列(選択肢のラベルがあればそれ、無ければ数値)。
//
// ★★表示側 3 面(詳細 / 比較 / エクスポート)が同じ判断を 3 回書かないための SSOT である。
//   ⇒ 片方だけ直すと、同じコンボが面によって「弱」と「1」で出る。
// ★flag(boolean)には使わない。locale 文言を呼び出し側が持つためである(空文字を返す)。
//   ⇒ 戻り型を string に固定してあるのは、将来 number ガードを外した呼び出しが増えても
//     テンプレート文字列へ "undefined" が混じらないようにするためである。
export function customStateValueText(s: ResolvedCustomState): string {
  if (typeof s.value !== "number") return "";
  return s.valueLabel ?? formatIntStateValue(s.kind, s.value);
}

export function resolveCustomStatesForDisplay(
  situation: string | null | undefined,
  defs: CustomStateDef[],
  locale: CustomStateLocale = "ja",
): ResolvedCustomState[] {
  const values = parseSituationCustomStates(situation);
  const result: ResolvedCustomState[] = [];
  for (const def of defs) {
    if (!isSupportedState(def)) continue;
    const v = values[def.code];
    if (isFlagState(def)) {
      if (v === true) {
        result.push({
          code: def.code,
          // flag は M16-07 スコープ外(周辺表示は ja のまま)。
          label: def.name_ja ?? def.code,
          type: def.type ?? "flag",
          value: true,
          kind: "flag",
        });
      }
    } else if (isIntState(def)) {
      const norm = normalizeIntValue(v, def);
      if (isDefaultIntValue(norm, def)) continue;
      const type = def.type ?? "level";
      // M31-05 追補: single_value は 1 行だけ出す(ラベルは state 名。固定句なし)。
      if (isSingleValueState(def)) {
        result.push({
          code: def.code,
          label: customStateIntLabel(def, "end", locale),
          type,
          value: norm.end,
          kind: "single",
          valueLabel: optionLabelFor(def, norm.end, locale),
        });
        continue;
      }
      result.push({
        code: def.code,
        label: customStateIntLabel(def, "startMin", locale),
        type,
        value: norm.start_min,
        kind: "start_min",
        valueLabel: optionLabelFor(def, norm.start_min, locale),
      });
      result.push({
        code: def.code,
        label: customStateIntLabel(def, "end", locale),
        type,
        value: norm.end,
        kind: "end",
        valueLabel: optionLabelFor(def, norm.end, locale),
      });
      if (def.show_delta) {
        result.push({
          code: def.code,
          label: customStateIntLabel(def, "delta", locale),
          type,
          value: intStateDelta(norm),
          kind: "delta",
        });
      }
    }
  }
  return result;
}
