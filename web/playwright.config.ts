import fs from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

// ─────────────────────────────────────────────────────────────────────────────
// E2E は使い捨て DB + 専用ポートの独立スタックで実行する(改善レーン E1)。
//
// - DB: バックエンドを TACPENDIUM_DB_PATH で web/e2e/.tmp/ 配下の専用 DB に向ける。
//   マイグレーション + seed は起動時に自動適用されるため、毎回クリーンな seed 済み
//   DB になる(dev DB への残渣蓄積・dev DB 状態への依存を根絶)。
//   パスはバックエンド CWD(リポジトリルート)からの相対。絶対パス(/tmp 等)は
//   ValidateDataPath が拒否するためリポジトリ内 .tmp を使う(.gitignore 済み)。
// - ポート: バックエンドは TACPENDIUM_PORT(既定 47390)、Vite は専用ポート(既定
//   5273)+ VITE_API_PORT を使い、config.toml のポート(通常の開発サーバ)と
//   取り合わない。並行 worktree でも衝突しないよう、この 2 つの E2E ポートは
//   worktree の dev ポートから決定的に導出する(下記 BASE_* 定数を参照)。
//   TACPENDIUM_PORT 上書き中は L-04 フォールバックのポート永続化もスキップされる。
//
// 注意: 使い捨て DB の破棄をモジュールスコープで行ってはならない。本ファイルは
// playwright のワーカープロセスでも再ロードされるため、テスト実行中に稼働中
// バックエンドの DB を削除してしまう(接続プールが空 DB を再作成し "no such table"
// で全 API が 500 になる)。破棄はバックエンド起動コマンド内で一度だけ行う。
// ─────────────────────────────────────────────────────────────────────────────

// E2E ポートは worktree ごとに独立させる。dev バックエンドポート(wt-new.sh が
// worktree ごとにユニーク割当: 47330+)を config.toml から読み、その基準からの
// オフセット分だけ E2E ポートをずらす。これにより複数 worktree で make e2e を
// 同時実行しても衝突しない(dev DB が per-worktree 独立なのと対をなす)。
// config.toml が読めない場合(CI 等)は基準値 47390 / 5273 にフォールバックする。
// ルート dev ポート 47320(= BASE_DEV_PORT)のときはオフセット 0 で従来値に一致し、
// 単一スタック E2E・CI の挙動は不変。
// 前提: E2E 帯(47390+ / 5273+)は dev ポートのスキャン範囲(各 dev port から
// netutil の +20)や dev vite 帯(5174+)と被らない。worktree 数が現実的な範囲
// (数個)なら干渉しない(大量作成時のみ注意)。
const BASE_DEV_PORT = 47320;
const BASE_E2E_BACKEND_PORT = 47390;
const BASE_E2E_VITE_PORT = 5273;

function readDevBackendPort(): number {
  try {
    const toml = fs.readFileSync(path.resolve(__dirname, "../config.toml"), "utf8");
    // config.toml で `port` キーを持つのは [server] セクションのみ(vite.config.ts と同一方針)。
    const m = toml.match(/^\s*port\s*=\s*(\d+)/m);
    if (m) return Number(m[1]);
  } catch {
    // config.toml 不在・読取失敗時は基準ポートにフォールバック。
  }
  return BASE_DEV_PORT;
}

