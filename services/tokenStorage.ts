// li-app/services/tokenStorage.ts
import * as SecureStore from "expo-secure-store";

export interface ITokenStorage {
  setTokens(access: string, refresh: string): Promise<void>;
  getAccessToken(): Promise<string | null>;
  getRefreshToken(): Promise<string | null>;
  clearTokens(): Promise<void>;
}

export const TokenStorage: ITokenStorage = {
  async setTokens(access: string, refresh: string) {
    await SecureStore.setItemAsync("access_token", access);
    await SecureStore.setItemAsync("refresh_token", refresh);
  },

  async getAccessToken() {
    return await SecureStore.getItemAsync("access_token");
  },

  async getRefreshToken() {
    return await SecureStore.getItemAsync("refresh_token");
  },

  async clearTokens() {
    await SecureStore.deleteItemAsync("access_token");
    await SecureStore.deleteItemAsync("refresh_token");
  },
};