import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";

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

import { interceptedHrefFromClick, toLinkClickLike } from "./linkClick";

// M24-04(CO-003): 未保存の入力があるまま画面を離れようとしたら確認する。
//
// ★★やらないこと＝入力の保持。「あとで戻ってきたら残っている」は作らない。
//   それは REQ-001 §7 フェーズ3 の独立項目「編集中の画面遷移時データ保持」であり、
//   下書きの永続化という別の設計が要る(指示書 §1.1.2 / §1.3-1)。
//   ⇒ ここでは入力内容をブラウザストレージにも React 外にも一切保存しない。
//
// 掛ける経路は 4 つ:
//   1. 画面内リンク(フッタのナビ、将来ヘッダを足した場合も) …… document の click キャプチャ
//   2. ブラウザバック ……………………………………………… 番人の履歴エントリ + popstate
//   3. リロード / タブを閉じる ……………………………… beforeunload
//   4. 「キャンセル」ボタンなど画面内の遷移 ………… requestLeave() を通す
//
// ★確認は共有プリミティブ(AlertDialog)で出す。自作オーバーレイは M21-07 の
//   物理入力抑止に参加しないため(DES-005 §5.7 規則9)。

/**
 * 離脱しようとしている先。
 *
 * ★★「任意の関数を実行する」という形は持たない。
 *   番人の履歴エントリを積んでいるため、離脱は必ずその 1 枚ぶんを補正する必要がある。
 *   任意の関数（例: `navigate(-1)`）を預かると補正のしようがなく、
 *   「離れたつもりで編集画面自身のエントリへ戻る」＝離れられない状態になる。
 *   ⇒ 行き先の形を 2 つに絞り、どちらも補正の仕方が決まっている状態にしてある。
 */
type PendingLeave = { kind: "to"; to: string } | { kind: "back" };

interface NavigationGuardContextValue {
  /** ガードの有効・無効を登録する(dirty な編集面が 1 つでもあれば止める)。 */
  setBlocked: (id: string, blocked: boolean) => void;
  /** 行き先を指定して離れる。ガードが無効なら即遷移する。 */
  requestLeaveTo: (to: string) => void;
  /** 履歴を 1 つ戻って離れる。ガードが無効なら即戻る。 */
  requestLeaveBack: () => void;
  /** 確認を出さずに離れる（保存が済んだ直後など）。★番人の補正はする。 */
  leaveWithoutConfirmTo: (to: string) => void;
  /** 確認を出さずに履歴を 1 つ戻る（保存が済んだ直後など）。★番人の補正はする。 */
  leaveWithoutConfirmBack: () => void;
}

/**
 * 番人の履歴エントリに付ける目印。
 * ★★`window.history.state` は react-router 6 のもの(`{usr, key, idx}`)である。
 *   潰すと前後の差分計算が狂うため、複製して目印だけを足す。
 * ★★目印を見れば「いま居るのが番人のエントリか」が分かる。ref だけで数えると、
 *   アプリ側が別の遷移をしたあとも「番人の上に居る」と誤認し、余計に 1 つ戻してしまう。
 */
const SENTINEL_KEY = "__tacpendiumNavigationGuardSentinel";
let sentinelSeq = 0;

const NavigationGuardContext = createContext<NavigationGuardContextValue | null>(
  null,
);

export function useNavigationGuardContext(): NavigationGuardContextValue {
  const ctx = useContext(NavigationGuardContext);
  if (!ctx) {
    throw new Error(
      "useNavigationGuardContext は NavigationGuardProvider の内側で使うこと",
    );
  }
  return ctx;
}

