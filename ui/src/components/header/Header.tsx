import React from 'react'
import { PiMoon, PiPlusCircle, PiSun } from 'react-icons/pi'

export interface HeaderProps {
    onNewSession: () => void
}

const Header = (props: HeaderProps) => {

    return (
        <div className='bg-none border-none cursor-pointer bg-purple-400'>
            <PiPlusCircle size={24} onClick={props.onNewSession}/>
        </div>
    )
}

export default Header