// ============================================
// DEEPSEEK AI ROUTES
// ============================================

const express = require('express');
const router = express.Router();
const axios = require('axios');

// DeepSeek configuration
const getDeepSeekConfig = (model = 'v3') => {
    const deploymentName = model === 'r1' 
        ? process.env.DEEPSEEK_DEPLOYMENT_R1 
        : process.env.DEEPSEEK_DEPLOYMENT_V3;
    
    return {
        endpoint: process.env.DEEPSEEK_ENDPOINT,
        apiKey: process.env.DEEPSEEK_API_KEY,
        deploymentName: deploymentName,
        apiVersion: process.env.DEEPSEEK_API_VERSION || '2024-08-01-preview'
    };
};

// Validate DeepSeek configuration
const validateConfig = (res) => {
    const config = getDeepSeekConfig();
    
    if (!config.endpoint || config.endpoint.includes('your-')) {
        res.status(503).json({
            error: 'DeepSeek not configured',
            message: 'Please configure DEEPSEEK_ENDPOINT in your .env file',
            mock: true
        });
        return false;
    }
    
    if (!config.apiKey || config.apiKey.includes('your-')) {
        res.status(503).json({
            error: 'DeepSeek API key not configured',
            message: 'Please configure DEEPSEEK_API_KEY in your .env file',
            mock: true
        });
        return false;
    }
    
    return true;
};

// Chat completion endpoint
router.post('/chat', async (req, res) => {
    try {
        const { messages, model = 'v3', temperature = 0.7, max_tokens = 4096 } = req.body;
        
        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({
                error: 'Invalid request',
                message: 'messages array is required'
            });
        }
        
        // Validate configuration
        if (!validateConfig(res)) {
            // Return mock response for development
            return res.json(getMockResponse(messages, model));
        }
        
        const config = getDeepSeekConfig(model);
        const url = `${config.endpoint}openai/deployments/${config.deploymentName}/chat/completions?api-version=${config.apiVersion}`;
        
        console.log(`[DeepSeek] Sending request to ${config.deploymentName}`);
        
        const response = await axios.post(url, {
            messages: messages,
            max_tokens: max_tokens,
            temperature: temperature,
            top_p: 0.95,
            stream: false
        }, {
            headers: {
                'Content-Type': 'application/json',
                'api-key': config.apiKey
            },
            timeout: 60000 // 60 seconds timeout
        });
        
        const result = {
            content: response.data.choices[0].message.content,
            model: config.deploymentName,
            tokens: {
                prompt: response.data.usage?.prompt_tokens || 0,
                completion: response.data.usage?.completion_tokens || 0,
                total: response.data.usage?.total_tokens || 0
            },
            finishReason: response.data.choices[0].finish_reason,
            mock: false
        };
        
        console.log(`[DeepSeek] Response received. Tokens: ${result.tokens.total}`);
        
        res.json(result);
        
    } catch (error) {
        console.error('[DeepSeek] Error:', error.response?.data || error.message);
        
        // Return mock response on error
        if (error.response?.status === 401) {
            res.status(401).json({
                error: 'Authentication failed',
                message: 'Invalid API key. Please check your DEEPSEEK_API_KEY in .env file',
                mock: true,
                ...getMockResponse(req.body.messages, req.body.model)
            });
        } else if (error.response?.status === 404) {
            res.status(404).json({
                error: 'Deployment not found',
                message: 'Check your DEEPSEEK_DEPLOYMENT_V3 or DEEPSEEK_DEPLOYMENT_R1 in .env file',
                mock: true,
                ...getMockResponse(req.body.messages, req.body.model)
            });
        } else {
            res.status(500).json({
                error: 'DeepSeek API error',
                message: error.message,
                mock: true,
                ...getMockResponse(req.body.messages, req.body.model)
            });
        }
    }
});

// Get available models
router.get('/models', (req, res) => {
    const models = {
        v3: {
            name: process.env.DEEPSEEK_DEPLOYMENT_V3 || 'deepseek-v3',
            displayName: 'DeepSeek V3',
            maxTokens: 4096,
            description: 'Modelo estándar de DeepSeek para consultas generales'
        },
        r1: {
            name: process.env.DEEPSEEK_DEPLOYMENT_R1 || 'deepseek-r1',
            displayName: 'DeepSeek R1 (DeepThink)',
            maxTokens: 8192,
            description: 'Modelo avanzado con razonamiento profundo paso a paso'
        }
    };
    
    res.json({
        models: models,
        configured: validateConfig({ status: () => ({ json: () => {} }) })
    });
});

// Mock response generator
function getMockResponse(messages, model) {
    const lastMessage = messages[messages.length - 1];
    const modelName = model === 'r1' ? 'DeepSeek R1 (DeepThink)' : 'DeepSeek V3';
    
    const mockResponses = {
        'v3': `[${modelName} - Modo Demo]

He recibido tu consulta: "${lastMessage.content}"

Esta es una respuesta simulada porque el servidor no pudo conectarse con Azure AI Foundry.

**Para habilitar la API real:**
1. Configura DEEPSEEK_ENDPOINT en tu archivo .env
2. Configura DEEPSEEK_API_KEY con tu API key válida
3. Verifica que DEEPSEEK_DEPLOYMENT_V3 tenga el nombre correcto de tu deployment
4. Reinicia el servidor

**Funcionalidades disponibles en modo real:**
✓ Análisis de documentos cargados
✓ Respuestas contextuales precisas
✓ Resúmenes inteligentes
✓ Consultas técnicas avanzadas`,

        'r1': `[${modelName} - Modo Demo]

🤔 **Análisis DeepThink de tu consulta...**

**Razonamiento paso a paso:**
1. Identificación del problema: "${lastMessage.content}"
2. Análisis contextual de requisitos
3. Evaluación de posibles enfoques
4. Validación lógica de conclusiones

**Conclusión:**
Esta es una respuesta de demostración. DeepSeek R1 proporciona razonamiento profundo y detallado en modo producción.

**Configuración necesaria para modo real:**
• Azure AI Foundry endpoint configurado
• API key válida en variables de entorno
• Deployment R1 activo y accesible`
    };
    
    return {
        content: mockResponses[model] || mockResponses['v3'],
        model: modelName,
        tokens: { prompt: 0, completion: 0, total: 0 },
        finishReason: 'stop',
        mock: true
    };
}

module.exports = router;