export function NavigationGuardProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [blockedIds, setBlockedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [pending, setPending] = useState<PendingLeave | null>(null);

  const blocked = blockedIds.size > 0;
  // イベントハンドラは 1 度しか張らないので、最新値を ref 経由で読む。
  const blockedRef = useRef(blocked);
  blockedRef.current = blocked;
  // いま積んである番人の目印。null = 積んでいない。
  const sentinelTokenRef = useRef<number | null>(null);
  // 「離れる」を実行中か。実行中は effect の後始末が番人を二重に戻さないようにする。
  const leavingRef = useRef(false);
  // 自分で起こした popstate を 1 度だけ読み飛ばす(戻って離れるときの go)。
  const skipNextPopRef = useRef(false);

  /** いま居るのが番人のエントリか。★ref ではなく履歴の目印で判定する。 */
  const onSentinelEntry = useCallback((): boolean => {
    const token = sentinelTokenRef.current;
    if (token == null) return false;
    const state = window.history.state as Record<string, unknown> | null;
    return !!state && state[SENTINEL_KEY] === token;
  }, []);

  const setBlocked = useCallback((id: string, isBlocked: boolean) => {
    setBlockedIds((prev) => {
      const has = prev.has(id);
      if (has === isBlocked) return prev;
      const next = new Set(prev);
      if (isBlocked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const requestLeaveTo = useCallback(
    (to: string) => {
      if (!blockedRef.current) {
        navigate(to);
        return;
      }
      setPending({ kind: "to", to });
    },
    [navigate],
  );

  const requestLeaveBack = useCallback(() => {
    if (!blockedRef.current) {
      navigate(-1);
      return;
    }
    setPending({ kind: "back" });
  }, [navigate]);

  // --- 0. リロードで取り残された番人を片づける ----------------------------
  // ★★`pushState` の state はリロードを跨いで残るため、番人のエントリの上で
  //   リロードすると、新しいインスタンスは「自分が積んでいない番人」の上で起動する。
  //   ★そのまま放置すると、一度も入力せずに「戻る」を押したとき、同じ URL の
  //     エントリへ着地して 1 回空振りする（本サブ以前には無かった挙動）。
  //   ⇒ 起動時に 1 度だけ、番人の上に居たら 1 つ戻して取り除く。
  //     ★番人は必ず「直前のエントリと同じ URL」で積まれるため、戻っても画面は変わらない。
  useEffect(() => {
    const state = window.history.state as Record<string, unknown> | null;
    if (state && typeof state[SENTINEL_KEY] === "number") {
      window.history.go(-1);
    }
    // 起動時に 1 度だけ実行する。
  }, []);

  // --- 1. 画面内リンクのクリックを横取りする ------------------------------
  // ★1 か所で全リンクを見る。リンクごとに部品を差し替えると、次に足された
  //   リンクが素通りする(ヘッダを足したときに漏れる)。
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!blockedRef.current) return;
      const href = interceptedHrefFromClick(
        toLinkClickLike(event),
        window.location.href,
      );
      if (href == null) return;
      event.preventDefault();
      event.stopPropagation();
      setPending({ kind: "to", to: href });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // --- 2. ブラウザバック --------------------------------------------------
  // ★番人のエントリを 1 つ積んでおく。積まずに popstate を待つと、待った時点で
  //   既に前の画面へ移っており編集中の state ごと消えている(戻す手立てが無い)。
  // ★history.state は現在値を複製して積む——react-router 6 は state 内の idx で
  //   前後の差分を数えており、null を積むとその計算が狂う。
  useEffect(() => {
    if (!blocked) return;

    const pushSentinel = () => {
      const token = ++sentinelSeq;
      const state = window.history.state as Record<string, unknown> | null;
      window.history.pushState({ ...(state ?? {}), [SENTINEL_KEY]: token }, "");
      sentinelTokenRef.current = token;
    };

    // ★★いま立っているエントリが既に番人なら、引き継いで積み直さない。
    //   ★★リロードを挟むとこうなる——`pushState` の state はリロードを跨いで残るため、
    //     前のインスタンスが積んだ番人の上に立ったまま復帰する。そこでもう 1 枚積むと
    //     番人が 2 枚になり、「保存せずに離れる」の go(-2) では足りず、
    //     編集画面自身へ着地して離れられない
    //     （2026-08-28 の開発者手動確認で報告された手順そのもの）。
    //   ★トークンは引き継いだ値をそのまま使う。新しく採ると onSentinelEntry() が
    //     「番人の上に居ない」と誤判定する。
    const currentState = window.history.state as Record<string, unknown> | null;
    const inherited = currentState?.[SENTINEL_KEY];
    if (typeof inherited === "number") {
      sentinelTokenRef.current = inherited;
    } else {
      pushSentinel();
    }

    const onPopState = () => {
      // ★自分で起こした go(戻って離れる)の popstate は読み飛ばす。
      //   読み飛ばさないと、離れる操作そのものをもう一度止めてしまう。
      if (skipNextPopRef.current) {
        skipNextPopRef.current = false;
        sentinelTokenRef.current = null;
        return;
      }
      // 戻るが押されて番人が 1 つ消えた。積み直して現在地に留め、確認を出す。
      pushSentinel();
      setPending({ kind: "back" });
    };
    window.addEventListener("popstate", onPopState);

    return () => {
      window.removeEventListener("popstate", onPopState);
      // ★★番人を残さない。dirty を打ち消しただけ(入力してから消した等)でも
      //   ここへ来るため、残すと「戻る」が 1 回空振りする——本サブ以前には無かった挙動になる。
      // ★「離れる」の実行中は触らない。leave() が既に補正している。
      // ★★目印で「いま番人の上に居るか」を確かめてから戻す。アプリが別の遷移を
      //   済ませた後(保存して一覧へ移った後など)は番人の上に居らず、
      //   戻すとその遷移を巻き戻してしまう。
      if (!leavingRef.current && onSentinelEntry()) {
        sentinelTokenRef.current = null;
        window.history.go(-1);
      } else {
        sentinelTokenRef.current = null;
      }
    };
  }, [blocked, onSentinelEntry]);

  // --- 3. リロード / タブを閉じる ----------------------------------------
  useEffect(() => {
    if (!blocked) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      // 文面はブラウザが決める(任意文言は現代のブラウザでは表示されない)。
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [blocked]);

  const stay = useCallback(() => setPending(null), []);

  /**
   * 実際に離れる。★番人の履歴エントリ 1 枚ぶんをここで補正する。
   *
   * ★★確認を出すかどうかとは独立である——保存が済んだ直後のように
   *   「確認は要らないが補正は要る」場合があるため、補正だけをここへ切り出してある。
   */
  const performLeave = useCallback(
    /**
     * @param afterSave ★★保存が済んだ後の遷移か。
     *   真なら遷移先へ `fromSave` の目印を渡す。⇒ 遷移先は「直前は保存済みの
     *   編集画面である」ことを知れる（`ComboDetailPage` の「戻る」がこれを見る）。
     *
     * ★★履歴から編集画面を消す形は**採らない**。番人は react-router の `idx` を
     *   複製して積まれるため、`history.go` を挟むとルータの位置の勘定が狂う
     *   （差分が 0 になり更新されない）。**M24-12 (3) が「戻る 1 回で編集画面、
     *   2 回目でその前へ抜ける」を契約として押さえており、そこも壊れた**
     *   （2026-09-05 に実際に赤で出た）。⇒ 履歴の形は 1 枚も変えない。
     */
    (target: PendingLeave, afterSave = false) => {
      // ★★ガードの登録(blockedIds)は触らない。
    //   以前は全解除していたが、useUnsavedChangesGuard の effect は deps が
    //   変わらないため再登録されず、遷移が起きなかったときに
    //   「入力が未保存のままガードだけ恒久的に外れる」状態になっていた。
      //   ⇒ 遷移が起きれば編集面がアンマウントされ、登録は自然に解ける。
      //     起きなければガードは張られたまま——そちらが安全側である。
      const hadSentinel = onSentinelEntry();
      leavingRef.current = true;

      if (target.kind === "back") {
        // いま居るのは番人のエントリ。その 1 つ前が編集画面、さらに 1 つ前が戻り先。
        // ★この go が起こす popstate は自分のものなので読み飛ばす。
        skipNextPopRef.current = hadSentinel;
        sentinelTokenRef.current = null;
        window.history.go(hadSentinel ? -2 : -1);
      } else {
        // ★番人のエントリを遷移先で置き換える。置き換えないと履歴に編集画面の
        //   複製が残り、戻るを 1 回多く押すことになる。
        sentinelTokenRef.current = null;
        // ★番人が無いときはオプションを渡さない。`{ replace: false }` は挙動としては
        //   同じだが、遷移先を引数の形で固定している先行サブのテスト
        //   （M24-01 の保存後の遷移先）を無用に落とす。
        // ★★M27-03 追補: 保存後だけ目印を渡す。履歴の形は変えない。
        const opts = afterSave ? { state: { fromSave: true } } : undefined;
        if (hadSentinel) {
          navigate(target.to, { ...opts, replace: true });
        } else if (opts) {
          navigate(target.to, opts);
        } else {
          navigate(target.to);
        }
      }

      // ★次のタスクで解除する。ここで同期的に false へ戻すと、遷移に伴う
      //   effect の後始末がまだ走っておらず、番人を二重に戻しうる。
      window.setTimeout(() => {
        leavingRef.current = false;
      }, 0);
    },
    [navigate, onSentinelEntry],
  );

  const leave = useCallback(() => {
    const target = pending;
    setPending(null);
    if (target) performLeave(target);
  }, [pending, performLeave]);

  // ★★保存が済んだ直後のように「確認は要らないが補正は要る」場合の入口。
  //   ★★ここを通さず素の navigate(-1) を呼ぶと、番人のエントリぶんしか戻らず
  //     編集画面自身へ着地する。しかも dirty を落とす state 更新は非同期なので、
  //     その時点ではガードがまだ張られており、確認ダイアログまで出てしまう
  //     （2026-08-28 の開発者手動確認 ④-1 で実際に起きた）。
  const leaveWithoutConfirmTo = useCallback(
    // ★★保存後の入口なので目印を渡す（M27-03 追補）。
    (to: string) => performLeave({ kind: "to", to }, true),
    [performLeave],
  );
  const leaveWithoutConfirmBack = useCallback(
    () => performLeave({ kind: "back" }),
    [performLeave],
  );

  const value = useMemo<NavigationGuardContextValue>(
    () => ({
      setBlocked,
      requestLeaveTo,
      requestLeaveBack,
      leaveWithoutConfirmTo,
      leaveWithoutConfirmBack,
    }),
    [
      setBlocked,
      requestLeaveTo,
      requestLeaveBack,
      leaveWithoutConfirmTo,
      leaveWithoutConfirmBack,
    ],
  );

  return (
    <NavigationGuardContext.Provider value={value}>
      {children}
      {/* ★★ガードが実際に張られたことの目印。
          ガードは「dirty になった次の描画」で張られる(番人の履歴エントリを積むのは
          useEffect である)。E2E がそれを待たずにブラウザバックを押すと、まだ番人が
          無いため本当に戻ってしまう——実際に 1 度 flaky になった。
          ⇒ 待てる signal を出す。人の操作では起こらない速さの話であり、
            これは「テストのための待ち合わせ点」であって挙動ではない。 */}
      {blocked && (
        <span data-testid="unsaved-changes-armed" hidden aria-hidden="true" />
      )}
      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) stay();
        }}
      >
        <AlertDialogContent data-testid="unsaved-changes-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-yellow-700">
              保存していない変更があります
            </AlertDialogTitle>
            <AlertDialogDescription>
              このページを離れると、入力した内容は保存されません。
              入力内容はどこにも保存されないため、戻ってきても復元されません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={stay}>
              このページに留まる
            </AlertDialogCancel>
            <AlertDialogAction onClick={leave}>
              保存せずに離れる
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </NavigationGuardContext.Provider>
  );
}
