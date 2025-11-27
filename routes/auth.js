// ============================================
// AUTHENTICATION ROUTES
// ============================================

const express = require('express');
const router = express.Router();
const { ClientSecretCredential } = require('@azure/identity');

// Get Azure AD configuration for client
router.get('/config', (req, res) => {
    try {
        const config = {
            tenantId: process.env.AZURE_TENANT_ID,
            clientId: process.env.AZURE_CLIENT_ID,
            redirectUri: process.env.AZURE_REDIRECT_URI || 'http://localhost:3000/auth/callback',
            scopes: ['openid', 'profile', 'email', 'User.Read']
        };
        
        // Validate configuration
        if (!config.tenantId || config.tenantId.includes('your-')) {
            return res.status(503).json({
                error: 'Azure AD not configured',
                message: 'Please configure AZURE_TENANT_ID in your .env file'
            });
        }
        
        res.json(config);
    } catch (error) {
        console.error('Error getting auth config:', error);
        res.status(500).json({
            error: 'Configuration error',
            message: error.message
        });
    }
});

// Verify token (for backend validation)
router.post('/verify', async (req, res) => {
    try {
        const { token } = req.body;
        
        if (!token) {
            return res.status(400).json({
                error: 'Token required',
                message: 'No token provided in request body'
            });
        }
        
        // Here you would validate the token with Azure AD
        // For now, we'll return success if token exists
        // TODO: Implement proper token validation with @azure/msal-node
        
        res.json({
            valid: true,
            message: 'Token is valid'
        });
    } catch (error) {
        console.error('Error verifying token:', error);
        res.status(401).json({
            error: 'Invalid token',
            message: error.message
        });
    }
});

// Login endpoint (for credential-based login)
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({
                error: 'Missing credentials',
                message: 'Email and password are required'
            });
        }
        
        // TODO: Implement actual authentication logic
        // For now, return a mock user for development
        const user = {
            email: email,
            name: email.split('@')[0],
            avatar: email[0].toUpperCase(),
            provider: 'credentials',
            authenticated: true
        };
        
        res.json({
            success: true,
            user: user,
            message: 'Login successful (development mode)'
        });
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({
            error: 'Login failed',
            message: error.message
        });
    }
});

// Logout endpoint
router.post('/logout', (req, res) => {
    try {
        // Clear any server-side session data here
        res.json({
            success: true,
            message: 'Logout successful'
        });
    } catch (error) {
        console.error('Error during logout:', error);
        res.status(500).json({
            error: 'Logout failed',
            message: error.message
        });
    }
});

module.exports = router;
