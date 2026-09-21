// 登録できないキーの定義（M21-05 §4.3。★開発者要求）。
//
// ★**本ファイルが除外キーの唯一の定義である**（チェックリスト §3-4）。判定・案内文・テストの
//   いずれもここだけを引く。複数箇所へ写すと、片方だけ古くなる（`E-76`）。
//
// ★除外する理由は 1 つに尽きる——**OS やブラウザがより高い優先度の動作を持つキーを登録させると、
//   「登録できたのに動かない」状態を作る**。しかも本アプリのログには何も残らない（イベントが
//   そもそも届かないため）。利用者からは本アプリの不具合に見える。
//
// ★**無反応で弾かない**（§4.3-2）。理由を必ず返し、呼び出し側が利用者へ出す。
//   無反応にすると、利用者は自分の押し方が悪いと思って何度も押す。
//
// ★キーの同一性は `KeyboardEvent.code`（物理位置）で持つ。`key` は配列・IME で変わるため、
//   格闘ゲームの入力に使う「物理的にどこを押したか」とは合わない。

/** 除外の理由。★利用者へ出す文言は {@link EXCLUSION_MESSAGE} が持つ（表を 2 つにしない）。 */
export type KeyExclusionReason =
  /** ファンクションキー（F1〜F24）。ブラウザ・OS が再読込・全画面・開発者ツール等に使う。 */
  | "function_key"
  /** Windows / Command キー。OS のメニューが開く。 */
  | "os_key"
  /** 修飾キー単体（Ctrl / Alt / Shift / CapsLock 等）。 */
  | "modifier_key"
  /** 画面操作に使うキー（Tab / Escape）。奪うとフォーカス移動とダイアログの閉じ方が壊れる。 */
  | "navigation_key"
  /** ボタンの実行に使うキー（Enter / Space）。奪うと画面上のボタンが二重に動く。 */
  | "activation_key"
  /** OS・ブラウザの専用キー（PrintScreen / 音量 / ブラウザ戻る 等）。 */
  | "system_key"
  /** Ctrl / Alt / Command を押しながらの入力。ブラウザのショートカットと衝突する。 */
  | "modified_chord";

/** 拒否の理由として利用者へ出す文言。★案内文の第 2 の表を作らない。 */
export const EXCLUSION_MESSAGE: Record<KeyExclusionReason, string> = {
  function_key:
    "ファンクションキーは、ブラウザや OS が先に使うため登録できません（別のキーを押してください）",
  os_key:
    "Windows キー / Command キーは、OS が先に使うため登録できません（別のキーを押してください）",
  modifier_key:
    "Ctrl / Alt / Shift などの修飾キー単体は登録できません（別のキーを押してください）",
  navigation_key:
    "Tab / Esc は画面の操作（フォーカス移動・ダイアログを閉じる）に使うため登録できません",
  activation_key:
    "Enter は画面上のボタンの実行に使うため登録できません（別のキーを押してください）",
  system_key:
    "このキーは OS やブラウザの専用キーのため登録できません（別のキーを押してください）",
  modified_chord:
    "Ctrl / Alt / Command を押しながらのキーは、ブラウザの操作と重なるため登録できません",
};

/** ファンクションキー。★F1〜F24 を 1 つずつ並べず、形で判定する。 */
const FUNCTION_KEY_PATTERN = /^F([1-9]|1\d|2[0-4])$/;

const OS_KEYS: readonly string[] = [
  "MetaLeft",
  "MetaRight",
  // 旧 Firefox が返す形。実機で当たる可能性があるため残す。
  "OSLeft",
  "OSRight",
];

const MODIFIER_KEYS: readonly string[] = [
  "ControlLeft",
  "ControlRight",
  "AltLeft",
  // ★AltRight は多くの配列で AltGr であり、文字入力の修飾に使われる。
  "AltRight",
  "ShiftLeft",
  "ShiftRight",
  "CapsLock",
  "NumLock",
  "ScrollLock",
  "Fn",
  "FnLock",
];

const NAVIGATION_KEYS: readonly string[] = ["Tab", "Escape"];

