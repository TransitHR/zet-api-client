import { LoginCredentials, RegisterCredentials, AuthTokens, LoginCredentialsSchema, RegisterCredentialsSchema, AuthTokensSchema, RefreshTokenRequestSchema, AuthTokensLogin } from './types';
import config, { headers } from '../core/config';
import { parseZodError } from '../core/utils';
import axios, { AxiosError } from 'axios';

export class ZetAuthManager {
	private tokens: { access: string; refresh: string; expiresAt: number; } | null = null;
	private refreshPromise: Promise<void> | null = null;

	private readonly tokenExpiryBufferMs = 120000; // 2 minutes before expiry, consider it expired.
	private readonly defaultTokenExpiryMs = 900000; // 15 minutes default expiry if not provided.

	public isAuthenticated(): boolean {
		return this.tokens !== null && Date.now() < this.tokens.expiresAt - this.tokenExpiryBufferMs;
	}

	public async getAccessToken(): Promise<string> {
		if (!this.tokens) throw new Error('Not authenticated. Please login first.');
		if (Date.now() < this.tokens.expiresAt - this.tokenExpiryBufferMs) return this.tokens.access;

		await this.ensureTokenRefresh();
		if (!this.tokens || Date.now() >= this.tokens.expiresAt - this.tokenExpiryBufferMs) throw new Error('Token expired. Please login again.');

		return this.tokens.access;
	}

	public async login(credentials: LoginCredentials): Promise<AuthTokensLogin> {
		const validated = LoginCredentialsSchema.parse(credentials);

		if (validated.accessToken && validated.refreshToken) {
			const reusedTokens = this.tryReuseAccessToken(validated.accessToken, validated.refreshToken);
			if (reusedTokens) return reusedTokens;
		}

		if (validated.refreshToken) {
			const refreshedTokens = await this.tryRefreshToken(validated.refreshToken);
			if (refreshedTokens) return refreshedTokens;
		}

		return await this.performPasswordLogin(validated);
	}

	public async register(credentials: RegisterCredentials): Promise<void> {
		const validated = RegisterCredentialsSchema.parse(credentials);
		if (validated.password !== validated.confirmPassword) throw new Error('Passwords do not match.');

		const response = await axios.post(`${config.accountServiceUrl}/register`, validated, { headers }).catch((err: AxiosError) => err.response);
		if (!response || response.status !== 200) {
			const errorMsg = response?.data?.message || response?.statusText || 'Unknown error';
			throw new Error(`Registration failed: ${errorMsg}`);
		}
	}

	public async logout(): Promise<void> {
		if (this.tokens?.refresh) {
			try {
				const validated = RefreshTokenRequestSchema.parse({ refreshToken: this.tokens.refresh });
				await axios.post(`${config.authServiceUrl}/logout`, validated, { headers }).catch(() => { });
			} catch {
				// *
			}
		}

		this.clearTokens();
	}

	private tryReuseAccessToken(accessToken: string, refreshToken: string): AuthTokensLogin | null {
		try {
			const parts = accessToken.split('.');
			if (parts.length !== 3 || !parts[1]) return null;

			const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
			if (!payload.exp) return null;

			const expiresAt = payload.exp * 1000;
			const now = Date.now();

			if (expiresAt > now + this.tokenExpiryBufferMs) {
				this.storeTokens({ accessToken, refreshToken }, expiresAt);

				return {
					accessToken: this.tokens!.access,
					refreshToken: this.tokens!.refresh,
					expiresIn: Math.max(0, this.tokens!.expiresAt - now),
					viaTokenRefresh: false,
					viaAccessToken: true,
				};
			}

			return null;
		} catch (error) {
			return null;
		}
	}

	private async tryRefreshToken(refreshToken: string): Promise<AuthTokensLogin | null> {
		try {
			const validated = RefreshTokenRequestSchema.parse({ refreshToken });

			const response = await axios.post(`${config.authServiceUrl}/refreshTokens`, validated, { headers }).catch((err: AxiosError) => err.response);
			if (!response || response.status !== 200) return null;

			const parsed = AuthTokensSchema.safeParse(response.data);
			if (!parsed.success) return null;

			this.storeTokens(parsed.data);

			return {
				accessToken: this.tokens!.access,
				refreshToken: this.tokens!.refresh,
				expiresIn: Math.max(0, this.tokens!.expiresAt - Date.now()),
				viaTokenRefresh: true,
				viaAccessToken: false,
			};
		} catch (error) {
			return null;
		}
	}

	private async performPasswordLogin(validated: LoginCredentials): Promise<AuthTokensLogin> {
		if (!validated.username || !validated.password) throw new Error('Username and password are required for login.');

		const loginData = {
			username: validated.username,
			password: validated.password,
			revokeOtherTokens: validated.revokeOtherTokens,
			fcmToken: validated.fcmToken,
		};

		const response = await axios.post(`${config.authServiceUrl}/login`, loginData, { headers }).catch((err: AxiosError) => err.response);
		if (!response || response.status !== 200) throw new Error(`Login failed: ${response?.statusText || 'Unknown error'}`);

		const parsed = AuthTokensSchema.safeParse(response.data);
		if (!parsed.success) throw new Error(`Failed to parse login response: ${parseZodError(parsed.error).join(', ')}`);

		this.storeTokens(parsed.data);

		return {
			accessToken: this.tokens!.access,
			refreshToken: this.tokens!.refresh,
			expiresIn: Math.max(0, this.tokens!.expiresAt - Date.now()),
			viaTokenRefresh: false,
			viaAccessToken: false,
		};
	}

	private async ensureTokenRefresh(): Promise<void> {
		if (this.refreshPromise) return this.refreshPromise;
		this.refreshPromise = this.performTokenRefresh();

		try {
			await this.refreshPromise;
		} finally {
			this.refreshPromise = null;
		}
	}

	private async performTokenRefresh(): Promise<void> {
		if (!this.tokens?.refresh) throw new Error('No refresh token available.');

		const refreshToken = this.tokens.refresh;

		try {
			const validated = RefreshTokenRequestSchema.parse({ refreshToken });

			const response = await axios.post(`${config.authServiceUrl}/refreshTokens`, validated, { headers }).catch((err: AxiosError) => err.response);
			if (!response || response.status !== 200) {
				this.clearTokens();
				throw new Error(`Token refresh failed: ${response?.statusText || 'Unknown error'}. Please login again.`);
			}

			const parsed = AuthTokensSchema.safeParse(response.data);
			if (!parsed.success) {
				this.clearTokens();
				throw new Error(`Failed to parse refresh response: ${parseZodError(parsed.error).join(', ')}`);
			}

			this.storeTokens(parsed.data);
		} catch (error) {
			this.clearTokens();
			throw error;
		}
	}

	private storeTokens(tokens: AuthTokens, expiresAt?: number): void {
		if (!expiresAt) {
			try {
				const parts = tokens.accessToken.split('.');
				if (parts.length === 3 && parts[1]) {
					const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
					expiresAt = payload.exp ? payload.exp * 1000 : Date.now() + this.defaultTokenExpiryMs;
				}
			} catch {
				// *
			}
		}

		this.tokens = {
			access: tokens.accessToken,
			refresh: tokens.refreshToken,
			expiresAt: expiresAt || Date.now() + this.defaultTokenExpiryMs,
		};
	}

	private clearTokens(): void {
		this.tokens = null;
		this.refreshPromise = null;
	}
}
