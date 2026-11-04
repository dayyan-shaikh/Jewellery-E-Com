import { Navigate, Route, Routes } from 'react-router-dom'
import Admin from './pages/Admin'
import Login from './pages/Login'
import SetupAdmin from './pages/SetupAdmin'
import { AuthProvider, RequireAdmin } from './auth'

export default function App(){return <AuthProvider><Routes><Route path="/login" element={<Login/>}/><Route path="/setup" element={<SetupAdmin/>}/><Route path="/admin/*" element={<RequireAdmin><Admin/></RequireAdmin>}/><Route path="*" element={<Navigate to="/admin" replace/>}/></Routes></AuthProvider>}
