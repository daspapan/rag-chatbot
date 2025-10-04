// src/project-files-service.ts

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as AWS from 'aws-sdk'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { DATA_SOURCE_ID, KNOWLEDGE_BASE_ID, PROJECT_FILES_TABLE, USER_FILES_BUCKET } from '../constants'
import { ProjectFile, TenantConfig } from '../models/ProjectFilesModel'
import { logger } from '../utils/common'
import { deleteFromS3 } from './S3Service'


// const PROJECT_FILES_TABLE = process.env.PROJECT_FILES_TABLE!;
// const USER_FILES_BUCKET = process.env.USER_FILES_BUCKET!;
// const KNOWLEDGE_BASE_ID = process.env.KNOWLEDGE_BASE_ID;
// const DATA_SOURCE_ID = process.env.DATA_SOURCE_ID;
const TENANTS_CONFIG: TenantConfig[] = JSON.parse(process.env.TENANTS || '{"Tenants":[]}').Tenants

// AWS SDK v3 clients
const ddbClient = new DynamoDBClient({})
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient)

/**
 * Finds tenant configuration by ID.
 */
export function findTenant(tenantId: string): TenantConfig | undefined {
    return TENANTS_CONFIG.find(tenant => tenant.Id === tenantId)
} 

/**
 * Retrieves a single project file record by ID.
 */
export async function getProjectFile(tenantId: string, id: string): Promise<ProjectFile | null> {
    logger.info(`Getting project file with ID: ${id} for tenant id: ${tenantId}`)

    const command = new GetCommand({
        TableName: PROJECT_FILES_TABLE || '',
        Key: { tenantId, id },
    })
    
    const response = await ddbDocClient.send(command)
    const item = response.Item as ProjectFile | undefined

    if (!item) {
        logger.warn(`Project file not found: ${id}`)
        return null
    }

    return item
}




/**
 * Creates a new file record in DynamoDB.
 */
export async function createFileRecord(
    userId: string, 
    tenantId: string, 
    projectId: string, 
    fileName: string, 
    fileSize: number, 
    s3Key: string
): Promise<string> {
    const fileId = crypto.randomUUID()
    const current_time = Math.floor(Date.now() / 1000) // Unix epoch time in seconds
    
    const item: ProjectFile = {
        id: fileId,
        userId,
        tenantId,
        projectId,
        createdAt: current_time,
        filesize: fileSize,
        filename: fileName,
        s3Key,
        bucket: USER_FILES_BUCKET || ''
    }
    
    try {
        const command = new PutCommand({
            TableName: PROJECT_FILES_TABLE,
            Item: item
        })

        await ddbDocClient.send(command)
        
        logger.info(`Created file record with ID: ${fileId}`)
        
        return fileId
    } catch (e) {
        logger.exception('Error creating file record:', e)
        throw e
    }
}


/**
 * Lists all project file records for a given project ID.
 */
export async function listProjectFilesByProjectId(tenantId: string, projectId: string): Promise<ProjectFile[]> {
    logger.info(`Listing project files for project ID: ${projectId}`)
    
    const command = new QueryCommand({
        TableName: PROJECT_FILES_TABLE || '',
        IndexName: 'tenantId-projectId-index',
        KeyConditionExpression: 'tenantId = :t and projectId = :p',
        ExpressionAttributeValues: {
            ':t': tenantId,
            ':p': projectId,
        },
    })

    const response = await ddbDocClient.send(command)
    const items = (response.Items || []) as ProjectFile[]

    logger.info(`Found ${items.length} project files for project ID: ${projectId}`)
    
    return items
}



/**
 * Deletes the project file from S3, Knowledge Base, and DynamoDB.
 */
export async function deleteProjectFile(tenantId: string, id: string): Promise<void> {
    logger.info(`Deleting project file with ID: ${id} for tenantId: ${tenantId}`)

    // 1. Get the item to retrieve the S3 key
    const item = await getProjectFile(tenantId, id)
    if (!item) {
        throw new Error('Project file not found')
    }

    // 2. Delete from S3
    if (item.s3Key) {
        deleteFromS3(item.s3Key)
    }

    // 3. Delete document from knowledge base (Skipping actual AWS Bedrock Agent client for simplicity)
    if (KNOWLEDGE_BASE_ID && DATA_SOURCE_ID) {
        logger.warn('Skipping Bedrock Agent delete_knowledge_base_documents for simplicity of porting. In production, this call must be implemented.')
        // metrics.addMetric('DeleteKnowledgeBaseDocumentStub', 'Count', 1);
        // NOTE: In a real implementation, you would initialize and use the BedrockAgent client here.
        // Example: await bedrockAgentClient.deleteKnowledgeBaseDocuments(...)
    }

    // 4. Delete record from DynamoDB
    logger.info(`Deleting project file record from DynamoDB: ${id}`)
    const deleteDdbCommand = new DeleteCommand({
        TableName: PROJECT_FILES_TABLE,
        Key: { tenantId, id }
    })
    await ddbDocClient.send(deleteDdbCommand)
}


