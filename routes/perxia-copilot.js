// ============================================
// PERXIA COPILOT - STANDARD MODEL ROUTES
// Modelo estándar para consultas generales
// Usa OpenAI SDK con Azure AI Foundry
// Incluye RAG (Retrieval-Augmented Generation)
// Incluye Hub Search (Casos de Éxito, PoCs)
// ============================================

const express = require('express');
const router = express.Router();
const { AzureOpenAI } = require('openai');
const searchService = require('../services/search-service');
const hubSearchService = require('../server/services/hub-search-service');

// Configuration for standard model (DeepSeek V3.1)
const getConfig = () => ({
    endpoint: process.env.DEEPSEEK_ENDPOINT,
    apiKey: process.env.DEEPSEEK_API_KEY,
    deploymentName: process.env.DEEPSEEK_DEPLOYMENT_V3 || 'DeepSeek-V3.1',
    apiVersion: process.env.DEEPSEEK_API_VERSION || '2024-05-01-preview'
});

// Validate configuration
const validateConfig = () => {
    const config = getConfig();
    
    if (!config.endpoint || config.endpoint.includes('your-')) {
        return { valid: false, error: 'DEEPSEEK_ENDPOINT not configured' };
    }
    
    if (!config.apiKey || config.apiKey.includes('your-')) {
        return { valid: false, error: 'DEEPSEEK_API_KEY not configured' };
    }
    
    return { valid: true, config };
};

// Create Azure OpenAI client
const createClient = (config) => {
    return new AzureOpenAI({
        endpoint: config.endpoint,
        apiKey: config.apiKey,
        apiVersion: config.apiVersion,
        deployment: config.deploymentName
    });
};

// System prompt for Perxia Copilot
const SYSTEM_PROMPT = `Eres Perxia Copilot, un asistente de IA corporativo profesional y amigable.

Tu rol es:
- Responder consultas de manera clara, concisa y profesional
- Ayudar con análisis de documentos y datos
- Proporcionar resúmenes ejecutivos cuando se soliciten
- Ofrecer información precisa y útil

Directrices:
- Usa un tono profesional pero accesible
- Estructura tus respuestas de forma clara
- Si no sabes algo, admítelo honestamente
- Responde siempre en español a menos que se indique lo contrario
- Cuando uses información de documentos, indica de qué documento proviene`;

// Build context from RAG search results
const buildDocumentContext = (searchResults) => {
    if (!searchResults || searchResults.length === 0) {
        return '';
    }

    let context = '\n\n📄 **CONTEXTO DE DOCUMENTOS RELEVANTES:**\n\n';
    
    searchResults.forEach((result, index) => {
        context += `---\n`;
        context += `**Documento ${index + 1}:** ${result.filename}\n`;
        context += `**Relevancia:** ${(result.score * 100).toFixed(1)}%\n`;
        context += `**Contenido:**\n${result.content}\n\n`;
    });

    context += '---\n\nUsa la información anterior para responder la consulta del usuario cuando sea relevante.';
    
    return context;
};

// Search for relevant documents using text search (low memory usage)
const searchDocuments = async (query, maxResults = 5) => {
    try {
        // Usar textSearch en vez de hybridSearch para evitar problemas de memoria
        const results = await searchService.textSearch(query, {
            top: maxResults
        });
        
        if (results && results.length > 0) {
            console.log(`[RAG] Found ${results.length} relevant documents`);
            return results;
        }
        
        return [];
    } catch (error) {
        console.log(`[RAG] Search error (non-blocking): ${error.message}`);
        return [];
    }
};

// Detectar si la pregunta es sobre casos de éxito, PoCs, herramientas de Periferia IT
const shouldSearchHub = (query) => {
    const queryLower = query.toLowerCase();
    const hubKeywords = [
        'caso de éxito', 'casos de éxito', 'caso de exito', 'casos de exito',
        'poc', 'pocs', 'pov', 'povs', 'proof of concept', 'proof of value',
        'herramienta', 'herramientas', 'proyecto', 'proyectos',
        'periferia it', 'periferia', 'cliente', 'clientes',
        'qué se ha hecho', 'que se ha hecho', 'qué proyectos', 'que proyectos',
        'qué casos', 'que casos', 'experiencia con', 'trabajado con',
        'implementación', 'implementacion', 'desarrollado',
        'semillero', 'semilleros'
    ];
    
    return hubKeywords.some(keyword => queryLower.includes(keyword));
};

// Buscar en el Hub (Casos de Éxito, PoCs, etc.)
const searchHubContext = async (query, maxResults = 5) => {
    try {
        if (!hubSearchService || !hubSearchService.client) {
            console.log('[Hub RAG] Hub Search Service no disponible');
            return { context: '', items: [] };
        }
        
        const results = await hubSearchService.searchForContext(query, maxResults);
        
        if (results.success && results.items && results.items.length > 0) {
            console.log(`[Hub RAG] Found ${results.items.length} relevant items from Hub`);
            return {
                context: results.context,
                items: results.items.map(item => ({
                    title: item.enrichedTitle || 'Sin título',
                    type: item.enrichedType || 'documento',
                    tags: item.enrichedTags || []
                }))
            };
        }
        
        return { context: '', items: [] };
    } catch (error) {
        console.log(`[Hub RAG] Search error (non-blocking): ${error.message}`);
        return { context: '', items: [] };
    }
};

