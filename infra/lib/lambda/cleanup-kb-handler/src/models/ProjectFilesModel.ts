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
