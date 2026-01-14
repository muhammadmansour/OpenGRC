/**
 * Authentication Middleware
 * Validates JWT tokens and attaches user to request
 */

const { supabase, isSupabaseConfigured } = require('../config/database');

/**
 * Middleware to validate authentication token
 */
async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const userId = req.headers.userid;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'No authorization token provided' 
      });
    }
    
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Invalid authorization header format' 
      });
    }
    
    // Attach token and user info to request
    req.accessToken = token;
    req.userId = userId;
    
    // Optionally validate token with Supabase if configured
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (user) {
          req.user = user;
        }
      } catch (authError) {
        // Token might be from external auth system, continue anyway
        console.log('Token not from Supabase auth, continuing with external token');
      }
    }
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Authentication failed' 
    });
  }
}

/**
 * Optional auth - doesn't fail if no token, but attaches user if present
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      req.accessToken = token;
      req.userId = req.headers.userid;
      
      if (isSupabaseConfigured && supabase) {
        try {
          const { data: { user } } = await supabase.auth.getUser(token);
          if (user) {
            req.user = user;
          }
        } catch (authError) {
          // Continue without user
        }
      }
    }
    
    next();
  } catch (error) {
    // Don't fail, just continue
    next();
  }
}

module.exports = {
  authMiddleware,
  optionalAuth
};
