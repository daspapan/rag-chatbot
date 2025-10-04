// DynamoDB Chat History item structure
export interface ChatMessage {
    id: string;
    sessionId: string;
    tenantId: string;
    userId: string;
    projectId: string;
    type: 'user' | 'ai' | 'system' | 'error';
    content: string;
    timestamp: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sources?: any[]; // Simplified for porting
}