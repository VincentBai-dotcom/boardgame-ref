import { importPKCS8, SignJWT, createRemoteJWKSet, jwtVerify } from "jose";
import type { OAuthClaims, OAuthProvider, OAuthTokens } from "../types";
import type { AppConfig } from "../../../config";

const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys";
const APPLE_AUTHORIZE_URL = "https://appleid.apple.com/auth/authorize";
const APPLE_TOKEN_URL = "https://appleid.apple.com/auth/token";

type AppleConfig = AppConfig["oauth"]["apple"];

export class AppleOAuthProvider implements OAuthProvider {
  name = "apple" as const;

  constructor(private config: AppleConfig) {}

  getAuthorizeUrl(params: {
    state: string;
    nonce: string;
    codeChallenge?: string;
    codeChallengeMethod?: "S256" | "plain";
  }): string {
    this.assertConfigured();
    const url = new URL(APPLE_AUTHORIZE_URL);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", this.config.clientId);
    url.searchParams.set("redirect_uri", this.config.redirectUri);
    url.searchParams.set("scope", "openid email name");
    url.searchParams.set("state", params.state);
    url.searchParams.set("nonce", params.nonce);
    if (params.codeChallenge) {
      url.searchParams.set("code_challenge", params.codeChallenge);
      url.searchParams.set(
        "code_challenge_method",
        params.codeChallengeMethod ?? "S256",
      );
    }
    return url.toString();
  }

  async exchangeCode(
    code: string,
    codeVerifier?: string,
  ): Promise<OAuthTokens> {
    this.assertConfigured();
    const clientSecret = await this.createClientSecret();
    const body = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: this.config.redirectUri,
    });
    if (codeVerifier) {
      body.set("code_verifier", codeVerifier);
    }

    const response = await fetch(APPLE_TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Apple token exchange failed: ${errorText}`);
    }

    const data = (await response.json()) as {
      id_token?: string;
      access_token?: string;
      refresh_token?: string;
    };

    if (!data.id_token) {
      throw new Error("Apple token response missing id_token");
    }

    return {
      idToken: data.id_token,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
    };
  }

  async verifyIdToken(
    idToken: string,
    expectedNonce: string,
  ): Promise<OAuthClaims> {
    this.assertConfigured();
    const jwks = createRemoteJWKSet(new URL(APPLE_JWKS_URL));
    const { payload } = await jwtVerify(idToken, jwks, {
      issuer: APPLE_ISSUER,
      audience: this.config.clientId,
    });

    const nonce = typeof payload.nonce === "string" ? payload.nonce : undefined;
    if (nonce !== expectedNonce) {
      throw new Error("Apple id_token nonce mismatch");
    }

    const email = typeof payload.email === "string" ? payload.email : undefined;
    const emailVerified =
      payload.email_verified === "true" || payload.email_verified === true;

    return {
      sub: String(payload.sub),
      email,
      emailVerified,
      nonce,
    };
  }

  private async createClientSecret(): Promise<string> {
    const privateKey = this.config.privateKey.replace(/\\n/g, "\n");
    const key = await importPKCS8(privateKey, "ES256");
    return new SignJWT({})
      .setProtectedHeader({ alg: "ES256", kid: this.config.keyId })
      .setIssuedAt()
      .setExpirationTime("5m")
      .setIssuer(this.config.teamId)
      .setAudience(APPLE_ISSUER)
      .setSubject(this.config.clientId)
      .sign(key);
  }

  private assertConfigured(): void {
    if (
      !this.config.clientId ||
      !this.config.teamId ||
      !this.config.keyId ||
      !this.config.privateKey ||
      !this.config.redirectUri
    ) {
      throw new Error("Apple OAuth not configured");
    }
  }
}
