/**
 * Authentication Service
 * Handles authentication with external auth provider (Keycloak)
 */

const config = require('../config');

class AuthService {
  constructor() {
    this.accessToken = null;
    this.refreshToken = null;
    this.userId = null;
    this.tokenExpiryTime = null;
    this.authLock = null;
    this.refreshLock = null;
  }

  /**
   * Check if token is expired or about to expire
   */
  isTokenExpired() {
    if (!this.tokenExpiryTime) {
      return true;
    }
    return Date.now() >= (this.tokenExpiryTime - config.tokenBufferTime);
  }

  /**
   * Ensure we have a valid token
   */
  async ensureValidToken() {
    if (this.accessToken && !this.isTokenExpired()) {
      return true;
    }

    if (this.authLock) {
      await this.authLock;
      return this.accessToken && !this.isTokenExpired();
    }

    this.authLock = this.performAuthentication();
    
    try {
      await this.authLock;
      return !!this.accessToken;
    } catch (error) {
      console.error('Authentication failed:', error);
      return false;
    } finally {
      this.authLock = null;
    }
  }

  /**
   * Perform authentication
   */
  async performAuthentication() {
    // Try refresh first if we have a refresh token
    if (this.refreshToken && this.tokenExpiryTime) {
      try {
        await this.refreshTokenSync();
        return;
      } catch (error) {
        console.log('Token refresh failed, trying fresh auth:', error.message);
      }
    }

    await this.authenticate();
  }

  /**
   * Authenticate with credentials
   */
  async authenticate() {
    const authEndpoint = `${config.authApiUrl}/auth-kc/signin`;
    
    console.log('🔐 Authenticating with external auth service...');

    const response = await fetch(authEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        email: config.serviceEmail,
        password: config.servicePassword
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Authentication failed (${response.status}): ${errorText}`);
    }

    const authData = await response.json();

    if (!authData.accessToken || !authData.refreshToken || !authData.id) {
      throw new Error('Invalid authentication response: missing required fields');
    }

    this.accessToken = authData.accessToken;
    this.refreshToken = authData.refreshToken;
    this.userId = authData.id;
    this.tokenExpiryTime = Date.now() + (60 * 60 * 1000); // 1 hour

    console.log('✅ Authentication successful');
  }

  /**
   * Refresh the access token
   */
  async refreshTokenSync() {
    if (this.refreshLock) {
      await this.refreshLock;
      return;
    }

    this.refreshLock = this._doRefresh();
    
    try {
      await this.refreshLock;
    } finally {
      this.refreshLock = null;
    }
  }

  async _doRefresh() {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await fetch(`${config.authApiUrl}/auth-kc/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${this.refreshToken}`,
        'userid': this.userId
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token refresh failed (${response.status}): ${errorText}`);
    }

    const authData = await response.json();

    this.accessToken = authData.accessToken;
    this.refreshToken = authData.refreshToken;
    this.tokenExpiryTime = Date.now() + (60 * 60 * 1000);

    console.log('✅ Token refreshed successfully');
  }

  /**
   * Get current access token
   */
  getAccessToken() {
    return this.accessToken;
  }

  /**
   * Get current user ID
   */
  getUserId() {
    return this.userId;
  }

  /**
   * Make an authenticated request to external API
   */
  async makeAuthenticatedRequest(url, options = {}) {
    const hasValidToken = await this.ensureValidToken();
    
    if (!hasValidToken) {
      throw new Error('Authentication failed - unable to obtain valid token');
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${this.accessToken}`,
        'userid': this.userId
      }
    });

    // Handle 401 - try refresh and retry
    if (response.status === 401) {
      console.log('⚠️ Received 401, refreshing token...');
      
      this.tokenExpiryTime = null;
      
      try {
        await this.refreshTokenSync();
        
        return fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            'Authorization': `Bearer ${this.accessToken}`,
            'userid': this.userId
          }
        });
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        throw new Error('Authentication failed - unable to refresh token');
      }
    }

    return response;
  }

  /**
   * Clear all auth state
   */
  logout() {
    this.accessToken = null;
    this.refreshToken = null;
    this.userId = null;
    this.tokenExpiryTime = null;
    console.log('User logged out');
  }
}

// Singleton instance
const authService = new AuthService();

module.exports = authService;
