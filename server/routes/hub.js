// ============================================
// HUB ROUTES
// API endpoints para Periferia IT Hub
// ============================================

const express = require('express');
const router = express.Router();
const hubSearchService = require('../services/hub-search-service');

/**
 * GET /api/hub/items
 * Obtener todos los items del Hub
 */
router.get('/items', async (req, res) => {
    try {
        const { category, top = 50, query } = req.query;
        
        let results;
        if (query) {
            results = await hubSearchService.search(query, { top: parseInt(top) });
        } else if (category && category !== 'all') {
            results = await hubSearchService.getByCategory(category, parseInt(top));
        } else {
            results = await hubSearchService.getAll({ top: parseInt(top) });
        }

        res.json(results);
    } catch (error) {
        console.error('Error en GET /api/hub/items:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            items: []
        });
    }
});

/**
 * GET /api/hub/search
 * Buscar en el Hub
 */
router.get('/search', async (req, res) => {
    try {
        const { q, top = 10 } = req.query;
        
        if (!q) {
            return res.status(400).json({ 
                success: false, 
                error: 'Query parameter "q" is required' 
            });
        }

        const results = await hubSearchService.search(q, { top: parseInt(top) });
        res.json(results);
    } catch (error) {
        console.error('Error en GET /api/hub/search:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            items: []
        });
    }
});

/**
 * GET /api/hub/context
 * Obtener contexto para el chat (RAG)
 */
router.get('/context', async (req, res) => {
    try {
        const { q, top = 5 } = req.query;
        
        if (!q) {
            return res.status(400).json({ 
                success: false, 
                error: 'Query parameter "q" is required' 
            });
        }

        const results = await hubSearchService.searchForContext(q, parseInt(top));
        res.json(results);
    } catch (error) {
        console.error('Error en GET /api/hub/context:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            context: ''
        });
    }
});

/**
 * GET /api/hub/stats
 * Obtener estadísticas del Hub
 */
router.get('/stats', async (req, res) => {
    try {
        const stats = await hubSearchService.getStats();
        res.json(stats);
    } catch (error) {
        console.error('Error en GET /api/hub/stats:', error);
        res.status(500).json({ 
            success: false, 
            stats: { total: 0, casos: 0, pocs: 0, tools: 0 }
        });
    }
});

/**
 * GET /api/hub/tags
 * Obtener tags disponibles para filtros
 */
router.get('/tags', async (req, res) => {
    try {
        const { category } = req.query;
        const result = await hubSearchService.getAvailableTags(category);
        res.json(result);
    } catch (error) {
        console.error('Error en GET /api/hub/tags:', error);
        res.status(500).json({ 
            success: false, 
            tags: []
        });
    }
});

/**
 * GET /api/hub/test
 * Probar conexión con el índice
 */
router.get('/test', async (req, res) => {
    try {
        const connected = await hubSearchService.testConnection();
        res.json({ 
            success: connected,
            message: connected ? 'Conexión exitosa con el Hub' : 'No se pudo conectar',
            index: process.env.AZURE_HUB_SEARCH_INDEX_NAME
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

module.exports = router;
