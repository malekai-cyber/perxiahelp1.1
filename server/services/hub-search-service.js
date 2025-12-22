// ============================================
// HUB SEARCH SERVICE
// Conecta con Azure AI Search para Periferia IT Hub
// (Casos de Éxito, PoCs, Herramientas)
// ============================================

const { SearchClient, AzureKeyCredential } = require('@azure/search-documents');

class HubSearchService {
    constructor() {
        this.endpoint = process.env.AZURE_HUB_SEARCH_ENDPOINT;
        this.apiKey = process.env.AZURE_HUB_SEARCH_API_KEY;
        this.indexName = process.env.AZURE_HUB_SEARCH_INDEX_NAME;
        
        if (!this.endpoint || !this.apiKey || !this.indexName) {
            console.warn('⚠️ Hub Search Service: Variables de entorno no configuradas');
            this.client = null;
        } else {
            this.client = new SearchClient(
                this.endpoint,
                this.indexName,
                new AzureKeyCredential(this.apiKey)
            );
            console.log('✅ Hub Search Service inicializado:', this.indexName);
        }
    }

    /**
     * Extraer título inteligente del contenido
     * @param {object} item - Documento del índice
     * @returns {string} - Título generado
     */
    extractTitle(item) {
        const content = item.content || item.contenido || item.chunk || item.text || '';
        
        // Lista de países/lugares que NO deben ser títulos por sí solos
        const invalidTitles = ['colombia', 'ecuador', 'perú', 'peru', 'méxico', 'mexico', 'chile', 
                              'argentina', 'brasil', 'panamá', 'panama', 'costa rica', 'latinoamérica',
                              'sin título', 'untitled', 'documento', 'caso de éxito', 'caso de exito'];
        
        // Función para validar si un título es útil
        const isValidTitle = (t) => {
            if (!t || t.length < 5) return false;
            const lower = t.toLowerCase().trim();
            return !invalidTitles.includes(lower) && lower.length > 3;
        };

        // 1. Buscar nombre de cliente/empresa específico en el contenido
        const clientPatterns = [
            /cliente[:\s]+([A-ZÁÉÍÓÚÑ][A-Za-záéíóúñ\s&\-]+?)(?:\s+Sector|\s+País|\.|,|;|\n)/i,
            /para\s+(?:el\s+)?(?:Banco\s+)?([A-ZÁÉÍÓÚÑ][A-Za-záéíóúñ0-9\s&\-]+?)(?:\s+Sector|\.|,|;|\n)/i,
            /(?:Banco|Bancolombia|Davivienda|BBVA|ATH|AVC|Fedepalma|Ruminau|Occidente)(?:\s*\/\s*\w+)?/gi,
        ];

        let clientName = null;
        for (const pattern of clientPatterns) {
            const match = content.match(pattern);
            if (match) {
                const candidate = match[1] || match[0];
                if (candidate && isValidTitle(candidate)) {
                    clientName = candidate.trim();
                    break;
                }
            }
        }

        // 2. Buscar qué se hizo (el proyecto/acción)
        const projectPatterns = [
            /(?:Implementación|Desarrollo|Migración|Renovación|Integración|Modernización|Creación|Automatización)\s+(?:de(?:l)?\s+)?([^.;]+?)(?:\s+para|\s+en\s+|\.|;)/i,
            /(?:Maquila|Certificación|Aplicaciones?|Sistema|Plataforma|Bus de Servicios?)\s+(?:de\s+|en\s+)?([^.;]{5,50}?)(?:\s+para|\.|;)/i,
            /proyecto\s+([^.;]+?)(?:\s+para|\.|;)/i,
            /(?:CI\/CD|DevOps|DevSecOps|QR|SAM|FEP)\s+(?:para\s+)?([^.;]+?)(?:\.|;|$)/i,
        ];

        let projectDesc = null;
        for (const pattern of projectPatterns) {
            const match = content.match(pattern);
            if (match && match[1] && match[1].trim().length > 5) {
                projectDesc = match[1].trim();
                // Limpiar si termina en palabras comunes
                projectDesc = projectDesc.replace(/\s+(de|del|para|en|con|al|la|el|los|las)$/i, '');
                break;
            }
        }

        // También buscar la acción directamente
        const actionMatch = content.match(/(?:Implementación|Desarrollo|Migración|Renovación|Integración|Modernización|Creación)\s+(?:de(?:l)?\s+)?([A-Za-záéíóúñ\s\/\-]+?)(?:\s+para|\.|;)/i);
        if (actionMatch && actionMatch[0]) {
            const fullAction = actionMatch[0].replace(/\s+para.*$/, '').trim();
            if (fullAction.length > 10 && fullAction.length < 60) {
                projectDesc = fullAction;
            }
        }

        // 3. Construir título combinando cliente + proyecto
        let title = '';
        
        if (projectDesc && clientName) {
            // Tenemos ambos: "Proyecto X para Cliente Y"
            title = `${projectDesc} - ${clientName}`;
        } else if (projectDesc) {
            // Solo proyecto
            title = projectDesc;
        } else if (clientName && isValidTitle(clientName)) {
            // Solo cliente válido
            title = `Proyecto para ${clientName}`;
        }

        // 4. Si aún no tenemos título, buscar en campos del documento
        if (!title || !isValidTitle(title)) {
            // Buscar en descripción
            const desc = item.descripcion || item.description || '';
            if (desc && desc.length > 10 && isValidTitle(desc.split('.')[0])) {
                title = desc.split('.')[0].trim();
            }
        }

        // 5. Buscar tecnologías clave como último recurso
        if (!title || !isValidTitle(title)) {
            const techPatterns = [
                /(Azure\s+\w+(?:\s+\w+)?)/i,
                /(AWS\s+\w+(?:\s+\w+)?)/i,
                /(Power\s+(?:BI|Apps|Automate))/i,
                /(Kubernetes|Docker|DevOps|CI\/CD)/i,
                /(Cosmos\s+DB|SQL\s+Server|MongoDB)/i,
            ];
            
            for (const pattern of techPatterns) {
                const match = content.match(pattern);
                if (match && match[1]) {
                    title = `Implementación ${match[1]}`;
                    break;
                }
            }
        }

        // 6. Último recurso: primera oración significativa
        if (!title || !isValidTitle(title)) {
            const sentences = content
                .replace(/^[A-Z\s]+[;:]/gm, '')
                .split(/[.!?]+/)
                .filter(s => s.trim().length > 20 && isValidTitle(s));
            
            if (sentences.length > 0) {
                const words = sentences[0].trim().split(/\s+/).slice(0, 8);
                title = words.join(' ');
            }
        }

        return this.cleanTitle(title || 'Proyecto de Periferia IT');
    }

