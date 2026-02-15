/**
 * Mail Service
 * Sends emails via Microsoft Graph API (Outlook SDK) using Azure AD client credentials
 */

const { ConfidentialClientApplication } = require('@azure/msal-node');

// Azure AD / Microsoft Graph configuration (set via environment variables)
// Required env vars: AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_CLIENT_SECRET, OUTLOOK_SENDER_EMAIL
const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID;
const AZURE_TENANT_ID = process.env.AZURE_TENANT_ID;
const AZURE_CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET;
const SENDER_EMAIL = process.env.OUTLOOK_SENDER_EMAIL || 'info@wathbahs.com';

const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';

class MailService {
  constructor() {
    this.msalClient = null;
    this.initialized = false;
    this.tokenCache = null;
  }

  /**
   * Initialize the MSAL confidential client for Azure AD auth
   */
  initialize() {
    if (this.initialized) {
      return;
    }

    if (!AZURE_CLIENT_ID || !AZURE_TENANT_ID || !AZURE_CLIENT_SECRET) {
      throw new Error(
        'Mail service requires AZURE_CLIENT_ID, AZURE_TENANT_ID, and AZURE_CLIENT_SECRET environment variables'
      );
    }

    const msalConfig = {
      auth: {
        clientId: AZURE_CLIENT_ID,
        authority: `https://login.microsoftonline.com/${AZURE_TENANT_ID}`,
        clientSecret: AZURE_CLIENT_SECRET
      }
    };

    this.msalClient = new ConfidentialClientApplication(msalConfig);
    this.initialized = true;

    console.log(`📧 Mail service initialized (Microsoft Graph API, sender: ${SENDER_EMAIL})`);
  }

  /**
   * Acquire an access token for Microsoft Graph API
   */
  async getAccessToken() {
    this.initialize();

    try {
      const result = await this.msalClient.acquireTokenByClientCredential({
        scopes: ['https://graph.microsoft.com/.default']
      });

      if (!result || !result.accessToken) {
        throw new Error('No access token returned from Azure AD');
      }

      return result.accessToken;
    } catch (error) {
      console.error('❌ Failed to acquire Azure AD token:', error.message);
      throw new Error(`Azure AD authentication failed: ${error.message}`);
    }
  }

  /**
   * Verify the connection by acquiring a token and checking Graph API access
   */
  async verifyConnection() {
    this.initialize();

    try {
      const token = await this.getAccessToken();

      // Test Graph API access by getting user profile
      const response = await fetch(`${GRAPH_API_BASE}/users/${SENDER_EMAIL}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Graph API returned ${response.status}: ${errorBody}`);
      }

      const user = await response.json();
      console.log(`✅ Mail service verified (Graph API user: ${user.displayName || user.mail})`);

      return {
        success: true,
        message: 'Microsoft Graph API connection verified',
        user: user.displayName || user.mail
      };
    } catch (error) {
      console.error('❌ Mail service verification failed:', error.message);
      throw new Error(`Mail service verification failed: ${error.message}`);
    }
  }

  /**
   * Send an email via Microsoft Graph API
   * @param {Object} options - Email options
   * @param {string} options.from_email - Sender email (optional, uses default)
   * @param {string[]} options.recipient_list - Array of recipient emails
   * @param {string} options.subject - Email subject
   * @param {string} options.body - Email body (plain text)
   * @param {string} options.html - Email body (HTML, optional)
   * @param {string[]} options.cc - CC recipients (optional)
   * @param {string[]} options.bcc - BCC recipients (optional)
   */
  async sendMail({ from_email, recipient_list, subject, body, html, cc, bcc }) {
    this.initialize();

    // Validate required fields
    if (!recipient_list || !Array.isArray(recipient_list) || recipient_list.length === 0) {
      throw new Error('recipient_list is required and must be a non-empty array');
    }

    if (!subject) {
      throw new Error('subject is required');
    }

    if (!body && !html) {
      throw new Error('body or html content is required');
    }

    const sender = from_email || SENDER_EMAIL;

    // Build Microsoft Graph sendMail payload
    const message = {
      subject: subject,
      body: {
        contentType: html ? 'HTML' : 'Text',
        content: html || body
      },
      toRecipients: recipient_list.map(email => ({
        emailAddress: { address: email }
      }))
    };

    // Add CC recipients if provided
    if (cc && Array.isArray(cc) && cc.length > 0) {
      message.ccRecipients = cc.map(email => ({
        emailAddress: { address: email }
      }));
    }

    // Add BCC recipients if provided
    if (bcc && Array.isArray(bcc) && bcc.length > 0) {
      message.bccRecipients = bcc.map(email => ({
        emailAddress: { address: email }
      }));
    }

    const payload = {
      message,
      saveToSentItems: true
    };

    console.log(`📤 Sending email via Graph API`);
    console.log(`   From: ${sender}`);
    console.log(`   To: ${recipient_list.join(', ')}`);
    console.log(`   Subject: ${subject}`);

    try {
      const token = await this.getAccessToken();

      const response = await fetch(`${GRAPH_API_BASE}/users/${sender}/sendMail`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorBody = await response.text();
        let errorDetail;
        try {
          errorDetail = JSON.parse(errorBody);
        } catch {
          errorDetail = errorBody;
        }
        console.error('❌ Graph API error:', errorDetail);
        throw new Error(`Graph API returned ${response.status}: ${typeof errorDetail === 'object' ? (errorDetail.error?.message || JSON.stringify(errorDetail)) : errorDetail}`);
      }

      // Graph API returns 202 Accepted with no body on success
      console.log('✅ Email sent successfully via Microsoft Graph API');

      return {
        success: true,
        message: 'Email sent successfully via Microsoft Graph API',
        sender: sender,
        accepted: recipient_list,
        rejected: []
      };
    } catch (error) {
      console.error('❌ Failed to send email:', error.message);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  /**
   * Send bulk emails (one email per recipient)
   * @param {Object} options - Email options
   * @param {string} options.from_email - Sender email (optional)
   * @param {string[]} options.recipient_list - Array of recipient emails
   * @param {string} options.subject - Email subject
   * @param {string} options.body - Email body
   * @param {string} options.html - Email body (HTML, optional)
   */
  async sendBulkMail({ from_email, recipient_list, subject, body, html }) {
    this.initialize();

    const results = {
      successful: [],
      failed: []
    };

    for (const recipient of recipient_list) {
      try {
        const result = await this.sendMail({
          from_email,
          recipient_list: [recipient],
          subject,
          body,
          html
        });
        results.successful.push({ recipient, status: 'sent' });
      } catch (error) {
        results.failed.push({ recipient, error: error.message });
      }
    }

    return {
      success: results.failed.length === 0,
      message: `Sent ${results.successful.length}/${recipient_list.length} emails`,
      results
    };
  }

  /**
   * Get mail configuration status (without sensitive data)
   */
  getConfigStatus() {
    return {
      configured: !!(AZURE_CLIENT_ID && AZURE_TENANT_ID && AZURE_CLIENT_SECRET),
      provider: 'Microsoft Graph API (Outlook)',
      sender: SENDER_EMAIL,
      tenantId: AZURE_TENANT_ID,
      clientId: AZURE_CLIENT_ID
    };
  }
}

// Singleton instance
const mailService = new MailService();

module.exports = mailService;
