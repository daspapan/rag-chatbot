import React from 'react';
import { Message } from './Dashboard';
import clsx from 'clsx';
import Image from 'next/image';
import { GetObjectCommand, S3Client, S3ClientConfig } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

interface AttachmentCardProps {
    placement: 'left' | 'right';
    msg: Message;
    userId: string | undefined;
}

const s3ClientConfig : S3ClientConfig = {
    region: process.env.NEXT_PUBLIC_AWS_REGION,
    credentials: {
        accessKeyId: process.env.NEXT_PUBLIC_ACCESS_KEY_ID!,
        secretAccessKey: process.env.NEXT_PUBLIC_SECRET_ACCESS_KEY!
    }
};
const s3Client = new S3Client(s3ClientConfig);
const BUCKET_NAME = process.env.NEXT_PUBLIC_S3_BUCKET_NAME!;

const AttachmentCard = ({placement, msg, userId}:AttachmentCardProps) => {

    const attachmentClickHandler = async () => {

        try {
            
            const getCommand = new GetObjectCommand({
                Bucket: BUCKET_NAME,
                Key: msg.text,
            });
            
            const presignedUrl = await getSignedUrl(s3Client, getCommand, {
                expiresIn: 300 // URL expires in 5 minutes
            });

            console.log("Open-[PRESIGNED URL]->", presignedUrl)

            if(presignedUrl){
                window.open(presignedUrl, '_blank');
            }
            
        } catch (error) {
            console.error('Error opening attachment:', error);
        }
    }

    return (
        <>
            {placement === 'left' ? (

                <div>

                    <div className={clsx(
                        "text-gray-800 p-2 rounded max-w-xs break-words shadow-sm",
                        {
                            "bg-green-100": msg.user === userId,
                            "bg-blue-100": msg.user !== userId,
                        }
                    )}
                    >
                        {msg.type === 'image' && msg.attachments && (
                            <Image 
                                src={msg.attachments || ''} 
                                alt={msg.text}
                                width={200} height={200} 
                                className="mb-1 rounded cursor-pointer" 
                                onClick={attachmentClickHandler}
                            />
                        )}

                        {msg.type === 'file' && msg.attachments && (
                            <Image 
                                src={'/file.png'} 
                                alt={msg.text}
                                width={200} height={200} 
                                className="mb-1 rounded cursor-pointer" 
                                onClick={attachmentClickHandler}
                            />
                        )}

                        
                        <span className="text-xs text-gray-500 block mt-1">{msg.text}</span>
                        {/* {msg.user && (<span className="text-xs text-gray-500 block mt-1">{msg.user}</span>)} */}
                    </div>

                    <span className="text-xs text-gray-400 mt-1">
                        {msg.timestamp.toLocaleString()}
                    </span>

                </div>

                

            ) : null}

            {placement === 'right' ? (
                <li className="text-sm text-gray-700 py-1 border-b last:border-0">
                    {msg.attachments && msg.attachments.length > 0 ? (
                    
                        <span onClick={() => attachmentClickHandler()}
                            className="text-blue-600 cursor-pointer hover:underline"
                        >
                            {msg.type === 'image' ? '🖼️' : '📎'} {msg.text}
                        </span>
                        
                    ) : (
                        <span>No attachment</span>
                    )}
                </li>
            ) : null}
            
        </>
    )
}

export default AttachmentCard