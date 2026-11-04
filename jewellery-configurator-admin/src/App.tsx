import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import ProductDetail from './pages/ProductDetail'
import Cart from './pages/Cart'
import Checkout from './pages/Checkout'
import OrderSuccess from './pages/OrderSuccess'
import NotFound from './pages/NotFound'
import Admin from './pages/Admin'
import { AuthProvider, RequireAdmin } from './auth'
import Login from './pages/Login'
import SetupAdmin from './pages/SetupAdmin'

export default function App() {
  return <AuthProvider><Routes><Route path="/login" element={<Login/>}/><Route path="/setup" element={<SetupAdmin/>}/><Route path="/admin/*" element={<RequireAdmin><Admin /></RequireAdmin>} /><Route element={<Layout />}>
    <Route path="/" element={<Home />} />
    <Route path="/products/:id" element={<ProductDetail />} />
    <Route path="/cart" element={<Cart />} />
    <Route path="/checkout" element={<Checkout />} />
    <Route path="/order-success" element={<OrderSuccess />} />
    <Route path="*" element={<NotFound />} />
  </Route></Routes></AuthProvider>
}
