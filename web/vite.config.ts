/// <reference types="vitest" />
import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const DEFAULT_API_PORT = 47318;

// dev proxy の転送先(バックエンド)を解決する。
// 優先順位: VITE_API_TARGET(完全URL) > VITE_API_PORT > リポジトリルート config.toml の
// [server].port > 既定 47318。
// バックエンドは起動時ポート競合フォールバック(L-04)で採用ポートを config.toml に書き込むため、
// それを読むことで dev proxy を実ポートへ自動追従させる(ハードコード 47318 だと不一致になる)。
function resolveApiTarget(): string {
  if (process.env.VITE_API_TARGET) return process.env.VITE_API_TARGET;
  if (process.env.VITE_API_PORT) return `http://localhost:${process.env.VITE_API_PORT}`;
  try {
    const toml = fs.readFileSync(path.resolve(__dirname, "../config.toml"), "utf8");
    // config.toml で `port` キーを持つのは [server] セクションのみ。
    const m = toml.match(/^\s*port\s*=\s*(\d+)/m);
    if (m) return `http://localhost:${m[1]}`;
  } catch {
    // config.toml 不在・読取失敗時は既定ポートにフォールバック。
  }
  return `http://localhost:${DEFAULT_API_PORT}`;
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": {
        target: resolveApiTarget(),
        changeOrigin: false,
      },
    },
  },
  // ★E2E は dev サーバではなく preview(ビルド済み dist の配信)を使う(M24-09c 追補 / CHANGE-135)。
  // vite preview は server.proxy を読まないため、preview 側にも同じ proxy が要る。
  //
  // ★★ターゲット解決は resolveApiTarget() をそのまま使う。第 2 の解決規則を書き起こさないこと
  // —— 2 つの「同じ」が並ぶと、片方だけ直されて静かにずれる。
  //
  // ★なぜ dev サーバをやめたのか —— dev サーバはバンドルせず ESM を 1 モジュールずつ配るため、
  // 1 ページロードで数百リクエストが出る。Playwright は test ごとに新規ブラウザコンテキストを
  // 使うので HTTP キャッシュが毎回空になり、その固定費を毎回払い直す。
  // 実測(同一セッション・同一 HEAD・180 テスト・workers:1 で背中合わせに測った値):
  //   pnpm dev = 402 秒 / pnpm build + vite preview = 223〜253 秒。約 1.6〜1.8 倍速。
  // ★別時点で測った値どうしを引き算しないこと —— 指示書が母数として与えた 307〜309 秒も、
  //   以前この注記に書いていた 156〜159 秒も、同じ環境で再現しなかった(完了報告 §18.2)。
  preview: {
    proxy: {
      "/api": {
        target: resolveApiTarget(),
        changeOrigin: false,
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", "dist", "prototypes"],
  },
});
