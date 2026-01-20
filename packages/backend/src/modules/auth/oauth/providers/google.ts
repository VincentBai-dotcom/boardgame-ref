import { createRemoteJWKSet, jwtVerify } from "jose";
import type { OAuthClaims, OAuthProvider, OAuthTokens } from "../types";
import type { AppConfig } from "../../../config";

const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

type GoogleConfig = AppConfig["oauth"]["google"];

export class GoogleOAuthProvider implements OAuthProvider {
  name = "google" as const;

  constructor(private config: GoogleConfig) {}

  getAuthorizeUrl(params: {
    state: string;
    nonce: string;
    codeChallenge?: string;
    codeChallengeMethod?: "S256" | "plain";
  }): string {
    this.assertConfigured();
    const url = new URL(GOOGLE_AUTHORIZE_URL);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", this.config.clientId);
    url.searchParams.set("redirect_uri", this.config.redirectUri);
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
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
    const body = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: this.config.redirectUri,
    });
    if (codeVerifier) {
      body.set("code_verifier", codeVerifier);
    }

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google token exchange failed: ${errorText}`);
    }

    const data = (await response.json()) as {
      id_token?: string;
      access_token?: string;
      refresh_token?: string;
    };

    if (!data.id_token) {
      throw new Error("Google token response missing id_token");
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
    const jwks = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));
    const { payload } = await jwtVerify(idToken, jwks, {
      issuer: GOOGLE_ISSUERS,
      audience: this.config.clientId,
    });

    const nonce = typeof payload.nonce === "string" ? payload.nonce : undefined;
    if (nonce !== expectedNonce) {
      throw new Error("Google id_token nonce mismatch");
    }

    const email = typeof payload.email === "string" ? payload.email : undefined;
    const emailVerified = payload.email_verified === true;

    return {
      sub: String(payload.sub),
      email,
      emailVerified,
      nonce,
    };
  }

  private assertConfigured(): void {
    if (
      !this.config.clientId ||
      !this.config.clientSecret ||
      !this.config.redirectUri
    ) {
      throw new Error("Google OAuth not configured");
    }
  }
}
