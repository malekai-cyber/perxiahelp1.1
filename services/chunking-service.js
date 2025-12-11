// ============================================
// CHUNKING SERVICE
// Divide documentos en chunks para indexación
// ============================================

class ChunkingService {
    constructor() {
        this.defaultChunkSize = 1000;  // caracteres por chunk
        this.defaultOverlap = 200;      // overlap entre chunks
    }

    /**
     * Divide texto en chunks con overlap
     * @param {string} text - Texto a dividir
     * @param {Object} options - Opciones de chunking
     * @returns {Array<{text: string, index: number, startChar: number, endChar: number}>}
     */
    chunkText(text, options = {}) {
        const chunkSize = options.chunkSize || this.defaultChunkSize;
        const overlap = options.overlap || this.defaultOverlap;

        if (!text || text.trim().length === 0) {
            return [];
        }

        const chunks = [];
        let startIndex = 0;
        let chunkIndex = 0;

        while (startIndex < text.length) {
            let endIndex = startIndex + chunkSize;

            // Si no es el último chunk, buscar un punto de corte natural
            if (endIndex < text.length) {
                // Buscar el último punto, salto de línea o espacio
                const searchStart = Math.max(startIndex + chunkSize - 200, startIndex);
                const searchText = text.substring(searchStart, endIndex);
                
                // Priorizar: fin de párrafo > fin de oración > espacio
                let cutPoint = searchText.lastIndexOf('\n\n');
                if (cutPoint === -1) cutPoint = searchText.lastIndexOf('. ');
                if (cutPoint === -1) cutPoint = searchText.lastIndexOf('.\n');
                if (cutPoint === -1) cutPoint = searchText.lastIndexOf(' ');
                
                if (cutPoint !== -1) {
                    endIndex = searchStart + cutPoint + 1;
                }
            }

            const chunkText = text.substring(startIndex, endIndex).trim();

            if (chunkText.length > 0) {
                chunks.push({
                    text: chunkText,
                    index: chunkIndex,
                    startChar: startIndex,
                    endChar: endIndex
                });
                chunkIndex++;
            }

            // Mover al siguiente chunk con overlap
            startIndex = endIndex - overlap;
            if (startIndex >= text.length - overlap) {
                break;
            }
        }

        return chunks;
    }

    /**
     * Divide texto por páginas y luego en chunks
     * @param {Array} pages - Array de páginas con texto
     * @param {Object} options - Opciones de chunking
     */
    chunkByPages(pages, options = {}) {
        const chunks = [];
        let globalIndex = 0;

        for (const page of pages) {
            const pageChunks = this.chunkText(page.text, options);
            
            for (const chunk of pageChunks) {
                chunks.push({
                    ...chunk,
                    index: globalIndex,
                    pageNumber: page.pageNumber
                });
                globalIndex++;
            }
        }

        return chunks;
    }

    /**
     * Divide texto respetando la estructura del documento
     * @param {string} text - Texto completo
     * @param {Object} options - Opciones
     */
    chunkByStructure(text, options = {}) {
        const maxChunkSize = options.maxChunkSize || 1500;
        const minChunkSize = options.minChunkSize || 200;
        
        // Dividir por párrafos primero
        const paragraphs = text.split(/\n\n+/);
        const chunks = [];
        let currentChunk = '';
        let chunkIndex = 0;

        for (const paragraph of paragraphs) {
            const trimmedParagraph = paragraph.trim();
            
            if (!trimmedParagraph) continue;

            // Si el párrafo es muy largo, dividirlo
            if (trimmedParagraph.length > maxChunkSize) {
                // Guardar el chunk actual si tiene contenido
                if (currentChunk.length >= minChunkSize) {
                    chunks.push({
                        text: currentChunk.trim(),
                        index: chunkIndex++
                    });
                    currentChunk = '';
                }

                // Dividir el párrafo largo
                const subChunks = this.chunkText(trimmedParagraph, {
                    chunkSize: maxChunkSize,
                    overlap: 100
                });

                for (const subChunk of subChunks) {
                    chunks.push({
                        text: subChunk.text,
                        index: chunkIndex++
                    });
                }
                continue;
            }

            // Si agregar el párrafo excede el tamaño máximo, guardar el chunk actual
            if (currentChunk.length + trimmedParagraph.length + 2 > maxChunkSize) {
                if (currentChunk.length >= minChunkSize) {
                    chunks.push({
                        text: currentChunk.trim(),
                        index: chunkIndex++
                    });
                }
                currentChunk = trimmedParagraph;
            } else {
                currentChunk += (currentChunk ? '\n\n' : '') + trimmedParagraph;
            }
        }

        // Agregar el último chunk
        if (currentChunk.length >= minChunkSize) {
            chunks.push({
                text: currentChunk.trim(),
                index: chunkIndex
            });
        } else if (currentChunk.length > 0 && chunks.length > 0) {
            // Agregar al último chunk si es muy pequeño
            chunks[chunks.length - 1].text += '\n\n' + currentChunk.trim();
        } else if (currentChunk.length > 0) {
            chunks.push({
                text: currentChunk.trim(),
                index: chunkIndex
            });
        }

        return chunks;
    }
}

module.exports = new ChunkingService();
