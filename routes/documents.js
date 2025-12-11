// ============================================
// DOCUMENTS ROUTE - Document Management API
// Usa Azure Document Intelligence + Azure AI Search
// ============================================

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { BlobServiceClient } = require('@azure/storage-blob');
const path = require('path');

// Services
const documentIntelligence = require('../services/document-intelligence');
const embeddingService = require('../services/embedding-service');
const searchService = require('../services/search-service');
const chunkingService = require('../services/chunking-service');

// Configurar multer para archivos en memoria
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.pdf', '.docx', '.doc', '.txt', '.md', '.png', '.jpg', '.jpeg'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error(`Tipo de archivo no soportado: ${ext}`));
        }
    }
});

// Azure Blob Storage client
let containerClient = null;
try {
    const blobServiceClient = BlobServiceClient.fromConnectionString(
        process.env.AZURE_STORAGE_CONNECTION_STRING
    );
    containerClient = blobServiceClient.getContainerClient(
        process.env.AZURE_STORAGE_CONTAINER_NAME || 'documents'
    );
} catch (error) {
    console.warn('⚠️ Azure Blob Storage not configured:', error.message);
}

// ===== ENDPOINTS =====

/**
 * POST /api/documents/upload
 * Sube y procesa un documento
 */
router.post('/upload', upload.single('document'), async (req, res) => {
    const startTime = Date.now();
    
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No se proporcionó ningún archivo' });
        }

        const { originalname, buffer, mimetype, size } = req.file;
        const { tags = '', uploadedBy = 'anonymous' } = req.body;
        const documentId = uuidv4();
        const fileType = path.extname(originalname).toLowerCase().replace('.', '');

        console.log(`\n📄 ========== Processing: ${originalname} ==========`);
        console.log(`   ID: ${documentId}`);
        console.log(`   Size: ${(size / 1024).toFixed(2)} KB`);
        console.log(`   Type: ${fileType}`);

        // 1. Subir a Azure Blob Storage
        let blobUrl = '';
        if (containerClient) {
            const blobName = `${documentId}/${originalname}`;
            const blockBlobClient = containerClient.getBlockBlobClient(blobName);
            await blockBlobClient.uploadData(buffer, {
                blobHTTPHeaders: { blobContentType: mimetype }
            });
            blobUrl = blockBlobClient.url;
            console.log(`   ☁️ Uploaded to blob storage`);
        }

        // 2. Extraer texto con Document Intelligence
        let extractedText = '';
        let pages = 0;

        if (!documentIntelligence.isAvailable()) {
            return res.status(500).json({
                success: false,
                error: 'Azure Document Intelligence no está configurado'
            });
        }

        try {
            const extraction = await documentIntelligence.extractText(buffer, originalname);
            extractedText = extraction.text;
            pages = extraction.pages;
            console.log(`   📝 Extracted ${extractedText.length} chars from ${pages} pages`);
        } catch (extractError) {
            console.error(`   ❌ Extraction error:`, extractError.message);
            return res.status(400).json({
                success: false,
                error: `Error al extraer texto: ${extractError.message}`
            });
        }

        if (!extractedText || extractedText.trim().length < 10) {
            return res.status(400).json({
                success: false,
                error: 'No se pudo extraer texto del documento'
            });
        }

        // 3. Dividir en chunks
        const chunks = chunkingService.chunkByStructure(extractedText, {
            maxChunkSize: 1000,
            minChunkSize: 100
        });
        console.log(`   ✂️ Created ${chunks.length} chunks`);

        // 4. Generar embeddings para cada chunk
        console.log(`   🧠 Generating embeddings...`);
        const chunksWithEmbeddings = [];

        for (let i = 0; i < chunks.length; i++) {
            try {
                const embedding = await embeddingService.generateEmbedding(chunks[i].text);
                chunksWithEmbeddings.push({
                    ...chunks[i],
                    embedding
                });
                
                // Mostrar progreso cada 5 chunks
                if ((i + 1) % 5 === 0 || i === chunks.length - 1) {
                    console.log(`      Progress: ${i + 1}/${chunks.length} chunks`);
                }
            } catch (embError) {
                console.warn(`      ⚠️ Embedding failed for chunk ${i}, using empty vector`);
                chunksWithEmbeddings.push({
                    ...chunks[i],
                    embedding: new Array(1536).fill(0)
                });
            }
        }

        // 5. Indexar en Azure AI Search
        console.log(`   📤 Indexing in Azure AI Search...`);
        const indexResult = await searchService.indexDocument({
            documentId,
            filename: originalname,
            fileType,
            fileSize: size,
            uploadedBy,
            blobUrl,
            tags: tags ? tags.split(',').map(t => t.trim()).filter(t => t) : []
        }, chunksWithEmbeddings);

        const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`   ✅ Done in ${processingTime}s`);
        console.log(`   ========================================\n`);

        res.status(201).json({
            success: true,
            document: {
                documentId,
                filename: originalname,
                fileType,
                fileSize: size,
                pages,
                chunks: chunks.length,
                chunksIndexed: indexResult.indexed,
                blobUrl,
                processingTimeSeconds: parseFloat(processingTime)
            },
            message: 'Documento procesado e indexado correctamente'
        });

    } catch (error) {
        console.error('❌ Upload error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Error al procesar el documento'
        });
    }
});