    /**
     * Limpiar y formatear título
     * @param {string} title - Título a limpiar
     * @returns {string} - Título limpio
     */
    cleanTitle(title) {
        if (!title) return 'Sin título';
        
        // Remover prefijos no deseados
        title = title
            .replace(/^[\/\-\s:;]+/, '')
            .replace(/^(logro|titulo|blog|fecha|cliente|proyecto)[:\s]*/i, '')
            .replace(/^(Colombia|Ecuador|Perú|México|Chile|Argentina)[:\s]*/i, '') // Quitar países al inicio
            .replace(/[""\[\]]+/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        
        // Capitalizar primera letra
        if (title.length > 0) {
            title = title.charAt(0).toUpperCase() + title.slice(1);
        }
        
        // Limitar longitud
        if (title.length > 60) {
            title = title.substring(0, 57) + '...';
        }
        
        return title || 'Sin título';
    }

    /**
     * Clasificar automáticamente el tipo de documento
     * @param {object} item - Documento del índice
     * @returns {string} - Tipo clasificado (caso_exito, poc, pov, herramienta)
     */
    classifyType(item) {
        const content = (item.content || item.contenido || item.chunk || item.text || '').toLowerCase();
        const existingType = (item.tipo || item.type || item.categoria || '').toLowerCase();

        // Priorizar tipo existente si es válido
        if (existingType.includes('caso') || existingType.includes('exito') || existingType.includes('éxito')) return 'caso_exito';
        if (existingType.includes('poc')) return 'poc';
        if (existingType.includes('pov')) return 'pov';
        if (existingType.includes('herramienta') || existingType.includes('tool')) return 'herramienta';

        // ===== DETECCIÓN DE POC =====
        // POC explícito en contenido
        if (content.match(/\bpoc\b[;:\s]/i) || 
            content.includes('proof of concept') ||
            content.includes('prueba de concepto')) {
            return 'poc';
        }
        
        // Indicadores fuertes de POC
        const pocIndicators = [
            'prototipo', 'demo', 'demostración', 'piloto', 'validación técnica',
            'prueba técnica', 'concepto', 'experimentación', 'evaluación técnica',
            'fase de prueba', 'mvp', 'mínimo viable'
        ];
        let pocScore = 0;
        for (const indicator of pocIndicators) {
            if (content.includes(indicator)) pocScore++;
        }
        if (pocScore >= 2) return 'poc';

        // ===== DETECCIÓN DE POV =====
        if (content.match(/\bpov\b[;:\s]/i) || 
            content.includes('proof of value') ||
            content.includes('prueba de valor')) {
            return 'pov';
        }
        
        // Indicadores de POV
        const povIndicators = [
            'valor de negocio', 'retorno de inversión', 'roi', 'impacto comercial',
            'beneficio económico', 'caso de negocio', 'business case'
        ];
        for (const indicator of povIndicators) {
            if (content.includes(indicator)) return 'pov';
        }

        // ===== DETECCIÓN DE CASO DE ÉXITO =====
        if (content.match(/caso\s*de\s*[eé]xito/i)) return 'caso_exito';
        
        // Indicadores fuertes de caso de éxito
        const casoIndicators = [
            'cliente:', 'resultado:', 'logro:', 'impacto:', 'beneficio:',
            'implementación exitosa', 'proyecto completado', 'producción',
            'en producción', 'go live', 'lanzamiento'
        ];
        let casoScore = 0;
        for (const indicator of casoIndicators) {
            if (content.includes(indicator)) casoScore++;
        }
        // Si tiene indicadores de cliente + resultado = caso de éxito
        if (casoScore >= 2) return 'caso_exito';
        if (content.includes('cliente') && (content.includes('resultado') || content.includes('logr'))) {
            return 'caso_exito';
        }

        // ===== DETECCIÓN DE HERRAMIENTA =====
        if (content.match(/herramienta[;:\s]/i) || content.match(/tool[;:\s]/i)) {
            return 'herramienta';
        }
        
        const toolIndicators = [
            'sdk', 'librería', 'library', 'framework', 'api', 'plugin',
            'extensión', 'extension', 'utilidad', 'utility', 'módulo'
        ];
        let toolScore = 0;
        for (const indicator of toolIndicators) {
            if (content.includes(indicator)) toolScore++;
        }
        if (toolScore >= 2) return 'herramienta';

        // Si no se puede clasificar pero tiene indicadores parciales
        if (pocScore >= 1) return 'poc';
        if (casoScore >= 1) return 'caso_exito';
        if (toolScore >= 1) return 'herramienta';

        return 'otros';
    }

    /**
     * Extraer tags/etiquetas del contenido para filtros
     * @param {object} item - Documento del índice
     * @returns {Array<string>} - Tags extraídos
     */
    extractTags(item) {
        const content = (item.content || item.contenido || item.chunk || item.text || '').toLowerCase();
        const tags = new Set();

        // Tags de tecnología
        const techPatterns = {
            'azure': /azure|microsoft cloud/i,
            'ai': /\b(ia|ai|inteligencia artificial|machine learning|ml|deep learning)\b/i,
            'data': /\b(data|datos|analytics|bi|power bi|tableau|etl)\b/i,
            'cloud': /\b(cloud|nube|aws|gcp|kubernetes|docker)\b/i,
            'devops': /\b(devops|ci\/cd|pipeline|jenkins|github actions)\b/i,
            'web': /\b(web|frontend|backend|react|angular|node|api rest)\b/i,
            'mobile': /\b(mobile|móvil|ios|android|flutter|react native)\b/i,
            'iot': /\b(iot|internet of things|sensores|embedded)\b/i,
            'security': /\b(seguridad|security|cybersecurity|oauth|jwt)\b/i,
            'database': /\b(sql|nosql|mongodb|cosmos|postgresql|mysql)\b/i,
            'automation': /\b(automatización|automation|rpa|power automate)\b/i,
        };

        for (const [tag, pattern] of Object.entries(techPatterns)) {
            if (pattern.test(content)) {
                tags.add(tag);
            }
        }

        // Tags de industria
        const industryPatterns = {
            'finanzas': /\b(banco|financiero|fintech|crédito|inversión)\b/i,
            'retail': /\b(retail|comercio|ecommerce|tienda|ventas)\b/i,
            'salud': /\b(salud|hospital|médico|healthcare|clínica)\b/i,
            'educación': /\b(educación|universidad|escuela|learning)\b/i,
            'gobierno': /\b(gobierno|público|municipal|estatal)\b/i,
            'manufactura': /\b(manufactura|producción|fábrica|industrial)\b/i,
        };

        for (const [tag, pattern] of Object.entries(industryPatterns)) {
            if (pattern.test(content)) {
                tags.add(tag);
            }
        }

        return Array.from(tags);
    }

    /**
     * Extraer descripción resumida del contenido
     * @param {object} item - Documento del índice
     * @returns {string} - Descripción corta
     */
    extractDescription(item) {
        if (item.descripcion) return item.descripcion;
        if (item.description) return item.description;
        if (item.summary) return item.summary;

        const content = item.content || item.contenido || item.chunk || item.text || '';
        
        // Limpiar el contenido de marcadores de tipo
        let cleaned = content
            .replace(/^(CASO DE [EÉ]XITO|POC|POV|HERRAMIENTA)[;:]\s*/gi, '')
            .replace(/T[ÍI]TULO\s*PRINCIPAL[:\s]*[""][^""]+[""]/gi, '')
            .replace(/Blog[:\s]*[^T]+/gi, '')
            .trim();

        // Obtener las primeras oraciones significativas
        const sentences = cleaned.split(/[.!?]+/).filter(s => s.trim().length > 20);
        if (sentences.length > 0) {
            let desc = sentences[0].trim();
            if (desc.length > 150) desc = desc.substring(0, 147) + '...';
            return desc;
        }

        // Fallback: primeras palabras
        if (cleaned.length > 150) cleaned = cleaned.substring(0, 147) + '...';
        return cleaned || 'Sin descripción disponible';
    }

    /**
     * Procesar y enriquecer un item del índice
     * @param {object} item - Documento crudo del índice
     * @returns {object} - Documento enriquecido
     */
    enrichItem(item) {
        // Mapear campos del índice (con mayúsculas) a campos esperados
        const content = item.Contenido || item.contenido || item.content || item.chunk || item.text || '';
        const titulo = item.TituloCaso || item.Nombre || item.titulo || item.title || '';
        const cliente = item.Cliente || item.cliente || '';
        const enlace = item.Enlace || item.enlace || item.url || '';
        const keyPhrases = item.keyPhrases || [];
        const organizations = item.organizations || [];
        
        // Crear item normalizado
        const normalized = {
            ...item,
            // Campos normalizados (lowercase)
            content: content,
            title: titulo,
            cliente: cliente,
            enlace: enlace,
            keyPhrases: keyPhrases,
            organizations: organizations,
        };
        
        return {
            ...normalized,
            // Campos enriquecidos
            enrichedTitle: titulo || this.extractTitle(normalized),
            enrichedType: this.classifyType(normalized),
            enrichedTags: keyPhrases.length > 0 ? keyPhrases.slice(0, 5) : this.extractTags(normalized),
            enrichedDescription: content ? (content.length > 200 ? content.substring(0, 197) + '...' : content) : 'Sin descripción disponible',
            enrichedCliente: cliente || (organizations.length > 0 ? organizations[0] : 'Periferia IT'),
            // Mantener campos originales
            originalTitle: titulo,
            originalType: item.tipo || item.type || item.categoria || null
        };
    }

    /**
     * Buscar en el índice del Hub
     * @param {string} query - Texto de búsqueda
     * @param {object} options - Opciones de búsqueda
     * @returns {Promise<Array>} - Resultados de búsqueda
     */
    async search(query, options = {}) {
        if (!this.client) {
            throw new Error('Hub Search Service no está configurado');
        }

        const {
            top = 10,
            filter = null,
            select = null,
            orderBy = null,
            enrich = true
        } = options;

        try {
            const searchOptions = {
                top,
                includeTotalCount: true
            };

            if (filter) searchOptions.filter = filter;
            if (select) searchOptions.select = select;
            if (orderBy) searchOptions.orderBy = orderBy;

            const results = await this.client.search(query || '*', searchOptions);
            
            const items = [];
            for await (const result of results.results) {
                const item = {
                    ...result.document,
                    score: result.score
                };
                // Enriquecer el item con título, tipo, tags
                items.push(enrich ? this.enrichItem(item) : item);
            }

            return {
                success: true,
                count: results.count || items.length,
                items
            };
        } catch (error) {
            console.error('❌ Error buscando en Hub:', error.message);
            throw error;
        }
    }

    /**
     * Obtener todos los items (para listar en el Hub)
     * @param {object} options - Opciones de búsqueda
     * @returns {Promise<Array>} - Todos los documentos
     */
    async getAll(options = {}) {
        return this.search('*', options);
    }

    /**
     * Obtener items por categoría (clasificación automática)
     * @param {string} category - Categoría (casos, pocs, tools)
     * @param {number} top - Cantidad máxima de resultados
     * @returns {Promise<Array>} - Items filtrados por categoría
     */
    async getByCategory(category, top = 50) {
        try {
            // Obtener todos los items y filtrar por clasificación enriquecida
            const results = await this.search('*', { top: 200, enrich: true });
            
            const categoryMap = {
                casos: ['caso_exito'],
                pocs: ['poc', 'pov'],
                tools: ['herramienta'],
                all: ['caso_exito', 'poc', 'pov', 'herramienta', 'otros']
            };

            const validTypes = categoryMap[category] || categoryMap.all;
            
            const filtered = results.items.filter(item => 
                validTypes.includes(item.enrichedType)
            );

            return {
                success: true,
                count: filtered.length,
                items: filtered.slice(0, top)
            };
        } catch (error) {
            console.error('⚠️ Error obteniendo por categoría:', error.message);
            return { success: false, count: 0, items: [] };
        }
    }

    /**
     * Búsqueda semántica para el chat
     * @param {string} query - Pregunta del usuario
     * @param {number} top - Cantidad de resultados
     * @returns {Promise<Array>} - Contexto relevante
     */
    async searchForContext(query, top = 5) {
        if (!this.client) {
            return { success: false, items: [], context: '' };
        }

        try {
            // Primero intentar búsqueda normal
            let results = await this.search(query, { top, enrich: true });
            
            // Si no hay resultados, intentar con términos clave del query
            if (results.items.length === 0) {
                // Extraer palabras clave importantes (nombres de empresas, tecnologías, etc.)
                const keywords = query
                    .replace(/["""'']/g, '') // Quitar comillas
                    .replace(/cuéntame sobre|cuentame sobre|información sobre|informacion sobre/gi, '')
                    .replace(/de Periferia IT.*$/i, '')
                    .replace(/el caso de éxito|la poc|el pov|la herramienta|el proyecto/gi, '')
                    .trim();
                
                if (keywords && keywords.length > 3) {
                    console.log(`[Hub Search] Retry with keywords: "${keywords}"`);
                    results = await this.search(keywords, { top, enrich: true });
                }
            }
            
            // Si aún no hay resultados, intentar búsqueda más amplia
            if (results.items.length === 0) {
                // Extraer posibles nombres de empresa/proyecto
                const entityMatch = query.match(/(?:FEDEPALMA|ATH|Banco|Occidente|Ruminau|FEP|Certificación|Migración|DevOps)/i);
                if (entityMatch) {
                    console.log(`[Hub Search] Retry with entity: "${entityMatch[0]}"`);
                    results = await this.search(entityMatch[0], { top, enrich: true });
                }
            }
            
            // Construir contexto para el LLM usando campos enriquecidos
            let context = '';
            if (results.items.length > 0) {
                context = results.items.map((item, i) => {
                    const title = item.enrichedTitle || 'Sin título';
                    const type = item.enrichedType || 'documento';
                    const typeLabel = type === 'caso_exito' ? 'CASO DE ÉXITO' : 
                                      type === 'poc' ? 'PRUEBA DE CONCEPTO (PoC)' :
                                      type === 'pov' ? 'PRUEBA DE VALOR (PoV)' :
                                      type === 'herramienta' ? 'HERRAMIENTA' : 'DOCUMENTO';
                    const tags = item.enrichedTags?.join(', ') || '';
                    const desc = item.enrichedDescription || '';
                    const content = item.content || item.contenido || item.chunk || '';
                    
                    // Formato más claro para que la IA no confunda con información general
                    return `══════════════════════════════════════
📋 ${typeLabel} #${i + 1}
══════════════════════════════════════
🏷️ NOMBRE DEL PROYECTO/CLIENTE: ${title}
📂 Tipo: ${typeLabel}
${tags ? `🔖 Tecnologías/Tags: ${tags}` : ''}
${desc ? `📝 Resumen: ${desc}` : ''}

📄 DETALLE DEL PROYECTO:
${content}
══════════════════════════════════════`;
                }).join('\n\n');
            }

            return {
                success: true,
                items: results.items,
                context,
                count: results.count
            };
        } catch (error) {
            console.error('❌ Error en searchForContext:', error.message);
            return { success: false, items: [], context: '' };
        }
    }

    /**
     * Obtener estadísticas del índice (usando clasificación automática)
     * @returns {Promise<object>} - Estadísticas
     */
    async getStats() {
        try {
            // Si no hay cliente configurado, devolver stats de demo
            if (!this.client) {
                console.log('ℹ️ Hub no configurado, devolviendo stats de demo');
                return {
                    success: true,
                    stats: {
                        total: 45,
                        casos: 18,
                        pocs: 12,
                        tools: 8,
                        otros: 7,
                        topTags: {
                            'Azure': 15,
                            'AI': 12,
                            'DevOps': 10,
                            'Cloud': 8,
                            'Data': 6
                        }
                    }
                };
            }

            const all = await this.search('*', { top: 500, enrich: true });
            
            // Contar por categorías usando clasificación enriquecida
            const stats = {
                total: all.count,
                casos: 0,
                pocs: 0,
                tools: 0,
                otros: 0,
                // Tags más comunes
                topTags: {}
            };

            all.items.forEach(item => {
                const tipo = item.enrichedType;
                if (tipo === 'caso_exito') stats.casos++;
                else if (tipo === 'poc' || tipo === 'pov') stats.pocs++;
                else if (tipo === 'herramienta') stats.tools++;
                else stats.otros++;

                // Contar tags
                (item.enrichedTags || []).forEach(tag => {
                    stats.topTags[tag] = (stats.topTags[tag] || 0) + 1;
                });
            });

            // Ordenar tags por frecuencia
            stats.topTags = Object.entries(stats.topTags)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});

            return { success: true, stats };
        } catch (error) {
            console.error('❌ Error obteniendo stats:', error.message);
            return { success: false, stats: { total: 0, casos: 0, pocs: 0, tools: 0 } };
        }
    }

    /**
     * Obtener tags disponibles para filtros
     * @param {string} category - Categoría opcional para filtrar
     * @returns {Promise<Array>} - Lista de tags con conteos
     */
    async getAvailableTags(category = null) {
        try {
            let items;
            if (category && category !== 'all') {
                const result = await this.getByCategory(category, 200);
                items = result.items;
            } else {
                const result = await this.search('*', { top: 200, enrich: true });
                items = result.items;
            }

            const tagCounts = {};
            items.forEach(item => {
                (item.enrichedTags || []).forEach(tag => {
                    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                });
            });

            // Convertir a array ordenado
            const tags = Object.entries(tagCounts)
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count);

            return { success: true, tags };
        } catch (error) {
            console.error('❌ Error obteniendo tags:', error.message);
            return { success: false, tags: [] };
        }
    }

    /**
     * Verificar conexión con el índice
     * @returns {Promise<boolean>}
     */
    async testConnection() {
        if (!this.client) return false;
        
        try {
            await this.search('*', { top: 1 });
            return true;
        } catch (error) {
            console.error('❌ Error de conexión Hub Search:', error.message);
            return false;
        }
    }
}

module.exports = new HubSearchService();
