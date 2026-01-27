export type OAuthProviderName = "apple" | "google";
export type OAuthClientType = "web" | "native";

export type OAuthAuthorizeParams = {
  state: string;
  nonce: string;
  codeChallenge?: string;
  codeChallengeMethod?: "S256" | "plain";
};

export type OAuthTokens = {
  idToken: string;
  accessToken?: string;
  refreshToken?: string;
};

export type OAuthClaims = {
  sub: string;
  email?: string;
  emailVerified?: boolean;
  nonce?: string;
};

export interface OAuthProvider {
  name: OAuthProviderName;
  getAuthorizeUrl(params: OAuthAuthorizeParams): string;
  exchangeCode(
    code: string,
    codeVerifier?: string,
    clientType?: OAuthClientType,
  ): Promise<OAuthTokens>;
  verifyIdToken(
    idToken: string,
    expectedNonce: string,
    clientType?: OAuthClientType,
  ): Promise<OAuthClaims>;
}