// Build context from Hub search results
const buildHubContext = (hubResult) => {
    if (!hubResult.context) {
        return '';
    }

    let context = '\n\n🏆 **CONTEXTO DE CASOS DE ÉXITO Y PROYECTOS DE PERIFERIA IT:**\n\n';
    context += hubResult.context;
    context += '\n\n---\n\nUsa esta información sobre casos de éxito, PoCs y proyectos de Periferia IT para responder cuando sea relevante.';
    
    return context;
};

// Chat completion endpoint with RAG
router.post('/chat', async (req, res) => {
    try {
        const { messages, temperature = 0.7, max_tokens = 4096, useRAG = true } = req.body;
        
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid request',
                message: 'El array de mensajes es requerido'
            });
        }
        
        const validation = validateConfig();
        
        if (!validation.valid) {
            console.log('[Perxia Copilot] Config not valid:', validation.error);
            return res.json(getMockResponse(messages));
        }
        
        const config = validation.config;
        
        console.log(`[Perxia Copilot] Endpoint: ${config.endpoint}`);
        console.log(`[Perxia Copilot] Deployment: ${config.deploymentName}`);
        console.log(`[Perxia Copilot] RAG Enabled: ${useRAG}`);
        
        // Get the last user message for RAG search
        const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
        let documentContext = '';
        let hubContext = '';
        let ragResults = [];
        let hubResults = { context: '', items: [] };
        
        // Perform RAG search if enabled
        if (useRAG && lastUserMessage) {
            const userQuery = lastUserMessage.content;
            console.log(`[Perxia Copilot] Searching documents for: "${userQuery.substring(0, 50)}..."`);
            
            // Búsqueda en documentos del usuario
            ragResults = await searchDocuments(userQuery, 5);
            documentContext = buildDocumentContext(ragResults);
            
            // Búsqueda en Hub (Casos de Éxito, PoCs) si la pregunta lo amerita
            if (shouldSearchHub(userQuery)) {
                console.log(`[Perxia Copilot] Query matches Hub keywords, searching Hub...`);
                hubResults = await searchHubContext(userQuery, 5);
                hubContext = buildHubContext(hubResults);
            }
        }
        
        // Create OpenAI client for Azure
        const client = createClient(config);
        
        // Prepare messages with system prompt, document context, and hub context
        const systemPromptWithContext = SYSTEM_PROMPT + documentContext + hubContext;
        const fullMessages = [
            { role: 'system', content: systemPromptWithContext },
            ...messages
        ];
        
        console.log(`[Perxia Copilot] Sending request...`);
        
        const response = await client.chat.completions.create({
            model: config.deploymentName,
            messages: fullMessages,
            max_tokens: max_tokens,
            temperature: temperature,
            top_p: 0.95
        });
        
        const hubItemsUsed = hubResults.items.length > 0;
        const result = {
            success: true,
            content: response.choices[0].message.content,
            model: 'Perxia Copilot',
            tokens: {
                prompt: response.usage?.prompt_tokens || 0,
                completion: response.usage?.completion_tokens || 0,
                total: response.usage?.total_tokens || 0
            },
            finishReason: response.choices[0].finish_reason,
            mock: false,
            ragUsed: useRAG && (ragResults.length > 0 || hubItemsUsed),
            documentsUsed: ragResults.length > 0 ? ragResults.map(r => ({
                filename: r.filename,
                score: r.score
            })) : [],
            hubUsed: hubItemsUsed,
            hubItemsUsed: hubResults.items
        };
        
        console.log(`[Perxia Copilot] Response received. Tokens: ${result.tokens.total}, RAG docs: ${ragResults.length}, Hub items: ${hubResults.items.length}`);
        
        res.json(result);
        
    } catch (error) {
        console.error('[Perxia Copilot] Error:', error.message);
        console.error('[Perxia Copilot] Full error:', error);
        
        // Return mock response on error for development
        if (process.env.NODE_ENV !== 'production') {
            return res.json(getMockResponse(req.body.messages, error.message));
        }
        
        res.status(500).json({
            success: false,
            error: 'API Error',
            message: error.message
        });
    }
});

// Get model info
router.get('/info', (req, res) => {
    const validation = validateConfig();
    
    res.json({
        name: 'Perxia Copilot',
        description: 'Asistente de IA estándar para consultas generales',
        deployment: process.env.DEEPSEEK_DEPLOYMENT_V3,
        maxTokens: 4096,
        configured: validation.valid,
        features: [
            'Análisis de documentos',
            'Búsqueda inteligente',
            'Lenguaje natural',
            'Resúmenes ejecutivos'
        ]
    });
});

// Mock response generator
function getMockResponse(messages, errorMsg = null) {
    const lastMessage = messages[messages.length - 1];
    const userQuery = lastMessage?.content || 'tu consulta';
    
    const errorInfo = errorMsg ? `\n\n**Error técnico:** ${errorMsg}` : '';
    
    const mockContent = `¡Hola! Soy **Perxia Copilot**, tu asistente de IA.

He recibido tu mensaje: "${userQuery.substring(0, 100)}${userQuery.length > 100 ? '...' : ''}"

---

📋 **Modo Demostración**

Actualmente estoy funcionando en modo demo.${errorInfo}

**Para activar el modo completo:**
1. Verifica que el deployment \`${process.env.DEEPSEEK_DEPLOYMENT_V3}\` exista en Azure AI Foundry
2. Confirma que el endpoint y API key sean correctos
3. Reinicia el servidor

¿En qué más puedo ayudarte?`;

    return {
        success: true,
        content: mockContent,
        model: 'Perxia Copilot',
        tokens: { prompt: 0, completion: 0, total: 0 },
        finishReason: 'stop',
        mock: true
    };
}

module.exports = router;
