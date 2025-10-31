import { io, Socket } from 'socket.io-client'
let socket:Socket|null=null
export function getSocket(){ if(socket) return socket; const base=(import.meta.env.VITE_API_BASE||'http://localhost:4000').replace(/https?:\/\//,'http://'); socket=io(base,{transports:['websocket']}); return socket }
