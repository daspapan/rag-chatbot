// Structure for a file item in the KNOWLEDGE_BASE_FILES_TABLE
export interface KnowledgeBaseFile {
    id: string;
    userId: string;
    tenantId: string;
    projectId: string;
    documentStatus: 'ready' | 'ingesting' | 'complete' | 'failed';
    createdAt: number;
    ttl: number;
}