import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import Header from "@/components/Header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCharacters } from "@/features/character/hooks/useCharacters";
import CharacterSelector from "@/features/mycombo/components/CharacterSelector";
import { copyPlainText } from "@/features/combo-io/clipboard";
import { useIntakeBuildCsv, useIntakeResolve } from "@/features/intake/api";
import { buildIntakePrompt } from "@/features/intake/prompt";
import {
  buildCsvPayload,
  comboHasExcludedStep,
  countUnresolved,
  effectiveMoveCode,
  isStepExcluded,
  isStepResolved,
  stepKey,
  unresolvedHint,
  unresolvedKind,
  type StepExclusions,
  type StepOverrides,
} from "@/features/intake/review";
import type { IntakeResolveResponse } from "@/features/intake/types";
import { intakeUserRulesStorage } from "@/features/intake/user-rules-storage";
import { useMovesByCharacter } from "@/features/moves/api";
import { MOVE_CATEGORY_LABEL_JA } from "@/features/moves/types";

// 画面: 他から引っ越し(DES-005 §5.14 の突合動線の拡張・M17-04)。
//
// ★★【M24-07 で改称】画面名は「取込ヘルパー」→「引っ越し取込」。
// ★★【M38-02 で再改称(2026-09-17・D-892)】「引っ越し取込」→「他から引っ越し」。
//   ⇒ 2 度目の改名である。表示語の正本はこの h1 とヘッダの NAV_LINKS であり、
//   ja.json に本画面のキーは無い(DES-005 §5.19「i18n キーは追加しない」)。
//   DES-005 §5.19 の見出し・画面一覧 row 19・§5.14 の連携口記述は旧名のままであり、
//   as-built 差分として設計卓へ回してある(M38-02 完了報告・設計伝達レポート §1/§6)。
// ① アプリ外プロンプト(コピー配布)→ ユーザーが AI で正規化 → ② 本画面が候補トークン列を厳密照合 →
// 未解決を人レビューで解決 → 取込 CSV を生成し既存 import プレビューへ連携する。
export default function IntakeHelperPage() {
  const navigate = useNavigate();
  const { data: characters } = useCharacters();

  const [characterCode, setCharacterCode] = useState<string>("");
  const [text, setText] = useState<string>("");
  // (d) コンボのメモ(M17-05d)。プロンプトへ埋め込む本文。コンボ本体は永続化しない(CLAUDE.md §10.X)
  // ため、AI 出力欄(text)と同じく揮発 state で保持する(保存しない)。
  const [comboMemo, setComboMemo] = useState<string>("");
  // (c) ユーザー独自ルール(M17-05d)。localStorage から初期復元し、変更のたびに保存する。
  const [userRules, setUserRules] = useState<string>(() => intakeUserRulesStorage.load() ?? "");
  const [resolveResult, setResolveResult] = useState<IntakeResolveResponse | null>(null);
  const [overrides, setOverrides] = useState<StepOverrides>({});
  const [excluded, setExcluded] = useState<StepExclusions>({});

  const selectedCharacter = useMemo(
    () => characters?.find((c) => c.code === characterCode) ?? null,
    [characters, characterCode],
  );

  const { data: moves } = useMovesByCharacter(selectedCharacter?.id);

  const resolveM = useIntakeResolve();
  const buildCsvM = useIntakeBuildCsv();

  // 技セレクタの選択肢(value=move_code, label="技名 — code")。人レビューの直接指定に使う。
  const moveOptions = useMemo(() => {
    return (moves ?? []).map((m) => {
      const name = m.nameJa && m.nameJa.trim() !== "" ? m.nameJa : m.code;
      const category = MOVE_CATEGORY_LABEL_JA[m.category] ?? m.category;
      return { code: m.code, label: `${name}（${category}） — ${m.code}` };
    });
  }, [moves]);

  const unresolvedCount = useMemo(
    () => countUnresolved(resolveResult, overrides, excluded),
    [resolveResult, overrides, excluded],
  );

  const resetResults = () => {
    setResolveResult(null);
    setOverrides({});
    setExcluded({});
  };

  // (c) 自由ルールの変更を state と localStorage の両方へ反映する(保存の往復)。
  const handleUserRulesChange = (value: string) => {
    setUserRules(value);
    intakeUserRulesStorage.save(value);
  };

  const handleCopyPrompt = async () => {
    if (!selectedCharacter) return;
    const prompt = buildIntakePrompt(
      selectedCharacter.nameJa,
      moves ?? [],
      [],
      userRules,
      comboMemo,
    );
    try {
      // プレーンテキスト専用でコピーする(Web AI チャットの contenteditable へ貼るため。
      // text/html を書くと空/整形崩れになる)。
      await copyPlainText(prompt);
      toast.success("プロンプトをコピーしました。お使いの AI に貼り付けてください。");
    } catch {
      toast.error("クリップボードへのコピーに失敗しました。");
    }
  };

  const handleResolve = () => {
    if (!characterCode || text.trim() === "") return;
    resolveM.mutate(
      { characterCode, text },
      {
        onSuccess: (data) => {
          setResolveResult(data);
          setOverrides({});
          setExcluded({});
        },
      },
    );
  };

  const handleProceed = () => {
    if (!resolveResult) return;
    const payload = buildCsvPayload(characterCode, resolveResult, overrides, excluded);
    if (payload.combos.length === 0) {
      toast.error("取込対象のコンボがありません。");
      return;
    }
    buildCsvM.mutate(payload, {
      onSuccess: (data) => {
        // 生成した combos.csv を既存 import プレビュー画面へ連携(検証・重複判定を再利用)。
        navigate("/import/combo", { state: { intakeCsvText: data.csvText } });
      },
    });
  };

  const setOverride = (comboIndex: number, stepOrder: number, code: string) => {
    setOverrides((prev) => ({ ...prev, [stepKey(comboIndex, stepOrder)]: code }));
  };

  const setExcludeStep = (comboIndex: number, stepOrder: number, on: boolean) => {
    setExcluded((prev) => ({ ...prev, [stepKey(comboIndex, stepOrder)]: on }));
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <Header />
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold">他から引っ越し(他のアプリ・メモ・表計算から)</h1>
          <p className="text-sm text-slate-600 mt-1">
            自分の形式で記録したコンボを取り込むための補助画面です。
            ① キャラとコンボのメモを入力して「プロンプトをコピー」で得たプロンプトをお使いの AI に貼り、メモを正規化してもらいます(メモは AI 側で貼り付けても構いません)。
            ② その出力(表)をここに貼って「照合」すると、技コードへの厳密照合を行います。
            引けなかった行は下の一覧で技を指定するか、取り込まない行は「除外」してから、既存の取込動線へ進みます。
          </p>
        </div>

        {/* ステップ1: キャラ・コンボ入力 + プロンプトのコピー(M17-05d で上から順に入力→コピーの動線へ) */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold">1. キャラとコンボを入力し、プロンプトをコピー</h2>
          <div className="space-y-1">
            <Label>キャラクター</Label>
            {/* ★M24-02 §4.3.2: 独自の native select をやめ、共有部品へ寄せた。
                ★本画面が持つのは id ではなく code である(照合 API が code を取る)。
                  共有部品は id で扱うため、境界で id ⇄ code を変換する。
                  変換を呼び出し側に置くのは、共有部品へ code の概念を持ち込むと
                  他の 13 コントロールにも不要な分岐が生えるからである。 */}
            <CharacterSelector
              selectedCharacterId={selectedCharacter?.id ?? null}
              onChange={(characterId) => {
                const picked = characters?.find((c) => c.id === characterId);
                setCharacterCode(picked?.code ?? "");
                resetResults();
              }}
              placeholder="選択してください"
              ariaLabel="キャラクター"
              data-testid="intake-helper-character"
            />
          </div>
          {selectedCharacter && moves && moves.length === 0 && (
            <p className="text-sm text-amber-700" role="status">
              このキャラの技データはまだ投入されていません。照合しても全行が未解決になります(壊れません)。
            </p>
          )}

          {/* (d) コンボのメモの入力欄(M17-05d)。コピー時にプロンプト本文へ埋め込む。
              コンボ本体は永続化しない(CLAUDE.md §10.X)ため保存しない揮発入力。 */}
          <div className="space-y-1">
            <Label htmlFor="combo-memo">あなたのコンボのメモ</Label>
            <textarea
              id="combo-memo"
              className="w-full min-h-32 rounded border border-slate-300 bg-white p-2 font-mono text-sm"
              placeholder={"自分の書き方のままで構いません。1 コンボ 1 行がおすすめです。\n例: 中足ラッシュ > 強P > 引き強P > 強昇竜"}
              value={comboMemo}
              onChange={(e) => setComboMemo(e.target.value)}
            />
            <p className="text-xs text-slate-500">
              ここに入力するとコピーするプロンプトへ一緒に入ります(この欄は保存されません)。
              空のままコピーして、あとで AI 側に貼り付けても構いません。
            </p>
          </div>

          {/* (c) ユーザー独自ルールの自由入力欄(M17-05d)。コピー時にプロンプト本文へ結合され、localStorage に保存される。 */}
          <div className="space-y-1">
            <Label htmlFor="user-rules">あなた独自のルール(任意)</Label>
            <textarea
              id="user-rules"
              className="w-full min-h-20 rounded border border-slate-300 bg-white p-2 text-sm"
              placeholder="例: 「屈中P」は「しゃがみ中P」のこと / 「弱昇竜」は「昇竜拳(弱)」のこと"
              value={userRules}
              onChange={(e) => handleUserRulesChange(e.target.value)}
            />
            <p className="text-xs text-slate-500">
              あなたの別名・書き方のクセを書くと、コピーするプロンプトへ一緒に渡します(この端末に保存されます)。
              コピーしたプロンプトはそのまま使わなくても構いません。一部を整えたり、ここにルールを足したりして使ってください。
            </p>
          </div>

          {/* (b) 入力整形のお願い 3 件(M17-05d)。プロンプト本文にも同内容が入る。画面側は折りたたみで縦伸びを抑える。 */}
          <details className="rounded border border-slate-200 bg-white p-3 text-sm">
            <summary className="cursor-pointer font-medium text-slate-700">
              うまく取り込めないとき: メモの書き方のコツ(3 つ)
            </summary>
            <ol className="mt-2 list-decimal space-y-2 pl-5 text-slate-600">
              <li>
                回数表記を展開する: 「2弱P×2〜3」のような回数つき表記は、
                「2弱P &gt; 2弱P &gt; 2弱P」のように 1 回ずつに展開してください。
              </li>
              <li>
                コンボの切れ目を明示する: 1 コンボ 1 行にする・行頭に番号を付けるなどして、
                切れ目が分かるようにしてください。
              </li>
              <li>
                分岐を行単位に戻す: 1 本の始動から複数の締めに枝分かれする書き方は、
                分岐ごとに独立した行へ戻してください。
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded bg-slate-50 p-2 font-mono text-xs">
{`【分岐している例（そのままだと取り込みにくい）】
中足ラッシュ
- 強P > 強波掌撃 > 中竜巻
- 強P > 引き強P > 強昇竜
- 強P > 引き強P > 強K > 強P > 強昇竜 > SA3
- [端が近いと] 強P > 引き強P > 中昇竜 > SA3

【行単位に戻した例（取り込みやすい）】
- 中足ラッシュ > 強P > 強波掌撃 > 中竜巻
- 中足ラッシュ > 強P > 引き強P > 強昇竜
- 中足ラッシュ > 強P > 引き強P > 強K > 強P > 強昇竜 > SA3
- [端が近いと] 中足ラッシュ > 強P > 引き強P > 中昇竜 > SA3`}
                </pre>
              </li>
            </ol>
          </details>

          {/* 入力(キャラ・コンボ・独自ルール)を上でそろえてからコピーする動線 */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button onClick={handleCopyPrompt} disabled={!selectedCharacter}>
              プロンプトをコピー
            </Button>
            {!selectedCharacter && (
              <p className="text-sm text-amber-700" role="status">
                先にキャラクターを選択してください。
              </p>
            )}
          </div>

          {/* (a) 複数の AI サービスを試す旨の明示(M17-05d)。特定モデルは単一指名しない。 */}
          <p className="text-sm text-slate-600" role="note">
            1 つの AI サービスで上手くいかない場合は、別の AI サービスでも試してください。
            出力の安定度は AI やコンボの書き方によって変わります(特定のサービスに限りません)。
          </p>
        </section>

        {/* ステップ2: AI 出力の貼り付けと照合 */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold">2. AI の出力(表)を貼り付けて照合</h2>
          <textarea
            className="w-full min-h-40 rounded border border-slate-300 bg-white p-2 font-mono text-sm"
            placeholder="AI が出力した表(Markdown のパイプ表)をそのまま貼り付けてください"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />

          {/* 取り込める形式のヒント(M17-05d 追補)。パーサは「1 行 1 ステップ・行頭がコンボ番号・
              列はパイプ | かタブ区切り」を拾う(internal/service/intake.ParseInput)。改行が消えると
              取り込めないため、一部の AI で 1 行に潰れるケースの対処と、実サンプルの取込結果を併記する。 */}
          <details className="rounded border border-slate-200 bg-white p-3 text-sm">
            <summary className="cursor-pointer font-medium text-slate-700">
              貼り付けがうまくいかないとき: 取り込める形式の例
            </summary>
            <div className="mt-2 space-y-3 text-slate-600">
              <p>
                各行が「1 行 = 1 ステップ」で、行の先頭がコンボ番号(半角数字)、列は パイプ{" "}
                <code className="rounded bg-slate-100 px-1">|</code> 区切り(タブ区切りでも取り込めます)の形なら取り込めます。
                <strong>各行が改行で分かれていること</strong>が重要です。
              </p>
              <p className="text-amber-700">
                一部の AI は、画面では表に見えても<strong>コピーすると 1 行に潰れて改行が消える</strong>ことがあります。
                その状態では取り込めません。もう一度コピーし直す・「プレーンなパイプ表で出して」と AI に頼む・
                貼り付け後に各行が改行されているか確認する、のいずれかを試してください。
              </p>
              <p className="font-medium text-slate-700">取り込める例(この形):</p>
              <pre className="overflow-x-auto whitespace-pre rounded bg-slate-50 p-2 font-mono text-xs">
{`| # | ステップ | 元の表記 | トークン列 | 技名の候補 | 確信度 | 備考 |
|---|---|---|---|---|---|---|
| 1 | 1 | 中足ラッシュ | ? | しゃがみ中K(ラッシュ) | 低 | ラッシュは語彙で表現できないため ? |
| 1 | 2 | 強P | p_h | 立ち強P | 高 |  |
| 1 | 3 | 強ハショー | d dr r plus p_h | 強波掌撃 | 高 | ハショー＝波掌撃 |
| 1 | 4 | 中タツ | d dl l plus k_m | 中竜巻旋風脚 | 高 | タツ＝竜巻旋風脚 |
| 2 | 1 | 中足ラッシュ | ? | しゃがみ中K(ラッシュ) | 低 | ラッシュは語彙で表現できないため ? |
| 2 | 2 | 強P | p_h | 立ち強P | 高 |  |
| 2 | 3 | 引き強P | l plus p_h | 立ち強P | 低 | 後ろ入力として解釈 |
| 2 | 4 | 強波動K | d dr r plus k_h | 強上段足刀蹴り | 中 | 波動K＝足刀の別名ルール |`}
              </pre>
              <p className="font-medium text-slate-700">この例から入るコンボ(2 本):</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  コンボ #1: 中足ラッシュ → 立ち強P → 強波掌撃 → 中竜巻旋風脚
                </li>
                <li>
                  コンボ #2: 中足ラッシュ → 立ち強P → 引き強P(立ち強P) → 強上段足刀蹴り
                </li>
              </ul>
              <p className="text-xs text-slate-500">
                ※「中足ラッシュ」の行はトークンが <code className="rounded bg-slate-100 px-1">?</code>(ラッシュは語彙で表せない)のため、
                照合後は「未解決」で表示されます。下の一覧の「技(move_code)」で しゃがみ中K を選ぶと解決します
                (使わない場合は「除外」でも構いません)。それ以外の行は自動で解決します。
              </p>
            </div>
          </details>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleResolve}
              disabled={!characterCode || text.trim() === "" || resolveM.isPending}
            >
              {resolveM.isPending ? "照合中…" : "照合"}
            </Button>
            {!characterCode && (
              <p className="text-sm text-amber-700" role="status">
                先にキャラクターを選択してください。
              </p>
            )}
          </div>
          {resolveM.isError && (
            <p className="text-sm text-red-600" role="alert">
              照合に失敗しました: {resolveM.error.message}
            </p>
          )}
        </section>

        {/* ステップ3: 人レビュー(未解決の解決) */}
        {resolveResult && (
          <section className="space-y-3" aria-label="照合結果">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold">3. 照合結果を確認・解決</h2>
              <p className="text-sm text-slate-600">
                全 {resolveResult.summary.totalSteps} ステップ / 解決 {" "}
                {resolveResult.summary.totalSteps - unresolvedCount} / 未解決 {unresolvedCount}
              </p>
            </div>
            {!resolveResult.movesAvailable && (
              <p className="text-sm text-amber-700" role="status">
                このキャラは技データ未投入(またはキャラ不明)です。全行が未解決として表示されます。
              </p>
            )}

            {resolveResult.combos.map((combo) => (
              <div key={combo.comboIndex} className="space-y-1">
                <h3 className="text-sm font-semibold text-slate-700">
                  コンボ #{combo.comboIndex}
                </h3>
                <div className="overflow-x-auto rounded border border-slate-200 bg-white">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>元の表記</TableHead>
                        <TableHead>トークン列</TableHead>
                        <TableHead>技名候補</TableHead>
                        <TableHead>確信度</TableHead>
                        <TableHead>状態</TableHead>
                        <TableHead>技(move_code)</TableHead>
                        <TableHead className="w-16">除外</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {combo.steps.map((step) => {
                        const excludedFlag = isStepExcluded(combo.comboIndex, step, excluded);
                        const resolved = isStepResolved(combo.comboIndex, step, overrides);
                        const current = effectiveMoveCode(combo.comboIndex, step, overrides);
                        // 強調: 除外は灰色・解決/除外どちらでもない未解決のみ amber。
                        const rowClass = excludedFlag
                          ? "bg-slate-100 text-slate-400"
                          : resolved
                            ? undefined
                            : "bg-amber-50";
                        return (
                          <TableRow
                            key={step.stepOrder}
                            data-resolved={resolved}
                            data-excluded={excludedFlag}
                            /* 未解決の理由(候補あり / 候補なし)。E2E がこの 2 つを
                               見分けられることを主張する(M20-07 §4.3-4・E-84)。
                               除外行は「解決不要」であり未解決ではないため付けない。 */
                            data-unresolved-kind={
                              resolved || excludedFlag ? undefined : unresolvedKind(step)
                            }
                            className={rowClass}
                          >
                            <TableCell className="text-right">{step.stepOrder}</TableCell>
                            <TableCell>{step.rawText || "—"}</TableCell>
                            <TableCell className="font-mono text-xs">
                              {step.tokens || "—"}
                            </TableCell>
                            <TableCell>{step.nameCandidate || "—"}</TableCell>
                            {/* 確信度(参考)。低/? が多い＝推測で埋めている疑い(§4.3 の観察点)。
                                備考は title でホバー参照できる。 */}
                            <TableCell className="text-xs" title={step.note || undefined}>
                              {step.confidence || "—"}
                              {step.note ? " *" : ""}
                            </TableCell>
                            <TableCell>
                              {excludedFlag ? (
                                <Badge variant="outline">除外</Badge>
                              ) : resolved ? (
                                <Badge variant="secondary">
                                  {step.resolvedVia === "alias"
                                    ? "別名で解決"
                                    : step.resolvedVia === "token"
                                      ? "トークンで解決"
                                      : "手動で解決"}
                                </Badge>
                              ) : (
                                /* ★「候補が複数あって決められなかった」と「そもそも 1 つも
                                   当たらなかった」を別の顔で出す(M20-07 §4.3-4・E-84)。
                                   同じ「未解決」で出すと、利用者は次に何をすべきか判断できない
                                   ——前者は選ぶ作業、後者は自分で探す作業である。 */
                                <Badge variant="destructive" title={unresolvedHint(step)}>
                                  {step.candidates.length > 0
                                    ? `未解決(候補 ${step.candidates.length} 件)`
                                    : "未解決(候補なし)"}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <select
                                className="block h-8 w-full max-w-xs rounded border border-slate-300 bg-white px-2 text-xs disabled:opacity-50"
                                value={current}
                                disabled={excludedFlag}
                                onChange={(e) =>
                                  setOverride(combo.comboIndex, step.stepOrder, e.target.value)
                                }
                                aria-label={`ステップ ${step.stepOrder} の技を指定`}
                              >
                                <option value="">(未解決)</option>
                                {/* ★候補を独立したグループで先頭に置く(M20-07)。
                                    旧実装は「全技リストに含まれる code を候補から除く」形で
                                    あったため、候補は必ず全技リストに含まれる以上、
                                    このグループは常に空だった=候補があっても人に見えなかった。 */}
                                {step.candidates.length > 0 && (
                                  <optgroup label={`候補(${step.candidates.length} 件)`}>
                                    {step.candidates.map((c) => (
                                      <option key={`cand-${c}`} value={c}>
                                        {moveOptions.find((o) => o.code === c)?.label ?? c}
                                      </option>
                                    ))}
                                  </optgroup>
                                )}
                                <optgroup label="すべての技">
                                  {moveOptions.map((o) => (
                                    <option key={o.code} value={o.code}>
                                      {o.label}
                                    </option>
                                  ))}
                                </optgroup>
                              </select>
                            </TableCell>
                            <TableCell>
                              <input
                                type="checkbox"
                                checked={excludedFlag}
                                onChange={(e) =>
                                  setExcludeStep(
                                    combo.comboIndex,
                                    step.stepOrder,
                                    e.target.checked,
                                  )
                                }
                                aria-label={`ステップ ${step.stepOrder} を取込から除外`}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                {comboHasExcludedStep(combo, excluded) && (
                  <p className="text-xs text-amber-700" role="status">
                    除外した行はこのコンボのレシピから外れます(元の表記より手数が減ります)。取り込む内容を確認してください。
                  </p>
                )}
              </div>
            ))}

            {/* ステップ4: 既存 import へ連携 */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                onClick={handleProceed}
                disabled={unresolvedCount > 0 || buildCsvM.isPending}
              >
                {buildCsvM.isPending ? "生成中…" : "取込プレビューへ進む"}
              </Button>
              {unresolvedCount > 0 && (
                <p className="text-sm text-amber-700" role="status">
                  未解決の {unresolvedCount} 行を「技の指定」で解決するか「除外」にすると、取込プレビューへ進めます。
                </p>
              )}
              {buildCsvM.isError && (
                <p className="text-sm text-red-600" role="alert">
                  CSV の生成に失敗しました: {buildCsvM.error.message}
                </p>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