// ★Enter を除外するのは「押しても何も起きない」からではなく、**画面上のボタンを実行して
//   しまう**ためである。フォーカスされたボタンの実行とステップ入力が同時に起きる。
//
// ★**Space は 2026-08-14 の開発者要求で除外から外した**（登録可能にした）。
//   格闘ゲームの操作として Space を使う利用者が実在するためである。
//   ★**代償**——Space を登録した利用者は、入力面が表示されている間、**Space でフォーカス中の
//     ボタン・スイッチを実行できなくなる**（`useKeyboardInput` が既定動作を止めるため）。
//     **ただしこれは Space を自分で割り当てた利用者にだけ起きる**（未登録なら抑止対象外）。
//     **テキスト欄では従来どおり空白が入力できる**（`isEditableElementFocused` が先に効く）。
//   ★**`Enter` は残す。** フォーカス中のボタン実行とフォーム送信の**最後の経路**を確保するため。
//     Space と同じ理屈で解禁自体は可能であり、必要になれば本表から外すだけでよい。
const ACTIVATION_KEYS: readonly string[] = ["Enter", "NumpadEnter"];

const SYSTEM_KEYS: readonly string[] = [
  "PrintScreen",
  "ContextMenu",
  "Pause",
  "Power",
  "Sleep",
  "WakeUp",
  "BrowserBack",
  "BrowserForward",
  "BrowserRefresh",
  "BrowserStop",
  "BrowserSearch",
  "BrowserFavorites",
  "BrowserHome",
  "AudioVolumeUp",
  "AudioVolumeDown",
  "AudioVolumeMute",
  "MediaPlayPause",
  "MediaStop",
  "MediaTrackNext",
  "MediaTrackPrevious",
  "LaunchMail",
  "LaunchApp1",
  "LaunchApp2",
  "Eject",
];

/** 修飾キーの同時押し状態。★`KeyboardEvent` そのものを渡さず、必要な値だけを取る（純粋に保つため）。 */
export interface KeyModifierState {
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}

/**
 * このキーを登録対象にできるか。できないなら理由を返す。
 *
 * ★**null が「登録できる」である。** 理由を返す形にしてあるのは、呼び出し側が無反応で
 *   弾けないようにするためである（§4.3-2）。boolean を返す形にすると、理由を出さない実装が書ける。
 *
 * @param code       `KeyboardEvent.code`
 * @param modifiers  同時に押されている修飾キー
 */
export function keyExclusionReason(
  code: string,
  modifiers: KeyModifierState,
): KeyExclusionReason | null {
  // ★**キーそのものの種類を先に見る。** 修飾キーを単体で押すと、そのイベント自身が
  //   `ctrlKey: true` 等を伴うため、同時押し判定を先に置くと `Ctrl` 単独の押下が
  //   「Ctrl を押しながらのキー」と案内されて噛み合わない（`Shift` 単独だけが正しい文言に
  //   なるという一貫性の無さも生む）。
  if (FUNCTION_KEY_PATTERN.test(code)) return "function_key";
  if (OS_KEYS.includes(code)) return "os_key";
  if (MODIFIER_KEYS.includes(code)) return "modifier_key";

  // ★そのうえで修飾キーとの同時押しを見る。`KeyJ` 自体は登録できるが `Ctrl + KeyJ` は登録できない。
  if (modifiers.ctrlKey || modifiers.altKey || modifiers.metaKey) {
    return "modified_chord";
  }
  if (NAVIGATION_KEYS.includes(code)) return "navigation_key";
  if (ACTIVATION_KEYS.includes(code)) return "activation_key";
  if (SYSTEM_KEYS.includes(code)) return "system_key";
  // ★空の code は「ブラウザが物理位置を報告しなかった」状態であり、識別子として使えない。
  if (code === "") return "system_key";
  return null;
}

/** 登録できるキーか（理由が要らない場面用の薄い別名）。 */
export function isRegistrableKey(
  code: string,
  modifiers: KeyModifierState,
): boolean {
  return keyExclusionReason(code, modifiers) === null;
}

const ARROW_LABEL: Readonly<Record<string, string>> = {
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
};

/**
 * キーの表示ラベルを作る。
 *
 * ★**同一性は `code`（物理位置）で持つが、ラベルは `key`（実際に刻印されている文字）を優先する。**
 *   配列が QWERTY でない利用者にとって、`KeyJ` を「J」と出すのは嘘になりうるためである。
 *   `key` が 1 文字の印字可能文字でないときだけ `code` から構造的に導く。
 */
export function keyLabel(code: string, key: string): string {
  if (key.length === 1 && key.trim() !== "") return key.toUpperCase();
  if (ARROW_LABEL[code] !== undefined) return ARROW_LABEL[code];
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return `テンキー${code.slice(6)}`;
  return code === "" ? "(不明なキー)" : code;
}
