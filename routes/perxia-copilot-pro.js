// ============================================
// PERXIA COPILOT PRO - PREMIUM MODEL ROUTES
// Modelo avanzado con razonamiento profundo
// Usa OpenAI SDK con Azure AI Foundry
// Incluye RAG (Retrieval-Augmented Generation)
// Incluye Hub Search (Casos de Éxito, PoCs)
// ============================================

const express = require('express');
const router = express.Router();
const { AzureOpenAI } = require('openai');
const searchService = require('../services/search-service');
const hubSearchService = require('../server/services/hub-search-service');

// Configuration for premium model (DeepSeek R1)
const getConfig = () => ({
    endpoint: process.env.DEEPSEEK_ENDPOINT,
    apiKey: process.env.DEEPSEEK_API_KEY,
    deploymentName: process.env.DEEPSEEK_DEPLOYMENT_R1 || 'DeepSeek-R1-0528',
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

// System prompt for Perxia Copilot Pro
const SYSTEM_PROMPT = `Eres Perxia Copilot Pro, un asistente de IA premium de Periferia IT con capacidades avanzadas de razonamiento.

Tu rol es:
- Proporcionar análisis profundos y detallados
- Razonar paso a paso para resolver problemas complejos
- Ofrecer insights estratégicos sobre casos de éxito y proyectos de Periferia IT
- Abordar consultas técnicas avanzadas con precisión

MUY IMPORTANTE sobre Casos de Éxito y PoCs:
- Cuando se te proporcione información de CASOS DE ÉXITO o PoCs, son PROYECTOS REALES realizados por Periferia IT
- Los títulos pueden ser nombres de clientes, empresas o proyectos (NO confundir con información general)
- Por ejemplo: si el título es "Colombia" o "Bancolombia", se refiere a un CLIENTE o PROYECTO, no al país
- SIEMPRE basa tu análisis en el contenido del caso de éxito, NO en conocimiento general
- Analiza qué se hizo, qué tecnologías se usaron, y cuáles fueron los resultados

Directrices:
- Usa razonamiento estructurado (paso a paso) cuando sea apropiado
- Proporciona análisis más profundos y detallados
- Considera múltiples perspectivas antes de concluir
- Fundamenta tus respuestas con lógica clara
- Responde siempre en español a menos que se indique lo contrario
- Cuando uses información de casos de éxito, cita el proyecto específico

Cuando sea apropiado, estructura tu respuesta así:
1. **Análisis del proyecto**: Identificación de aspectos clave
2. **Razonamiento**: Evaluación de tecnologías y resultados
3. **Conclusión**: Resumen con insights estratégicos`;

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

    context += '---\n\nAnaliza la información anterior de forma crítica y úsala para responder la consulta del usuario.';
    
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
            console.log(`[RAG Pro] Found ${results.length} relevant documents`);
            return results;
        }
        
        return [];
    } catch (error) {
        console.log(`[RAG Pro] Search error (non-blocking): ${error.message}`);
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
        'semillero', 'semilleros',
        // Keywords para prompts desde tarjetas del Hub
        'cuéntame sobre', 'cuentame sobre', 'información sobre', 'informacion sobre',
        'qué se hizo', 'que se hizo', 'qué tecnologías', 'que tecnologias',
        'resultados', 'dame más información', 'dame mas informacion'
    ];
    
    return hubKeywords.some(keyword => queryLower.includes(keyword));
};

// Extraer título de proyecto del prompt cuando viene de tarjeta del Hub
const extractProjectTitle = (query) => {
    // Patrones para detectar prompts de tarjetas del Hub
    const patterns = [
        /cuéntame sobre (?:el|la)?\s*(?:caso de éxito|poc|pov|herramienta|proyecto)?\s*"([^"]+)"/i,
        /cuentame sobre (?:el|la)?\s*(?:caso de éxito|poc|pov|herramienta|proyecto)?\s*"([^"]+)"/i,
        /información sobre[:\s]*"?([^"?.]+)"?/i,
        /informacion sobre[:\s]*"?([^"?.]+)"?/i,
        /dame más información sobre[:\s]*"?([^"?.]+)"?/i,
        /dame mas información sobre[:\s]*"?([^"?.]+)"?/i,
    ];
    
    for (const pattern of patterns) {
        const match = query.match(pattern);
        if (match && match[1]) {
            const title = match[1].trim();
            // Limpiar sufijos comunes
            return title.replace(/\s+de Periferia IT.*$/i, '').trim();
        }
    }
    return null;
};

