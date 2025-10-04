import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { USER_FILES_BUCKET } from '../constants'
import { logger } from '../utils/common'
import * as url from 'url'

const s3Client = new S3Client({})


/**
 * Generates a pre-signed URL for file download from S3.
 */
export async function generatePresignedUrlForDownload(
    bucket: string, 
    key: string, 
    filename: string, 
    expiration: number = 3600
): Promise<string> {
    try {
        const encodedFilename = url.pathToFileURL(filename).pathname
        const responseHeaders: { [key: string]: string } = {
            'Content-Disposition': `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`,
        }

        if (filename.toLowerCase().endsWith('.txt')) {
            responseHeaders['Content-Type'] = 'application/octet-stream'
        }

        const command = new PutObjectCommand({ // Using PutObjectCommand for presign
            Bucket: bucket,
            Key: key,
            // ResponseContentDisposition: responseHeaders['Content-Disposition'],
            // ResponseContentType: responseHeaders['Content-Type'],
        })
        
        const downloadUrl = await getSignedUrl(s3Client, command, { expiresIn: expiration })
        
        return downloadUrl
    } catch (error: AWS.AWSError | unknown) {

        logger.exception('Error generating presigned URL for download:', error)
        
        throw error

    }
}

/**
 * Creates a pre-signed URL for file upload to S3.
 */
export async function createUploadPresignedUrl(fileId: string, s3Key: string): Promise<{ uploadUrl: string, fileId: string } | null> {
    try {
        const command = new PutObjectCommand({
            Bucket: USER_FILES_BUCKET || '',
            Key: s3Key,
            ContentType: 'application/octet-stream',
        })

        // URL expires in 1 hour (3600 seconds)
        const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 })
        
        logger.info(`Generated presigned URL for file: ${s3Key}`)
        
        return { uploadUrl, fileId }
    } catch (e) {
        logger.exception('Error generating presigned URL:', e)
        return null
    }
}



/**
 * Creates a pre-signed URL for file upload to S3.
 */
export async function deleteFromS3(s3Key: string): Promise<void> {
    try {
        logger.info('Deleting S3 object: ${s3Key}')
        const deleteS3Command = new DeleteObjectCommand({
            Bucket: USER_FILES_BUCKET,
            Key: s3Key,
        })
        await s3Client.send(deleteS3Command)
    } catch (e) {
        logger.exception('Error deleting S3 object:', e)

        // Re-throw to indicate failure to the caller
        throw new Error('Failed to delete file from S3')
    }
}

