/**
 * API client for the Sample Just-in-Time Amazon Bedrock Knowledge Base application
 * This file contains all the REST API calls used in the application
 */

import { HTTP_ENDPOINT } from "@/constants";
import { FileMetadata, Project, ProjectData, ProjectFile, QueryData, QueryResult, StatusData, StatusResponse, UploadResponse } from "@/types";

class ApiClient {

    private apiUrl: string;

    constructor() {
        // Get the API URL from the config
        this.apiUrl = HTTP_ENDPOINT || '' // window.config?.API;
        if (!this.apiUrl) {
            console.error('API URL (HTTP_ENDPOINT) not found in config');
        }
        
        // Remove trailing slash if present
        if (this.apiUrl && this.apiUrl.endsWith('/')) {
            this.apiUrl = this.apiUrl.slice(0, -1);
        }
    }

    /**
     * Get the authorization header with the current JWT token
     * @returns {Object} Headers object with Authorization
     */
    async getAuthHeaders() {
        // Get the current token from the auth context
        const token = '' // await this._getCurrentToken(); // MOD
        
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    }

    /**
     * Get the current authentication token
     * @returns {string} JWT token
     * @private
     */
    async _getCurrentToken() {
        try {
            // Get the current user from the auth context
            const auth = {tokens: {idToken:''}}; // window.authInstance;
            
            if (!auth || !auth.tokens || !auth.tokens.idToken) {
                throw new Error('No authentication token found');
            }
            
            return auth.tokens.idToken;
        } catch (error) {
            console.error('Error getting authentication token:', error);
            throw new Error('Not authenticated');
        }
    }

    /**
     * Make an authenticated API request
     * @param {string} endpoint - API endpoint path
     * @param {string} method - HTTP method (GET, POST, PUT, DELETE)
     * @param {Object} [body] - Request body for POST/PUT requests
     * @returns {Promise<Object>} Response data
     * @private
     */
    async _apiRequest<T>(
        endpoint:string, 
        method:'GET' | 'POST' | 'PUT' | 'DELETE', 
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        body: any = null
    ): Promise<T> {

        const headers = await this.getAuthHeaders();
        const url = `${this.apiUrl}${endpoint}`;
        
        const options: RequestInit = {
            method,
            headers,
            credentials: 'include'
        };
        
        if (body && (method === 'POST' || method === 'PUT')) {
            options.body = JSON.stringify(body);
        }
        
        try {
            const response = await fetch(url, options);
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
            }
            
            // Check if response is empty
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json() as T;
            } else if (response.status === 204) {
                 // No content for successful DELETE/OPTIONS
                return {} as T; 
            }else {
                return await response.text() as T;
            }
        } catch (error) {
            console.error('Error in API request:', 'Method:', method, 'Endpoint:', endpoint, 'Error:', error);
            throw error;
        }
    }

    // ===== Projects API =====

    /**
     * Get all projects for the current user
     * @returns {Promise<Array>} List of projects
     */
    async getProjects() {
        return this._apiRequest('/projects', 'GET');
    }

    /**
     * Get a specific project by ID
     * @param {string} projectId - Project ID
     * @returns {Promise<Object>} Project data
     */
    async getProject(projectId: string) {
        return this._apiRequest(`/projects/${projectId}`, 'GET');
    }

    /**
     * Create a new project
     * @param {Object} projectData - Project data
     * @returns {Promise<Object>} Created project
     */
    async createProject(projectData: ProjectData): Promise<Project> {
        return this._apiRequest('/projects', 'POST', projectData);
    }

    /**
     * Delete a project
     * @param {string} projectId - Project ID
     * @returns {Promise<Object>} Response data
     */
    async deleteProject(projectId: string) {
        return this._apiRequest(`/projects/${projectId}`, 'DELETE');
    }

    // ===== Project Files API =====

    /**
     * Get all files for a project
     * @param {string} projectId - Project ID
     * @returns {Promise<Array>} List of files
     */
    async getProjectFiles(projectId: string): Promise<ProjectFile[]> {
        return this._apiRequest(`/project-files/${projectId}`, 'GET');
    }

    /**
     * Get a specific file by ID
     * @param {string} projectId - Project ID
     * @param {string} fileId - File ID
     * @returns {Promise<Object>} File data
     */
    async getProjectFile(projectId: string, fileId: string) {
        return this._apiRequest(`/project-files/${projectId}/${fileId}`, 'GET');
    }

    /**
     * Upload a file to a project
     * @param {string} projectId - Project ID
     * @param {Object} fileData - File metadata
     * @returns {Promise<Object>} Created file metadata with presigned URL
     */
    async uploadProjectFile(projectId:string, fileData: FileMetadata): Promise<UploadResponse>{
        return this._apiRequest<UploadResponse>(`/project-files/${projectId}`, 'POST', fileData);
    }

    /**
     * Upload file content using presigned URL
     * @param {string} presignedUrl - Presigned URL for upload
     * @param {File} file - File object to upload
     * @returns {Promise<Object>} Upload response
     */
    async uploadFileContent(presignedUrl: string, file: File) {
        try {
            const response = await fetch(presignedUrl, {
                method: 'PUT',
                body: file,
                headers: {
                    'Content-Type': file.type
                }
            });
            
            if (!response.ok) {
                throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
            }
            
            return { success: true };
        } catch (error) {
            console.error('Error uploading file content:', error);
            throw error;
        }
    }

    /**
     * Delete a file from a project
     * @param {string} projectId - Project ID
     * @param {string} fileId - File ID
     * @returns {Promise<Object>} Response data
     */
    async deleteProjectFile(projectId: string, fileId: string) {
        return this._apiRequest(`/project-files/${projectId}/${fileId}`, 'DELETE');
    }

    /**
     * Get a download URL for a file
     * @param {string} projectId - Project ID
     * @param {string} fileId - File ID
     * @returns {Promise<Object>} Object containing download URL
     */
    async getFileDownloadUrl(projectId: string, fileId: string) {
        return this._apiRequest(`/project-files/${projectId}/download/${fileId}`, 'GET');
    }

    // ===== Knowledge Base API =====

    /**
     * Query the knowledge base
     * @param {Object} queryData - Query parameters
     * @returns {Promise<Object>} Query results
     */
    async queryKnowledgeBase(queryData: QueryData): Promise<QueryResult> {
        return this._apiRequest<QueryResult>('/knowledge-base/query', 'POST', queryData);
    }

    /**
     * Check the status of the knowledge base
     * @param {Object} statusData - Status request data
     * @returns {Promise<Object>} Status information
     */
    async checkKnowledgeBaseStatus(statusData: StatusData): Promise<StatusResponse> {
        return this._apiRequest<StatusResponse>('/knowledge-base/status', 'POST', statusData);
    }

    /**
     * Get chat history
     * @param {string} historyId - History ID
     * @returns {Promise<Object>} Chat history
     */
    async getChatHistory(historyId:string): Promise<Response> {
        return this._apiRequest(`/knowledge-base/history/${historyId}`, 'GET');
    }

    /**
     * Delete chat history
     * @param {string} historyId - History ID
     * @returns {Promise<Object>} Response data
     */
    async deleteChatHistory(historyId:string): Promise<Response> {
        return this._apiRequest(`/knowledge-base/history/${historyId}`, 'DELETE');
    }
}

// Create a singleton instance
const apiClient = new ApiClient();

// Export the singleton
export default apiClient;