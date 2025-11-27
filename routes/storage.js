// ============================================
// AZURE STORAGE ROUTES
// ============================================

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { BlobServiceClient } = require('@azure/storage-blob');

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept only specific file types
        const allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain',
            'text/markdown'
        ];
        
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only PDF, DOC, DOCX, TXT, and MD files are allowed.'));
        }
    }
});

// Get Azure Storage client
const getStorageClient = () => {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    
    if (!connectionString || connectionString.includes('your-')) {
        throw new Error('Azure Storage not configured');
    }
    
    return BlobServiceClient.fromConnectionString(connectionString);
};

// Upload document
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                error: 'No file provided',
                message: 'Please select a file to upload'
            });
        }
        
        // Check if storage is configured
        if (!process.env.AZURE_STORAGE_CONNECTION_STRING || 
            process.env.AZURE_STORAGE_CONNECTION_STRING.includes('your-')) {
            // Return mock success for development
            return res.json({
                success: true,
                fileName: req.file.originalname,
                size: req.file.size,
                url: `mock://documents/${req.file.originalname}`,
                message: 'File uploaded (simulated). Configure Azure Storage for real uploads.',
                mock: true
            });
        }
        
        const blobServiceClient = getStorageClient();
        const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'documents';
        const containerClient = blobServiceClient.getContainerClient(containerName);
        
        // Ensure container exists
        await containerClient.createIfNotExists({
            access: 'blob'
        });
        
        // Generate unique filename
        const timestamp = Date.now();
        const filename = `${timestamp}-${req.file.originalname}`;
        const blockBlobClient = containerClient.getBlockBlobClient(filename);
        
        // Upload file
        await blockBlobClient.uploadData(req.file.buffer, {
            blobHTTPHeaders: {
                blobContentType: req.file.mimetype
            }
        });
        
        console.log(`[Storage] File uploaded: ${filename}`);
        
        res.json({
            success: true,
            fileName: req.file.originalname,
            storedName: filename,
            size: req.file.size,
            url: blockBlobClient.url,
            contentType: req.file.mimetype,
            mock: false
        });
        
    } catch (error) {
        console.error('[Storage] Upload error:', error);
        
        // Return mock success on error for development
        if (error.message.includes('not configured')) {
            return res.json({
                success: true,
                fileName: req.file.originalname,
                size: req.file.size,
                url: `mock://documents/${req.file.originalname}`,
                message: 'File uploaded (simulated). Configure Azure Storage for real uploads.',
                mock: true
            });
        }
        
        res.status(500).json({
            error: 'Upload failed',
            message: error.message
        });
    }
});

// List documents
router.get('/documents', async (req, res) => {
    try {
        // Check if storage is configured
        if (!process.env.AZURE_STORAGE_CONNECTION_STRING || 
            process.env.AZURE_STORAGE_CONNECTION_STRING.includes('your-')) {
            return res.json({
                documents: [],
                message: 'Configure Azure Storage to list documents',
                mock: true
            });
        }
        
        const blobServiceClient = getStorageClient();
        const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'documents';
        const containerClient = blobServiceClient.getContainerClient(containerName);
        
        const documents = [];
        
        for await (const blob of containerClient.listBlobsFlat()) {
            documents.push({
                name: blob.name,
                size: blob.properties.contentLength,
                contentType: blob.properties.contentType,
                lastModified: blob.properties.lastModified,
                url: `${containerClient.url}/${blob.name}`
            });
        }
        
        res.json({
            documents: documents,
            count: documents.length,
            mock: false
        });
        
    } catch (error) {
        console.error('[Storage] List error:', error);
        res.status(500).json({
            error: 'Failed to list documents',
            message: error.message
        });
    }
});

// Delete document
router.delete('/documents/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        
        if (!filename) {
            return res.status(400).json({
                error: 'Filename required',
                message: 'Please provide a filename to delete'
            });
        }
        
        // Check if storage is configured
        if (!process.env.AZURE_STORAGE_CONNECTION_STRING || 
            process.env.AZURE_STORAGE_CONNECTION_STRING.includes('your-')) {
            return res.json({
                success: true,
                message: 'Document deleted (simulated)',
                mock: true
            });
        }
        
        const blobServiceClient = getStorageClient();
        const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'documents';
        const containerClient = blobServiceClient.getContainerClient(containerName);
        const blockBlobClient = containerClient.getBlockBlobClient(filename);
        
        await blockBlobClient.delete();
        
        console.log(`[Storage] File deleted: ${filename}`);
        
        res.json({
            success: true,
            message: 'Document deleted successfully',
            mock: false
        });
        
    } catch (error) {
        console.error('[Storage] Delete error:', error);
        res.status(500).json({
            error: 'Delete failed',
            message: error.message
        });
    }
});

module.exports = router;
