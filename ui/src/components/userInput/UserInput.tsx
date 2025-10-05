'use client'

import { HTTP_ENDPOINT } from '@/constants'
import { ChatOptions, useChatOptions } from '@/hooks/useChatOptions'
import axios from 'axios';
import React, { ChangeEvent, useState } from 'react'
import { toast } from 'react-toastify';

export interface UserInputProps {
    onSubmit: (input: string, opts?: ChatOptions) => void
    isLoading: boolean
}

const UserInput = (props: UserInputProps) => {

    const { chatOptions, setChatOptions, setPreset, preset } = useChatOptions()
    const [query, setQuery] = useState('')
    const [ isOptionsOpen, setIsOptionsOpen ] = useState<boolean>(false)
    const [uploadProgress, setUploadProgress] = useState<number>(95)
    const [uploading, setUploading] = useState<boolean>(false)

    const handleInputKeydown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if(e.key === 'Enter' && !e.shiftKey){
            e.preventDefault()
            setQuery('')
            props.onSubmit(query, chatOptions)
        }
    }


    const handleAttach = async (event: ChangeEvent<HTMLInputElement>) => {

        event.preventDefault();

        setUploading(true);
        const formData = new FormData();

        if(event.target.files){
            const file : File = event.target.files[0];
            formData.append('file', file);
        }else{
            throw new Error(' No file selected. ')
        }

        // 'Content-Type': 'multipart/form-data',

        try {
            await axios.post(`${HTTP_ENDPOINT}file/upload`, formData, {
                onUploadProgress: (progressEvent) => {
                    if(progressEvent.total){
                        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                        setUploadProgress(percentCompleted);
                    }
                },
                headers: {
                    'Access-Control-Allow-Header': '*',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': '*'
                },
            });
            console.log('File uploaded successfully!');
            toast.success(`File uploading successful.`)
        } catch (error) {
            console.error('Upload failed:', error);
            toast.error(`Uploading file failed.`)
        } finally {
            setUploading(false);
            setUploadProgress(0);
            // setFile(null); // Clear selected file
        }
    
    }

    let placeholderText = ''
    // console.log(props.readyState)
    switch(props.readyState){
        case ReadyState.CONNECTING:
            placeholderText = 'Connecting...'
            break;
        case ReadyState.OPEN:
            placeholderText = 'Retrieve a document...'
            break;
        case ReadyState.CLOSING:
            placeholderText = 'Closing connection...'
            break;
        case ReadyState.CLOSED:
            placeholderText = 'Connection closed. Click "Connect" to retry...'
            break;
        case ReadyState.UNINSTANTIATED:
            placeholderText = 'Websocket not initialized. Click "connect" to start...'
            break;
        default:
            placeholderText = 'Retrieve a document'
            break;
        
    }

    return (
        <>

            {uploading && (
                <div className="w-full bg-gray-200 rounded-full dark:bg-gray-700 mb-4">
                    <div className={`bg-blue-600 text-xs font-medium text-blue-100 text-center p-0.5 leading-none rounded-full`} style={{ width: `${uploadProgress}%` }}> {uploadProgress}%</div>
                </div>
            )}

            <div className='flex space-x-2'>
                <input 
                    type='text' 
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={placeholderText}
                    onKeyDown={handleInputKeydown}
                    className="flex-1 border border-gray-300 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    disabled={props.isLoading || props.readyState !== WebSocket.OPEN }/>


                <label htmlFor="file-upload" className="cursor-pointer bg-gray-200 hover:bg-gray-300 p-2 rounded">
                    {uploading ? '📤' : '📎'}
                </label>

                <input
                    id="file-upload"
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleAttach}
                    disabled={uploading}
                />

                <button onClick={() => setIsOptionsOpen(true)} className="cursor-pointer bg-gray-200 hover:bg-gray-300 p-2 rounded">
                ⚙️
                </button>


                {props.readyState === WebSocket.CLOSED && (
                    <button 
                        onClick={() => window.location.reload()}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
                        >Reconnect
                    </button>
                )}


                {props.readyState === WebSocket.CLOSED && (
                    <button
                        onClick={() => {
                            setQuery('')
                            props.onSubmit(query)
                        }}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
                        >Submit
                    </button>
                )}

                <button
                    onClick={()=>{}}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
                >
                    Send
                </button>
            </div>

            {isOptionsOpen && (
                <p>Show the options.</p>
            )}
        </>
    )
}



export default UserInput