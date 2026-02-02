/**
 * Mail Routes
 * Handles email sending endpoints
 */

const express = require('express');
const router = express.Router();
const mailService = require('../services/mail.service');
const { asyncHandler } = require('../middleware/error.middleware');

/**
 * @swagger
 * tags:
 *   name: Mail
 *   description: Email sending endpoints
 */

/**
 * @swagger
 * /api/mail/send:
 *   post:
 *     summary: Send an email
 *     description: Send an email to one or more recipients
 *     tags: [Mail]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - recipient_list
 *               - subject
 *               - body
 *             properties:
 *               from_email:
 *                 type: string
 *                 format: email
 *                 description: Sender email address (optional, uses default if not provided)
 *                 example: "mansourmuhammad37@gmail.com"
 *               recipient_list:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: email
 *                 description: List of recipient email addresses
 *                 example: ["mansourmuhammad7@gmail.com"]
 *               subject:
 *                 type: string
 *                 description: Email subject
 *                 example: "CISO Assistant: You have been assigned to 'Applied Control 1'"
 *               body:
 *                 type: string
 *                 description: Email body (plain text)
 *                 example: "Hello,\n\nYou have been assigned to the following Control:..."
 *               html:
 *                 type: string
 *                 description: Email body (HTML, optional)
 *     responses:
 *       200:
 *         description: Email sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Email sent successfully"
 *                 messageId:
 *                   type: string
 *                   example: "<abc123@gmail.com>"
 *       400:
 *         description: Validation error
 *       500:
 *         description: Failed to send email
 */
router.post('/send', asyncHandler(async (req, res) => {
  const { from_email, recipient_list, subject, body, html } = req.body;

  // Validation
  if (!recipient_list || !Array.isArray(recipient_list) || recipient_list.length === 0) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'recipient_list is required and must be a non-empty array of email addresses'
    });
  }

  if (!subject) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'subject is required'
    });
  }

  if (!body && !html) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'body or html content is required'
    });
  }

  // Validate email formats
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const invalidEmails = recipient_list.filter(email => !emailRegex.test(email));
  
  if (invalidEmails.length > 0) {
    return res.status(400).json({
      error: 'Validation Error',
      message: `Invalid email format: ${invalidEmails.join(', ')}`
    });
  }

  console.log('📧 Mail send request received');

  const result = await mailService.sendMail({
    from_email,
    recipient_list,
    subject,
    body,
    html
  });

  res.json(result);
}));

/**
 * @swagger
 * /api/mail/send-bulk:
 *   post:
 *     summary: Send bulk emails
 *     description: Send individual emails to multiple recipients (one email per recipient)
 *     tags: [Mail]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - recipient_list
 *               - subject
 *               - body
 *             properties:
 *               from_email:
 *                 type: string
 *                 format: email
 *               recipient_list:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: email
 *               subject:
 *                 type: string
 *               body:
 *                 type: string
 *               html:
 *                 type: string
 *     responses:
 *       200:
 *         description: Bulk email results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 results:
 *                   type: object
 *                   properties:
 *                     successful:
 *                       type: array
 *                       items:
 *                         type: object
 *                     failed:
 *                       type: array
 *                       items:
 *                         type: object
 */
router.post('/send-bulk', asyncHandler(async (req, res) => {
  const { from_email, recipient_list, subject, body, html } = req.body;

  // Validation
  if (!recipient_list || !Array.isArray(recipient_list) || recipient_list.length === 0) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'recipient_list is required and must be a non-empty array'
    });
  }

  if (!subject) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'subject is required'
    });
  }

  if (!body && !html) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'body or html content is required'
    });
  }

  console.log(`📧 Bulk mail request received for ${recipient_list.length} recipients`);

  const result = await mailService.sendBulkMail({
    from_email,
    recipient_list,
    subject,
    body,
    html
  });

  res.json(result);
}));

/**
 * @swagger
 * /api/mail/verify:
 *   get:
 *     summary: Verify mail connection
 *     description: Test the connection to the mail server
 *     tags: [Mail]
 *     responses:
 *       200:
 *         description: Connection verified
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       500:
 *         description: Connection failed
 */
router.get('/verify', asyncHandler(async (req, res) => {
  console.log('📧 Mail verification request');
  
  const result = await mailService.verifyConnection();
  res.json(result);
}));

/**
 * @swagger
 * /api/mail/status:
 *   get:
 *     summary: Get mail configuration status
 *     description: Check if mail service is configured (does not expose credentials)
 *     tags: [Mail]
 *     responses:
 *       200:
 *         description: Configuration status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 configured:
 *                   type: boolean
 *                 host:
 *                   type: string
 *                 port:
 *                   type: string
 *                 useTls:
 *                   type: boolean
 *                 defaultFrom:
 *                   type: string
 */
router.get('/status', asyncHandler(async (req, res) => {
  const status = mailService.getConfigStatus();
  res.json(status);
}));

module.exports = router;
