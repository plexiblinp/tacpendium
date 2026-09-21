import { usePresetAliases } from "../api";

/**
 * PresetSamplePreview はプリセット一覧(DES-005 §5.10)の「サンプル表記プレビュー」。
 *
 * 記法プリセットは名前だけでは違いが分からない(「ナンバリング記法」と
 * 「SRK 記法」がどう違うかは、実物を並べないと伝わらない)。したがって
 * 各プリセットの実際のエイリアスを数件だけ引いて並べる。
 *
 * ★全件ではなく limit 付きで引く。1 プリセットのエイリアスは最大 1,653 行ある。
 */
const SAMPLE_LIMIT = 4;

interface Props {
  presetId: number;
  characterId: number;
}

export default function PresetSamplePreview({ presetId, characterId }: Props) {
  const { data, isLoading, isError } = usePresetAliases(
    presetId,
    characterId,
    SAMPLE_LIMIT,
  );

  if (isLoading) {
    return <span className="text-xs text-slate-400">読み込み中...</span>;
  }
  if (isError || !data || data.length === 0) {
    return <span className="text-xs text-slate-400">—</span>;
  }

  return (
    <span className="text-xs text-slate-600" data-testid="preset-sample-preview">
      {data.map((a) => a.aliasText).join(" / ")}
    </span>
  );
}
