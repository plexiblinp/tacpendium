import { useTranslation } from "react-i18next";

/**
 * PasswordForgotHelp は「パスワードが分からないとき」の案内を出す。
 *
 * ★これは復旧手段ではなく、手順の案内である(CHANGE-112 §4 / 指示書 §1.6-5)。
 * アプリから「パスワードを知らないまま無効化」できる経路は作らない——
 * LAN 上の誰でも叩ける経路になり、パスワードの意味がその場で消える。
 * ⇒ 信頼の根は「そのマシンのファイルを編集できること」に置いている。
 *
 * ★ファイルの絶対パスは出さない。コピーボタンも持たない(開発者裁定 2026-08-16)。
 * CHANGE-113 §3.8 は「<config.toml の実際のパス> [コピー]」を描いていたが、
 *   - 本画面はログイン画面からも開く。そこは未認証であり GET /api/config を
 *     読めないため、そもそもパスを運ぶ経路が無い
 *   - 設定画面側でならパスを出せるが、パスワードが分からない人は設定画面へ
 *     入れない。出しても届かない
 * の 2 点から、パスを出す案そのものを採らなかった。
 *
 * ★代わりに「そのフォルダへ辿り着く手順」を出す(fileLocationHint)。
 * パスを出さない以上、ここが実際の代替になる。ファイル名だけをコピーさせる
 * ボタンは、貼り付け先が無く役に立たなかった(開発者の実機確認 ①)。
 *
 * ★実行ファイル名は書かない。配布物は tacpendium-windows-amd64.exe、
 * ローカルビルドは tacpendium(Makefile)であり、固定名を書くと外れる。
 */
export default function PasswordForgotHelp() {
  const { t } = useTranslation();

  return (
    <div className="text-sm text-gray-700 space-y-3" data-testid="auth-forgot-help">
      <p>{t("auth.forgot.intro")}</p>
      <p>{t("auth.forgot.step1")}</p>

      <div>
        <code className="px-2 py-1 bg-gray-100 rounded font-mono">
          {t("auth.forgot.fileName")}
        </code>
      </div>
      <p className="text-gray-500">{t("auth.forgot.fileLocation")}</p>
      <p className="text-gray-500">{t("auth.forgot.fileLocationHint")}</p>
      <p className="text-gray-500">{t("auth.forgot.fileOpenWith")}</p>

      {/* ★書き換えはアプリを止めてから。動かしたまま書き換えると、アプリ側の
          設定書き戻し(起動時に読んだ値が土台になる)で元へ戻ることがある。 */}
      <p className="text-gray-500">{t("auth.forgot.quitFirst")}</p>

      <p>
        {t("auth.forgot.step2")}
        <code className="mx-1 px-2 py-1 bg-gray-100 rounded font-mono">
          password_enabled = true
        </code>
        {t("auth.forgot.step3")}
        <code className="mx-1 px-2 py-1 bg-gray-100 rounded font-mono">
          password_enabled = false
        </code>
        {t("auth.forgot.step4")}
      </p>

      {/* ★password_hash も消す必要がある。ここを落とすと手順が成立しない——
          残っていると PasswordSet() が true のままで、設定画面は「変える」を出し、
          SetPassword が現在のパスワードの一致を要求する(service/auth/service.go:155)。
          ⇒ 忘れた当のパスワードを聞かれて詰む。 */}
      <p>
        {t("auth.forgot.step5")}
        <code className="mx-1 px-2 py-1 bg-gray-100 rounded font-mono">
          password_hash = &quot;...&quot;
        </code>
        {t("auth.forgot.step6")}
      </p>

      <p>{t("auth.forgot.step7")}</p>

      <p className="text-gray-500">{t("auth.forgot.note")}</p>
      {/* ★詰みが原理的に起きないことを添える(D-396: 必須化していないため)。 */}
      <p className="text-gray-500">{t("auth.forgot.lanNote")}</p>
    </div>
  );
}
