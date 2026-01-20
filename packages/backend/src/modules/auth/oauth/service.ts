import type { OAuthClaims, OAuthProvider, OAuthProviderName } from "./types";

export class OAuthService {
  constructor(private providers: Record<OAuthProviderName, OAuthProvider>) {}

  getAuthorizeUrl(
    provider: OAuthProviderName,
    state: string,
    nonce: string,
    codeChallenge?: string,
    codeChallengeMethod?: "S256" | "plain",
  ) {
    return this.getProvider(provider).getAuthorizeUrl({
      state,
      nonce,
      codeChallenge,
      codeChallengeMethod,
    });
  }

  async exchangeAndVerify(
    provider: OAuthProviderName,
    code: string,
    expectedNonce: string,
    codeVerifier?: string,
  ): Promise<{ claims: OAuthClaims; refreshToken?: string }> {
    const oauthProvider = this.getProvider(provider);
    const tokens = await oauthProvider.exchangeCode(code, codeVerifier);
    const claims = await oauthProvider.verifyIdToken(
      tokens.idToken,
      expectedNonce,
    );
    return {
      claims,
      refreshToken: tokens.refreshToken,
    };
  }

  private getProvider(provider: OAuthProviderName): OAuthProvider {
    const instance = this.providers[provider];
    if (!instance) {
      throw new Error(`Unsupported OAuth provider: ${provider}`);
    }
    return instance;
  }
}
