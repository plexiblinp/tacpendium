/**
 * TanStack Query の queryKey の正本(M24-08 / CO-009 / CHANGE-148)。
 *
 * ★★本ファイルの外で queryKey の配列リテラルを書かないこと。
 *   検査: web/src/lib/query-keys.convention.test.ts が機械で見ている。
 *
 * ── 作法 ────────────────────────────────────────────────────────────
 * 1. 配列。第 1 要素はドメインのルート文字列。
 * 2. 階層はリテラル文字列 + スカラーの位置引数(flat)を正典とする。
 * 3. 末尾 object は「多フィールドのフィルタ束」のときだけ許す。
 *    ⇒ 現在の例外は combos.list / tags.list / setups.byCharacter /
 *      setup.detail / setupCandidates.byKnockdown / setplaySuggestions.list /
 *      presets.aliases / characters.list の 8 種。理由は各定義に書いてある。
 *
 * ── ★★平坦化しなかった箇所と、その理由(消さないこと) ──────────────
 * 本サブの成果物は「E2E 非回帰 = 挙動を 1 つも変えない」である。
 * 以下 3 件は object を flat へ展開すると **matching の意味が変わる**ため、
 * 値を今のまま写した。「統一漏れ」ではない。平坦化すると静かに壊れる。
 *
 *  (a) tags —— invalidate 側 tags.byCategory(true, cat) が query 側
 *      tags.statusCounts() の **真部分集合**であり、TanStack の
 *      partialDeepEqual にのみ依存して当たっている。flat 展開すると
 *      前方一致では代替できず、マイコンボの件数が更新されなくなる。
 *  (b) setupCandidates —— byCombo(comboId) と byKnockdown({...}) が
 *      同じルートを共有している。両方を flat にすると
 *      byCombo(5) が byKnockdown({characterId:5,...}) を
 *      **巻き込むようになる**(現在は巻き込まない)。
 *  (c) combo.recipe —— combo.detail(id) の invalidate 10 箇所が
 *      前方一致で recipe も同時に無効化している。これが契約 F-2 の
 *      FE 側の実体である(m20-contract §5 / D-291)。object 化すると切れる。
 *
 * ── 契約 F-2(m20-contract §5 / m21-contract §5 / D-291) ─────────────
 * presetId は単一値であり、combo.recipe の構成要素として残す。★落とさない。
 * 対応する他の 2 面(RecipeResponse.presetId / config [defaults] preset_id)は
 * 本ファイルの管轄外であり、変更しない。
 */

/** 多フィールドのフィルタ束。作法 3 の例外に渡す。 */
type FilterBundle = object;