// Buscar en el Hub (Casos de Éxito, PoCs, etc.)
const searchHubContext = async (query, maxResults = 5) => {
    try {
        if (!hubSearchService || !hubSearchService.client) {
            console.log('[Hub RAG Pro] Hub Search Service no disponible');
            return { context: '', items: [] };
        }
        
        // Detectar si es un prompt de tarjeta del Hub y extraer título específico
        const projectTitle = extractProjectTitle(query);
        let searchQuery = query;
        
        if (projectTitle) {
            // Buscar primero por título exacto
            console.log(`[Hub RAG Pro] Detected Hub card prompt, searching for: "${projectTitle}"`);
            searchQuery = projectTitle;
        }
        
        let results = await hubSearchService.searchForContext(searchQuery, maxResults);
        
        // Si no encontró con título exacto, buscar con query original
        if (projectTitle && (!results.success || results.items.length === 0)) {
            console.log(`[Hub RAG Pro] No results with exact title, trying original query`);
            results = await hubSearchService.searchForContext(query, maxResults);
        }
        
        if (results.success && results.items && results.items.length > 0) {
            console.log(`[Hub RAG Pro] Found ${results.items.length} relevant items from Hub`);
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
        console.log(`[Hub RAG Pro] Search error (non-blocking): ${error.message}`);
        return { context: '', items: [] };
    }
};

// Build context from Hub search results
const buildHubContext = (hubResult) => {
    if (!hubResult.context) {
        return '';
    }

    let context = '\n\n🏆 **INFORMACIÓN DE PROYECTOS REALES DE PERIFERIA IT:**\n';
    context += '⚠️ IMPORTANTE: Los siguientes son CASOS DE ÉXITO y PROYECTOS REALES. Los títulos son nombres de CLIENTES o PROYECTOS, NO temas generales.\n';
    context += 'Basa tu análisis ÚNICAMENTE en esta información, NO en conocimiento general.\n\n';
    context += hubResult.context;
    context += '\n\n---\n\n📌 INSTRUCCIÓN: Analiza qué hizo Periferia IT en estos proyectos, las tecnologías implementadas, los desafíos resueltos y los resultados obtenidos. NO proporciones información general sobre los títulos.';
    
    return context;
};

// Chat completion endpoint with RAG
router.post('/chat', async (req, res) => {
    try {
        const { messages, temperature = 0.5, max_tokens = 8192, useRAG = true } = req.body;
        
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid request',
                message: 'El array de mensajes es requerido'
            });
        }
        
        const validation = validateConfig();
        
        if (!validation.valid) {
            console.log('[Perxia Copilot Pro] Config not valid:', validation.error);
            return res.json(getMockResponse(messages));
        }
        
        const config = validation.config;
        
        console.log(`[Perxia Copilot Pro] Endpoint: ${config.endpoint}`);
        console.log(`[Perxia Copilot Pro] Deployment: ${config.deploymentName}`);
        console.log(`[Perxia Copilot Pro] RAG Enabled: ${useRAG}`);
        
        // Get the last user message for RAG search
        const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
        let documentContext = '';
        let hubContext = '';
        let ragResults = [];
        let hubResults = { context: '', items: [] };
        
        // Perform RAG search if enabled
        if (useRAG && lastUserMessage) {
            const userQuery = lastUserMessage.content;
            console.log(`[Perxia Copilot Pro] Searching documents for: "${userQuery.substring(0, 50)}..."`);
            
            // Búsqueda en documentos del usuario
            ragResults = await searchDocuments(userQuery, 5);
            documentContext = buildDocumentContext(ragResults);
            
            // Búsqueda en Hub (Casos de Éxito, PoCs) si la pregunta lo amerita
            if (shouldSearchHub(userQuery)) {
                console.log(`[Perxia Copilot Pro] Query matches Hub keywords, searching Hub...`);
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
        
        console.log(`[Perxia Copilot Pro] Sending request...`);
        
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
            model: 'Perxia Copilot Pro',
            tokens: {
                prompt: response.usage?.prompt_tokens || 0,
                completion: response.usage?.completion_tokens || 0,
                total: response.usage?.total_tokens || 0
            },
            finishReason: response.choices[0].finish_reason,
            mock: false,
            reasoning: true,
            ragUsed: useRAG && (ragResults.length > 0 || hubItemsUsed),
            documentsUsed: ragResults.length > 0 ? ragResults.map(r => ({
                filename: r.filename,
                score: r.score
            })) : [],
            hubUsed: hubItemsUsed,
            hubItemsUsed: hubResults.items
        };
        
        console.log(`[Perxia Copilot Pro] Response received. Tokens: ${result.tokens.total}, RAG docs: ${ragResults.length}, Hub items: ${hubResults.items.length}`);
        
        res.json(result);
        
    } catch (error) {
        console.error('[Perxia Copilot Pro] Error:', error.message);
        console.error('[Perxia Copilot Pro] Full error:', error);
        
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
        name: 'Perxia Copilot Pro',
        description: 'Asistente de IA premium con razonamiento avanzado',
        deployment: process.env.DEEPSEEK_DEPLOYMENT_R1,
        maxTokens: 8192,
        configured: validation.valid,
        features: [
            'Razonamiento profundo',
            'Análisis paso a paso',
            'Insights estratégicos',
            'Consultas técnicas avanzadas',
            'Mayor contexto de tokens'
        ],
        premium: true
    });
});

// Mock response generator
function getMockResponse(messages, errorMsg = null) {
    const lastMessage = messages[messages.length - 1];
    const userQuery = lastMessage?.content || 'tu consulta';
    
    const errorInfo = errorMsg ? `\n\n**Error técnico:** ${errorMsg}` : '';
    
    const mockContent = `⭐ **Perxia Copilot Pro** - Análisis Avanzado

He recibido tu consulta: "${userQuery.substring(0, 100)}${userQuery.length > 100 ? '...' : ''}"

---

📋 **Modo Demostración**

Actualmente estoy funcionando en modo demo.${errorInfo}

**Para activar Copilot Pro completo:**
1. Verifica que el deployment \`${process.env.DEEPSEEK_DEPLOYMENT_R1}\` exista en Azure AI Foundry
2. Confirma que el endpoint y API key sean correctos
3. Reinicia el servidor

**Capacidades Premium:**
- 🎯 Análisis estratégico profundo
- 📊 Evaluación multi-perspectiva
- 🔬 Razonamiento técnico avanzado
- 📈 Recomendaciones fundamentadas

¿En qué más puedo ayudarte?`;

    return {
        success: true,
        content: mockContent,
        model: 'Perxia Copilot Pro',
        tokens: { prompt: 0, completion: 0, total: 0 },
        finishReason: 'stop',
        mock: true,
        reasoning: true
    };
}

module.exports = router;
