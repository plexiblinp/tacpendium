import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

import { SetupBasicInfoForm } from "./SetupBasicInfoForm";

vi.mock("@/features/character/hooks/useCharacters", () => ({
  useCharacterName: vi.fn(() => "リュウ"),
}));

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

afterEach(() => vi.clearAllMocks());

describe("SetupBasicInfoForm", () => {
  it("キャラクター名が読み取り専用で表示される", () => {
    render(
      <SetupBasicInfoForm
        characterId={1}
        name={null}
        description={null}
        onChange={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );
    expect(screen.getByText("リュウ")).toBeDefined();
  });

  it("name を変更すると onChange が呼ばれる", () => {
    const onChange = vi.fn();
    render(
      <SetupBasicInfoForm
        characterId={1}
        name={null}
        description={null}
        onChange={onChange}
      />,
      { wrapper: createWrapper() },
    );
    fireEvent.change(screen.getByPlaceholderText("セットプレイ名"), {
      target: { value: "テストセットプレイ" },
    });
    expect(onChange).toHaveBeenCalledWith({ name: "テストセットプレイ" });
  });

  it("description を変更すると onChange が呼ばれる", () => {
    const onChange = vi.fn();
    render(
      <SetupBasicInfoForm
        characterId={1}
        name={null}
        description={null}
        onChange={onChange}
      />,
      { wrapper: createWrapper() },
    );
    fireEvent.change(screen.getByPlaceholderText("セットプレイの説明"), {
      target: { value: "説明文" },
    });
    expect(onChange).toHaveBeenCalledWith({ description: "説明文" });
  });

  it("name / description が null のとき空文字で表示される", () => {
    render(
      <SetupBasicInfoForm
        characterId={1}
        name={null}
        description={null}
        onChange={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );
    const nameInput = screen.getByPlaceholderText("セットプレイ名") as HTMLInputElement;
    expect(nameInput.value).toBe("");
  });
});
