export interface WorkspaceUser {
  id: string;
  role: string;
}

export type ApiClient = <T>(path: string, options?: RequestInit) => Promise<T>;
