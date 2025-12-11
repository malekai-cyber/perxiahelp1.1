// ============================================
// EMBEDDING SERVICE
// Genera embeddings usando Azure OpenAI
// ============================================

const { AzureOpenAI } = require('openai');

class EmbeddingService {
    constructor() {
        this.endpoint = process.env.AZURE_EMBEDDING_ENDPOINT || process.env.DEEPSEEK_ENDPOINT;
        this.apiKey = process.env.AZURE_EMBEDDING_API_KEY || process.env.DEEPSEEK_API_KEY;
        this.deploymentName = process.env.AZURE_EMBEDDING_DEPLOYMENT || 'text-embedding-3-small';
        this.apiVersion = '2024-02-01';
        
        if (!this.endpoint || !this.apiKey) {
            console.warn('⚠️ Azure OpenAI Embedding credentials not configured');
            this.client = null;
            return;
        }

        this.client = new AzureOpenAI({
            endpoint: this.endpoint,
            apiKey: this.apiKey,
            apiVersion: this.apiVersion,
            deployment: this.deploymentName
        });

        console.log('✅ Embedding Service initialized');
    }

    /**
     * Verifica si el servicio está disponible
     */
    isAvailable() {
        return this.client !== null;
    }

    /**
     * Genera un embedding para un texto
     * @param {string} text - Texto a convertir en embedding
     * @returns {Promise<number[]>} - Vector de embedding (1536 dimensiones)
     */
    async generateEmbedding(text) {
        if (!this.client) {
            throw new Error('Embedding service not configured');
        }

        // Limpiar y truncar el texto si es necesario
        const cleanText = text
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 8000); // Límite de tokens aproximado

        if (!cleanText) {
            throw new Error('Empty text provided for embedding');
        }

        try {
            const response = await this.client.embeddings.create({
                model: this.deploymentName,
                input: cleanText
            });

            if (!response.data || response.data.length === 0) {
                throw new Error('No embedding returned from API');
            }

            return response.data[0].embedding;
        } catch (error) {
            console.error('❌ Error generating embedding:', error.message);
            throw new Error(`Failed to generate embedding: ${error.message}`);
        }
    }

    /**
     * Genera embeddings para múltiples textos en batch
     * @param {string[]} texts - Array de textos
     * @returns {Promise<number[][]>} - Array de vectores de embedding
     */
    async generateEmbeddings(texts) {
        if (!this.client) {
            throw new Error('Embedding service not configured');
        }

        // Procesar en batches de 16 para evitar límites de API
        const batchSize = 16;
        const allEmbeddings = [];

        for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize);
            const cleanBatch = batch.map(text => 
                text.replace(/\s+/g, ' ').trim().substring(0, 8000)
            );

            try {
                const response = await this.client.embeddings.create({
                    model: this.deploymentName,
                    input: cleanBatch
                });

                for (const item of response.data) {
                    allEmbeddings.push(item.embedding);
                }

                // Pequeña pausa entre batches para evitar rate limiting
                if (i + batchSize < texts.length) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            } catch (error) {
                console.error(`❌ Error in batch ${i / batchSize + 1}:`, error.message);
                // Agregar embeddings vacíos para los que fallaron
                for (let j = 0; j < batch.length; j++) {
                    allEmbeddings.push(new Array(1536).fill(0));
                }
            }
        }

        return allEmbeddings;
    }

    /**
     * Calcula la similitud coseno entre dos embeddings
     * @param {number[]} embedding1 
     * @param {number[]} embedding2 
     * @returns {number} - Similitud entre 0 y 1
     */
    cosineSimilarity(embedding1, embedding2) {
        if (embedding1.length !== embedding2.length) {
            throw new Error('Embeddings must have the same length');
        }

        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;

        for (let i = 0; i < embedding1.length; i++) {
            dotProduct += embedding1[i] * embedding2[i];
            norm1 += embedding1[i] * embedding1[i];
            norm2 += embedding2[i] * embedding2[i];
        }

        return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    }
}

module.exports = new EmbeddingService();
