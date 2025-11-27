// ============================================
// HEALTH CHECK ROUTE
// ============================================

const express = require('express');
const router = express.Router();

// Health check endpoint
router.get('/', (req, res) => {
    const health = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        services: {
            azure_ad: !!process.env.AZURE_CLIENT_ID && !process.env.AZURE_CLIENT_ID.includes('your-'),
            deepseek: !!process.env.DEEPSEEK_API_KEY && !process.env.DEEPSEEK_API_KEY.includes('your-'),
            storage: !!process.env.AZURE_STORAGE_ACCOUNT_NAME && !process.env.AZURE_STORAGE_ACCOUNT_NAME.includes('your-')
        }
    };
    
    res.status(200).json(health);
});

// Detailed health check
router.get('/detailed', (req, res) => {
    const detailed = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        memory: process.memoryUsage(),
        configuration: {
            azure_tenant_configured: !!process.env.AZURE_TENANT_ID && !process.env.AZURE_TENANT_ID.includes('your-'),
            azure_client_configured: !!process.env.AZURE_CLIENT_ID && !process.env.AZURE_CLIENT_ID.includes('your-'),
            deepseek_endpoint_configured: !!process.env.DEEPSEEK_ENDPOINT && !process.env.DEEPSEEK_ENDPOINT.includes('your-'),
            deepseek_key_configured: !!process.env.DEEPSEEK_API_KEY && !process.env.DEEPSEEK_API_KEY.includes('your-'),
            storage_configured: !!process.env.AZURE_STORAGE_ACCOUNT_NAME && !process.env.AZURE_STORAGE_ACCOUNT_NAME.includes('your-')
        }
    };
    
    res.status(200).json(detailed);
});

module.exports = router;
