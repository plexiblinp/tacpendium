import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// 保存が競合で止まったときのモーダル(M22-04 / CHANGE-115 §3)。
//
// ★守るべきものは 1 つ——利用者が書いたものを消さないこと。
//   本部品は「知らせる」だけで、フォームの state に一切触れない。読み込み直しは
//   呼び出し元の onReload に委ね、しかも 2 段階の確認を挟む(§4.3-3)。
//
// ★「ほかの人の内容を見る」は別枠(新しいタブ)で開く。編集中の画面を離れると
//   入力が消えるため、ルータの navigate を使ってはならない(§4.3-3)。
//
// ★上書きの道は出さない。M22-03 の as-built では 409 の応答本文にエラーコードと
//   メッセージしか載らず(details 無し = 指示書 §4.4 の案 A)、相手が何を変えたかを
//   知る手段が「別枠で開く」しか無い。判断材料が無いまま上書きさせると FR501 の
//   目的(誤上書きの防止)がその場で消える。
//
// ★差分の自動提示は作らない(D-415 で「作らない」に確定)。代わりに (a) の導線で
//   相手の現在の内容そのものを見せる。
//
// ★AlertDialogContent 経由のため、M21-07 の物理入力抑止(lib/modal-presence)には
//   自動で参加する。自作のオーバーレイにしてはならない。
//
// ★★「この内容で新しく登録する」は上書きの道ではない(M22-04 §4.7.2・D-417)。
//   別の行を新しく作るのであって、誰の編集も壊さない。⇒ 上書きの道を出さないと
//   決めた §4.4 案 (A) とも FR501(誤上書きの防止)とも矛盾しない。
//   ★この一文を消さないこと——書かないと、次の担当が「案 (A) に反する」と読んで削る。
//
// ★本部品の初版(v1.4.0)は 404 のとき「閉じる」しか出しておらず、利用者が入力を
//   抱えたまま保存する道を失った。⇒ 導線は「出ていること」ではなく「そこから先へ
//   進めること」で見る(§5.1-15)。

/** 資源の種別。文言の「コンボ」/「セットプレイ」を出し分けるためだけに使う。 */
export type ConflictResource = "combo" | "setup";

/**
 * モーダルで扱う競合の種別。
 *
 * - versionConflict: ほかの人が先に保存した(409 + version_conflict)
 * - notFound: 保存先の行がもう無い(404)。★キー変更編集(PUT)に負けた側もここへ来る
 *
 * ★notFound は「ほかの人が作り直した」と「本当に削除された」の両方で起こる。
 *   サーバは両者に同じコードと同じメッセージを返すため、画面側で区別する手段は無い。
 *   ⇒ 区別しない文言にしてある(「作り直したか、削除した可能性があります」)。
 */
export type ConflictKind = "versionConflict" | "notFound";

interface Props {
  open: boolean;
  kind: ConflictKind;
  resource: ConflictResource;
  /**
   * 「ほかの人の内容を見る」の遷移先。別枠で開く。
   * null なら導線を出さない(notFound は指す先の行がもう無いため null になる)。
   */
  viewTheirsHref: string | null;
  /**
   * 「読み込み直す」の実処理。★2 段目の確認を通ったときだけ呼ばれる。
   * null なら導線を出さない(notFound は読み込み直しても行が無いため null になる)。
   */
  onReload: (() => void) | null;
  /**
   * 「この内容で新しく登録する」の実処理(M22-04 §4.7.2-1)。
   * ★2 段目の確認を通ったときだけ呼ばれる。null なら導線を出さない。
   *
   * ★notFound で保存する道を作るためのものである。旧行がもう無いため
   *   「読み込み直す」も「ほかの人の内容を見る」も指す先が無く、これが唯一の
   *   前進経路になる。
   *
   * ★★任意（既定 null）にしないこと。省略できる形にすると、渡し忘れが
   *   「閉じるだけ」の行き止まりとして静かに復活する（D-417 がまさにそれだった）。
   *   ⇒ 出さないなら null を明示的に渡す。
   */
  onSaveAsNew: (() => void) | null;
  /**
   * 「コンボ一覧へ」の実処理(M22-04 §4.7.2-2)。最小の脱出路。
   * ★入力が失われるため 2 段目の確認を挟む。null なら導線を出さない。
   */
  onGoToList: (() => void) | null;
  onClose: () => void;
}

/** 2 段目の確認を要する操作。★1 つの確認ダイアログを共用する(E-76 のドリフト回避)。 */
type PendingAction = "reload" | "saveAsNew" | "goToList";

