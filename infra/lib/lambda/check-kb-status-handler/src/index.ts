import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'

import { createResponse, getUserTenantFromClaims, handleClientError, handleGeneralException, handleOptionsRequest, logger } from './utils/common'
import { KNOWLEDGE_BASE_ID } from './constants'
import { getProjectFiles, ingestFiles } from './services/KnowledgeBase'

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {

    console.log('[Received event]', JSON.stringify(event, null, 2))

    try {

        const optionsResponse = handleOptionsRequest(event)
        if (optionsResponse) {
            return optionsResponse
        }
        
        try {
            // Get the user ID from the Cognito authorizer
            const {userId, tenantId} = getUserTenantFromClaims(event)
            logger.info(`Processing KB status check for user: ${userId} tenant: ${tenantId}`)
            
            // Parse the request body
            const body = JSON.parse(event.body || '{}')
            const projectId = body.projectId

            if (!KNOWLEDGE_BASE_ID) {
                logger.error('Knowledge base ID not configured')
                
                return createResponse(event, 500, { error: 'Knowledge base ID not configured' })
            }
            
            if (!userId) {
                logger.warn('User ID is missing in request')
                return createResponse(event, 400, { error: 'User ID is required' })
            }
            
            if (!projectId) {
                logger.warn('Report project ID is missing in request')
                return createResponse(event, 400, { error: 'Report project ID is required' })
            }

            logger.info(`Checking files for project ID: ${projectId}`)
            const selectedFiles = await getProjectFiles(userId, tenantId, projectId)

            if (!selectedFiles || selectedFiles.length === 0) {
                logger.warn(`No files found for project ID: ${projectId}`)
                return createResponse(event, 400, { error: 'Project requires files' })
            }
            
            logger.info(`Found ${selectedFiles.length} files for project ID: ${projectId}. Starting ingestion check.`)
            
            // The original Python code calls ingestFiles which puts a record in DDB and calls Bedrock ingest for every file.
            await ingestFiles(userId, tenantId, projectId, selectedFiles)

            
            return createResponse(event, 200, { 
                'itemStatus': 'ready',
                'message': 'Ingestion requests processed for all project files'
            })
                
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
            if (e.name && e.name.endsWith('Exception')) {
                return handleClientError(e, event)
            }
            if (e.message.includes('TENANTS configuration error')) {
                return createResponse(event, 500, { error: 'Configuration Error', message: e.message })
            }
            return handleGeneralException(e, event, 'KnowledgeBaseStatusError')
        }
        
    } catch (error) {
        console.error('Error:', error)
        return createResponse(event, 500, { message: 'Internal Server Error', error })
    }
    
}





