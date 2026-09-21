export interface StorageHelper<T> {
  save(value: T): boolean;
  load(): T | null;
  remove(): void;
}

// key には必ず "-v1" 等のバージョン suffix を付与すること（CLAUDE.md §10.X）。
export function createLocalStorageHelper<T>(key: string): StorageHelper<T> {
  return createStorageHelper<T>(key, () => localStorage);
}

// セッション内のみ保持する用途（タブを閉じると消える）。
// in-app ナビゲーション中の UI 状態（フィルタ/ソート等）の一時保持に用いる。恒久化は localStorage 側を使う。
export function createSessionStorageHelper<T>(key: string): StorageHelper<T> {
  return createStorageHelper<T>(key, () => sessionStorage);
}

function createStorageHelper<T>(
  key: string,
  getStorage: () => Storage,
): StorageHelper<T> {
  return {
    save(value: T): boolean {
      try {
        getStorage().setItem(key, JSON.stringify(value));
        return true;
      } catch (e) {
        console.warn(`browser-storage: save failed for key "${key}"`, e);
        return false;
      }
    },

    load(): T | null {
      try {
        const raw = getStorage().getItem(key);
        if (raw === null) return null;
        return JSON.parse(raw) as T;
      } catch {
        console.warn(`browser-storage: load failed for key "${key}"`);
        return null;
      }
    },

    remove(): void {
      try {
        getStorage().removeItem(key);
      } catch (e) {
        console.warn(`browser-storage: remove failed for key "${key}"`, e);
      }
    },
  };
}
