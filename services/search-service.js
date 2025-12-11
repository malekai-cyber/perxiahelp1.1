// ============================================
// SEARCH SERVICE
// Azure AI Search para indexación y búsqueda
// ============================================

const { SearchClient, SearchIndexClient, AzureKeyCredential } = require('@azure/search-documents');

class SearchService {
    constructor() {
        this.endpoint = process.env.AZURE_SEARCH_ENDPOINT;
        this.apiKey = process.env.AZURE_SEARCH_API_KEY;
        this.indexName = process.env.AZURE_SEARCH_INDEX_NAME || 'perxia-documents';
        
        if (!this.endpoint || !this.apiKey) {
            console.warn('⚠️ Azure Search credentials not configured');
            this.searchClient = null;
            this.indexClient = null;
            return;
        }

        this.credential = new AzureKeyCredential(this.apiKey);
        this.indexClient = new SearchIndexClient(this.endpoint, this.credential);
        this.searchClient = new SearchClient(this.endpoint, this.indexName, this.credential);
        
        console.log('✅ Search Service initialized');
    }

    /**
     * Verifica si el servicio está disponible
     */
    isAvailable() {
        return this.searchClient !== null;
    }

    /**
     * Crea o actualiza el índice de documentos
     */
    async createOrUpdateIndex() {
        if (!this.indexClient) {
            throw new Error('Search service not configured');
        }

        const indexDefinition = {
            name: this.indexName,
            fields: [
                { name: 'id', type: 'Edm.String', key: true, filterable: true },
                { name: 'documentId', type: 'Edm.String', filterable: true, sortable: true },
                { name: 'filename', type: 'Edm.String', searchable: true, filterable: true },
                { name: 'content', type: 'Edm.String', searchable: true, analyzerName: 'es.microsoft' },
                { 
                    name: 'contentVector', 
                    type: 'Collection(Edm.Single)', 
                    searchable: true,
                    vectorSearchDimensions: 1536,
                    vectorSearchProfileName: 'vector-profile'
                },
                { name: 'chunkIndex', type: 'Edm.Int32', filterable: true, sortable: true },
                { name: 'totalChunks', type: 'Edm.Int32', filterable: true },
                { name: 'pageNumber', type: 'Edm.Int32', filterable: true },
                { name: 'fileType', type: 'Edm.String', filterable: true, facetable: true },
                { name: 'fileSize', type: 'Edm.Int64', filterable: true },
                { name: 'uploadedBy', type: 'Edm.String', filterable: true },
                { name: 'uploadedAt', type: 'Edm.DateTimeOffset', filterable: true, sortable: true },
                { name: 'blobUrl', type: 'Edm.String' },
                { name: 'tags', type: 'Collection(Edm.String)', filterable: true, facetable: true }
            ],
            vectorSearch: {
                algorithms: [
                    {
                        name: 'hnsw-algorithm',
                        kind: 'hnsw',
                        parameters: { m: 4, efConstruction: 400, efSearch: 500, metric: 'cosine' }
                    }
                ],
                profiles: [
                    { name: 'vector-profile', algorithmConfigurationName: 'hnsw-algorithm' }
                ]
            },
            semantic: {
                configurations: [
                    {
                        name: 'semantic-config',
                        prioritizedFields: {
                            contentFields: [{ name: 'content' }],
                            titleField: { name: 'filename' }
                        }
                    }
                ]
            }
        };

        try {
            await this.indexClient.createOrUpdateIndex(indexDefinition);
            console.log(`✅ Index '${this.indexName}' ready`);
            return true;
        } catch (error) {
            // Si el error es por campos existentes, eliminar y recrear
            if (error.message.includes('cannot be changed') || error.code === 'OperationNotAllowed') {
                console.log(`🔄 Recreating index '${this.indexName}'...`);
                try {
                    await this.indexClient.deleteIndex(this.indexName);
                    console.log(`🗑️ Old index deleted`);
                    await this.indexClient.createIndex(indexDefinition);
                    console.log(`✅ New index '${this.indexName}' created`);
                    // Recrear el searchClient con el nuevo índice
                    this.searchClient = new SearchClient(this.endpoint, this.indexName, this.credential);
                    return true;
                } catch (recreateError) {
                    console.error('❌ Error recreating index:', recreateError.message);
                    throw recreateError;
                }
            }
            console.error('❌ Error creating index:', error.message);
            throw error;
        }
    }

