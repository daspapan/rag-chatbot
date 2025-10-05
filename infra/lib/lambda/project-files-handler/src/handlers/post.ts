import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { 
    createFileRecord, 
    findTenant, 
    listProjectFilesByProjectId 
} from '../services/ProjectFiles'
import { createResponse, getUserTenantFromClaims, logger } from '../utils/common'
import { createUploadPresignedUrl } from '../services/S3Service'


export const handlePostRequest = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {

    logger.info(`Handle Post Request: ${JSON.stringify(event, null, 2)}`)

    const { userId, tenantId } = getUserTenantFromClaims(event)

    const pathParameters = event.pathParameters || {}
    if (!('projectId' in pathParameters)) {
        logger.warn('Project ID is missing in POST request')
        return createResponse(event, 400, { message: 'Project ID is required' })
    }

    const projectId = decodeURIComponent(pathParameters.projectId || '')

    if (!event.body) {
        return createResponse(event, 400, { error: 'Request body is missing' })
    }

    const body = JSON.parse(event.body)
    const fileName = body.filename
    const fileSize = body.filesize

    if (!fileName || !fileSize) {
        logger.warn('Missing filename or filesize in request')
        return createResponse(event, 400, { error: 'file name and file size are required' })
    }

    logger.info(`Processing upload request for file: ${fileName}, projectId: ${projectId}`)
    
    // Check tenant file limit
    const tenant = findTenant(tenantId)
    if (!tenant) {
        logger.warn(`Tenant not found: ${tenantId}`)
        return createResponse(event, 400, { error: 'Invalid tenant' })
    }
    
    const existingFiles = await listProjectFilesByProjectId(tenantId, projectId)
    const currentFileCount = existingFiles.length
    const maxFiles = tenant.MaxFiles
    
    if (currentFileCount >= maxFiles) {
        logger.warn(`File limit exceeded for tenant ${tenantId}. Current: ${currentFileCount}, Max: ${maxFiles}`)
        
        return createResponse(event, 400, {
            error: `File limit exceeded. Maximum ${maxFiles} files allowed per project.`
        })
    }

    const s3Key = `${tenantId}/${projectId}/${fileName}`
    const fileId = await createFileRecord(userId, tenantId, projectId, fileName, fileSize, s3Key)

    const result = await createUploadPresignedUrl(fileId, s3Key)
    
    if (!result) {
        logger.error('Failed to generate upload URL')
        return createResponse(event, 500, { error: 'Failed to generate upload URL' })
    }
    
    return createResponse(event, 200, result)


}