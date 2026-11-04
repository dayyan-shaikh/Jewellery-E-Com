import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import {
  Activity, ArrowUpRight, Bell, Check, ChevronDown, ChevronRight,
  CircleDollarSign, Clock3, Gem, LayoutDashboard, Menu, Package, Plus, Search,
  Settings2, ShoppingBag, SlidersHorizontal, Sparkles, X, Pencil, RefreshCw,
} from 'lucide-react'
import type { Product, Metal } from '../types'
import { money } from '../services/api'
import { adminApi, type MakingChargeRule, type MetalRate } from '../services/adminApi'
import '../admin.css'

const nav = [
  { label: 'Overview', path: '/admin', icon: LayoutDashboard, end: true },
  { label: 'Products', path: '/admin/products', icon: Gem },
  { label: 'Inventory', path: '/admin/inventory', icon: Package },
  { label: 'Metal rates', path: '/admin/rates', icon: CircleDollarSign },
  { label: 'Making charges', path: '/admin/making-charges', icon: SlidersHorizontal },
  { label: 'Orders', path: '/admin/orders', icon: ShoppingBag },
]
const dateLabel = (value: string) => new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function Admin() {
  const location = useLocation()
  const [products, setProducts] = useState<Product[]>([])
  const [rates, setRates] = useState<MetalRate[]>([])
  const [rules, setRules] = useState<MakingChargeRule[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)

  const refresh = async () => {
    setLoading(true); setError('')
    try {
      const [p, r, m, o] = await Promise.all([adminApi.products(), adminApi.rates(), adminApi.rules(), adminApi.orders()])
      setProducts(p); setRates(r); setRules(m); setOrders(o)
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load admin data.') }
    finally { setLoading(false) }
  }
  useEffect(() => { void refresh() }, [])
  useEffect(() => { if (notice) { const t = window.setTimeout(() => setNotice(''), 3200); return () => window.clearTimeout(t) } }, [notice])

  const saveNewProduct = async (product: Omit<Product, 'id'>) => {
    try { const saved = await adminApi.createProduct(product); setProducts(prev => [...prev, saved]); setNotice('Product created.') }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not create product.') }
  }
  const saveProduct = async (product: Product) => {
    try { const saved = await adminApi.updateProduct(product.id, product); setProducts(prev => prev.map(p => p.id === saved.id ? saved : p)); setNotice('Product changes saved.') }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save product.') }
  }
  const saveRule = async (rule: MakingChargeRule) => {
    try { const saved = await adminApi.saveRule(rule); setRules(prev => prev.some(r => r.id === saved.id) ? prev.map(r => r.id === saved.id ? saved : r) : [...prev, saved]); setNotice('Making-charge rule saved.') }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save rule.') }
  }
  const saveRate = async (metal: Metal, value: number) => {
    try { const saved = await adminApi.updateRate(metal, value); setRates(prev => prev.map(r => r.metal === metal ? saved : r)); setNotice(`${metal} rate updated.`) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not update rate.') }
  }

  const pageTitle = nav.find(n => n.path === location.pathname)?.label || (location.pathname.includes('making-charges') ? 'Making charges' : location.pathname.includes('inventory') ? 'Inventory' : location.pathname.includes('products') ? 'Products' : location.pathname.includes('rates') ? 'Metal rates' : location.pathname.includes('orders') ? 'Orders' : 'Overview')
  const lowStock = products.filter(p => p.stock > 0 && p.stock <= 2).length
  const totalStock = products.reduce((sum, p) => sum + p.stock, 0)
  const shellProps = { products, rates, rules, orders, loading, error, onCreateProduct: saveNewProduct, onSaveProduct: saveProduct, onSaveRule: saveRule, onSaveRate: saveRate, onNotice: setNotice }

  return <div className="admin-shell">
    <aside className={`admin-sidebar ${mobileOpen ? 'is-open' : ''}`}>
      <div className="admin-brand"><span>MAISON</span><strong>AURELIA</strong><small>ADMINISTRATION</small></div>
      <div className="admin-workspace"><span className="workspace-mark">M</span><span><b>Maison Aurelia</b><small>Store workspace</small></span><ChevronDown size={14}/></div>
      <div className="admin-nav-label">WORKSPACE</div>
      <nav className="admin-nav">{nav.map(item => { const Icon = item.icon; return <NavLink key={item.path} to={item.path} end={item.end} onClick={() => setMobileOpen(false)}><Icon size={17}/><span>{item.label}</span>{item.label === 'Inventory' && lowStock > 0 && <i>{lowStock}</i>}</NavLink> })}</nav>
      <div className="sidebar-bottom"><div className="sidebar-help"><Sparkles size={16}/><b>Maison notes</b><p>Thoughtful details make an exceptional experience.</p></div><div className="admin-user"><div className="avatar">A</div><span><b>Administrator</b><small>Store manager</small></span><Settings2 size={16}/></div></div>
    </aside>
    {mobileOpen && <button className="admin-scrim" onClick={() => setMobileOpen(false)} aria-label="Close navigation"/>}
    <main className="admin-main">
      <header className="admin-topbar"><button className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={20}/></button><div className="admin-breadcrumb">MAISON AURELIA <ChevronRight size={13}/> <span>{pageTitle}</span></div><div className="topbar-actions"><span className="admin-live"><i/> Store workspace</span><button className="icon-button" aria-label="Notifications"><Bell size={17}/></button><div className="topbar-avatar">A</div></div></header>
      <div className="admin-content">
        {error && <div className="admin-alert error"><span>{error}</span><button onClick={() => setError('')}><X size={15}/></button></div>}
        {notice && <div className="admin-toast"><Check size={15}/>{notice}</div>}
        {loading ? <div className="admin-loading"><RefreshCw size={19}/> Preparing your workspace…</div> : <Routes>
          <Route index element={<Overview {...shellProps} lowStock={lowStock} totalStock={totalStock} onRefresh={refresh}/>} />
          <Route path="products" element={<ProductsPage {...shellProps}/>} />
          <Route path="inventory" element={<InventoryPage {...shellProps}/>} />
          <Route path="rates" element={<RatesPage {...shellProps}/>} />
          <Route path="making-charges" element={<RulesPage {...shellProps}/>} />
          <Route path="orders" element={<OrdersPage {...shellProps}/>} />
        </Routes>}
        <footer className="admin-footer"><span>MAISON AURELIA</span><span>Crafted with intention · Administration</span></footer>
      </div>
    </main>
  </div>
}

type Shared = { products: Product[]; rates: MetalRate[]; rules: MakingChargeRule[]; orders: any[]; loading: boolean; error: string; onCreateProduct: (p: Omit<Product, 'id'>) => void; onSaveProduct: (p: Product) => void; onSaveRule: (r: MakingChargeRule) => void; onSaveRate: (m: Metal, v: number) => void; onNotice: (s: string) => void }

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: ReactNode; description: string; action?: ReactNode }) {
  return <div className="admin-page-heading"><div><div className="admin-eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>
}
function Stat({ label, value, note, icon: Icon, trend }: { label: string; value: string; note: string; icon: any; trend?: string }) {
  return <div className="stat-card"><div className="stat-top"><span>{label}</span><i><Icon size={17}/></i></div><strong>{value}</strong><div className="stat-foot"><span>{note}</span>{trend && <em><ArrowUpRight size={13}/>{trend}</em>}</div></div>
}
function Overview({ products, rates, rules, orders, lowStock, totalStock, onRefresh }: Shared & { lowStock: number; totalStock: number; onRefresh: () => void }) {
  const orderValue = orders.reduce((sum, o) => sum + (o.total || 0), 0)
  return <>
    <PageHeading eyebrow={new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase()} title={<>A considered view of<br/><em>your store.</em></>} description="A quiet overview of the details that keep Maison Aurelia moving." action={<button className="admin-button secondary" onClick={onRefresh}><RefreshCw size={15}/> Refresh overview</button>}/>
    <div className="welcome-strip"><div><span className="welcome-kicker">THE ATELIER AT A GLANCE</span><h2>Good afternoon.</h2><p>Your catalogue and pricing workspace is ready.</p></div><div className="welcome-ornament"><Gem size={39} strokeWidth={1}/><span>MAISON<br/>AURELIA</span></div></div>
    <div className="stat-grid"><Stat label="ACTIVE PRODUCTS" value={String(products.length).padStart(2, '0')} note="Across your collection" icon={Gem}/><Stat label="UNITS IN STOCK" value={String(totalStock).padStart(2, '0')} note={`${lowStock} products at low stock`} icon={Package}/><Stat label="MAKING-CHARGE RULES" value={String(rules.length).padStart(2, '0')} note="Configured pricing rules" icon={SlidersHorizontal}/><Stat label="ORDERS PLACED" value={String(orders.length).padStart(2, '0')} note={money(orderValue) + ' order value'} icon={ShoppingBag}/></div>
    <div className="overview-grid"><section className="admin-panel"><div className="panel-heading"><div><span className="admin-eyebrow">COLLECTION</span><h3>Inventory overview</h3></div><NavLink to="/admin/inventory" className="subtle-link">View inventory <ChevronRight size={14}/></NavLink></div><div className="inventory-summary">{products.slice(0, 4).map(p => <div className="inventory-row" key={p.id}><div className="mini-product"><Gem size={17}/></div><div className="inventory-name"><b>{p.name}</b><small>{p.category} · {p.metal}</small></div><div className="stock-meter"><span><i style={{ width: `${Math.min(100, p.stock / 5 * 100)}%` }}/></span><small>{p.stock} {p.stock === 1 ? 'unit' : 'units'}</small></div><span className={`status-pill ${p.stock === 0 ? 'danger' : p.stock <= 2 ? 'warning' : 'good'}`}>{p.stock === 0 ? 'Out of stock' : p.stock <= 2 ? 'Low stock' : 'In stock'}</span></div>)}</div></section>
      <section className="admin-panel rate-panel"><div className="panel-heading"><div><span className="admin-eyebrow">LIVE PRICING</span><h3>Metal reference rates</h3></div><NavLink to="/admin/rates" className="subtle-link">Details <ChevronRight size={14}/></NavLink></div><div className="rate-list">{rates.map(r => <div className="rate-row" key={r.metal}><span className="metal-dot"/><span className="metal-name">{r.metal}</span><b>{money(r.ratePerGram)}<small> / g</small></b></div>)}</div><div className="rate-footnote"><Activity size={13}/> Rates shown from the connected pricing configuration</div></section></div>
    <section className="admin-panel recent-panel"><div className="panel-heading"><div><span className="admin-eyebrow">RECENT ACTIVITY</span><h3>Latest orders</h3></div><NavLink to="/admin/orders" className="subtle-link">All orders <ChevronRight size={14}/></NavLink></div>{orders.length ? <div className="table-wrap"><table className="admin-table"><thead><tr><th>ORDER</th><th>DATE</th><th>AMOUNT</th><th>STATUS</th></tr></thead><tbody>{orders.slice(0, 5).map((o, i) => <tr key={o.id || i}><td>#{o.orderNumber || o.id}</td><td>{o.createdAt ? dateLabel(o.createdAt) : '—'}</td><td>{money(o.total || 0)}</td><td><span className="status-pill good">Placed</span></td></tr>)}</tbody></table></div> : <div className="empty-inline"><ShoppingBag size={19}/><span>No orders to display yet.</span></div>}</section>
  </>
}

function ProductsPage({ products, onSaveProduct, onCreateProduct }: Shared) {
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Product | null>(null)
  const [creating, setCreating] = useState(false)
  const filtered = products.filter(p => `${p.name} ${p.category} ${p.metal}`.toLowerCase().includes(query.toLowerCase()))
  return <><PageHeading eyebrow="CATALOGUE MANAGEMENT" title={<>Every piece,<br/><em>beautifully considered.</em></>} description="Review your collection and keep product details in step with the atelier." action={<button className="admin-button primary" onClick={() => setCreating(true)}><Plus size={15}/> New product</button>}/>
    <div className="admin-toolbar"><div className="search-field"><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search products or categories…"/></div><span className="result-count">{filtered.length} pieces in collection</span></div>
    <div className="admin-panel table-panel"><div className="table-wrap"><table className="admin-table"><thead><tr><th>PRODUCT</th><th>METAL / PURITY</th><th>WEIGHT OPTIONS</th><th>MAKING / G</th><th>STOCK</th><th/></tr></thead><tbody>{filtered.map(p => <tr key={p.id}><td><div className="product-cell"><img src={p.imageUrl} alt=""/><span><b>{p.name}</b><small>{p.category} · {p.id}</small></span></div></td><td><span className="capitalize">{p.metal}</span><small className="table-sub">{p.purities.join(', ')}</small></td><td>{p.weightOptions.join(' · ')} g</td><td>{money(p.makingChargePerGram)}</td><td><span className={`status-pill ${p.stock <= 2 ? 'warning' : 'good'}`}>{p.stock} units</span></td><td><button className="table-icon" onClick={() => setEditing(p)} aria-label={`Edit ${p.name}`}><Pencil size={15}/></button></td></tr>)}</tbody></table></div>{filtered.length === 0 && <div className="empty-inline">No products match your search.</div>}</div>
    {editing && <ProductEditor product={editing} onClose={() => setEditing(null)} onSave={p => { onSaveProduct(p); setEditing(null) }}/>}
    {creating && <NewProductEditor onClose={() => setCreating(false)} onSave={p => { onCreateProduct(p); setCreating(false) }}/>}
  </>
}
function ProductEditor({ product, onClose, onSave }: { product: Product; onClose: () => void; onSave: (p: Product) => void }) {
  const [stock, setStock] = useState(String(product.stock)); const [making, setMaking] = useState(String(product.makingChargePerGram)); const [wastage, setWastage] = useState(String(product.wastagePercent))
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}><form className="admin-modal" onSubmit={e => { e.preventDefault(); onSave({ ...product, stock: Math.max(0, Number(stock)), makingChargePerGram: Math.max(0, Number(making)), wastagePercent: Math.max(0, Number(wastage)) }) }}><div className="modal-heading"><div><span className="admin-eyebrow">PRODUCT CONFIGURATION</span><h3>Edit product</h3><p>{product.name}</p></div><button type="button" className="table-icon" onClick={onClose}><X size={18}/></button></div><label>Available stock<input type="number" min="0" value={stock} onChange={e => setStock(e.target.value)}/></label><label>Making charge per gram (₹)<input type="number" min="0" value={making} onChange={e => setMaking(e.target.value)}/></label><label>Wastage (%)<input type="number" min="0" step="0.1" value={wastage} onChange={e => setWastage(e.target.value)}/></label><div className="modal-actions"><button type="button" className="admin-button secondary" onClick={onClose}>Cancel</button><button className="admin-button primary" type="submit"><Check size={15}/> Save changes</button></div></form></div>
}
function NewProductEditor({ onClose, onSave }: { onClose: () => void; onSave: (p: Omit<Product, 'id'>) => void }) {
  const [name, setName] = useState(''); const [category, setCategory] = useState('Rings'); const [metal, setMetal] = useState<Metal>('gold')
  const [purity, setPurity] = useState('18K'); const [weight, setWeight] = useState('4'); const [stock, setStock] = useState('1')
  const [making, setMaking] = useState('850'); const [wastage, setWastage] = useState('5'); const [stone, setStone] = useState('0')
  const [image, setImage] = useState('https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=1000&q=85')
  return <div className="modal-backdrop"><form className="admin-modal" onSubmit={e => { e.preventDefault(); onSave({ name, subtitle: 'A considered Maison Aurelia design', description: `${name}, crafted with intention.`, category, metal, purities: [purity], defaultPurity: purity, weightOptions: [Number(weight)], defaultWeight: Number(weight), wastagePercent: Number(wastage), makingChargePerGram: Number(making), stoneCost: Number(stone), stock: Number(stock), imageUrl: image, variants: [{ id: `new-${Date.now()}`, sku: `NEW-${Date.now()}`, purity, weightGrams: Number(weight), stoneCharge: Number(stone), stock: Number(stock) }] }) }}><div className="modal-heading"><div><span className="admin-eyebrow">NEW COLLECTION PIECE</span><h3>Add a product</h3><p>Enter the product configuration used by the pricing engine.</p></div><button type="button" className="table-icon" onClick={onClose}><X size={18}/></button></div><label>Product name<input value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. The Aurelia Pendant"/></label><div className="form-two"><label>Category<input value={category} onChange={e => setCategory(e.target.value)} required/></label><label>Metal<select value={metal} onChange={e => { const m = e.target.value as Metal; setMetal(m); setPurity(m === 'platinum' ? '950' : m === 'silver' ? '925' : '18K') }}><option value="gold">Gold</option><option value="silver">Silver</option><option value="platinum">Platinum</option></select></label></div><div className="form-two"><label>Purity<input value={purity} onChange={e => setPurity(e.target.value)} required/></label><label>Weight (g)<input type="number" min="0.1" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} required/></label></div><div className="form-two"><label>Stock units<input type="number" min="0" value={stock} onChange={e => setStock(e.target.value)} required/></label><label>Wastage (%)<input type="number" min="0" step="0.1" value={wastage} onChange={e => setWastage(e.target.value)} required/></label></div><div className="form-two"><label>Making / gram (₹)<input type="number" min="0" value={making} onChange={e => setMaking(e.target.value)} required/></label><label>Stone cost (₹)<input type="number" min="0" value={stone} onChange={e => setStone(e.target.value)} required/></label></div><label>Product image URL<input value={image} onChange={e => setImage(e.target.value)} required/></label><div className="modal-actions"><button type="button" className="admin-button secondary" onClick={onClose}>Cancel</button><button className="admin-button primary"><Plus size={15}/> Create product</button></div></form></div>
}

function InventoryPage({ products, onSaveProduct }: Shared) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [adjusting, setAdjusting] = useState<Product | null>(null)
  const [amount, setAmount] = useState('')
  const filtered = products.filter(p => `${p.name} ${p.category}`.toLowerCase().includes(query.toLowerCase())).filter(p => filter === 'all' || (filter === 'low' ? p.stock > 0 && p.stock <= 2 : filter === 'out' ? p.stock === 0 : p.stock > 2))
  return <><PageHeading eyebrow="STOCK CONTROL" title={<>A careful eye on<br/><em>what remains.</em></>} description="Limited pieces deserve precise inventory visibility."/><div className="inventory-callout"><Package size={18}/><span>Inventory is kept intentionally lean. Review low-stock pieces before accepting further orders.</span></div><div className="admin-toolbar"><div className="search-field"><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search inventory…"/></div><div className="filter-tabs">{[['all','All'],['low','Low stock'],['out','Out of stock'],['healthy','Healthy']].map(([v,l]) => <button className={filter === v ? 'active' : ''} onClick={() => setFilter(v)} key={v}>{l}</button>)}</div></div><div className="admin-panel table-panel"><div className="table-wrap"><table className="admin-table"><thead><tr><th>PIECE</th><th>SKU</th><th>METAL</th><th>AVAILABLE</th><th>STOCK STATUS</th><th/></tr></thead><tbody>{filtered.map(p => <tr key={p.id}><td><div className="product-cell"><img src={p.imageUrl} alt=""/><span><b>{p.name}</b><small>{p.category}</small></span></div></td><td className="muted-cell">{p.id.toUpperCase()}</td><td className="capitalize">{p.metal}</td><td><b>{p.stock}</b> <span className="muted-cell">units</span></td><td><span className={`status-pill ${p.stock === 0 ? 'danger' : p.stock <= 2 ? 'warning' : 'good'}`}>{p.stock === 0 ? 'Out of stock' : p.stock <= 2 ? 'Low stock' : 'In stock'}</span></td><td><button className="admin-button small secondary" onClick={() => { setAdjusting(p); setAmount(String(p.stock)) }}>Adjust stock</button></td></tr>)}</tbody></table></div>{filtered.length === 0 && <div className="empty-inline">No inventory items found.</div>}</div>{adjusting && <div className="modal-backdrop"><form className="admin-modal" onSubmit={e => { e.preventDefault(); onSaveProduct({ ...adjusting, stock: Math.max(0, Number(amount)) }); setAdjusting(null) }}><div className="modal-heading"><div><span className="admin-eyebrow">INVENTORY ADJUSTMENT</span><h3>Adjust available units</h3><p>{adjusting.name}</p></div><button type="button" className="table-icon" onClick={() => setAdjusting(null)}><X size={18}/></button></div><label>Available quantity<input type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)}/></label><p className="field-hint">This updates the product's stock quantity through the configured admin API.</p><div className="modal-actions"><button type="button" className="admin-button secondary" onClick={() => setAdjusting(null)}>Cancel</button><button className="admin-button primary">Save inventory</button></div></form></div>}</>
}
function RatesPage({ rates, onSaveRate }: Shared) {
  const [editing, setEditing] = useState<Metal | null>(null); const [value, setValue] = useState('')
  const meta: Record<Metal, { label: string; purity: string; description: string }> = { gold: { label: 'Gold', purity: '18K · 22K', description: 'Used across gold jewellery and fine settings.' }, silver: { label: 'Silver', purity: '925', description: 'Used for sterling silver pieces.' }, platinum: { label: 'Platinum', purity: '950', description: 'Used for platinum bands and fine forms.' } }
  return <><PageHeading eyebrow="LIVE PRICING CONFIGURATION" title={<>The value behind<br/><em>every detail.</em></>} description="Reference metal rates used by the live jewellery pricing engine."/><div className="rate-notice"><Activity size={17}/><span><b>Pricing source</b> These are reference rates from the admin pricing configuration. Confirm your backend's rate provider and update policy before using manual edits in production.</span></div><div className="rate-card-grid">{rates.map(r => <article className="metal-rate-card" key={r.metal}><div className="rate-card-top"><span className="metal-disc"><Gem size={19}/></span><span className="status-pill good">Configured</span></div><span className="metal-overline">{meta[r.metal].purity}</span><h3>{meta[r.metal].label}</h3><div className="rate-value">{money(r.ratePerGram)}<small> / gram</small></div><p>{meta[r.metal].description}</p><div className="rate-card-foot"><span><Clock3 size={13}/> Updated {dateLabel(r.updatedAt)}</span><button className="table-icon" onClick={() => { setEditing(r.metal); setValue(String(r.ratePerGram)) }} aria-label={`Edit ${r.metal} rate`}><Pencil size={15}/></button></div></article>)}</div>{editing && <div className="modal-backdrop"><form className="admin-modal" onSubmit={e => { e.preventDefault(); onSaveRate(editing, Number(value)); setEditing(null) }}><div className="modal-heading"><div><span className="admin-eyebrow">METAL RATE</span><h3>Update {editing} rate</h3><p>Set the reference rate per gram.</p></div><button type="button" className="table-icon" onClick={() => setEditing(null)}><X size={18}/></button></div><label>Rate per gram (₹)<input type="number" min="0" step="0.01" value={value} onChange={e => setValue(e.target.value)} required/></label><div className="modal-actions"><button type="button" className="admin-button secondary" onClick={() => setEditing(null)}>Cancel</button><button className="admin-button primary">Update rate</button></div></form></div>}</>
}
function RulesPage({ rules, onSaveRule }: Shared) {
  const blank = (): MakingChargeRule => ({ id: `new-${Date.now()}`, name: '', metal: 'gold', category: 'All categories', purity: 'all', amountPerGram: 0, status: 'active', updatedAt: new Date().toISOString() })
  const [editing, setEditing] = useState<MakingChargeRule | null>(null)
  const [query, setQuery] = useState('')
  const filtered = rules.filter(r => `${r.name} ${r.category} ${r.metal}`.toLowerCase().includes(query.toLowerCase()))
  return <><PageHeading eyebrow="PRICING POLICY" title={<>The craft of pricing,<br/><em>made transparent.</em></>} description="Manage the making-charge rules applied when new jewellery quotes are created." action={<button className="admin-button primary" onClick={() => setEditing(blank())}><Plus size={15}/> Add a rule</button>}/><div className="rules-explainer"><div className="explainer-icon"><SlidersHorizontal size={19}/></div><div><b>Making charges are part of the live price calculation.</b><p>Rules are expressed as a charge per gram. Existing locked quotes should retain their original price; updated rules should apply to subsequent quotes.</p></div></div><div className="admin-toolbar"><div className="search-field"><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Find a pricing rule…"/></div><span className="result-count">{rules.length} configured rules</span></div><div className="admin-panel table-panel"><div className="table-wrap"><table className="admin-table"><thead><tr><th>RULE</th><th>METAL</th><th>APPLIES TO</th><th>CHARGE / GRAM</th><th>STATUS</th><th/></tr></thead><tbody>{filtered.map(r => <tr key={r.id}><td><b>{r.name || `${r.category} rule`}</b><small className="table-sub">Updated {dateLabel(r.updatedAt)}</small></td><td className="capitalize">{r.metal}</td><td>{r.category} <small className="table-sub">{r.purity === 'all' ? 'All purities' : r.purity}</small></td><td><b>{money(r.amountPerGram)}</b></td><td><span className={`status-pill ${r.status === 'active' ? 'good' : 'muted'}`}>{r.status}</span></td><td><button className="table-icon" onClick={() => setEditing(r)} aria-label="Edit rule"><Pencil size={15}/></button></td></tr>)}</tbody></table></div>{filtered.length === 0 && <div className="empty-inline">No making-charge rules found.</div>}</div>{editing && <RuleEditor rule={editing} onClose={() => setEditing(null)} onSave={r => { onSaveRule({ ...r, updatedAt: new Date().toISOString() }); setEditing(null) }}/>}</>
}
function RuleEditor({ rule, onClose, onSave }: { rule: MakingChargeRule; onClose: () => void; onSave: (r: MakingChargeRule) => void }) {
  const [form, setForm] = useState(rule); const update = <K extends keyof MakingChargeRule>(key: K, value: MakingChargeRule[K]) => setForm(prev => ({ ...prev, [key]: value }))
  return <div className="modal-backdrop"><form className="admin-modal" onSubmit={e => { e.preventDefault(); onSave(form) }}><div className="modal-heading"><div><span className="admin-eyebrow">PRICING POLICY</span><h3>{rule.name ? 'Edit charge rule' : 'Create charge rule'}</h3><p>Define where this making charge applies.</p></div><button type="button" className="table-icon" onClick={onClose}><X size={18}/></button></div><label>Rule name<input value={form.name} onChange={e => update('name', e.target.value)} placeholder="e.g. Signature gold rings" required/></label><div className="form-two"><label>Metal<select value={form.metal} onChange={e => update('metal', e.target.value as MakingChargeRule['metal'])}><option value="gold">Gold</option><option value="silver">Silver</option><option value="platinum">Platinum</option><option value="all">All metals</option></select></label><label>Purity<select value={form.purity} onChange={e => update('purity', e.target.value)}><option value="all">All purities</option><option>18K</option><option>22K</option><option>925</option><option>950</option></select></label></div><label>Product category<input value={form.category} onChange={e => update('category', e.target.value)} placeholder="Rings, Earrings, All categories…" required/></label><label>Making charge per gram (₹)<input type="number" min="0" step="0.01" value={form.amountPerGram} onChange={e => update('amountPerGram', Number(e.target.value))} required/></label><label>Rule status<select value={form.status} onChange={e => update('status', e.target.value as MakingChargeRule['status'])}><option value="active">Active</option><option value="inactive">Inactive</option></select></label><div className="modal-actions"><button type="button" className="admin-button secondary" onClick={onClose}>Cancel</button><button className="admin-button primary"><Check size={15}/> Save rule</button></div></form></div>
}
function OrdersPage({ orders }: Shared) {
  return <><PageHeading eyebrow="CUSTOMER ORDERS" title={<>A record of every<br/><em>considered choice.</em></>} description="Review orders created through the Maison Aurelia checkout."/><div className="admin-panel table-panel"><div className="panel-heading table-panel-heading"><div><span className="admin-eyebrow">ORDER REGISTER</span><h3>All orders <span className="count-soft">({orders.length})</span></h3></div></div>{orders.length ? <div className="table-wrap"><table className="admin-table"><thead><tr><th>ORDER</th><th>DATE</th><th>ORDER VALUE</th><th>STATUS</th></tr></thead><tbody>{orders.map((o, i) => <tr key={o.id || i}><td><b>#{o.orderNumber || o.id}</b></td><td>{o.createdAt ? dateLabel(o.createdAt) : '—'}</td><td><b>{money(o.total || 0)}</b></td><td><span className="status-pill good">Placed</span></td></tr>)}</tbody></table></div> : <div className="empty-state"><div className="empty-icon"><ShoppingBag size={23}/></div><h3>Your order register is clear.</h3><p>Orders will appear here once customers complete checkout and the admin orders endpoint is connected.</p></div>}</div><div className="field-hint order-note">The current storefront checkout creates simulated order placement; payment processing and refunds are not included.</div></>
}
