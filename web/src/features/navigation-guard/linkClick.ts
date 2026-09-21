// M24-04(CO-003): 画面内リンクのクリックを離脱ガードで横取りしてよいかの判定。
//
// ★★なぜ自前なのか——本アプリのルータは `<BrowserRouter>` + `<Routes>` であり
//   data router ではない。react-router 6.30 の `useBlocker` は data router 専用のため
//   使えない。`createBrowserRouter` へ移すと AuthGate / CurrentUserProvider / App の
//   合成と、MemoryRouter で描いている既存のコンポーネントテスト群に波及する。
//   ⇒ ルータ移行はせず、離脱の入口を 1 か所で捕まえる形にした(指示書 §9.2 の裁量)。
//
// ★判定だけを純粋関数に切り出してある。DOM イベントを組み立てずに全分岐を検査できる。

/** クリック判定に必要な情報だけを抜き出した形。MouseEvent から組み立てる。 */
export interface LinkClickLike {
  defaultPrevented: boolean;
  /** 0 = 主ボタン(左)。それ以外は横取りしない。 */
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  /** クリックされた要素から最も近い <a>。無ければ null。 */
  anchor: {
    /** 解決済みの絶対 URL(`HTMLAnchorElement.href` の値)。 */
    href: string;
    /** `target` 属性。既定は空文字。 */
    target: string;
    /** `download` 属性を持つか。 */
    hasDownload: boolean;
  } | null;
}

/**
 * 横取りすべきクリックなら遷移先(パス + クエリ + ハッシュ)を返す。そうでなければ null。
 *
 * 横取りしないもの:
 * - 既に preventDefault されたクリック / 左ボタン以外 / 修飾キー付き(新しいタブで開く操作)
 * - <a> の外側のクリック
 * - `target` が別ウィンドウ / `download` 属性つき
 * - 別オリジン、`mailto:` `tel:` などアプリ外へ出るもの
 * - いま居る場所と同じ URL(遷移が起きないので確認する意味が無い)
 */
export function interceptedHrefFromClick(
  click: LinkClickLike,
  currentUrl: string,
): string | null {
  if (click.defaultPrevented) return null;
  if (click.button !== 0) return null;
  if (click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) {
    return null;
  }

  const anchor = click.anchor;
  if (!anchor) return null;
  if (anchor.hasDownload) return null;
  if (anchor.target !== "" && anchor.target !== "_self") return null;
  if (!anchor.href) return null;

  let target: URL;
  let current: URL;
  try {
    current = new URL(currentUrl);
    target = new URL(anchor.href, currentUrl);
  } catch {
    return null;
  }

  // http(s) 以外(mailto: tel: blob: など)はアプリ内遷移ではない。
  if (target.protocol !== "http:" && target.protocol !== "https:") return null;
  if (target.origin !== current.origin) return null;

  const to = `${target.pathname}${target.search}${target.hash}`;
  const here = `${current.pathname}${current.search}${current.hash}`;
  if (to === here) return null;

  return to;
}

/** DOM の MouseEvent を LinkClickLike へ写す。 */
export function toLinkClickLike(event: MouseEvent): LinkClickLike {
  const target = event.target;
  const element =
    target instanceof Element
      ? target
      : target instanceof Node
        ? target.parentElement
        : null;
  const anchorEl = element?.closest("a") ?? null;
  return {
    defaultPrevented: event.defaultPrevented,
    button: event.button,
    metaKey: event.metaKey,
    ctrlKey: event.ctrlKey,
    shiftKey: event.shiftKey,
    altKey: event.altKey,
    anchor: anchorEl
      ? {
          href: anchorEl.href,
          target: anchorEl.target,
          hasDownload: anchorEl.hasAttribute("download"),
        }
      : null,
  };
}
