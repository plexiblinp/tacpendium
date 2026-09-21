// コンボ詳細画面のメタデータエリア:ダメージ・ゲージ消費・有利フレーム・起き攻めオプション・メモ・メディア・タグ。

import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { TagBadgeList } from "@/features/tag/components/TagBadgeList";
import {
  OKI_VERIFIED_STATE_LABEL_KEYS,
  okiOptionKey,
  okiOptionLabel,
} from "@/constants/oki";
import { Badge } from "@/components/ui/badge";
import { InfoMark } from "@/components/InfoMark";
import { isSafeHttpUrl } from "@/lib/safe-url";
import { useAcknowledgeComboVersion } from "@/features/game-update/api";
import type { ComboDetail } from "../types";
import {
  formatDamage,
  formatDriveGauge,
  formatSAGauge,
  formatDriveDamage,
  driveDamageDirectionLabel,
  formatKnockdownAdvantage,
  formatPositionMass,
} from "../utils";

interface ComboDetailMetadataProps {
  combo: ComboDetail;
  /**
   * ゴミ箱のコンボ詳細から呼ばれているか(M28-02c / DES-005 §5.6)。
   *
   * ★★ゴミ箱では印は出すが「問題なし」ボタンは出さず、理由を添える ——
   *   判定式は deleted_at を見ないので印は載る一方、acknowledge-version の母集団は
   *   deleted_at IS NULL であり 404 になる。★ボタンだけ黙って消すと
   *   「確認できないのに警告だけ出る」形になる。
   */
  inTrash?: boolean;
}

