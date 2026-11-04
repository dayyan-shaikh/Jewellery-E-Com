import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
export type User = { id:number; name:string; email:string; role:'customer'|'admin' }
const KEY='maison-admin-auth-token'; const API=(import.meta.env.VITE_API_BASE_URL||'http://localhost:5000/api').replace(/\/$/,'')
export const token=()=>sessionStorage.getItem(KEY)
export function clearToken(){sessionStorage.removeItem(KEY);window.dispatchEvent(new Event('admin-auth-changed'))}
async function call<T>(path:string,init?:RequestInit):Promise<T>{const response=await fetch(`${API}${path}`,{...init,headers:{'Content-Type':'application/json',...(token()?{Authorization:`Bearer ${token()}`}:{ }),...(init?.headers||{})}});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.message||`Request failed (${response.status})`);return body.data as T}
export const adminSetupStatus=()=>call<{available:boolean}>('/auth/admin/setup-status')
export const bootstrapAdmin=(details:{name:string;email:string;password:string;setupKey:string})=>call<{user:User}>('/auth/admin/bootstrap',{method:'POST',body:JSON.stringify(details)})
type Value={user:User|null;ready:boolean;login:(email:string,password:string)=>Promise<void>;logout:()=>Promise<void>}
const Context=createContext<Value|null>(null)
export function AuthProvider({children}:{children:ReactNode}){const[user,setUser]=useState<User|null>(null);const[ready,setReady]=useState(false)
 const hydrate=useCallback(async()=>{if(!token()){setUser(null);setReady(true);return}try{const result=await call<{user:User}>('/auth/me');if(result.user.role!=='admin')throw new Error('This account does not have administrator access.');setUser(result.user)}catch{clearToken();setUser(null)}finally{setReady(true)}},[])
 useEffect(()=>{void hydrate();window.addEventListener('admin-auth-changed',hydrate);return()=>window.removeEventListener('admin-auth-changed',hydrate)},[hydrate])
 const login=useCallback(async(email:string,password:string)=>{const result=await call<{token:string;user:User}>('/auth/login',{method:'POST',body:JSON.stringify({email,password})});if(result.user.role!=='admin'){await fetch(`${API}/auth/logout`,{method:'POST',headers:{Authorization:`Bearer ${result.token}`}}).catch(()=>{});throw new Error('This account does not have administrator access.')}sessionStorage.setItem(KEY,result.token);setUser(result.user);setReady(true)},[])
 const logout=useCallback(async()=>{try{if(token())await call('/auth/logout',{method:'POST'})}finally{clearToken();setUser(null)}},[])
 const value=useMemo(()=>({user,ready,login,logout}),[user,ready,login,logout]);return <Context.Provider value={value}>{children}</Context.Provider>}
export function useAuth(){const value=useContext(Context);if(!value)throw new Error('useAuth must be used inside AuthProvider');return value}
export function RequireAdmin({children}:{children:ReactNode}){const{user,ready}=useAuth();const location=useLocation();if(!ready)return <div style={{padding:40}}>Checking administrator access…</div>;return user?.role==='admin'?<>{children}</>:<Navigate to="/login" replace state={{from:location}}/>}
