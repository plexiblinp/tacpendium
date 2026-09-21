import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentUser } from "./CurrentUserProvider";
import { useCreateUser, useRenameUser, useUsers } from "./useUsers";

/**
 * isDuplicateName は「同名の利用者が既にいる」失敗かを判定する。
 *
 * ★userApi は fetchJSON を使うため、status は message へ埋め込まれている
 * (`HTTP 409: {...}`)。lib/api-client.ts が status を構造化して持つよう
 * 改めたら、ここも合わせて畳むこと。
 */
function isDuplicateName(error: unknown): boolean {
  return hasHTTPStatus(error, 409);
}

/**
 * isEmptyName は「名前が空」の失敗かを判定する。
 *
 * ★サーバ側は 400 `user_name_empty` を返す（`internal/api/user/handler.go`）。
 * 判定の仕方は isDuplicateName と同じ理由で status 文字列に依存している。
 *
 * ★画面からは到達しない防御的な分岐である（送信ボタンが `trim() === ""` で
 * disabled のため空は送られない）。`curl` 相当の経路で 400 が返ったときに、
 * 理由が読める状態にしておくために残してある。**デッドコードとして消さないこと。**
 */
function isEmptyName(error: unknown): boolean {
  return hasHTTPStatus(error, 400);
}

function hasHTTPStatus(error: unknown, status: number): boolean {
  if (typeof error !== "object" || error === null) return false;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && message.startsWith(`HTTP ${status}`);
}

/**
 * UserManagement は設定画面の「利用者」欄。
 *
 * ★利用者を作るとサーバ側で既定タグ(mycombo_status の 3 件)も同時に生成される
 * (M22-02 §4.5-6)。生成しないと、その人はマイコンボのステータスを引けない。
 * ★削除は作らない。tags / presets が ON DELETE CASCADE で users を参照しており、
 * 消すとその人のタグ・プリセットが一括で消えるためである。
 */
export default function UserManagement() {
  const { t } = useTranslation();
  const nameId = useId();
  const renameId = useId();
  const { data: users } = useUsers();
  const { current, reselect } = useCurrentUser();
  const createUser = useCreateUser();
  const renameUser = useRenameUser();
  // ★追加と改名は同時に開かない。同じ「名前」欄が 2 つ並ぶと、どちらに打っているか
  // 分からなくなる。
  const [mode, setMode] = useState<"idle" | "add" | "rename">("idle");
  const [name, setName] = useState("");
  const [renamed, setRenamed] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (createUser.isPending || name.trim() === "") return;
    createUser.mutate(
      { name },
      {
        onSuccess: () => {
          setMode("idle");
          setName("");
          toast.success(t("user.add.done"));
        },
      },
    );
  };

  const handleRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (renameUser.isPending || renamed.trim() === "" || current === null) return;
    renameUser.mutate(
      { id: current.id, name: renamed },
      {
        onSuccess: () => {
          setMode("idle");
          setRenamed("");
          toast.success(t("user.rename.done"));
        },
      },
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-700">{t("user.current")}:</span>
        <span className="text-sm text-gray-500" data-testid="settings-user-current">
          {current?.name ?? t("common.unknown")}
        </span>
      </div>

      <div className="flex gap-2">
        {mode === "idle" && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setMode("add")}
            data-testid="settings-user-add"
          >
            {t("settings.user.addUser")}
          </Button>
        )}
        {/* ★選択中の利用者の名前を変える(DES-005 §5.16 の「編集」)。
            ★誰も選ばれていないときは出さない——変える相手が決まらない。 */}
        {mode === "idle" && current !== null && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setRenamed(current.name);
              setMode("rename");
            }}
            data-testid="settings-user-rename"
          >
            {t("settings.user.rename")}
          </Button>
        )}
        {/* ★「選び直す」導線として意図して出す。戻る・進むで勝手に出るのとは別である
            (指示書 §4.8-5)。★2 人以上のときだけ意味がある。 */}
        {(users?.length ?? 0) > 1 && (
          <Button
            type="button"
            variant="outline"
            onClick={reselect}
            data-testid="settings-user-reselect"
          >
            {t("user.reselect")}
          </Button>
        )}
      </div>

      {mode === "add" && (
        <form onSubmit={handleSubmit} className="space-y-3" data-testid="settings-user-add-form">
          <div className="space-y-1">
            <Label htmlFor={nameId}>{t("user.add.nameLabel")}</Label>
            <Input
              id={nameId}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              data-testid="settings-user-add-name"
            />
          </div>

          {createUser.isError && (
            <p className="text-sm text-red-600" role="alert" data-testid="settings-user-add-error">
              {/* ★「なぜできないか」を出す。一般文言へ潰すと、名前を変えれば
                  済むことが利用者に伝わらない(CHANGE-113 §3.10 と同じ考え方)。 */}
              {isDuplicateName(createUser.error)
                ? t("user.add.duplicate")
                : t("user.add.failed")}
            </p>
          )}

          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={name.trim() === "" || createUser.isPending}
              data-testid="settings-user-add-submit"
            >
              {t("user.add.submit")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setMode("idle");
                setName("");
              }}
            >
              {t("user.add.cancel")}
            </Button>
          </div>
        </form>
      )}

      {mode === "rename" && current !== null && (
        <form onSubmit={handleRename} className="space-y-3" data-testid="settings-user-rename-form">
          <div className="space-y-1">
            <Label htmlFor={renameId}>{t("user.rename.nameLabel")}</Label>
            <Input
              id={renameId}
              value={renamed}
              onChange={(e) => setRenamed(e.target.value)}
              autoFocus
              data-testid="settings-user-rename-name"
            />
          </div>

          {renameUser.isError && (
            <p
              className="text-sm text-red-600"
              role="alert"
              data-testid="settings-user-rename-error"
            >
              {/* ★「なぜできないか」を出す。いずれもサーバ側が返した理由であり、
                  画面はそれを見せるだけである(M22-08 §4.5-3)。 */}
              {isDuplicateName(renameUser.error)
                ? t("user.rename.duplicate")
                : isEmptyName(renameUser.error)
                  ? t("user.rename.empty")
                  : t("user.rename.failed")}
            </p>
          )}

          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={renamed.trim() === "" || renameUser.isPending}
              data-testid="settings-user-rename-submit"
            >
              {t("user.rename.submit")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setMode("idle");
                setRenamed("");
              }}
            >
              {t("user.rename.cancel")}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