/**
 * GET /api/documents
 * Lista todos los documentos
 */
router.get('/', async (req, res) => {
    try {
        const documents = await searchService.listDocuments();
        res.json({
            success: true,
            count: documents.length,
            documents
        });
    } catch (error) {
        console.error('Error listing documents:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/documents/stats
 * Obtiene estadísticas
 */
router.get('/stats', async (req, res) => {
    try {
        const stats = await searchService.getStats();
        res.json({ success: true, stats });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * DELETE /api/documents/:documentId
 * Elimina un documento
 */
router.delete('/:documentId', async (req, res) => {
    try {
        const { documentId } = req.params;
        
        // Eliminar del índice
        const deleteResult = await searchService.deleteDocument(documentId);
        
        // Eliminar del blob storage
        if (containerClient) {
            try {
                const blobs = containerClient.listBlobsFlat({ prefix: `${documentId}/` });
                for await (const blob of blobs) {
                    await containerClient.deleteBlob(blob.name);
                }
            } catch (blobError) {
                console.warn('Warning deleting blobs:', blobError.message);
            }
        }

        res.json({
            success: true,
            message: 'Documento eliminado',
            chunksDeleted: deleteResult.deleted
        });
    } catch (error) {
        console.error('Error deleting document:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/documents/search
 * Búsqueda en documentos
 */
router.post('/search', async (req, res) => {
    try {
        const { query, top = 5, searchType = 'hybrid' } = req.body;

        if (!query || query.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Se requiere una consulta de búsqueda'
            });
        }

        let results;

        if (searchType === 'hybrid' && embeddingService.isAvailable()) {
            // Búsqueda híbrida con embeddings
            const queryEmbedding = await embeddingService.generateEmbedding(query);
            results = await searchService.hybridSearch(query, queryEmbedding, { top });
        } else {
            // Búsqueda solo por texto
            results = await searchService.textSearch(query, { top });
        }

        res.json({
            success: true,
            query,
            searchType,
            count: results.length,
            results
        });
    } catch (error) {
        console.error('Error searching:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/documents/init-index
 * Inicializa el índice de búsqueda
 */
router.post('/init-index', async (req, res) => {
    try {
        await searchService.createOrUpdateIndex();
        res.json({ success: true, message: 'Índice creado/actualizado' });
    } catch (error) {
        console.error('Error initializing index:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/documents/health
 * Verifica el estado de los servicios
 */
router.get('/health', (req, res) => {
    res.json({
        success: true,
        services: {
            documentIntelligence: documentIntelligence.isAvailable(),
            embeddingService: embeddingService.isAvailable(),
            searchService: searchService.isAvailable(),
            blobStorage: containerClient !== null
        }
    });
});

module.exports = router;
