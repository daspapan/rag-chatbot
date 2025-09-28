// import { S3Client } from '@aws-sdk/client-s3'
import { projectItem } from '../database/dynamoClient'
import { ProjectRepo } from '../repository/projectRepo'
// import { FileRepo } from '../repository/fileRepo'
// import { PROJECT_FILES_TABLE } from '../constants'

// const s3 = new S3Client({})
const projectRepo = new ProjectRepo()
// const fileRepo = new FileRepo()

export class ProjectService {
    async getProject(tenantId: string, id: string) {
        // const metadata = await getMetadataById(doc.id)
        return projectRepo.getProject(tenantId, id)
    }

    async listProjects(tenantId: string) {
        return projectRepo.listProjects(tenantId)
    }

    async createProject(item: projectItem) {
        return projectRepo.createProject(item)
    }

    /* async deleteProject(tenantId: string, projectId: string) {
        // Delete files
        const files = await fileRepo.listFiles(tenantId, projectId)
        await fileRepo.deleteFiles(files)

        // Delete S3 folder
        await this.deleteS3Folder(PROJECT_FILES_TABLE!, `${tenantId}/${projectId}/`)

        // Delete project
        await projectRepo.deleteProject(tenantId, projectId);
    }

    private async deleteS3Folder(bucket: string, prefix: string) {
        const listResp = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }))
        if (!listResp.Contents || !listResp.Contents.length) return

        await s3.send(new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: {
                Objects: listResp.Contents.map(obj => ({ Key: obj.Key! })),
                Quiet: true,
            },
        }))
    }  */
}
