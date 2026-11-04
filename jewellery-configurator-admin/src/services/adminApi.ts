import { clearToken, token } from '../auth'
export type Metal = 'GOLD' | 'SILVER' | 'PLATINUM'
export interface ProductVariant { id: string; sku: string; purity: string; weightGrams: number; stoneCharge: number; stockQuantity: number; isActive: boolean; currentPrice: number | null }
export interface AdminProduct { id: string; name: string; description: string; metalType: Metal; wastagePercentage: number; makingChargePerGram: number; hasStones: boolean; isActive: boolean; variants: ProductVariant[] }
export interface MetalRate { id: string; metalType: Metal; purity: string; ratePerGram: number; currency: string; source: string; updatedAt: string }
export interface AdminOrder { id: string; totalAmount: number; status: string; createdAt: string; customerName?: string; customerEmail?: string; itemCount: number; items: Array<{ productName: string; quantity: number; total: number }> }
export interface DashboardSummary { products: { total: number; active: number }; variants: { total: number; stock: number; low_stock: number }; rates: { total: number }; orders: { total: number; value: number | string } }

const BASE=(import.meta.env.VITE_API_BASE_URL||'http://localhost:5000/api').replace(/\/$/,'')
async function request<T>(path:string,init?:RequestInit):Promise<T>{
  const response=await fetch(`${BASE}${path}`,{...init,headers:{'Content-Type':'application/json',...(token()?{Authorization:`Bearer ${token()}`}:{ } ),...(init?.headers||{})}})
  const body=await response.json().catch(()=>({}))
  if(!response.ok){if(response.status===401&&token())clearToken();throw new Error(body?.message||`Request failed (${response.status})`)}
  return (body&&'data'in body?body.data:body) as T
}
export const adminApi={
  access:()=>request<{allowed:boolean;user:{id:number;name:string;email:string;role:string}}>('/admin/access'),
  summary:()=>request<DashboardSummary>('/admin/summary'),
  products:()=>request<AdminProduct[]>('/admin/products'),
  createProduct:(product:Omit<AdminProduct,'id'>)=>request<AdminProduct>('/admin/products',{method:'POST',body:JSON.stringify(product)}),
  updateProduct:(id:string,product:Omit<AdminProduct,'id'>)=>request<AdminProduct>(`/admin/products/${id}`,{method:'PUT',body:JSON.stringify(product)}),
  rates:()=>request<MetalRate[]>('/admin/metal-rates'),
  createRate:(rate:{metalType:Metal;purity:string;ratePerGram:number;currency:string})=>request<MetalRate>('/admin/metal-rates',{method:'POST',body:JSON.stringify(rate)}),
  updateRate:(id:string,ratePerGram:number)=>request<MetalRate>(`/admin/metal-rates/${id}`,{method:'PATCH',body:JSON.stringify({ratePerGram})}),
  orders:()=>request<AdminOrder[]>('/admin/orders'),
}
export const money=(value:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(value)