    /**
     * Indexa chunks de un documento
     * @param {Object} document - Metadata del documento
     * @param {Array} chunks - Array de chunks con texto y embeddings
     */
    async indexDocument(document, chunks) {
        if (!this.searchClient) {
            throw new Error('Search service not configured');
        }

        const { documentId, filename, fileType, fileSize, uploadedBy, blobUrl, tags = [] } = document;
        
        const documents = chunks.map((chunk, index) => ({
            id: `${documentId}_chunk_${index}`,
            documentId,
            filename,
            content: chunk.text,
            contentVector: chunk.embedding,
            chunkIndex: index,
            totalChunks: chunks.length,
            pageNumber: chunk.pageNumber || 0,
            fileType,
            fileSize,
            uploadedBy: uploadedBy || 'anonymous',
            uploadedAt: new Date(),
            blobUrl,
            tags
        }));

        try {
            // Indexar en batches de 100
            const batchSize = 100;
            let totalIndexed = 0;

            for (let i = 0; i < documents.length; i += batchSize) {
                const batch = documents.slice(i, i + batchSize);
                const result = await this.searchClient.uploadDocuments(batch);
                totalIndexed += result.results.filter(r => r.succeeded).length;
            }

            console.log(`✅ Indexed ${totalIndexed}/${chunks.length} chunks for: ${filename}`);
            return { success: true, indexed: totalIndexed, total: chunks.length };
        } catch (error) {
            console.error('❌ Error indexing document:', error.message);
            throw error;
        }
    }

    /**
     * Búsqueda híbrida (texto + vectorial + semántica)
     * @param {string} query - Consulta del usuario
     * @param {number[]} queryEmbedding - Embedding de la consulta
     * @param {Object} options - Opciones de búsqueda
     */
    async hybridSearch(query, queryEmbedding, options = {}) {
        if (!this.searchClient) {
            throw new Error('Search service not configured');
        }

        const { top = 5, filter = null } = options;

        const searchOptions = {
            top: top * 2, // Buscar más para filtrar después
            select: ['id', 'documentId', 'filename', 'content', 'chunkIndex', 'pageNumber', 'fileType', 'uploadedAt', 'tags'],
            queryType: 'semantic',
            semanticSearchOptions: {
                configurationName: 'semantic-config'
            }
        };

        // Agregar búsqueda vectorial si hay embedding
        if (queryEmbedding && queryEmbedding.length > 0) {
            searchOptions.vectorSearchOptions = {
                queries: [{
                    kind: 'vector',
                    vector: queryEmbedding,
                    fields: ['contentVector'],
                    kNearestNeighborsCount: top * 2
                }]
            };
        }

        if (filter) {
            searchOptions.filter = filter;
        }

        try {
            const searchResults = await this.searchClient.search(query, searchOptions);
            const results = [];

            for await (const result of searchResults.results) {
                results.push({
                    id: result.document.id,
                    documentId: result.document.documentId,
                    filename: result.document.filename,
                    content: result.document.content,
                    chunkIndex: result.document.chunkIndex,
                    pageNumber: result.document.pageNumber,
                    fileType: result.document.fileType,
                    score: result.score,
                    rerankerScore: result.rerankerScore,
                    tags: result.document.tags
                });

                if (results.length >= top) break;
            }

            return results;
        } catch (error) {
            console.error('❌ Error searching:', error.message);
            throw error;
        }
    }

