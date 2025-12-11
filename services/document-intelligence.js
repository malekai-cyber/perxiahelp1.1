// ============================================
// DOCUMENT INTELLIGENCE SERVICE
// Azure AI Document Intelligence para extracción de texto
// ============================================

const { DocumentAnalysisClient, AzureKeyCredential } = require('@azure/ai-form-recognizer');

class DocumentIntelligenceService {
    constructor() {
        this.endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
        this.apiKey = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;
        
        if (!this.endpoint || !this.apiKey) {
            console.warn('⚠️ Azure Document Intelligence credentials not configured');
            this.client = null;
            return;
        }

        this.client = new DocumentAnalysisClient(
            this.endpoint,
            new AzureKeyCredential(this.apiKey)
        );
        
        console.log('✅ Document Intelligence Service initialized');
    }

    /**
     * Verifica si el servicio está disponible
     */
    isAvailable() {
        return this.client !== null;
    }

    /**
     * Extrae texto de un documento usando Azure Document Intelligence
     * @param {Buffer} buffer - Contenido del documento
     * @param {string} filename - Nombre del archivo
     * @returns {Promise<{text: string, pages: number, tables: Array, metadata: Object}>}
     */
    async extractText(buffer, filename) {
        if (!this.client) {
            throw new Error('Document Intelligence service not configured');
        }

        console.log(`📄 Analyzing document: ${filename}`);

        try {
            // Usar el modelo prebuilt-read para extracción de texto
            const poller = await this.client.beginAnalyzeDocument(
                'prebuilt-read',
                buffer
            );

            const result = await poller.pollUntilDone();

            // Extraer todo el texto del documento
            let fullText = '';
            const pages = [];
            const tables = [];

            if (result.pages) {
                for (const page of result.pages) {
                    let pageText = '';
                    
                    // Extraer líneas de texto
                    if (page.lines) {
                        for (const line of page.lines) {
                            pageText += line.content + '\n';
                        }
                    }
                    
                    pages.push({
                        pageNumber: page.pageNumber,
                        width: page.width,
                        height: page.height,
                        text: pageText.trim()
                    });
                    
                    fullText += pageText + '\n\n';
                }
            }

            // Extraer tablas si existen
            if (result.tables) {
                for (const table of result.tables) {
                    const tableData = {
                        rowCount: table.rowCount,
                        columnCount: table.columnCount,
                        cells: []
                    };
                    
                    if (table.cells) {
                        for (const cell of table.cells) {
                            tableData.cells.push({
                                rowIndex: cell.rowIndex,
                                columnIndex: cell.columnIndex,
                                content: cell.content
                            });
                        }
                    }
                    
                    tables.push(tableData);
                }
            }

            // Limpiar el texto
            fullText = fullText
                .replace(/\r\n/g, '\n')
                .replace(/\n{3,}/g, '\n\n')
                .trim();

            console.log(`✅ Extracted ${fullText.length} characters from ${pages.length} pages`);

            return {
                text: fullText,
                pages: pages.length,
                pageDetails: pages,
                tables,
                metadata: {
                    filename,
                    modelId: 'prebuilt-read',
                    extractedAt: new Date().toISOString(),
                    contentLength: fullText.length
                }
            };
        } catch (error) {
            console.error('❌ Error extracting text:', error.message);
            throw new Error(`Failed to extract text from document: ${error.message}`);
        }
    }

    /**
     * Extrae texto de un documento con análisis de layout (más detallado)
     * @param {Buffer} buffer - Contenido del documento
     * @param {string} filename - Nombre del archivo
     * @returns {Promise<Object>}
     */
    async extractWithLayout(buffer, filename) {
        if (!this.client) {
            throw new Error('Document Intelligence service not configured');
        }

        console.log(`📄 Analyzing document with layout: ${filename}`);

        try {
            const poller = await this.client.beginAnalyzeDocument(
                'prebuilt-layout',
                buffer
            );

            const result = await poller.pollUntilDone();

            let fullText = '';
            const sections = [];
            const tables = [];

            // Extraer párrafos
            if (result.paragraphs) {
                for (const paragraph of result.paragraphs) {
                    sections.push({
                        type: 'paragraph',
                        role: paragraph.role || 'content',
                        content: paragraph.content
                    });
                    fullText += paragraph.content + '\n\n';
                }
            }

            // Extraer tablas
            if (result.tables) {
                for (const table of result.tables) {
                    const tableText = this.tableToText(table);
                    tables.push(tableText);
                    fullText += '\n[TABLA]\n' + tableText + '\n[/TABLA]\n\n';
                }
            }

            return {
                text: fullText.trim(),
                sections,
                tables,
                pages: result.pages?.length || 0,
                metadata: {
                    filename,
                    modelId: 'prebuilt-layout',
                    extractedAt: new Date().toISOString()
                }
            };
        } catch (error) {
            console.error('❌ Error extracting layout:', error.message);
            throw error;
        }
    }

    /**
     * Convierte una tabla a texto legible
     */
    tableToText(table) {
        if (!table.cells || table.cells.length === 0) return '';

        const rows = [];
        for (let i = 0; i < table.rowCount; i++) {
            rows.push(new Array(table.columnCount).fill(''));
        }

        for (const cell of table.cells) {
            rows[cell.rowIndex][cell.columnIndex] = cell.content || '';
        }

        return rows.map(row => row.join(' | ')).join('\n');
    }
}

module.exports = new DocumentIntelligenceService();