export default function ComboDetailMetadata({
  combo,
  inTrash,
}: ComboDetailMetadataProps) {
  const { t } = useTranslation();
  // ★M27-03: 1 回だけ解決する(描画のたびに 2 回呼ばない)。
  const driveDamageDirection = driveDamageDirectionLabel(combo.driveDamage, t);

  return (
    <section className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
      <div>
        <h2 className="text-lg font-semibold mb-2">
          {t("comboDetail.metadata.heading")}
        </h2>
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className="text-xs text-slate-500">
              {t("comboDetail.metadata.damage")}
            </dt>
            <dd className="tabular-nums">{formatDamage(combo.damage)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">
              {t("comboDetail.metadata.driveGauge")}
            </dt>
            <dd className="tabular-nums">
              {formatDriveGauge(combo.driveAvailableAtStart)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">
              {t("comboDetail.metadata.saGauge")}
            </dt>
            <dd className="tabular-nums">
              {formatSAGauge(combo.saAvailableAtStart)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">
              {t("comboDetail.metadata.knockdownAdvantage")}
            </dt>
            <dd className="tabular-nums">
              {formatKnockdownAdvantage(combo.knockdownAdvantage)}
            </dd>
          </div>
          {/* ★★★M37-01: 運び量(D-731)。
              ★★状況ブロック(ComboDetailHeader の <dl>)には置かない —— あちらは
                重複判定キーの欄そのもの(★M37-07 で持続当てが加わり 5 欄になった)で
                あり、そこへ並べると「運び量もキーの一部である」と読めてしまう。
                ★運び量はキーではなく計測値である。
              ★区分は出さない。⇒ 区分を持つのは始動位置だけである(不変条件 2)。 */}
          <div>
            <dt className="text-xs text-slate-500">
              {t("comboDetail.metadata.carryDistanceMass")}
            </dt>
            <dd
              className="tabular-nums"
              data-testid="combo-detail-carry-distance-mass"
            >
              {formatPositionMass(combo.carryDistanceMass)}
            </dd>
          </div>
          {/* ★★M27-03(SD-009): 符号がどちらを表すかを画面から読めるようにする。
              ★項目は 1 つのままである。欄を分けたのではなく、格納値に応じて
                同じ 1 行の表示を変えている。
              ★値域も検証も変えていない(VAL-C13＝-6〜6)。 */}
          <div>
            <dt className="text-xs text-slate-500">
              {t("comboDetail.metadata.driveDamage")}
              <InfoMark
                topic="drive-damage"
                text={t("help.driveDamage")}
                ariaLabel={t("comboDetail.metadata.driveDamage")}
                className="ml-1 align-middle"
              />
            </dt>
            <dd className="tabular-nums">
              {formatDriveDamage(combo.driveDamage)}
              {/* ★0 と未入力には語を付けない(どちらでもないため)。 */}
              {driveDamageDirection && (
                <span className="ml-1 text-xs text-slate-400 not-italic">
                  {driveDamageDirection}
                </span>
              )}
            </dd>
          </div>
          {/* M16-02: 消費ゲージ。始動残量(driveGauge/saGauge)と別項目・ラベルで判別。 */}
          <div>
            <dt className="text-xs text-slate-500">
              {t("comboDetail.metadata.saGaugeConsumed")}
            </dt>
            <dd className="tabular-nums">
              {formatSAGauge(combo.saGaugeConsumed)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">
              {t("comboDetail.metadata.driveGaugeConsumed")}
            </dt>
            <dd className="tabular-nums">
              {formatDriveGauge(combo.driveGaugeConsumed)}
            </dd>
          </div>
          {/* ★★M28-02c(FR702): ゲーム更新の前提バージョン。印を出す面は詳細だけである
              ——専用画面は全行が該当するので冗長、一覧は「常に 1 軸増えると邪魔」。
              ここは 1 件だけを見ている画面であり、バナーもボタンも無い。
              ★★出る面は 2 つ(コンボ詳細 / ゴミ箱のコンボ詳細)。エクスポートには出さない。
              ★baselineVersion が無いときは「不明」＋印 ——「-」にすると
                「不明だから出ている」という因果が画面から消える。 */}
          <div>
            <dt className="text-xs text-slate-500">
              {t("gameUpdate.detailLabel")}
            </dt>
            <dd
              className="tabular-nums"
              data-testid="combo-detail-baseline-version"
            >
              {combo.baselineVersion ?? t("gameUpdate.baselineUnknown")}
              {/* ★★真偽の正本は affectedByGameUpdate である。
                  affectedMoves.length では判定しない(真偽が 2 か所で表せてしまう)。 */}
              {combo.affectedByGameUpdate && (
                <span
                  className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 not-italic"
                  data-testid="combo-detail-game-update-mark"
                >
                  {t("gameUpdate.detailUnconfirmed")}
                </span>
              )}
            </dd>
            {/* ★中身があるときだけ描く(空の <dd> を出さない)。
                ★真偽の正本は affectedByGameUpdate であり、ここは「並べる文字列が
                  あるか」の描画分岐にすぎない。 */}
            {combo.affectedByGameUpdate && combo.affectedMoves.length > 0 && (
              <dd
                className="mt-1 text-xs text-slate-600"
                data-testid="combo-detail-affected-moves"
              >
                {combo.affectedMoves
                  .map((m) => m.nameJa?.trim() || m.code)
                  .join(" / ")}
              </dd>
            )}
            {combo.affectedByGameUpdate && (
              <dd className="mt-1">
                {inTrash ? (
                  // ★ボタンだけ黙って消さない。出せない理由を添える。
                  <span
                    className="text-xs text-slate-500"
                    data-testid="combo-detail-acknowledge-trash-note"
                  >
                    {t("gameUpdate.detailTrashNote")}
                  </span>
                ) : (
                  <AcknowledgeVersionButton comboId={combo.id} />
                )}
              </dd>
            )}
          </div>
        </dl>
      </div>

      <div>
        {/* ★★M27-02b 追補: 「調べたか」は**行の有無によらず常に**出す。
            ★当初は「行が 1 つも無いとき」だけ出していたが、**利用者が実際に踏む経路
              (チェックを付けて登録した)でフラグが不可視だった**(2026-09-05 実機確認)。
              行があれば検証済みが自明に見えるが、**解除ガードを通せば「行あり ＋ 未検証」は
              作れる**(CSV 取込も同じ)。⇒ 表せる状態は画面に出す。
            ★★下の空欄時の 2 文とは役割が違う——バッジは「調べたか」、文は
              「一覧が空である理由」を言っている。重ねて出しても矛盾しない。 */}
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-sm font-semibold text-slate-700">
            {t("comboDetail.oki.heading")}
          </h3>
          <Badge
            variant={combo.okiVerified ? "secondary" : "outline"}
            data-testid="combo-detail-oki-verified"
            data-state={combo.okiVerified ? "verified" : "unverified"}
          >
            {t(
              combo.okiVerified
                ? OKI_VERIFIED_STATE_LABEL_KEYS.verified
                : OKI_VERIFIED_STATE_LABEL_KEYS.unverified,
            )}
          </Badge>
        </div>
        {/* M16-03: 起き攻めオプション(正規化・sparse)。成立するオプションをラベル一覧で表示。
            ★M27-02b: 「調べたか」はコンボ単位の okiVerified が持つ。⇒ 空のときの
              文言をそれで出し分ける(下記 else 側)。 */}
        {combo.okiOptions && combo.okiOptions.length > 0 ? (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {combo.okiOptions.map((o) => (
              <li key={okiOptionKey(o)} className="flex items-center gap-2 text-slate-700">
                <span className="text-emerald-600 font-medium">✓</span>
                {okiOptionLabel(o, t)}
              </li>
            ))}
          </ul>
        ) : (
          // ★★M27-02b(P4M-011): 本フラグを読む面は詳細だけである(開発者確定)。
          //   ★★空配列の意味は 2 つある——**まだ調べていない** と
          //     **調べたが成立するものが無かった**。同じ文言にすると区別が消える。
          <p className="text-sm text-slate-500">
            {combo.okiVerified
              ? t("comboDetail.oki.verifiedNone")
              : t("comboDetail.oki.notVerified")}
          </p>
        )}
      </div>

      {combo.tags.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-2">タグ</h3>
          <TagBadgeList tags={combo.tags} size="md" />
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-2">
          {t("comboDetail.metadata.memo")}
        </h3>
        {combo.memo ? (
          <p className="text-sm whitespace-pre-wrap break-words">
            {combo.memo}
          </p>
        ) : (
          <p className="text-sm text-slate-400">
            {t("comboDetail.metadata.noMemo")}
          </p>
        )}
      </div>

      {/* M17-01: メディア 3 フィールド(文字列参照まで)。値がある項目のみ表示(タグと同じ hidden-when-empty 流儀)。
          link は http/https のみリンク化(CHANGE-068 §2.3-h・危険スキーム無害化)、path 2 種は常にテキスト表示。 */}
      {(combo.link || combo.videoPath || combo.imagePath) && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-2">
            {t("comboDetail.metadata.media")}
          </h3>
          <dl className="space-y-1 text-sm">
            {combo.link && (
              <div className="flex gap-2">
                <dt className="text-xs text-slate-500 shrink-0 pt-0.5 w-20">
                  {t("comboDetail.metadata.link")}
                </dt>
                <dd className="break-all" data-testid="combo-detail-link">
                  {isSafeHttpUrl(combo.link) ? (
                    <a
                      href={combo.link.trim()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {combo.link}
                    </a>
                  ) : (
                    combo.link
                  )}
                </dd>
              </div>
            )}
            {combo.videoPath && (
              <div className="flex gap-2">
                <dt className="text-xs text-slate-500 shrink-0 pt-0.5 w-20">
                  {t("comboDetail.metadata.videoPath")}
                </dt>
                <dd className="break-all" data-testid="combo-detail-video-path">
                  {combo.videoPath}
                </dd>
              </div>
            )}
            {combo.imagePath && (
              <div className="flex gap-2">
                <dt className="text-xs text-slate-500 shrink-0 pt-0.5 w-20">
                  {t("comboDetail.metadata.imagePath")}
                </dt>
                <dd className="break-all" data-testid="combo-detail-image-path">
                  {combo.imagePath}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm border-t border-slate-100 pt-3">
        <div>
          <dt className="text-xs text-slate-500">
            {t("comboDetail.metadata.createdAt")}
          </dt>
          <dd className="tabular-nums text-slate-600">{combo.createdAt}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">
            {t("comboDetail.metadata.updatedAt")}
          </dt>
          <dd className="tabular-nums text-slate-600">{combo.updatedAt}</dd>
        </div>
      </dl>
    </section>
  );
}

/**
 * 「問題なし」ボタン(FR702・CHANGE-162 §6.1)。
 *
 * ★語は「問題なし」である ——「確認した」を採らなかった(2026-09-06 開発者確定)。
 *   誰が何を判断したのかがはっきりする。判断するのは利用者でありアプリではない。
 * ★★API 名は acknowledge-version のままである(ラベルと経路名がずれることは承知のうえ)。
 * ★1 件ずつだけである。一括は作らない —— 誤爆すると前の基準がどこにも残らない。
 * ★取り消しは持たない。⇒ 押した結果は操作結果として画面に出す。
 */
function AcknowledgeVersionButton({ comboId }: { comboId: number }) {
  const { t } = useTranslation();
  const acknowledge = useAcknowledgeComboVersion();

  // ★★操作結果はトーストで出す。★★この面でインラインに出しても読めない ——
  //   成功すると詳細が再取得され affectedByGameUpdate が false になるので、
  //   表示を含むブロックごとアンマウントされる。CHANGE-162 §6.2 が
  //   「✓ 問題なしにしました」を唯一の例外として残した以上、見えないまま消えるのは
  //   意図と食い違う。⇒ 面の外へ出す。
  const handleClick = () =>
    acknowledge.mutate(comboId, {
      onSuccess: () => toast.success(t("gameUpdate.acknowledged")),
    });

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={acknowledge.isPending}
        title={t("gameUpdate.acknowledgeHint")}
        className="text-xs text-blue-600 hover:underline disabled:text-slate-400"
        data-testid="combo-detail-acknowledge"
      >
        {t("gameUpdate.acknowledge")}
      </button>
      {/* ★失敗を黙って消さない。 */}
      {acknowledge.isError && (
        <span
          className="ml-2 text-xs text-red-600"
          data-testid="combo-detail-acknowledge-error"
        >
          {t("gameUpdate.acknowledgeError")}
        </span>
      )}
    </>
  );
}
