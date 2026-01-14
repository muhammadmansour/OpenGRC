/**
 * Authentication Routes
 * Handles user authentication endpoints
 */

const express = require('express');
const router = express.Router();
const authService = require('../services/auth.service');
const { asyncHandler } = require('../middleware/error.middleware');
const config = require('../config');

/**
 * @swagger
 * /api/auth/signin:
 *   post:
 *     summary: Authenticate user
 *     description: Sign in with email and password
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: yourpassword
 *     responses:
 *       200:
 *         description: Authentication successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Invalid credentials
 */
router.post('/signin', asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Email and password are required'
    });
  }

  console.log('🔐 User signin request for:', email);

  // Forward to external auth service
  const authEndpoint = `${config.authApiUrl}/auth-kc/signin`;
  
  const response = await fetch(authEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ Auth failed:', response.status, errorText);
    
    return res.status(response.status).json({
      error: 'Authentication Failed',
      message: getAuthErrorMessage(response.status, errorText)
    });
  }

  const authData = await response.json();
  
  console.log('✅ User authenticated successfully');
  
  res.json({
    accessToken: authData.accessToken,
    refreshToken: authData.refreshToken,
    id: authData.id,
    email: authData.email
  });
}));

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     description: Get new access token using refresh token
 *     tags: [Auth]
 *     parameters:
 *       - in: header
 *         name: Authorization
 *         required: true
 *         schema:
 *           type: string
 *         description: Bearer {refresh_token}
 *       - in: header
 *         name: userid
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Invalid or expired refresh token
 */
router.post('/refresh', asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization;
  const userId = req.headers.userid;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'No refresh token provided'
    });
  }

  const refreshToken = authHeader.split(' ')[1];

  console.log('🔄 Token refresh request');

  const response = await fetch(`${config.authApiUrl}/auth-kc/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${refreshToken}`,
      'userid': userId
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ Token refresh failed:', response.status, errorText);
    
    return res.status(response.status).json({
      error: 'Token Refresh Failed',
      message: 'Unable to refresh token'
    });
  }

  const authData = await response.json();
  
  console.log('✅ Token refreshed successfully');
  
  res.json({
    accessToken: authData.accessToken,
    refreshToken: authData.refreshToken,
    id: authData.id,
    email: authData.email
  });
}));

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout user
 *     description: Invalidate user session
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Logged out successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 */
router.post('/logout', asyncHandler(async (req, res) => {
  console.log('User logout request');
  
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
}));

/**
 * @swagger
 * /api/auth/verify:
 *   get:
 *     summary: Verify token
 *     description: Check if access token is valid
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Token is valid
 *       401:
 *         description: Token is invalid or expired
 */
router.get('/verify', asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'No token provided'
    });
  }

  res.json({
    valid: true,
    message: 'Token is valid'
  });
}));

/**
 * Helper function to get friendly auth error messages
 */
function getAuthErrorMessage(status, errorText) {
  switch (status) {
    case 400:
      return 'Invalid credentials format';
    case 401:
      return 'Invalid email or password';
    case 403:
      return 'Account is disabled';
    case 404:
      return 'Authentication service unavailable';
    case 429:
      return 'Too many login attempts. Please try again later';
    case 500:
    case 502:
    case 503:
    case 504:
      return 'Authentication service is temporarily unavailable';
    default:
      return errorText || `Authentication failed (${status})`;
  }
}

module.exports = router;
