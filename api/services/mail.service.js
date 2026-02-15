/**
 * Mail Service
 * Handles email sending using Nodemailer via Outlook / Microsoft 365 SMTP
 */

const nodemailer = require('nodemailer');

class MailService {
  constructor() {
    this.transporter = null;
    this.initialized = false;
  }

  /**
   * Initialize the mail transporter (Outlook / Microsoft 365)
   */
  initialize() {
    if (this.initialized) {
      return;
    }

    const host = process.env.EMAIL_HOST || 'smtp.office365.com';
    const port = parseInt(process.env.EMAIL_PORT) || 587;
    const user = process.env.EMAIL_HOST_USER || 'info@wathbahs.com';
    const pass = process.env.EMAIL_HOST_PASSWORD || 'Saudi2030+';

    const config = {
      host,
      port,
      secure: port === 465, // true for 465, false for 587 (STARTTLS)
      auth: {
        user,
        pass
      },
      tls: {
        ciphers: 'SSLv3',
        rejectUnauthorized: false
      }
    };

    this.transporter = nodemailer.createTransport(config);
    this.defaultFrom = process.env.DEFAULT_FROM_EMAIL || user;
    this.initialized = true;

    console.log(`📧 Mail service initialized (${host}:${port}, user: ${user})`);
  }

  /**
   * Verify the mail connection
   */
  async verifyConnection() {
    this.initialize();

    try {
      await this.transporter.verify();
      console.log('✅ Mail server connection verified');
      return { success: true, message: 'Mail server connection verified' };
    } catch (error) {
      console.error('❌ Mail server connection failed:', error.message);
      throw new Error(`Mail server connection failed: ${error.message}`);
    }
  }

  /**
   * Send an email
   * @param {Object} options - Email options
   * @param {string} options.from_email - Sender email (optional, uses default)
   * @param {string[]} options.recipient_list - Array of recipient emails
   * @param {string} options.subject - Email subject
   * @param {string} options.body - Email body (plain text)
   * @param {string} options.html - Email body (HTML, optional)
   */
  async sendMail({ from_email, recipient_list, subject, body, html }) {
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

    const mailOptions = {
      from: from_email || this.defaultFrom,
      to: recipient_list.join(', '),
      subject: subject,
      text: body
    };

    // Add HTML content if provided
    if (html) {
      mailOptions.html = html;
    }

    console.log(`📤 Sending email to: ${recipient_list.join(', ')}`);
    console.log(`   Subject: ${subject}`);

    try {
      const info = await this.transporter.sendMail(mailOptions);
      
      console.log('✅ Email sent successfully');
      console.log(`   Message ID: ${info.messageId}`);

      return {
        success: true,
        message: 'Email sent successfully',
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected
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
        results.successful.push({ recipient, messageId: result.messageId });
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
    const user = process.env.EMAIL_HOST_USER || 'info@wathbahs.com';
    return {
      configured: true,
      host: process.env.EMAIL_HOST || 'smtp.office365.com',
      port: process.env.EMAIL_PORT || '587',
      useTls: true,
      defaultFrom: process.env.DEFAULT_FROM_EMAIL || user
    };
  }
}

// Singleton instance
const mailService = new MailService();

module.exports = mailService;