const devPortOffset = readDevBackendPort() - BASE_DEV_PORT;
const E2E_BACKEND_PORT = BASE_E2E_BACKEND_PORT + devPortOffset;
const E2E_VITE_PORT = BASE_E2E_VITE_PORT + devPortOffset;
const E2E_DB_PATH_FROM_REPO_ROOT = "web/e2e/.tmp/tacpendium-e2e.db";
// ★★E2E 専用の設定ファイル(M24-09c 追補 / CHANGE-135)。
// 使い捨て DB と同じ .tmp 配下に置き、同じ寿命にする(起動時の rm -rf で毎回消える)。
//
// ★なぜ要るのか —— これが無いと、バックエンドは dev と同じリポジトリ直下の config.toml を
// 読む。E2E は test ごとに新規ブラウザコンテキストを使うため既定キャラの解決は
// 段 3b(config)で単独に決まり、開発者が設定画面で既定キャラを変えた瞬間に
// 「リュウが出ること」を前提にした spec がまとめて落ちる(開発者ローカル実測で 35 件)。
// ★依存は双方向だった —— E2E → dev(PUT /api/config が config.toml を再シリアライズする)も
// 本ファイルの導入で消える。E2E の書き込み先は .tmp 側になる。
const E2E_CONFIG_PATH_FROM_REPO_ROOT = "web/e2e/.tmp/tacpendium-e2e.toml";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  // ★★worker は 1 に固定する(M24-09c)。外さないこと————————————————————————
  // fullyParallel: false が直列化するのは「1 ファイルの中」だけで、spec ファイル同士は
  // worker 数だけ並列に走る。しかし E2E スタックはバックエンド 1 本・使い捨て DB 1 個・
  // config.toml 1 個の共有資源であり(下の webServer を参照)、ファイルをまたいだ干渉を
  // 防ぐ仕組みが無い。
  //
  // ★実際に奪い合いが観測されているもの（出所つき。★裏の取れていないものを並べないこと）:
  //   - プリセット総数（上限 8 件）: プリセットを作る spec を別ファイルへ置くと
  //     m20-04 の上限テストが 5 件目を作れずに落ちた。当該 spec 単独では 4/4 緑であり、
  //     組み合わせでしか出ない（M20-05 の実測。followup `e2e-shared-global-resource-parallel`）。
  //   - コンボの識別キー: m23-05 と m23-09 は、同じ判定キーで作ると片方がゴミ箱へ入れた行が
  //     もう片方の前提を壊すため、キーを意図的にずらしてある（m23-09 spec 冒頭の注記）。
  //     ★本ファイルの下で参照している probe 2 本は、この形を決定論的に再現したものである。
  //
  // ★これは「後片付けを足す」では直らない。並行実行中は「まだ消していない時間」が
  //   必ず在るためである(教訓 E-232)。
  //   ★worker ごとに DB を分ける手は今も採っていないが、理由は変わった —— 段 1 で
  //     TACPENDIUM_CONFIG_PATH と TACPENDIUM_DB_PATH を env で渡せるようになったため、
  //     「パスがハードコードで動かせない」はもう成り立たない(M24-09c 追補 / CHANGE-135)。
  //     採らない理由は、バックエンドが 1 本しか起動しておらず、worker ごとに DB を分けるには
  //     バックエンドも worker 数だけ起こす必要があり、ポート・seed・起動時間がすべて
  //     worker 数倍になるためである。★やるなら別サブの規模になる。
  //
  // ★外すと何が起きるかは aa-interference-probe-{a,b}.spec.ts が決定論的に示す
  //   (workers>=2 で必ず赤・workers=1 で必ず緑。M24-09c で 10 回ずつ実測)。
  //   ⇒ 本行を消す変更は、その 2 本が赤くなることで検出される。
  //
  // ★代償は実行時間である。本サブの実測では既定(2 worker)の約 1.5 倍になった
  //   (起動 5 秒 + テスト実行 243 秒 → 起動 5 秒 + テスト実行 377 秒)。
  //   「速いか」は 1 回の実行時間ではなく緑に到達するまでの総時間で見る(D-557)。
  workers: 1,
  retries: 1,
  reporter: "list",
  use: {
    headless: true,
    baseURL: `http://localhost:${E2E_VITE_PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // サンドボックス等でプラットフォーム同梱の Chromium を使う場合のみ
        // PW_EXECUTABLE_PATH で明示する(未設定=CI/通常環境では従来どおり
        // Playwright 管理のブラウザを使う=挙動不変)。
        ...(process.env.PW_EXECUTABLE_PATH
          ? { launchOptions: { executablePath: process.env.PW_EXECUTABLE_PATH } }
          : {}),
      },
    },
  ],
  webServer: [
    {
      // CWD が web/ になるため、リポジトリルートから go run する。
      // 起動直前に前回の使い捨て DB を破棄(WAL サイドカー含む)。親ディレクトリは
      // バックエンドの db.Open が MkdirAll で作成する。
      // reuseExistingServer: false — 既存プロセスの誤再利用を防ぐ(専用ポートのため
      // 通常は競合しない。使用中なら明示エラー)。
      // ★★-tags=debug で起動する(M28-02c・2026-09-07 開発者確定)。
      //   理由 —— FR702 の判定は moves.last_changed_game_version が非 NULL である
      //   ことを要求するが、マーカーを立てる経路は本番では DML マイグレしか無い。
      //   ⇒ 素の E2E では「影響コンボが 1 件以上ある状態」を作れず、初回は必ず 0 件で
      //   あるため「画面を開いても何も出ない」。動かして確認したことが証拠にならない。
      //   ★代償 = E2E が本番ビルドではなく debug ビルドを検査する。差分は
      //   internal/api/debug の 5 ルートの登録だけであり、本番コードの経路は同一である
      //   (Makefile の test-go-debug が既に debug ビルドを回している)。
      //   ★書き込み口を使うのは web/e2e/support/game-update.ts だけである。
      // ★専用 config は rm -rf の「後」に作る(先に作ると消される)。
      //   中身は config.toml.example のコピーである。同ファイルに [defaults] が無いため
      //   既定キャラは解決順の段 4(INITIAL_CHARACTER_ID = 1)へ落ちる。
      //   ★★ここに [defaults] を書き足さないこと —— 書いた時点で「誰かが変えると壊れる」が
      //     復活する。キャラが要る spec は自分で明示的に選ぶ(段 2)。
      command:
        "(cd .. && rm -rf web/e2e/.tmp && mkdir -p web/e2e/.tmp" +
        ` && cp config.toml.example ${E2E_CONFIG_PATH_FROM_REPO_ROOT}` +
        " && go run -tags=debug ./cmd/tacpendium)",
      env: {
        TACPENDIUM_DB_PATH: E2E_DB_PATH_FROM_REPO_ROOT,
        TACPENDIUM_CONFIG_PATH: E2E_CONFIG_PATH_FROM_REPO_ROOT,
        TACPENDIUM_PORT: String(E2E_BACKEND_PORT),
      },
      port: E2E_BACKEND_PORT,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      // E2E 専用ポートでフロントを配る(--strictPort で自動繰上げ禁止)。プロキシ先は
      // VITE_API_PORT で E2E バックエンドへ向ける(vite.config.ts の preview.proxy が対応済み)。
      // 通常の dev サーバ(5173)と共存でき、本 worktree のコードで必ずテストされる。
      //
      // ★★dev サーバではなく preview(ビルド済み dist の配信)を使う(M24-09c 追補 / CHANGE-135)。
      // dev サーバはバンドルせず ESM を 1 モジュールずつ配るため 1 ページロードで数百リクエストが
      // 出る。Playwright は test ごとに新規コンテキストを使うので HTTP キャッシュが毎回空になり、
      // その固定費を毎回払い直す。
      // 実測(同一セッション・同一 HEAD・180 テスト・workers:1 の背中合わせ):
      //   pnpm dev = 402 秒 / pnpm build + vite preview = 223〜253 秒(一発緑 3/3)。
      // ★別時点の値どうしを引き算しないこと —— 指示書の母数 307〜309 秒も、以前ここに
      //   書いていた 156〜159 秒も再現しなかった(完了報告 §18.2)。
      //
      // ★★pnpm build を「ここ」に置いてあるのは意図である。Makefile 側へ出すと、
      // pnpm e2e を直接叩いた経路が古い dist を検査する。★それは緑で通るため気づけない
      // ——「古いフロントをテストする」事故が本方式の最大の代償である(CHANGE-135 §5-1)。
      // ⇒ どの経路から E2E スタックを起こしても必ず再ビルドされる形にする。
      // ★条件付きにしないこと(dist の有無や更新時刻で分岐させない)。
      command: `pnpm build && pnpm exec vite preview --port ${E2E_VITE_PORT} --strictPort`,
      env: {
        VITE_API_PORT: String(E2E_BACKEND_PORT),
      },
      port: E2E_VITE_PORT,
      reuseExistingServer: false,
      // ★ビルドが同じコマンドに入るため、既定の 60 秒では足りない。
      timeout: 300_000,
    },
  ],
});
