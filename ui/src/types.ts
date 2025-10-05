// src/types.ts

// Global configuration expected to be available on the window object
declare global {
    interface Window {
        config?: AppConfig;
        authInstance?: AuthContext;
    }
}

// Configuration structure
export interface AppConfig {
    API?: string;
}

// Simplified Auth Context structure (based on _getCurrentToken logic)
export interface AuthContext {
    tokens?: {
        idToken?: string;
        accessToken?: string;
    };
    // ... potentially other auth methods
}

// --- API Request/Response Interfaces ---

// Projects API Payloads
export interface ProjectData {
    name: string;
    description?: string;
    // ... other project properties
}

export interface Project extends ProjectData {
    id: string;
    userId: string;
    tenantId: string;
    createdAt: number;
}

// Project Files API Payloads

export interface ProjectFile {
    id: string;
    userId: string;
    tenantId: string;
    projectId: string;
    createdAt: number;
    filesize: number;
    filename: string;
    s3Key: string;
    bucket: string;
}

export interface FileMetadata {
    fileName: string;
    fileType: string;
    fileSize: number;
}

export interface UploadResponse {
    fileId: string;
    presignedUrl: string;
    // ... other file metadata
}

export interface FileDownloadUrl {
    downloadUrl: string;
}

// Knowledge Base API Payloads
export interface QueryData {
    projectId: string;
    queryText: string;
    historyId?: string; // For continuation
}

export interface QueryResult {
    answer: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    citations: any[]; // Define a more specific interface if known
    historyId: string;
}

export interface StatusData {
    projectId: string;
}

export interface StatusResponse {
    itemStatus: 'ready' | 'ingesting' | 'error';
    message: string;
}

export interface ChatHistory {
    // Structure of chat history items
    messages: Array<{
        type: 'user' | 'ai';
        text: string;
        timestamp: number;
    }>;
}

export interface Response {
    statusCode: number;
    headers: string | object;
    body: string;
}

