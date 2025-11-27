// ============================================
// DEEPSEEK AI SERVICE MODULE
// ============================================

class DeepSeekService {
    constructor(config) {
        this.config = config;
        this.apiBaseUrl = config.API_BASE_URL || '/api';
        this.currentModel = 'v3';
        this.conversationHistory = [];
    }

    async sendMessage(message, options = {}) {
        const model = options.model || this.currentModel;
        const modelConfig = this.config.DEEPSEEK?.models?.[model];

        if (!modelConfig) {
            throw new Error(`Modelo ${model} no encontrado`);
        }

        this.log('Sending message to DeepSeek', { model, message });

        // Agregar mensaje del usuario al historial
        this.conversationHistory.push({
            role: 'user',
            content: message
        });

        try {
            const response = await this.callDeepSeekAPI(model, options);
            
            // Agregar respuesta al historial
            this.conversationHistory.push({
                role: 'assistant',
                content: response.content
            });

            return response;
        } catch (error) {
            console.error('DeepSeek API error:', error);
            // En caso de error, devolver respuesta simulada
            return this.getMockResponse(message, model);
        }
    }

    async callDeepSeekAPI(model, options = {}) {
        // Usar el proxy del backend en lugar de llamar directamente a Azure
        const endpoint = `${this.apiBaseUrl}/deepseek/chat`;

        const requestBody = {
            model: model,
            messages: this.conversationHistory,
            maxTokens: options.maxTokens,
            temperature: options.temperature || 0.7,
            topP: options.topP || 0.95
        };

        this.log('API Request via backend proxy', { endpoint, body: requestBody });

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            this.log('API Error Response', errorText);
            throw new Error(`API Error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        this.log('API Response', data);

        // El backend ya devuelve el formato correcto
        return data;
    }

    getMockResponse(message, model) {
        const modelConfig = this.config.DEEPSEEK?.models?.[model];
        const modelName = modelConfig?.displayName || 'DeepSeek';
        
        this.log('Using mock response for development');

        const mockResponses = {
            'v3': `[${modelName} - Respuesta Simulada]

Entiendo tu consulta: "${message}"

Esta es una respuesta simulada porque no se pudo conectar con la API de DeepSeek. En producción:

1. ✓ Me conectaré a Azure AI Foundry
2. ✓ Procesaré tu consulta con DeepSeek V3
3. ✓ Analizaré documentos cargados
4. ✓ Proporcionaré respuestas contextuales precisas

Para habilitar la API real, configura:
- Endpoint de Azure AI Foundry
- API Key válida
- Deployment name correcto`,

            'r1': `[${modelName} - DeepThink - Respuesta Simulada]

🤔 Análisis profundo de tu consulta...

**Razonamiento:**
1. Identificación del problema: "${message}"
2. Análisis de contexto y requisitos
3. Evaluación de posibles soluciones
4. Validación de conclusiones

**Conclusión:**
Esta es una respuesta simulada. DeepSeek R1 proporciona razonamiento paso a paso profundo en producción.

**Configuración necesaria:**
- Azure AI Foundry endpoint
- API key configurada
- Deployment R1 activo`
        };

        return {
            content: mockResponses[model] || mockResponses['v3'],
            model: modelName,
            tokens: { prompt: 0, completion: 0, total: 0 },
            finishReason: 'mock',
            isMock: true
        };
    }

    setModel(model) {
        if (this.config.DEEPSEEK?.models?.[model]) {
            this.currentModel = model;
            this.log(`Model changed to ${model}`);
        } else {
            throw new Error(`Modelo ${model} no válido`);
        }
    }

    clearHistory() {
        this.conversationHistory = [];
        this.log('Conversation history cleared');
    }

    getHistory() {
        return this.conversationHistory;
    }

    async uploadDocument(file) {
        this.log('Document upload requested', { name: file.name, size: file.size });

        // Usar el proxy del backend para upload
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(`${this.apiBaseUrl}/storage/upload`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Error al subir documento');
            }

            const data = await response.json();
            this.log('Document uploaded successfully', data);
            return data;
        } catch (error) {
            console.error('Upload error:', error);
            // Fallback a respuesta mock
            return {
                success: false,
                fileName: file.name,
                size: file.size,
                message: 'Error al subir documento. Verifica la configuración del backend.'
            };
        }
    }

    log(message, data = null) {
        const debug = this.config.APP?.debug || false;
        if (debug) {
            console.log(`[DeepSeek] ${message}`, data || '');
        }
    }
}

// Exportar para uso global
window.DeepSeekService = DeepSeekService;
