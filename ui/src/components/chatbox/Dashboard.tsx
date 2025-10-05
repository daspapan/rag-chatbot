"use client";

import React, { ChangeEvent, useRef, useState } from "react";
import clsx from "clsx";
// import moment from "moment";
import { toast } from 'react-toastify';
import AttachmentCard from "./AttachmentCard";
import apiClient from "@/utils/api";
import { FileMetadata, ProjectFile } from "@/types";
// import { ChatOptions } from "@/hooks/useChatOptions";

export interface Message {
  id: number;
  text: string;
  timestamp: Date;
  user: string;
  type: string; // 'text' | 'image' | 'file'
  attachments?: string;
  contentType?: string;
}


const Dashboard = () => {
    
    // const {sessionId, reset} = useSessionId();
    // const ref = React.useRef<HTMLDivElement>(null)
    // const { send, readyState, messageHistory, buffer, isLoading } = useChat(sessionId)

    // const [userId, setUserId] = useState<string>("Guest User");
    // const [messages, setMessages] = useState<Message[]>([]);
    // const [input, setInput] = useState("");
    // const [attachments, setAttachments] = useState<Message[]>([]);
    // const messagesEndRef = useRef<HTMLDivElement>(null);
    // const [errorMsg, setErrorMsg] = useState<string>("");
    // const [isLoading, setIsLoading] = useState<boolean>(false)


    

    // [SCROLL TO BOTTOM]   :    Scroll to the bottom when messages change
    // useEffect(() => {
        // messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    // }, [messages]);

    const [isRefreshingFiles, setIsRefreshingFiles] = useState<boolean>(false);
    const [checkedFiles, setCheckedFiles] = useState<object>({});
    const [files, setFiles] = useState<ProjectFile[]>([])
    const [uploadProgress, setUploadProgress] = useState<number>(0)
    const [isUploading, setIsUploading] = useState<boolean>()
    const projectId = '3aa2e82d-816e-41a3-897f-078b4cc5f6a0'
    const fileInputRef = useRef<HTMLInputElement>(null)

    
    const loadProjectFiles = async () => {
        try {
            setIsRefreshingFiles(true);
            const filesData = await apiClient.getProjectFiles(projectId);
            setFiles(filesData);

            // Reset checked files when loading new files
            setCheckedFiles({});
            return filesData;
        } catch (error) {
            console.error('Error loading project files:', error);
            return [];
        } finally {
            setIsRefreshingFiles(false);
        }
    };
    
    const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {

        const selectedFiles = (event.target.files && event.target.files.length > 0) ? Array.from(event.target.files) : []
        if (selectedFiles.length === 0) return;

        try {

            // Filter out files that already exist
            const existingFilenames = new Set(files.map(file => file.filename.toLowerCase()));
            const newFiles = selectedFiles.filter(file => !existingFilenames.has(file.name.toLowerCase()));


            // If all files were duplicates, show message and return
            if (newFiles.length === 0) {
                toast.warning('All selected files already exist in the data sources. No files were uploaded.')
                event.target.value = ''; // Reset the file input
                return;
            }

            setIsUploading(true);
            setUploadProgress(0);


            // Store the current file count before upload
            let totalUploaded = 0;  

            // Upload each file sequentially
            for (let i = 0; i < newFiles.length; i++) {
                const file = newFiles[i];

                // First request to get upload URL
                const fileData: FileMetadata = {
                    fileName: file.name,
                    fileSize: file.size,
                    fileType: file.type
                }

                const response = await apiClient.uploadProjectFile(projectId, fileData);

                const { presignedUrl, fileId } = response;

                // Use XMLHttpRequest for upload with progress tracking
                await new Promise((resolve, reject) => {
                    const xhr = new XMLHttpRequest();

                    xhr.upload.addEventListener('progress', (event) => {
                        if (event.lengthComputable) {
                            // Calculate overall progress across all files
                            const fileProgress = (event.loaded / event.total);
                            const overallProgress = ((totalUploaded + fileProgress) / newFiles.length) * 100;
                            setUploadProgress(overallProgress);
                        }
                    });

                    xhr.addEventListener('load', () => {
                        if (xhr.status === 200) {
                            totalUploaded++;
                            // Update progress for completed file
                            const overallProgress = (totalUploaded / newFiles.length) * 100;
                            setUploadProgress(overallProgress);
                            resolve(true);
                        } else {
                            reject(new Error(`Upload failed for ${file.name}`));
                        }
                    });

                    xhr.addEventListener('error', () => {
                        reject(new Error(`Upload failed for ${file.name}`));
                    });

                    xhr.open('PUT', presignedUrl);
                    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
                    xhr.send(file);
                });
            }


            await loadProjectFiles();
            setIsUploading(false);
            setUploadProgress(0);
            
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {

            console.error('Error uploading files:', error);

            // Generic error handler for unexpected errors
            let errorMessage = 'Error uploading files. Please try again.';

            if (error.message) {
                errorMessage = error.message;

                // Try to extract JSON error from message
                const match = error.message.match(/API request failed: \d+ \s*-\s*(\{.*\})/);
                if (match && match[1]) {
                    try {
                        const parsedError = JSON.parse(match[1]);
                        if (parsedError.error) {
                            errorMessage = parsedError.error;
                        }
                    } catch (e) {
                        // Keep original message if parsing fails
                        console.error(JSON.stringify(e, null, 2))
                    }
                }
            }

            toast.error(errorMessage)

            setUploadProgress(0);
            setIsUploading(false);
            
        }finally {
            event.target.value = ''; // Reset the file input
        }

    }

    

    return (
        <div className="container mx-auto mb-5 px-4 sm:px-6 lg:px-8 max-w-screen-xl">

            <div className="flex flex-col">

                ...

            </div>

            <div className="grid grid-cols-3 gap-4 h-screen">
                {/* 
                    This div spans two columns 
                    p-4 flex items-center justify-center
                */}
                <div className="col-span-2 bg-blue-200 ">

                    <div className="flex flex-col h-screen bg-gray-50 p-4">

                        <p className="text-xl font-bold mb-4">Chatbox</p>

                        <div className="flex-1 overflow-auto mb-4 p-4 bg-white rounded shadow">


                            <input
                                type="file"
                                multiple
                                ref={fileInputRef}
                                style={{ display: 'none' }}
                                onChange={handleFileUpload}
                                disabled={isUploading || isRefreshingFiles}
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="btn-primary"
                                disabled={isUploading || isRefreshingFiles}
                                style={{
                                    cursor: (isUploading || isRefreshingFiles) ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {isUploading ? 'Uploading...' : 'Upload'}
                            </button>
                            
                            
                        </div>

                        <div className="flex flex-col">
                            {JSON.stringify(files, null, 2)}
                        </div>

                    </div>

                </div>

            </div>

        </div>
    )
}

export default Dashboard


