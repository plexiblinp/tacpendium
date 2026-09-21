import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import PresetSamplePreview from "./PresetSamplePreview";
import { PRESET_TOTAL_LIMIT, type Preset } from "../types";

// ★件数は定数から組み立てる。VAL-P05 の値は M20-01 で 10 → 8 へ変わった実績が
// あり、リテラルで書くと文面だけが古い数字のまま残る。
const LIMIT_REACHED_HINT =
  `プリセットは全体で ${PRESET_TOTAL_LIMIT} 件までです。` +
  `不要なカスタムプリセットを削除してください`;

interface Props {
  builtins: Preset[];
  customs: Preset[];
  /** サンプル表記プレビューを引くキャラクター(config の既定キャラ)。 */
  sampleCharacterId: number | undefined;
  /** 現在適用中のプリセット(config の [defaults] preset_id)。 */
  currentPresetId: number | undefined;
  /** 上限に達しているとコピーできない(VAL-P05)。 */
  limitReached: boolean;
  onCopy: (base: Preset) => void;
  onDelete: (preset: Preset) => void;
  onUse: (preset: Preset) => void;
  isApplying?: boolean;
  /** いま操作している利用者(未選択なら undefined)。 */
  currentUserId?: number;
  /** userId → 表示名。分からなければ undefined を返す。 */
  ownerName?: (userId: number) => string | undefined;
}

/**
 * PresetListTable はプリセット一覧(DES-005 §5.10)の表。
 *
 * 表示項目は組み込み(名称・サンプル表記プレビュー)とカスタム(名称・ベース
 * プリセット名)。
 *
 * ★DES-005 §5.10 はカスタム行に「作成日」も挙げているが、presets テーブルに
 * created_at が存在しない(DES-003 §3.8 にタイムスタンプ列の定義が無い)。
 * 列を足すにはマイグレーションが要るが、本サブは自採番しない(D-293)ため
 * 表示しない。設計卓へ上げて DES-005 の改訂で扱う。
 *
 * ★レイアウトは設計書が定めていない(§9.2-1)。PC はテーブル、スマホは
 * カード形式という §5.10 のレスポンシブ方針に従い、md 未満でカードへ落とす。
 */
export default function PresetListTable({
  builtins,
  customs,
  sampleCharacterId,
  currentPresetId,
  limitReached,
  onCopy,
  onDelete,
  onUse,
  isApplying,
  currentUserId,
  ownerName,
}: Props) {
  const { t } = useTranslation();
  // ★FR013 後半: タグ・プリセットは作成者のみ編集・削除できる。
  // プリセットは「見えるが編集できない」形である(List は絞らず、書き込みを
  // authorizeMutation が VAL-P07 で弾く)。★タグはこれと形が違い、そもそも
  // 見えない(D-402)。混ぜないこと。
  const isOthers = (p: Preset) =>
    p.userId != null && currentUserId != null && p.userId !== currentUserId;
  const useButton = (p: Preset) =>
    currentPresetId === p.id ? (
      <span className="text-xs font-medium text-green-700">使用中</span>
    ) : (
      <button
        type="button"
        onClick={() => onUse(p)}
        disabled={isApplying}
        className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
        data-testid={`preset-use-${p.id}`}
      >
        使用する
      </button>
    );

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-2 text-sm font-bold text-slate-700">
          組み込みプリセット（{builtins.length}）
        </h2>
        <p className="mb-2 text-xs text-slate-500">
          組み込みプリセットは編集・削除できません。変更したい場合はコピーしてカスタムプリセットを作成してください。
        </p>

        <ul className="divide-y divide-slate-200 rounded border border-slate-200 bg-white">
          {builtins.map((p) => (
            <li
              key={p.id}
              className="flex flex-col gap-2 p-3 md:flex-row md:items-center md:justify-between"
              data-testid={`preset-row-${p.id}`}
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-800">{p.name}</div>
                <div className="mt-0.5 truncate">
                  {sampleCharacterId != null && (
                    <PresetSamplePreview
                      presetId={p.id}
                      characterId={sampleCharacterId}
                    />
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {useButton(p)}
                <button
                  type="button"
                  onClick={() => onCopy(p)}
                  disabled={limitReached}
                  title={limitReached ? LIMIT_REACHED_HINT : undefined}
                  className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  data-testid={`preset-copy-${p.id}`}
                >
                  コピー
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold text-slate-700">
          カスタムプリセット（{customs.length}）
        </h2>

        {customs.length === 0 ? (
          <p
            className="rounded border border-dashed border-slate-300 p-4 text-sm text-slate-500"
            data-testid="preset-custom-empty"
          >
            カスタムプリセットはまだありません。組み込みプリセットの「コピー」から作れます。
          </p>
        ) : (
          <ul className="divide-y divide-slate-200 rounded border border-slate-200 bg-white">
            {customs.map((p) => (
              <li
                key={p.id}
                className="flex flex-col gap-2 p-3 md:flex-row md:items-center md:justify-between"
                data-testid={`preset-row-${p.id}`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-800">{p.name}</span>
                    {isOthers(p) && (
                      <span
                        className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600"
                        data-testid={`preset-other-owner-${p.id}`}
                      >
                        {t("user.otherOwner.presetShort")}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    ベース: {p.basePresetCode ?? "—"}
                  </div>
                  {/* ★押せるのに何も起きない形にしない。失敗だけが出る形にもしない
                      ——「なぜできないか」が分からないのが最も分かりにくい
                      (CHANGE-113 §3.10)。⇒ ボタンを出さず、理由を書く。 */}
                  {isOthers(p) && (
                    <p
                      className="mt-1 text-xs text-slate-500"
                      data-testid={`preset-other-owner-note-${p.id}`}
                    >
                      {t("user.otherOwner.preset", {
                        name: ownerName?.(p.userId as number) ?? t("common.unknown"),
                      })}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {useButton(p)}
                  {!isOthers(p) && (
                    <>
                      <Link
                        to={`/presets/${p.id}/edit`}
                        className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                        data-testid={`preset-edit-${p.id}`}
                      >
                        編集
                      </Link>
                      <button
                        type="button"
                        onClick={() => onDelete(p)}
                        className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                        data-testid={`preset-delete-${p.id}`}
                      >
                        削除
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
