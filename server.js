// ============================================
// PERXIA HELP - EXPRESS SERVER
// ============================================

const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Load environment variables
dotenv.config();

// Import routes
const authRoutes = require('./routes/auth');
const deepseekRoutes = require('./routes/deepseek');
const storageRoutes = require('./routes/storage');
const healthRoutes = require('./routes/health');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// ===== Middleware =====

// Security headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://alcdn.msauth.net"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https://login.microsoftonline.com", process.env.DEEPSEEK_ENDPOINT],
            frameSrc: ["'self'", "https://copilotstudio.microsoft.com"]
        }
    }
}));

// CORS configuration
const corsOptions = {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:8080'],
    credentials: true,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());

// Logging
if (process.env.NODE_ENV !== 'production') {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined'));
}

// Rate limiting - más permisivo para desarrollo
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 1 * 60 * 1000, // 1 minuto
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 500, // 500 peticiones por minuto
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // No aplicar rate limit a rutas de autenticación en desarrollo
        return process.env.NODE_ENV === 'development' && req.path.startsWith('/auth/');
    }
});
app.use('/api/', limiter);

// ===== Routes =====

// Health check
app.use('/api/health', healthRoutes);

// Authentication
app.use('/api/auth', authRoutes);

// DeepSeek AI
app.use('/api/deepseek', deepseekRoutes);

// Storage
app.use('/api/storage', storageRoutes);

// Serve static files (client)
app.use(express.static(path.join(__dirname, 'client')));

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, 'client', 'index.html'));
    } else {
        res.status(404).json({ error: 'API endpoint not found' });
    }
});

// ===== Error Handling =====

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: 'The requested resource was not found on this server.'
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    
    const statusCode = err.statusCode || 500;
    const message = process.env.NODE_ENV === 'production' 
        ? 'Internal Server Error' 
        : err.message;
    
    res.status(statusCode).json({
        error: message,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    });
});

// ===== Start Server =====

app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                    PERXIA HELP SERVER                     ║
╚═══════════════════════════════════════════════════════════╝

🚀 Server running on: http://localhost:${PORT}
🌍 Environment: ${process.env.NODE_ENV || 'development'}
📝 Client URL: ${process.env.CLIENT_URL || 'http://localhost:8080'}
🔒 CORS Origins: ${process.env.ALLOWED_ORIGINS || 'http://localhost:8080'}

API Endpoints:
  • Health: http://localhost:${PORT}/api/health
  • Auth: http://localhost:${PORT}/api/auth
  • DeepSeek: http://localhost:${PORT}/api/deepseek
  • Storage: http://localhost:${PORT}/api/storage

⚠️  Make sure you have configured your .env file!
    `);
    
    // Validate critical environment variables
    const requiredEnvVars = [
        'AZURE_TENANT_ID',
        'AZURE_CLIENT_ID',
        'DEEPSEEK_ENDPOINT',
        'DEEPSEEK_API_KEY'
    ];
    
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName] || process.env[varName].includes('your-'));
    
    if (missingVars.length > 0) {
        console.warn('\n⚠️  WARNING: Missing or incomplete environment variables:');
        missingVars.forEach(varName => {
            console.warn(`   - ${varName}`);
        });
        console.warn('\n   Please configure these in your .env file for full functionality.\n');
    } else {
        console.log('✅ All critical environment variables are configured.\n');
    }
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});

module.exports = app;
