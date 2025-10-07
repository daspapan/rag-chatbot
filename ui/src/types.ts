// src/types.ts

import { RetrieveAndGenerateCommandOutput } from "@aws-sdk/client-bedrock-agent-runtime";

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
    tags?: string;
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
    filename: string;
    filetype: string;
    filesize: number;
}

export interface UploadResponse {
    fileId: string;
    uploadUrl: string;
    // ... other file metadata
}

export interface FileDownloadUrl {
    downloadUrl: string;
}

// Knowledge Base API Payloads
export interface QueryData {
    projectId: string;
    query: string;
    sessionId: string; // For continuation
    // historyId?: string; // For continuation
}

/* export interface QueryResult {
    answer: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    citations: any[]; // Define a more specific interface if known
    historyId: string;
} */

export interface QueryResult {
    query: string
    results: RetrieveAndGenerateCommandOutput
    result: {
        sessionId: string | undefined
        output: {text: string | undefined}
    } 
    sources: any[]
    source: {
        fileId: string
        content: string
        metadata: Record<string, DocumentType> | undefined
    }
    filters: { 
        fileIds: string
        projectId: string
        tenantId: string
        userId: string 
    }
}

export interface StatusData {
    projectId: string;
}

export interface StatusResponse {
    itemStatus: 'ready' | 'ingesting' | 'error';
    message: string;
}

export interface ChatType {
    type: string
    content: string
    timestamp: string
    sources?: ChatSourcesType[]
    showSources?: boolean
}

export interface ChatSourcesType {
    fileId: string
    filename: string
    userId: string
    projectId: string
    content: string
    fullContent: string
    fileInfo: string
    expanded: boolean
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

export interface CheckedFiles {
    [id: string]: boolean;
}

