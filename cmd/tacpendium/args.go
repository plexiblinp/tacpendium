package main

import (
	"errors"
	"flag"
	"fmt"
	"io"
	"strings"
)

// argUsage は引数の扱いを利用者へ伝える 1 行。★エラー本文にも -h の応答にも使う。
const argUsage = "本アプリは起動オプションを取りません。引数なしで起動してください。"

// parseArgs はコマンドライン引数を検査する(M34-02 段 2)。
//
// ★★これは仕様変更である ————————————————————————————————————————————————
// 着手前の cmd/tacpendium は flag も os.Args も持たず、余分な引数を黙って無視していた
// (M34-01 実査 1)。⇒ 常駐モードの判定を入れる前に「未知の引数をどう扱うか」を決める
// 必要があった。3 案〔(a) エラーにして終了 / (b) 無視を維持 / (c) 警告して続行〕のうち
// **(a) を採った**。理由 = 黙って無視すると、打ち間違えたオプションが効いていないことに
// 気づけない。★黒窓を消した後は「効かないうえ、何も出ない」になる。
//
// ★★エラーは段 4 の通知経路へ載る —— 本関数は run() の先頭で呼ばれ、返したエラーは
// main() の致命終了経路(reportFatal)を通る。⇒ -H=windowsgui 下でも
// MessageBox で見える(指示書 §2.2-2 / §2.4-4)。
//
// ★フラグは 1 つも定義しない。定義すると設計書に無い起動オプションを増やすことになる
// (CLAUDE.md §10)。⇒ 「引数なしが唯一の起動形」を機械で固定するためだけに flag を使う。
func parseArgs(args []string) error {
	fs := flag.NewFlagSet("tacpendium", flag.ContinueOnError)
	// ★既定の出力を捨てる。flag は usage を標準エラーへ書くが、GUI サブシステムでは
	// その接続先が無いため、伝え方は返り値のエラー 1 本に寄せる。
	fs.SetOutput(io.Discard)

	if err := fs.Parse(args); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return errors.New(argUsage)
		}
		return fmt.Errorf("%s (%w)", argUsage, err)
	}
	if fs.NArg() > 0 {
		return fmt.Errorf("%s 受け取った引数: %s", argUsage, strings.Join(fs.Args(), " "))
	}
	return nil
}
