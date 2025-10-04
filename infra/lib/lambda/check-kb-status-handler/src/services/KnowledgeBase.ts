import { PutCommand, QueryCommand, QueryCommandInput } from '@aws-sdk/lib-dynamodb'
import { DATA_SOURCE_ID, KNOWLEDGE_BASE_FILES_TABLE, KNOWLEDGE_BASE_ID, PROJECT_FILES_TABLE } from '../constants'
import { ProjectFile } from '../models/ProjectFilesModel'
import { bedrockAgent, ddbDocClient, logger } from '../utils/common'
import { TenantConfig } from '../models/TenantConfigModel'
import { KnowledgeBaseFile } from '../models/KnowledgeBaseFileModel'
import { IngestKnowledgeBaseDocumentsCommand, IngestKnowledgeBaseDocumentsCommandInput } from '@aws-sdk/client-bedrock-agent'

const TENANTS_CONFIG: TenantConfig[] = JSON.parse(process.env.TENANTS || '{"Tenants":[]}').Tenants



/**
 * Find the tenant configuration by ID.
 */
function findTenant(tenantId: string, tenants: TenantConfig[]): TenantConfig | undefined {
    try {
        return tenants.find(tenant => tenant.Id === tenantId)
    } catch (e) {
        logger.warn(`Error finding tenant ${tenantId} in config: ${JSON.stringify(e, null, 2)}`)
        return undefined
    }
}




/**
 * Get files for a tenant id and project ID.
 */
export async function getProjectFiles(userId: string, tenantId: string, projectId: string): Promise<ProjectFile[] | null> {
    if (!PROJECT_FILES_TABLE) {
        logger.warn('Project files table not configured')
        return null
    }

    try {
        logger.debug(`Getting project files for user: ${userId}, tenant: ${tenantId}, project: ${projectId}`)

        const params: QueryCommandInput = {
            TableName: PROJECT_FILES_TABLE,
            IndexName: 'tenantId-projectId-index',
            KeyConditionExpression: 'tenantId = :t and projectId = :p',
            ExpressionAttributeValues: {
                ':t': tenantId,
                ':p': projectId
            }
        }

        const command = new QueryCommand(params)
        const response = await ddbDocClient.send(command)

        const files = (response.Items as ProjectFile[] || [])
        logger.info(`Found ${files.length} files for project result`)
        return files

    } catch (e) {
        logger.warn(`Error getting project files: ${JSON.stringify(e, null, 2)}`)
        return null
    }
}






/**
 * Ingest files into the knowledge base.
 */
export async function ingestFiles(userId: string, tenantId: string, projectId: string, files: ProjectFile[]): Promise<void> {
    // 1. Calculate TTL
    let ttl: number
    try {
        const tenant = findTenant(tenantId, TENANTS_CONFIG)
        if (!tenant || !tenant.FilesTTLHours) {
            logger.warn(`Tenant ${tenantId} config missing or FilesTTLHours not set. Using default 24 hours TTL.`)
            ttl = Math.floor(Date.now() / 1000) + (24 * 3600)
        } else {
            ttl = Math.floor(Date.now() / 1000) + (tenant.FilesTTLHours * 3600)
        }
    } catch (e) {
        logger.warn(`Error parsing TENANTS config or calculating TTL. ${JSON.stringify(e, null, 2)}`)
        throw new Error('TENANTS configuration error.')
    }

    // 2. Process and Ingest Files
    try {
        logger.info(`Ingesting ${files.length} files into knowledge base`)
        let filesIngested = 0

        for (const file of files) {
            const fileId = file.id
            const s3Key = file.s3Key
            const bucket = file.bucket

            logger.info(`Processing file ID: ${fileId} from bucket: ${bucket}, key: ${s3Key}`)

            // A. Create a record in the knowledge base files table
            const ddbItem: KnowledgeBaseFile = {
                id: fileId,
                userId: userId,
                tenantId: tenantId,
                projectId: projectId,
                documentStatus: 'ready',
                createdAt: Math.floor(Date.now() / 1000),
                ttl: ttl
            }
            
            const putCommand = new PutCommand({
                TableName: KNOWLEDGE_BASE_FILES_TABLE,
                Item: ddbItem,
            })
            await ddbDocClient.send(putCommand)

            // B. Prepare and Start the ingestion job
            const clientToken = crypto.randomUUID()
            const s3Uri = `s3://${bucket}/${s3Key}`

            const ingestParams: IngestKnowledgeBaseDocumentsCommandInput = {
                knowledgeBaseId: KNOWLEDGE_BASE_ID,
                dataSourceId: DATA_SOURCE_ID,
                clientToken: clientToken,
                documents: [
                    {
                        content: {
                            dataSourceType: 'CUSTOM',
                            custom: {
                                customDocumentIdentifier: {
                                    id: fileId
                                },
                                s3Location: {
                                    uri: s3Uri
                                },
                                sourceType: 'S3_LOCATION'
                            }
                        },
                        metadata: {
                            type: 'IN_LINE_ATTRIBUTE',
                            inlineAttributes: [
                                { key: 'userId', value: { stringValue: userId, type: 'STRING' } },
                                { key: 'tenantId', value: { stringValue: tenantId, type: 'STRING' } },
                                { key: 'projectId', value: { stringValue: projectId, type: 'STRING' } },
                                { key: 'fileId', value: { stringValue: fileId, type: 'STRING' } }
                            ]
                        }
                    }
                ]
            }

            // tracer.put_annotation('operation', 'ingest_knowledge_base_documents');
            const ingestCommand = new IngestKnowledgeBaseDocumentsCommand(ingestParams)
            await bedrockAgent.send(ingestCommand)
            
            filesIngested++
            logger.debug(`Successfully requested ingestion for file ID: ${fileId}`)
        }

        logger.info(`Successfully processed ${filesIngested} ingestion requests`)
        

    } catch (e) {
        logger.warn(`Error ingesting files: ${JSON.stringify(e, null, 2)}`)
        throw e // Re-raise the exception
    }
}