/**
 * 2 段目の test-id の中置き。
 *
 * ★`reload` は既存の `conflict-dialog-reload-confirm` / `-cancel` / `-execute` を
 *   そのまま保つ(既存 test-id の改名は E2E とコンポーネントテストの回帰になる
 *   ＝`DES-005` §6.8)。追加分だけケバブケースで足す。
 */
const CONFIRM_TESTID: Record<PendingAction, string> = {
  reload: "reload",
  saveAsNew: "save-as-new",
  goToList: "go-to-list",
};

export function ConflictDialog({
  open,
  kind,
  resource,
  viewTheirsHref,
  onReload,
  onSaveAsNew,
  onGoToList,
  onClose,
}: Props) {
  const { t } = useTranslation();
  // 2 段階の確認(§4.3-3・§4.3-4・§4.7.2)。押す前に何が起きるかを伝える。
  // ★3 つの操作で 1 つの確認ダイアログを共用する。別々に書くと必ずドリフトする(E-76)。
  const [pending, setPending] = useState<PendingAction | null>(null);

  const suffix = resource === "combo" ? "Combo" : "Setup";
  const title = t(`conflict.${kind}.title${suffix}`);
  const body = t(`conflict.${kind}.body${suffix}`);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setPending(null);
      onClose();
    }
  };

  const runPending = () => {
    const action = pending;
    setPending(null);
    if (action === "reload") onReload?.();
    else if (action === "saveAsNew") onSaveAsNew?.();
    else if (action === "goToList") onGoToList?.();
  };

  return (
    <>
      <AlertDialog open={open && pending === null} onOpenChange={handleOpenChange}>
        <AlertDialogContent data-testid="conflict-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>{body}</p>
                {/* ★利用者が最初に知りたいのは「書いたものは無事か」である(§4.3-2)。 */}
                <p className="font-medium text-gray-900" data-testid="conflict-dialog-input-kept">
                  {t("conflict.inputKept")}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {viewTheirsHref && (
              // ★別枠で開く。編集中の画面を離れない(離れると入力が消える)。
              <a
                href={viewTheirsHref}
                target="_blank"
                rel="noreferrer"
                data-testid="conflict-dialog-view-theirs"
                className="inline-flex items-center justify-center rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
              >
                {t("conflict.viewTheirs")}
              </a>
            )}
            {onReload && (
              <button
                type="button"
                onClick={() => setPending("reload")}
                data-testid="conflict-dialog-reload"
                className="inline-flex items-center justify-center rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
              >
                {t("conflict.reload")}
              </button>
            )}
            {/* ★保存する道(§4.7.2-1)。上書きではなく、別の行を新しく作る。 */}
            {onSaveAsNew && (
              <button
                type="button"
                onClick={() => setPending("saveAsNew")}
                data-testid="conflict-dialog-save-as-new"
                className="inline-flex items-center justify-center rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                {t("conflict.saveAsNew")}
              </button>
            )}
            {/* ★脱出路(§4.7.2-2)。保存を選ばない利用者のために要る。 */}
            {onGoToList && (
              <button
                type="button"
                onClick={() => setPending("goToList")}
                data-testid="conflict-dialog-go-to-list"
                className="inline-flex items-center justify-center rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
              >
                {t("conflict.goToList")}
              </button>
            )}
            <AlertDialogAction onClick={onClose} data-testid="conflict-dialog-close">
              {t("conflict.close")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 2 段目: 何が起きるかを読んでからでないと押せない形にする(§4.3-3・§4.3-4・§4.7.2)。
          ★3 操作で共用する。test-id は操作ごとに分け、既存の
            `conflict-dialog-reload-confirm` 系は名前を変えない(改名は回帰になる)。 */}
      <AlertDialog open={pending !== null} onOpenChange={(next) => !next && setPending(null)}>
        <AlertDialogContent data-testid={`conflict-dialog-${CONFIRM_TESTID[pending ?? "reload"]}-confirm`}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t(`conflict.${pending ?? "reload"}Confirm.title`)}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(`conflict.${pending ?? "reload"}Confirm.body`)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              data-testid={`conflict-dialog-${CONFIRM_TESTID[pending ?? "reload"]}-cancel`}
            >
              {t(`conflict.${pending ?? "reload"}Confirm.cancel`)}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={runPending}
              data-testid={`conflict-dialog-${CONFIRM_TESTID[pending ?? "reload"]}-execute`}
            >
              {t(`conflict.${pending ?? "reload"}Confirm.confirm`)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