    /**
     * Búsqueda solo por texto (sin embeddings)
     */
    async textSearch(query, options = {}) {
        if (!this.searchClient) {
            throw new Error('Search service not configured');
        }

        const { top = 5, filter = null } = options;

        const searchOptions = {
            top,
            select: ['id', 'documentId', 'filename', 'content', 'chunkIndex', 'pageNumber', 'fileType', 'tags'],
            queryType: 'simple'
        };

        if (filter) {
            searchOptions.filter = filter;
        }

        try {
            const searchResults = await this.searchClient.search(query, searchOptions);
            const results = [];

            for await (const result of searchResults.results) {
                results.push({
                    id: result.document.id,
                    documentId: result.document.documentId,
                    filename: result.document.filename,
                    content: result.document.content,
                    chunkIndex: result.document.chunkIndex,
                    score: result.score,
                    tags: result.document.tags
                });

                if (results.length >= top) break;
            }

            return results;
        } catch (error) {
            console.error('❌ Error in text search:', error.message);
            throw error;
        }
    }

    /**
     * Elimina todos los chunks de un documento
     */
    async deleteDocument(documentId) {
        if (!this.searchClient) {
            throw new Error('Search service not configured');
        }

        try {
            // Buscar todos los chunks del documento
            const searchResults = await this.searchClient.search('*', {
                filter: `documentId eq '${documentId}'`,
                select: ['id'],
                top: 1000
            });

            const idsToDelete = [];
            for await (const result of searchResults.results) {
                idsToDelete.push({ id: result.document.id });
            }

            if (idsToDelete.length > 0) {
                await this.searchClient.deleteDocuments(idsToDelete);
                console.log(`✅ Deleted ${idsToDelete.length} chunks for document: ${documentId}`);
            }

            return { deleted: idsToDelete.length };
        } catch (error) {
            console.error('❌ Error deleting document:', error.message);
            throw error;
        }
    }

    /**
     * Obtiene estadísticas de documentos
     */
    async getStats() {
        if (!this.searchClient) {
            return { totalChunks: 0, uniqueDocuments: 0 };
        }

        try {
            const searchResults = await this.searchClient.search('*', {
                top: 0,
                includeTotalCount: true,
                facets: ['documentId']
            });

            const count = searchResults.count || 0;
            
            // Contar documentos únicos
            let uniqueDocs = 0;
            if (searchResults.facets && searchResults.facets.documentId) {
                uniqueDocs = searchResults.facets.documentId.length;
            }

            return {
                totalChunks: count,
                uniqueDocuments: uniqueDocs
            };
        } catch (error) {
            return { totalChunks: 0, uniqueDocuments: 0 };
        }
    }

    /**
     * Lista todos los documentos únicos
     */
    async listDocuments() {
        if (!this.searchClient) {
            return [];
        }

        try {
            const searchResults = await this.searchClient.search('*', {
                select: ['documentId', 'filename', 'fileType', 'fileSize', 'uploadedBy', 'uploadedAt', 'blobUrl', 'totalChunks'],
                top: 1000,
                orderBy: ['uploadedAt desc']
            });

            const documentsMap = new Map();

            for await (const result of searchResults.results) {
                const doc = result.document;
                if (!documentsMap.has(doc.documentId)) {
                    documentsMap.set(doc.documentId, {
                        documentId: doc.documentId,
                        filename: doc.filename,
                        fileType: doc.fileType,
                        fileSize: doc.fileSize,
                        uploadedBy: doc.uploadedBy,
                        uploadedAt: doc.uploadedAt,
                        blobUrl: doc.blobUrl,
                        totalChunks: doc.totalChunks
                    });
                }
            }

            return Array.from(documentsMap.values());
        } catch (error) {
            console.error('❌ Error listing documents:', error.message);
            return [];
        }
    }
}

module.exports = new SearchService();
