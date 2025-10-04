import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { createResponse, getFileIds, logger } from '../utils/common'
import { 
    checkRateLimit, 
    performRetrieveAndGenerate, 
    recordQuery, 
    saveChatMessage, 
    updateChatHistorySessionId 
} from '../services/ChatService'
import { QueryRequestBody } from '../models/QueryRequestBodyModel'
import { KNOWLEDGE_BASE_ID } from '../constants'
import { 
    RetrieveAndGenerateCommandInput, 
    RetrieveAndGenerateCommandOutput 
} from '@aws-sdk/client-bedrock-agent-runtime'


export const handleQuery = async (event: APIGatewayProxyEvent, user_id: string, tenant_id: string): Promise<APIGatewayProxyResult> => {

    logger.info(`Handle Get Request: ${JSON.stringify(event, null, 2)}`)

    // 1. Check rate limit
    const [is_allowed, current_count] = await checkRateLimit(tenant_id)
    if (!is_allowed) {
        logger.warn(`Rate limit exceeded for tenant ${tenant_id}: ${current_count}`)
        
        return createResponse(event, 429, {
            error: 'Rate limit exceeded',
            message: 'You have exceeded the maximum number of queries allowed per minute'
        })
    }

    // 2. Parse request body
    const body: QueryRequestBody = JSON.parse(event.body || '{}')
    const query = body.query
    if (!query) {
        logger.warn('Missing query text in request')
        return createResponse(event, 400, { error: 'Query text is required' })
    }

    // 3. Extract parameters
    const queryParams = event.queryStringParameters || {}
    const project_id = queryParams.projectId || body.projectId
    const session_id = queryParams.sessionId || body.sessionId
    const limit = 5

    if (!KNOWLEDGE_BASE_ID) {
        logger.warn('Knowledge base ID not configured')
        return createResponse(event, 500, { error: 'Knowledge base ID not configured' })
    }
    
    if (!project_id) {
        logger.warn('Project ID is missing in request')
        return createResponse(event, 400, { error: 'Project ID is required' })
    }

    logger.info(`Processing knowledge base query: '${query}' for project ID: ${project_id}`)

    // 4. Record query for rate limit
    await recordQuery(tenant_id)

    // 5. Get file IDs and create filter
    const file_ids = await getFileIds(tenant_id, project_id)
    if (file_ids.length === 0) {
        logger.warn(`No files found for project ID: ${project_id}`)
        return createResponse(event, 404, { error: 'No files found for this project' })
    }
    logger.info(JSON.stringify({ message: 'File IDs for filter', file_ids }, null, 2))

    const filter_expression = {
        'andAll': [
            { 'equals': { 'key': 'tenantId', 'value': tenant_id } },
            { 'equals': { 'key': 'projectId', 'value': project_id } },
            // In the Bedrock Agent filter, 'in' only works for list-type metadata keys.
            // Since the original code assumes a single 'fileId' key, this filter may need adjustment
            // depending on the KB indexing schema. We port the structure directly for now.
            { 'in': { 'key': 'fileId', 'value': file_ids } } 
        ]
    }

    // 6. Create parameters for retrieve_and_generate
    const retrieve_params: RetrieveAndGenerateCommandInput = {
        input: { text: query },
        retrieveAndGenerateConfiguration: {
            type: 'KNOWLEDGE_BASE',
            knowledgeBaseConfiguration: {
                knowledgeBaseId: KNOWLEDGE_BASE_ID,
                modelArn: 'arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0', // Updated model ARN
                retrievalConfiguration: {
                    vectorSearchConfiguration: {
                        numberOfResults: limit,
                        filter: filter_expression
                    }
                }
            }
        },
    }
    
    if (session_id && session_id.trim()) {
        retrieve_params.sessionId = session_id.trim()
        logger.debug(`Using session ID: ${retrieve_params.sessionId}`)
    }

    // 7. Query the knowledge base
    let response: RetrieveAndGenerateCommandOutput
    let session_changed: boolean
    try {
        [response, session_changed] = await performRetrieveAndGenerate(retrieve_params)
        
        // Handle session ID change if required
        if (session_changed && session_id) {
            const new_session_id = response.sessionId!
            logger.info(`Session ID changed from ${session_id} to ${new_session_id}. Updating chat history.`)
            await updateChatHistorySessionId(user_id, tenant_id, project_id, session_id, new_session_id)
        }
    } catch (e: unknown) {
        logger.warn(`Error querying knowledge base: ${JSON.stringify(e, null, 2)}`)
        
        return createResponse(event, 500, { error: `Error querying knowledge base: ${e}` })
    }

    // 8. Extract sources
    const sources = (response.citations || []).flatMap(citation => 
        (citation.retrievedReferences || []).map(reference => {
            const metadata = reference.metadata || {}
            return {
                fileId: metadata.fileId || '',
                content: reference.content?.text || '',
                metadata: metadata
            }
        })
    )
    
    logger.info('Knowledge base query successful')
    
    const new_session_id = response.sessionId!
    const timestamp = Math.floor(Date.now() / 1000)
    
    // 9. Save chat history (User message)
    await saveChatMessage(
        new_session_id, user_id, tenant_id, project_id, 'user', query, timestamp
    )

    // 10. Save chat history (AI response)
    await saveChatMessage(
        new_session_id, user_id, tenant_id, project_id, 'ai', 
        response.output?.text || '', timestamp + 1, sources
    )

    // 11. Return final response
    return createResponse(event, 200, {
        query: query,
        results: response,
        sources: sources,
        filters: { fileIds: file_ids, projectId: project_id, tenantId: tenant_id, userId: user_id }
    })

}