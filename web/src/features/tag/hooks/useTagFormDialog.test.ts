import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

import "@/lib/i18n";
import { useTagFormDialog, createTagFormSchema } from "./useTagFormDialog";
import i18n from "@/lib/i18n";
import { TagApiError } from "@/features/tag/api/tagApi";
import { DEFAULT_TAG_COLOR } from "@/features/tag/constants/tagColorPalette";

beforeEach(() => {
  vi.clearAllMocks();
});

// ★M24-07: 検証メッセージを locale へ出したためスキーマはファクトリになった。
//   実 i18n の t を渡して組み立てる(文言そのものはここでは主張しない)。
const tagFormSchema = createTagFormSchema((k) => i18n.t(k));

describe("tagFormSchema", () => {
  it("正常な値でパースが成功する", () => {
    const result = tagFormSchema.safeParse({ name: "テスト", category: "", color: "#10B981" });
    expect(result.success).toBe(true);
  });

  it("空の name は失敗する", () => {
    const result = tagFormSchema.safeParse({ name: "", category: "", color: "" });
    expect(result.success).toBe(false);
  });

  it("スペースのみの name は trim 後に空になり失敗する", () => {
    const result = tagFormSchema.safeParse({ name: "   ", category: "", color: "" });
    expect(result.success).toBe(false);
  });

  it("不正な color 形式は失敗する", () => {
    const result = tagFormSchema.safeParse({ name: "テスト", category: "", color: "invalid" });
    expect(result.success).toBe(false);
  });

  it("空の color は許容する", () => {
    const result = tagFormSchema.safeParse({ name: "テスト", category: "", color: "" });
    expect(result.success).toBe(true);
  });
});

describe("useTagFormDialog", () => {
  it("open=true でタグが渡された場合、form がタグの値でリセットされる", () => {
    const tag = { id: 1, userId: 1, name: "既存タグ", category: "custom", color: "#FF0000" };
    const { result } = renderHook(() =>
      useTagFormDialog(true, tag, vi.fn(), vi.fn()),
    );

    expect(result.current.form.getValues()).toEqual({
      name: "既存タグ",
      category: "custom",
      color: "#FF0000",
    });
  });

  it("FB⑭: open=true でタグが null の場合(新規作成)、color は既定色(青系・灰色固定でない)でリセットされる", () => {
    const { result } = renderHook(() =>
      useTagFormDialog(true, null, vi.fn(), vi.fn()),
    );

    expect(result.current.form.getValues()).toEqual({
      name: "",
      category: "",
      color: DEFAULT_TAG_COLOR,
    });
  });

  it("open=true でタグが渡されたが color 未設定の場合(編集)、既定色を勝手に付与しない", () => {
    const tag = { id: 1, userId: 1, name: "無色タグ" };
    const { result } = renderHook(() =>
      useTagFormDialog(true, tag, vi.fn(), vi.fn()),
    );

    expect(result.current.form.getValues().color).toBe("");
  });

  it("送信時に color が空文字列なら undefined に正規化される", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    const { result } = renderHook(() =>
      useTagFormDialog(true, null, onSubmit, onClose),
    );

    await act(async () => {
      result.current.form.setValue("name", "新タグ");
      result.current.form.setValue("color", "");
      await result.current.handleSubmit();
    });

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ color: undefined }),
    );
  });

  it("既存タグ編集で HEX 欄を空にして送信しても color は undefined(=更新時に列変更なし)になり既存色を破壊しない", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    const tag = { id: 1, userId: 1, name: "色付きタグ", color: "#FF0000" };

    const { result } = renderHook(() =>
      useTagFormDialog(true, tag, onSubmit, onClose),
    );

    await act(async () => {
      result.current.form.setValue("color", "");
      await result.current.handleSubmit();
    });

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: "色付きタグ", color: undefined }),
    );
  });

  it("送信成功時に onClose が呼ばれる", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    const { result } = renderHook(() =>
      useTagFormDialog(true, null, onSubmit, onClose),
    );

    await act(async () => {
      result.current.form.setValue("name", "新タグ");
      await result.current.handleSubmit();
    });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("tag_name_duplicate エラー時に name フィールドにエラーがセットされる", async () => {
    const error = new TagApiError(409, {
      error: { code: "tag_name_duplicate", message: "duplicate" },
    }, "duplicate");
    const onSubmit = vi.fn().mockRejectedValue(error);
    const onClose = vi.fn();
    const tag = { id: 1, userId: 1, name: "テスト" };

    const { result } = renderHook(() =>
      useTagFormDialog(true, tag, onSubmit, onClose),
    );

    // useEffect でフォームがリセットされた後、trigger でバリデーションを通す
    await act(async () => {
      result.current.form.setValue("name", "テスト", { shouldValidate: true });
      const valid = await result.current.form.trigger();
      expect(valid).toBe(true);
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(onSubmit).toHaveBeenCalled();
    // setError 後の状態を getFieldState で確認（formState.errors はプロキシで遅延取得されるため）
    await waitFor(() => {
      const nameState = result.current.form.getFieldState("name");
      expect(nameState.error?.message).toBe("同名のタグが既に存在します");
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("予期しないエラー時に onClose が呼ばれない", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("unknown"));
    const onClose = vi.fn();
    const tag = { id: 1, userId: 1, name: "テスト" };

    const { result } = renderHook(() =>
      useTagFormDialog(true, tag, onSubmit, onClose),
    );

    await act(async () => {
      result.current.form.setValue("name", "テスト", { shouldValidate: true });
      const valid = await result.current.form.trigger();
      expect(valid).toBe(true);
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(onSubmit).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
