import { fetchJSON } from "@/lib/api-client";
import type { CreateUserRequest, UpdateUserRequest, User } from "./types";

export const userApi = {
  list: (): Promise<User[]> => fetchJSON<User[]>("/api/users"),

  create: (req: CreateUserRequest): Promise<User> =>
    fetchJSON<User>("/api/users", {
      method: "POST",
      body: JSON.stringify(req),
    }),

  rename: (id: number, req: UpdateUserRequest): Promise<User> =>
    fetchJSON<User>(`/api/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(req),
    }),
};
