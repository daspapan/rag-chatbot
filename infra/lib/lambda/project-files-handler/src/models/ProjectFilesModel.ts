// DynamoDB ProjectFile item structure
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

// Tenant configuration structure
export interface TenantConfig {
    Id: string;
    MaxFiles: number;
    // Add other tenant properties as needed
}