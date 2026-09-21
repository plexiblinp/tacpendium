import { useCharacterName } from "@/features/character/hooks/useCharacters";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  characterId: number;
  name: string | null;
  description: string | null;
  onChange: (changes: Partial<{ name: string | null; description: string | null }>) => void;
}

export function SetupBasicInfoForm({ characterId, name, description, onChange }: Props) {
  const characterName = useCharacterName(characterId);

  return (
    <fieldset className="space-y-3 rounded-lg border border-gray-300 p-4">
      <legend className="px-2 text-sm font-semibold">基本情報</legend>

      <div className="space-y-1">
        <Label>キャラクター</Label>
        <p className="rounded border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-700">
          {characterName || "未選択"}
        </p>
      </div>

      <div className="space-y-1">
        {/* C-03: セットプレイ名を必須化(VAL-S06)。 */}
        <Label>
          名前{" "}
          <span className="font-normal text-red-500">必須</span>
        </Label>
        <Input
          type="text"
          value={name ?? ""}
          onChange={(e) => onChange({ name: e.target.value || null })}
          placeholder="セットプレイ名"
          required
          aria-required="true"
        />
        {(name == null || name.trim() === "") && (
          <p className="text-xs text-red-500">セットプレイ名は必須です</p>
        )}
      </div>

      <div className="space-y-1">
        <Label>
          説明{" "}
          <span className="font-normal text-gray-400">(任意)</span>
        </Label>
        <Textarea
          rows={3}
          value={description ?? ""}
          onChange={(e) => onChange({ description: e.target.value || null })}
          placeholder="セットプレイの説明"
        />
      </div>
    </fieldset>
  );
}
