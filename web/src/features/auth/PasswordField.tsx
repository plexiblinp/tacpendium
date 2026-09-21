import { useId, useRef } from "react";
import { useTranslation } from "react-i18next";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { stripNonPrintableASCII } from "./passwordRules";

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  testIdPrefix: string;
  autoFocus?: boolean;
  disabled?: boolean;
  /**
   * いまマスクしているか。★初期値は呼び出し側が決める。
   *
   * ★ログイン欄はマスク既定、設定・変更欄は表示既定である(D-396 / D-397)。
   * 非対称は意図したものである——設定側は初回のタイプミスが config.toml の編集を
   * 強いるため表示を既定にし、ログイン側は「友人が来ているとき」「画面を配信する
   * 利用者」の場面があるためマスクを既定にする。
   */
  masked: boolean;
  onMaskedChange: (masked: boolean) => void;
}

/**
 * PasswordField はパスワード入力欄と表示/マスクの切替を提供する。
 *
 * ★確認入力(2 回打たせる)は設けない(D-396)。設定側が表示を既定とするため、
 * 打ち間違いは目で確認できる。
 *
 * ★★印字可能な ASCII 以外は入力段階で落とす(2026-08-16 開発者要望)。
 * 全 4 欄——ログイン ／ いまのパスワード ／ パスワードを決める ／ 新しいパスワード——
 * に無条件で掛ける。**opt-in の prop を作らないこと**——付け忘れた欄だけ全角が
 * 通る形の欠陥になる。
 *
 * ★なぜ入力段階なのか: 送信時に弾くのでは遅い。ログインの失敗は
 * 「パスワードが違います。」としか出ないため、利用者は全角が原因だと分からない。
 *
 * ★`type="password"` に頼れない理由: 表示/マスクの切替えがあるため、どの欄も
 * `type="text"` になり得る(決める欄は表示が既定＝D-396)。IME をページ側から
 * 無効化する標準の手段は存在しない(`ime-mode` は非標準で Firefox も削除済み)。
 * ⇒ 値そのものを濾す方法だけが確実に効く。
 *
 * ★★これは入力補助であって照合の検査ではない。サーバ側の照合は無検査のままである
 * (M22-08 §4.1-2＝最重要ゲート 1。詳細は passwordRules.ts の
 * `stripNonPrintableASCII` の注記)。
 */
export default function PasswordField({
  label,
  value,
  onChange,
  testIdPrefix,
  autoFocus,
  disabled,
  masked,
  onMaskedChange,
}: Props) {
  const { t } = useTranslation();
  const inputId = useId();
  // ★IME で変換中かどうか。state ではなく ref に持つ——同じイベントターン内で
  //   同期的に読む必要があり、再描画も要らない。
  const composingRef = useRef(false);

  return (
    <div className="space-y-1">
      <Label htmlFor={inputId}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={inputId}
          type={masked ? "password" : "text"}
          value={value}
          // ★IME で変換している間は濾さない。未確定の文字列を 1 文字ずつ落とすと
          //   変換が壊れ、IME の状態がずれる。⇒ 変換中は素通しし(日本語がそのまま
          //   見える)、確定した時点で落とす。
          //
          // ★変換中かの判定に InputEvent.isComposing を使わず、composition イベントで
          //   自前に持つ。理由は 2 つ——(1) 入力イベント経由の isComposing はブラウザ差が
          //   大きい (2) state ではなく ref に持てば同じイベントターン内で同期的に読める。
          onCompositionStart={() => {
            composingRef.current = true;
          }}
          onChange={(e) => {
            onChange(
              composingRef.current ? e.target.value : stripNonPrintableASCII(e.target.value),
            );
          }}
          // ★確定時に落とす。onChange 側と冪等なので、ブラウザによる
          //   compositionend と最後の input の発火順序の差に依存しない。
          onCompositionEnd={(e) => {
            composingRef.current = false;
            onChange(stripNonPrintableASCII(e.currentTarget.value));
          }}
          autoFocus={autoFocus}
          disabled={disabled}
          autoComplete="off"
          data-testid={`${testIdPrefix}-input`}
        />
        <button
          type="button"
          onClick={() => onMaskedChange(!masked)}
          disabled={disabled}
          className="shrink-0 px-3 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50"
          data-testid={`${testIdPrefix}-toggle`}
        >
          {masked ? t("auth.show") : t("auth.hide")}
        </button>
      </div>
    </div>
  );
}