export const queryKeys = {
  /** コンボ一覧系。combos.all() は list / recent / trash の全部に前方一致で届く。 */
  combos: {
    all: () => ["combos"] as const,
    /** ★例外: ComboListFilter は 14 フィールドの束であり、位置引数へ展開できない。 */
    list: <T extends FilterBundle>(filter: T) => ["combos", filter] as const,
    recent: () => ["combos", "recent"] as const,
    trash: (characterId: number) => ["combos", "trash", characterId] as const,
  },

  /** コンボ詳細系。combo.all() は detail / recipe / deleted の全部に届く。 */
  combo: {
    all: () => ["combo"] as const,
    detail: (id: number | string | null | undefined) =>
      ["combo", id] as const,
    /** ★契約 F-2。presetId を構成要素として残す。detail(comboId) が前方一致で届く。 */
    recipe: (
      comboId: number | string | undefined,
      presetId: number | undefined,
    ) => ["combo", comboId, "recipe", presetId] as const,
    /** ★削除済み詳細は通常詳細とキーを分ける(同じキーに載せると詳細のキャッシュを汚す)。 */
    deleted: (id: number | null | undefined) =>
      ["combo", "deleted", id] as const,
    /**
     * 登録前の重複判定(M24-08 第 2 部 C ／ CO-010)。
     *
     * ★入力の束をそのまま鍵にする。TanStack は object を安定ハッシュするため、
     *   着手前の手書き `JSON.stringify(input)` と同じ役割を果たす。
     * ★"duplicate-check" を挟むのは、combo.detail(id) の invalidate に
     *   巻き込まれないようにするためである(判定結果はコンボ 1 件のキャッシュではない)。
     */
    duplicateCheck: <T>(input: T) => ["combo", "duplicate-check", input] as const,
  },

  /** セットプレイ一覧系。 */
  setups: {
    all: () => ["setups"] as const,
    /** ★例外(b と同型): 値を動かさないため object のまま写した。 */
    byCharacter: (characterId: number | null | undefined) =>
      ["setups", { characterId }] as const,
    trash: (characterId: number) => ["setups", "trash", characterId] as const,
  },

  /** セットプレイ詳細。★例外: 既存の値が object であり、動かすと setQueryData と割れる。 */
  setup: {
    detail: (id: number | null | undefined) => ["setup", { id }] as const,
  },

  /** セットプレイ候補。★上記 (b) を参照。2 系統が同じルートを共有している。 */
  setupCandidates: {
    all: () => ["setupCandidates"] as const,
    byCombo: (comboId: number | null | undefined) =>
      ["setupCandidates", comboId] as const,
    byKnockdown: (
      characterId: number | null | undefined,
      knockdownAdvantage: number | null | undefined,
    ) => ["setupCandidates", { characterId, knockdownAdvantage }] as const,
  },

  /** セットプレイ提案。 */
  setplaySuggestions: {
    all: () => ["setplaySuggestions"] as const,
    /** ★applied は boolean ではなく検索条件の束(GetSuggestionsParams | null)である。 */
    list: <T>(comboId: number | null | undefined, applied: T) =>
      ["setplaySuggestions", { comboId, applied }] as const,
  },

  /**
   * タグ。★上記 (a) を参照。byCategory(true, cat) は statusCounts(cat, id) の真部分集合であり、
   * partialDeepEqual で当たっている。キーの形も引数名も動かさないこと。
   * ★include_usage / character_id が snake_case なのは既存の値をそのまま写したため。
   */
  tags: {
    all: () => ["tags"] as const,
    list: (includeUsage: boolean) =>
      ["tags", { include_usage: includeUsage }] as const,
    byCategory: (includeUsage: boolean, category: string) =>
      ["tags", { include_usage: includeUsage, category }] as const,
    statusCounts: (category: string, characterId: number | undefined) =>
      [
        "tags",
        { include_usage: true, category, character_id: characterId },
      ] as const,
  },

  /** プリセット。 */
  presets: {
    all: () => ["presets"] as const,
    /** ★aliases は presets.all() と presets.aliasesRoot(id) の両方から前方一致で届く。 */
    aliasesRoot: (presetId: number) =>
      ["presets", presetId, "aliases"] as const,
    /**
     * ★3 引数とも undefined を取りうる。値をそのまま写すこと——
     *   limit を 0 などへ丸めると別のキャッシュ実体になる(着手時に 1 度踏んだ)。
     */
    aliases: (
      presetId: number | undefined,
      characterId: number | undefined,
      limit: number | undefined,
    ) => ["presets", presetId, "aliases", { characterId, limit }] as const,
  },

  /** 技。 */
  moves: {
    byCharacter: (characterId: number | null | undefined) =>
      ["moves", "by-character", characterId] as const,
  },
  move: {
    detail: (id: number | null | undefined) => ["move", id] as const,
  },
  commandIndex: (characterId: number | null | undefined) =>
    ["command-index", characterId] as const,
  motionCommands: (characterId: number | null | undefined) =>
    ["motion-commands", characterId] as const,

  /**
   * 確定反撃。
   * ★着手前は features/punish/api.ts の文字列 const と
   *   features/moves/api.ts:106 のリテラル直書きに二重定義されていた(値は同一)。
   *   ⇒ 本ファイルへ寄せた。値は変えていない。
   */
  punishFinder: {
    all: () => ["punish-finder"] as const,
    byMatchup: (
      selfCharacterId: number | null,
      opponentCharacterId: number | null,
      guardType: string,
    ) =>
      ["punish-finder", selfCharacterId, opponentCharacterId, guardType] as const,
  },
  punishList: {
    all: () => ["punish-list"] as const,
    byMatchup: (
      selfCharacterId: number | null,
      opponentCharacterId: number | null,
      guardType: string,
    ) =>
      ["punish-list", selfCharacterId, opponentCharacterId, guardType] as const,
  },

  /** キャラクター。 */
  characters: {
    list: (gameId: number) => ["characters", { gameId }] as const,
  },

  /** 認証・設定・ユーザー。 */
  auth: {
    status: () => ["auth", "status"] as const,
  },
  config: () => ["config"] as const,
  users: () => ["users"] as const,

  /** 起動時の告知(M28-01: データディレクトリの移行)。生涯 1 度しか出ない。 */
  notices: {
    dataMigration: () => ["notices", "data-migration"] as const,
    /**
     * ゲーム更新の告知(M28-02c: FR702)。
     *
     * ★★件数と現在版と延期の状態を 1 本から取る。⇒ バナーと一覧のボタンが
     *   同じ出どころを見る(2 か所から取ると片方だけ古い値を出す)。
     * ★「問題なし」を押したら無効化する(件数が減るため)。
     */
    gameUpdate: () => ["notices", "game-update"] as const,
  },
} as const;
