// Request body structure for the query endpoint
export interface QueryRequestBody {
    query: string;
    projectId: string;
    sessionId?: string;
}