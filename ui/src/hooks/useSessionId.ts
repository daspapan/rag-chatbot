'use client';

import { useState } from 'react'
import { v4 as uuidV4 } from 'uuid'
import {LS_KEY_CHAT_HISTORY, LS_KEY_SESSION_ID} from '../constants';

const useSessionId = () => {

    const [sessionId, ] = useState<string>(() => {
        const storedSessionId = window.localStorage.getItem(LS_KEY_SESSION_ID)
        if(storedSessionId) return storedSessionId

        const newSessionId = uuidV4()
        window.localStorage.setItem(LS_KEY_SESSION_ID, newSessionId)
        return newSessionId
    })

    const reset = () => {
        window.localStorage.removeItem(LS_KEY_CHAT_HISTORY)
        window.localStorage.removeItem(LS_KEY_SESSION_ID)
        window.location.reload()
    }

    return {sessionId, reset}
}

export default useSessionId