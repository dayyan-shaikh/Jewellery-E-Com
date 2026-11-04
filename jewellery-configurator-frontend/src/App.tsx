import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import ProductDetail from './pages/ProductDetail'
import Cart from './pages/Cart'
import Checkout from './pages/Checkout'
import OrderSuccess from './pages/OrderSuccess'
import NotFound from './pages/NotFound'
import { RequireRole } from './auth'
import Login from './pages/Login'
import Register from './pages/Register'

export default function App() {
  return <Routes><Route path="/login" element={<Login/>}/><Route path="/register" element={<Register/>}/><Route element={<Layout />}>
    <Route path="/" element={<Home />} />
    <Route path="/products/:id" element={<ProductDetail />} />
    <Route path="/cart" element={<RequireRole role="customer"><Cart /></RequireRole>} />
    <Route path="/checkout" element={<RequireRole role="customer"><Checkout /></RequireRole>} />
    <Route path="/order-success" element={<RequireRole role="customer"><OrderSuccess /></RequireRole>} />
    <Route path="*" element={<NotFound />} />
  </Route></Routes>
}
