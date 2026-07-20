import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  LayoutDashboard, ClipboardList, Users, Boxes, FileText, UserCog,
  Settings, Plus, Save, Trash2, Download, Building2, Search, LogOut, LockKeyhole, History, WalletCards, Printer
} from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { supabase, supabaseConfigured } from './supabase'
import './styles.css'

const menu = [
  ['dashboard', 'Dashboard', LayoutDashboard],
  ['jobs', 'İş Emirleri', ClipboardList],
  ['customers', 'Müşteriler', Users],
  ['inventory', 'Stok', Boxes],
  ['quotes', 'Teklif Hazırla', FileText],
  ['finance', 'Ön Muhasebe', WalletCards],
  ['operators', 'Operatörler', UserCog],
  ['history', 'İşlem Geçmişi', History],
  ['settings', 'Ayarlar', Settings],
]

const emptyJob = {
  customer_id: '', job_no: '', part_name: '', material: 'DKP',
  thickness: '', quantity: 1, operator_id: '', due_date: '',
  status: 'Bekliyor', notes: ''
}

const emptyCustomer = {
  company_name: '', contact_name: '', phone: '', email: '', address: ''
}

const emptyStock = {
  material: 'DKP', thickness: '', width_mm: '', height_mm: '',
  quantity: 0, critical_level: 2
}

const emptyOperator = { full_name: '', role: 'Operatör', active: true }

const emptyQuote = {
  customer_id: '',
  quote_no: '',
  valid_until: '',
  vat_rate: 20,
  discount_rate: 0,
  status: 'Beklemede',
  notes: 'Fiyatlar belirtilen teknik resim ve adetlere göre hazırlanmıştır.',
  items: [{ description: '', quantity: 1, unit: 'Adet', unit_price: 0 }]
}

const defaultSettings = {
  company_name: 'Laserce Metal',
  slogan: 'Metalin Sanatla Buluşması',
  phone: '',
  email: '',
  address: '',
  tax_office: '',
  tax_no: '',
  iban: '',
  logo_data_url: ''
}


const CODE39 = {
  '0':'nnnwwnwnn','1':'wnnwnnnnw','2':'nnwwnnnnw','3':'wnwwnnnnn','4':'nnnwwnnnw',
  '5':'wnnwwnnnn','6':'nnwwwnnnn','7':'nnnwnnwnw','8':'wnnwnnwnn','9':'nnwwnnwnn',
  'A':'wnnnnwnnw','B':'nnwnnwnnw','C':'wnwnnwnnn','D':'nnnnwwnnw','E':'wnnnwwnnn',
  'F':'nnwnwwnnn','G':'nnnnnwwnw','H':'wnnnnwwnn','I':'nnwnnwwnn','J':'nnnnwwwnn',
  'K':'wnnnnnnww','L':'nnwnnnnww','M':'wnwnnnnwn','N':'nnnnwnnww','O':'wnnnwnnwn',
  'P':'nnwnwnnwn','Q':'nnnnnnwww','R':'wnnnnnwwn','S':'nnwnnnwwn','T':'nnnnwnwwn',
  'U':'wwnnnnnnw','V':'nwwnnnnnw','W':'wwwnnnnnn','X':'nwnnwnnnw','Y':'wwnnwnnnn',
  'Z':'nwwnwnnnn','-':'nwnnnnwnw','.':'wwnnnnwnn',' ':'nwwnnnwnn','*':'nwnnwnwnn'
}

function code39Svg(value) {
  const text = `*${String(value).toUpperCase().replace(/[^0-9A-Z. -]/g, '')}*`
  const narrow = 2, wide = 5, gap = 2, height = 55
  let x = 4
  const bars = []
  for (const ch of text) {
    const pattern = CODE39[ch] || CODE39['-']
    pattern.split('').forEach((kind, index) => {
      const width = kind === 'w' ? wide : narrow
      if (index % 2 === 0) bars.push(`<rect x="${x}" y="2" width="${width}" height="${height}" fill="#000"/>`)
      x += width
    })
    x += gap
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${x+4} ${height+20}" role="img"><g>${bars.join('')}</g><text x="${(x+4)/2}" y="${height+16}" text-anchor="middle" font-family="Arial" font-size="12">${value}</text></svg>`
}

function currency(value) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' })
    .format(Number(value || 0))
}

function dateText(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('tr-TR').format(new Date(value))
}

async function query(table, order = 'created_at') {
  const { data, error } = await supabase.from(table).select('*').order(order, { ascending: false })
  if (error) throw error
  return data || []
}

function App() {
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [page, setPage] = useState('dashboard')
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const [jobs, setJobs] = useState([])
  const [customers, setCustomers] = useState([])
  const [inventory, setInventory] = useState([])
  const [operators, setOperators] = useState([])
  const [quotes, setQuotes] = useState([])
  const [logs, setLogs] = useState([])
  const [transactions, setTransactions] = useState([])
  const [settings, setSettings] = useState(defaultSettings)

  const reload = async () => {
    if (!supabaseConfigured) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [j, c, i, o, q, l, t, s] = await Promise.all([
        query('jobs'),
        query('customers'),
        query('inventory'),
        query('operators'),
        query('quotes'),
        query('audit_logs'),
        query('finance_transactions', 'transaction_date'),
        supabase.from('company_settings').select('*').limit(1).maybeSingle()
      ])
      setJobs(j); setCustomers(c); setInventory(i); setOperators(o); setQuotes(q); setLogs(l); setTransactions(t)
      if (s.data) setSettings({ ...defaultSettings, ...s.data })
    } catch (err) {
      setNotice(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!supabaseConfigured) {
      setAuthLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session || null)
      setAuthLoading(false)
      if (data.session) reload()
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession || null)
      if (nextSession) reload()
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const flash = (message) => {
    setNotice(message)
    setTimeout(() => setNotice(''), 3500)
  }

  if (authLoading) {
    return <div className="setup-page"><div className="setup-card"><p>Yükleniyor…</p></div></div>
  }

  if (!supabaseConfigured) {
    return (
      <div className="setup-page">
        <div className="setup-card">
          <Building2 size={42} />
          <h1>Laserce ERP</h1>
          <p>Supabase bağlantısı eksik.</p>
          <code>VITE_SUPABASE_URL</code>
          <code>VITE_SUPABASE_ANON_KEY</code>
          <p>Bu iki değişkeni Vercel → Settings → Environment Variables bölümüne ekle.</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return <LoginPage flash={flash} />
  }

  const currentUserName = session.user.email?.toLowerCase() === 'ysf.altuntas@gmail.com'
    ? 'Yusuf Altuntaş'
    : session.user.email?.toLowerCase() === 'info@lasercemetal.com.tr' ? 'Yasin' : session.user.email

  const signOut = async () => {
    await supabase.auth.signOut()
    setSession(null)
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          {settings.logo_data_url
            ? <img src={settings.logo_data_url} alt="Logo" />
            : <div className="brand-mark">L</div>}
          <div>
            <strong>{settings.company_name}</strong>
            <span>ERP</span>
          </div>
        </div>

        <nav>
          {menu.map(([key, label, Icon]) => (
            <button key={key} className={page === key ? 'active' : ''} onClick={() => setPage(key)}>
              <Icon size={19} /> {label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <h1>{menu.find(x => x[0] === page)?.[1]}</h1>
            <p>{settings.slogan}</p>
          </div>
          <div className="actions">
            <span className="user-chip">{currentUserName}</span>
            <button className="secondary" onClick={reload}>Yenile</button>
            <button className="secondary" onClick={signOut}><LogOut size={17}/> Çıkış</button>
          </div>
        </header>

        {notice && <div className="notice">{notice}</div>}
        {loading ? <div className="loading">Yükleniyor…</div> : (
          <>
            {page === 'dashboard' && <Dashboard jobs={jobs} inventory={inventory} quotes={quotes} customers={customers} transactions={transactions} />}
            {page === 'jobs' && <Jobs jobs={jobs} customers={customers} operators={operators} logs={logs} reload={reload} flash={flash} />}
            {page === 'customers' && <Customers customers={customers} logs={logs} reload={reload} flash={flash} />}
            {page === 'inventory' && <Inventory inventory={inventory} logs={logs} reload={reload} flash={flash} />}
            {page === 'quotes' && <Quotes quotes={quotes} customers={customers} settings={settings} logs={logs} reload={reload} flash={flash} />}
            {page === 'finance' && <Finance transactions={transactions} customers={customers} logs={logs} reload={reload} flash={flash} />}
            {page === 'history' && <AuditHistory logs={logs} />}
            {page === 'operators' && <Operators operators={operators} reload={reload} flash={flash} />}
            {page === 'settings' && <SettingsPage settings={settings} setSettings={setSettings} flash={flash} />}
          </>
        )}
      </main>
    </div>
  )
}


function LoginPage({ flash }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [errorText, setErrorText] = useState('')

  const login = async (e) => {
    e.preventDefault()
    setBusy(true)
    setErrorText('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) setErrorText('E-posta veya şifre hatalı.')
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={login}>
        <div className="login-icon"><LockKeyhole size={28}/></div>
        <h1>Laserce ERP</h1>
        <p>Yetkili kullanıcı girişi</p>

        <label className="field">
          <span>E-posta</span>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
        </label>

        <label className="field">
          <span>Şifre</span>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
        </label>

        {errorText && <div className="login-error">{errorText}</div>}
        <button className="primary login-button" disabled={busy}>
          {busy ? 'Giriş yapılıyor…' : 'Giriş Yap'}
        </button>
      </form>
    </div>
  )
}

function Dashboard({ jobs, inventory, quotes, customers, transactions=[] }) {
  const delayed = jobs.filter(j => j.due_date && new Date(j.due_date) < new Date() && j.status !== 'Tamamlandı').length
  const active = jobs.filter(j => j.status !== 'Tamamlandı').length
  const lowStock = inventory.filter(i => Number(i.quantity) <= Number(i.critical_level)).length
  const quoteTotal = quotes.reduce((sum, q) => sum + Number(q.grand_total || 0), 0)

  return (
    <>
      <div className="stats">
        <Stat title="Aktif İşler" value={active} />
        <Stat title="Geciken İşler" value={delayed} danger={delayed > 0} />
        <Stat title="Kritik Stok" value={lowStock} danger={lowStock > 0} />
        <Stat title="Teklif Toplamı" value={currency(quoteTotal)} />
      </div>
      <div className="grid-2">
        <section className="panel">
          <h2>Yaklaşan İşler</h2>
          <Table headers={['İş No', 'Parça', 'Termin', 'Durum']}>
            {jobs.slice(0, 8).map(j => (
              <tr key={j.id}>
                <td>{j.job_no || '-'}</td><td>{j.part_name}</td><td>{dateText(j.due_date)}</td><td><Badge>{j.status}</Badge></td>
              </tr>
            ))}
          </Table>
        </section>
        <section className="panel">
          <h2>Genel Durum</h2>
          <div className="summary-list">
            <div><span>Müşteri Sayısı</span><strong>{customers.length}</strong></div>
            <div><span>Toplam İş Emri</span><strong>{jobs.length}</strong></div>
            <div><span>Toplam Teklif</span><strong>{quotes.length}</strong></div>
            <div><span>Stok Kalemi</span><strong>{inventory.length}</strong></div>
          </div>
        </section>
      </div>
    </>
  )
}

function Stat({ title, value, danger }) {
  return <div className={`stat ${danger ? 'danger' : ''}`}><span>{title}</span><strong>{value}</strong></div>
}


function creatorFor(logs, table, recordId) {
  const log = logs.find(x => x.table_name === table && x.record_id === String(recordId) && x.action === 'INSERT')
  return log?.user_name || log?.user_email || '-'
}

function dailyNumber(prefix, records, field) {
  const now = new Date()
  const dd = String(now.getDate()).padStart(2, '0')
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const yy = String(now.getFullYear()).slice(-2)
  const base = `${prefix}-${dd}${mm}${yy}-`
  const max = records
    .map(r => String(r[field] || ''))
    .filter(v => v.startsWith(base))
    .map(v => Number(v.slice(-3)))
    .filter(Number.isFinite)
    .reduce((a,b) => Math.max(a,b), 0)
  return `${base}${String(max + 1).padStart(3, '0')}`
}

function Jobs({ jobs, customers, operators, logs, reload, flash }) {
  const makeEmpty = () => ({ ...emptyJob, job_no: dailyNumber('IE', jobs, 'job_no') })
  const [form, setForm] = useState(makeEmpty)
  const [search, setSearch] = useState('')
  const filtered = jobs.filter(j =>
    `${j.job_no} ${j.part_name} ${j.material}`.toLowerCase().includes(search.toLowerCase())
  )

  useEffect(() => {
    if (!form.part_name) setForm(current => ({ ...current, job_no: dailyNumber('IE', jobs, 'job_no') }))
  }, [jobs])

  const save = async (e) => {
    e.preventDefault()
    const payload = { ...form, quantity: Number(form.quantity || 0), thickness: Number(form.thickness || 0) || null }
    const { error } = await supabase.from('jobs').insert(payload)
    if (error) return flash(error.message)
    setForm({ ...emptyJob, job_no: dailyNumber('IE', [...jobs, payload], 'job_no') })
    flash('İş emri kaydedildi.'); reload()
  }

  const remove = async id => {
    if (!confirm('Bu iş emri silinsin mi?')) return
    const { error } = await supabase.from('jobs').delete().eq('id', id)
    if (error) return flash(error.message)
    reload()
  }

  const printLabel = job => {
    const customer = customers.find(c => c.id === job.customer_id)
    const svgMarkup = code39Svg(job.job_no)
    const popup = window.open('', '_blank', 'width=500,height=500')
    if (!popup) return flash('Etiket penceresi engellendi. Açılır pencereye izin ver.')
    popup.document.write(`<!doctype html><html><head><title>${job.job_no}</title><style>
      @page{size:80mm 50mm;margin:2mm} body{font-family:Arial;margin:0}.label{width:76mm;height:46mm;padding:2mm;box-sizing:border-box;border:1px solid #ddd}
      h2{font-size:15px;margin:0 0 4px}.row{font-size:11px;margin:2px 0}.barcode{text-align:center;margin-top:4px}.barcode svg{max-width:100%;height:18mm}
      @media print{.label{border:0}}
    </style></head><body><div class="label"><h2>LASERCE METAL</h2>
      <div class="row"><b>Müşteri:</b> ${customer?.company_name || '-'}</div>
      <div class="row"><b>Parça:</b> ${job.part_name} &nbsp; <b>Adet:</b> ${job.quantity}</div>
      <div class="row"><b>Malzeme:</b> ${job.material || '-'} ${job.thickness ? job.thickness + ' mm' : ''}</div>
      <div class="row"><b>Termin:</b> ${dateText(job.due_date)}</div>
      <div class="barcode">${svgMarkup}</div></div><script>window.onload=()=>window.print()<\/script></body></html>`)
    popup.document.close()
  }

  return (
    <>
      <FormPanel title="Yeni İş Emri">
        <form className="form-grid" onSubmit={save}>
          <Input label="İş No (Otomatik)" value={form.job_no} onChange={()=>{}} readOnly />
          <Select label="Müşteri" value={form.customer_id} onChange={v => setForm({...form, customer_id:v})}
            options={customers.map(c => [c.id, c.company_name])} />
          <Input label="Parça Adı" value={form.part_name} onChange={v => setForm({...form, part_name:v})} required />
          <Select label="Malzeme" value={form.material} onChange={v => setForm({...form, material:v})}
            options={['DKP','ST37','Galvaniz','Paslanmaz','Alüminyum'].map(x => [x,x])} />
          <Input label="Kalınlık (mm)" type="number" value={form.thickness} onChange={v => setForm({...form, thickness:v})} />
          <Input label="Adet" type="number" value={form.quantity} onChange={v => setForm({...form, quantity:v})} />
          <Select label="Operatör" value={form.operator_id} onChange={v => setForm({...form, operator_id:v})}
            options={operators.filter(o => o.active).map(o => [o.id, o.full_name])} />
          <Input label="Termin" type="date" value={form.due_date} onChange={v => setForm({...form, due_date:v})} />
          <Select label="Durum" value={form.status} onChange={v => setForm({...form, status:v})}
            options={['Bekliyor','Kesimde','Kaynakta','Hazır','Tamamlandı'].map(x => [x,x])} />
          <Input label="Not" value={form.notes} onChange={v => setForm({...form, notes:v})} />
          <button className="primary"><Save size={17}/> Kaydet</button>
        </form>
      </FormPanel>

      <ListHeader title="İş Emirleri" search={search} setSearch={setSearch} />
      <section className="panel">
        <Table headers={['İş No','Parça','Malzeme','Adet','Termin','Durum','Kaydeden','İşlemler']}>
          {filtered.map(j => <tr key={j.id}>
            <td><strong>{j.job_no}</strong></td><td>{j.part_name}</td><td>{j.material} {j.thickness ? `${j.thickness} mm` : ''}</td>
            <td>{j.quantity}</td><td>{dateText(j.due_date)}</td><td><Badge>{j.status}</Badge></td>
            <td>{creatorFor(logs, 'jobs', j.id)}</td>
            <td><div className="table-actions"><button className="secondary small" onClick={() => printLabel(j)}><Printer size={15}/> Etiket</button><button className="icon danger-btn" onClick={() => remove(j.id)}><Trash2 size={16}/></button></div></td>
          </tr>)}
        </Table>
      </section>
    </>
  )
}

function Customers({ customers, logs, reload, flash }) {
  const [form, setForm] = useState(emptyCustomer)

  const save = async e => {
    e.preventDefault()
    const { error } = await supabase.from('customers').insert(form)
    if (error) return flash(error.message)
    setForm(emptyCustomer); flash('Müşteri kaydedildi.'); reload()
  }

  return (
    <>
      <FormPanel title="Yeni Müşteri">
        <form className="form-grid" onSubmit={save}>
          <Input label="Firma" value={form.company_name} onChange={v => setForm({...form, company_name:v})} required />
          <Input label="Yetkili" value={form.contact_name} onChange={v => setForm({...form, contact_name:v})} />
          <Input label="Telefon" value={form.phone} onChange={v => setForm({...form, phone:v})} />
          <Input label="E-posta" type="email" value={form.email} onChange={v => setForm({...form, email:v})} />
          <Input label="Adres" value={form.address} onChange={v => setForm({...form, address:v})} />
          <button className="primary"><Plus size={17}/> Ekle</button>
        </form>
      </FormPanel>
      <section className="panel">
        <Table headers={['Firma','Yetkili','Telefon','E-posta','Adres','Kaydeden']}>
          {customers.map(c => <tr key={c.id}>
            <td><strong>{c.company_name}</strong></td><td>{c.contact_name}</td><td>{c.phone}</td><td>{c.email}</td><td>{c.address}</td><td>{creatorFor(logs, 'customers', c.id)}</td>
          </tr>)}
        </Table>
      </section>
    </>
  )
}

function Inventory({ inventory, logs, reload, flash }) {
  const [form, setForm] = useState(emptyStock)

  const save = async e => {
    e.preventDefault()
    const payload = {
      ...form,
      thickness: Number(form.thickness || 0),
      width_mm: Number(form.width_mm || 0),
      height_mm: Number(form.height_mm || 0),
      quantity: Number(form.quantity || 0),
      critical_level: Number(form.critical_level || 0)
    }
    const { error } = await supabase.from('inventory').insert(payload)
    if (error) return flash(error.message)
    setForm(emptyStock); flash('Stok eklendi.'); reload()
  }

  return (
    <>
      <FormPanel title="Stok Ekle">
        <form className="form-grid" onSubmit={save}>
          <Select label="Malzeme" value={form.material} onChange={v => setForm({...form, material:v})}
            options={['DKP','ST37','Galvaniz','Paslanmaz','Alüminyum'].map(x => [x,x])} />
          <Input label="Kalınlık" type="number" value={form.thickness} onChange={v => setForm({...form, thickness:v})} required />
          <Input label="En (mm)" type="number" value={form.width_mm} onChange={v => setForm({...form, width_mm:v})} />
          <Input label="Boy (mm)" type="number" value={form.height_mm} onChange={v => setForm({...form, height_mm:v})} />
          <Input label="Sac Adedi" type="number" value={form.quantity} onChange={v => setForm({...form, quantity:v})} />
          <Input label="Kritik Seviye" type="number" value={form.critical_level} onChange={v => setForm({...form, critical_level:v})} />
          <button className="primary"><Plus size={17}/> Ekle</button>
        </form>
      </FormPanel>
      <section className="panel">
        <Table headers={['Malzeme','Kalınlık','Ölçü','Adet','Durum','Kaydeden']}>
          {inventory.map(i => <tr key={i.id}>
            <td>{i.material}</td><td>{i.thickness} mm</td><td>{i.width_mm}×{i.height_mm}</td><td>{i.quantity}</td>
            <td>{Number(i.quantity) <= Number(i.critical_level) ? <Badge danger>Kritik</Badge> : <Badge>Yeterli</Badge>}</td><td>{creatorFor(logs, 'inventory', i.id)}</td>
          </tr>)}
        </Table>
      </section>
    </>
  )
}

function Quotes({ quotes, customers, settings, logs, reload, flash }) {
  const [form, setForm] = useState(() => ({ ...emptyQuote, quote_no: dailyNumber('TK', quotes, 'quote_no') }))

  useEffect(() => {
    if (!form.customer_id && !form.items.some(x => x.description)) setForm(current => ({ ...current, quote_no: dailyNumber('TK', quotes, 'quote_no') }))
  }, [quotes])

  const totals = useMemo(() => {
    const subtotal = form.items.reduce((s, x) => s + Number(x.quantity || 0) * Number(x.unit_price || 0), 0)
    const discount = subtotal * Number(form.discount_rate || 0) / 100
    const vat = (subtotal - discount) * Number(form.vat_rate || 0) / 100
    return { subtotal, discount, vat, grand: subtotal - discount + vat }
  }, [form])

  const updateItem = (index, field, value) => {
    const items = [...form.items]
    items[index] = { ...items[index], [field]: value }
    setForm({ ...form, items })
  }

  const addItem = () => setForm({ ...form, items: [...form.items, { description:'', quantity:1, unit:'Adet', unit_price:0 }] })
  const removeItem = index => setForm({ ...form, items: form.items.filter((_, i) => i !== index) })

  const save = async () => {
    if (!form.quote_no) return flash('Teklif numarası gir.')
    const payload = {
      customer_id: form.customer_id || null,
      quote_no: form.quote_no,
      valid_until: form.valid_until || null,
      vat_rate: Number(form.vat_rate || 0),
      discount_rate: Number(form.discount_rate || 0),
      subtotal: totals.subtotal,
      discount_total: totals.discount,
      vat_total: totals.vat,
      grand_total: totals.grand,
      notes: form.notes
    }
    const { data, error } = await supabase.from('quotes').insert(payload).select().single()
    if (error) return flash(error.message)
    const items = form.items.map(x => ({
      quote_id: data.id,
      description: x.description,
      quantity: Number(x.quantity || 0),
      unit: x.unit,
      unit_price: Number(x.unit_price || 0),
      line_total: Number(x.quantity || 0) * Number(x.unit_price || 0)
    }))
    const itemResult = await supabase.from('quote_items').insert(items)
    if (itemResult.error) return flash(itemResult.error.message)
    setForm({ ...emptyQuote, quote_no: dailyNumber('TK', [...quotes, payload], 'quote_no') })
    flash('Teklif kaydedildi.'); reload()
  }

  const pdf = () => {
    const customer = customers.find(c => c.id === form.customer_id)
    const doc = new jsPDF()
    if (settings.logo_data_url) {
      try { doc.addImage(settings.logo_data_url, 'PNG', 14, 10, 35, 20) } catch {}
    }
    doc.setFontSize(18)
    doc.text(settings.company_name || 'Laserce Metal', 14, settings.logo_data_url ? 38 : 20)
    doc.setFontSize(10)
    doc.text(settings.slogan || '', 14, settings.logo_data_url ? 44 : 26)

    doc.setFontSize(16)
    doc.text('FIYAT TEKLIFI', 145, 20)
    doc.setFontSize(10)
    doc.text(`Teklif No: ${form.quote_no || '-'}`, 145, 28)
    doc.text(`Tarih: ${dateText(new Date())}`, 145, 34)
    doc.text(`Gecerlilik: ${dateText(form.valid_until)}`, 145, 40)

    doc.setFontSize(11)
    doc.text(`Firma: ${customer?.company_name || '-'}`, 14, 56)
    doc.text(`Yetkili: ${customer?.contact_name || '-'}`, 14, 63)
    doc.text(`Telefon: ${customer?.phone || '-'}`, 14, 70)
    doc.text(`E-posta: ${customer?.email || '-'}`, 14, 77)

    autoTable(doc, {
      startY: 88,
      head: [['Aciklama', 'Miktar', 'Birim', 'Birim Fiyat', 'Toplam']],
      body: form.items.map(x => [
        x.description,
        x.quantity,
        x.unit,
        currency(x.unit_price),
        currency(Number(x.quantity || 0) * Number(x.unit_price || 0))
      ])
    })

    const y = doc.lastAutoTable.finalY + 10
    doc.text(`Ara Toplam: ${currency(totals.subtotal)}`, 135, y)
    doc.text(`Indirim: ${currency(totals.discount)}`, 135, y + 7)
    doc.text(`KDV: ${currency(totals.vat)}`, 135, y + 14)
    doc.setFontSize(12)
    doc.text(`GENEL TOPLAM: ${currency(totals.grand)}`, 125, y + 24)

    doc.setFontSize(9)
    doc.text(form.notes || '', 14, y + 35, { maxWidth: 180 })
    doc.text(`${settings.phone || ''}  ${settings.email || ''}`, 14, 280)
    doc.save(`${form.quote_no || 'teklif'}.pdf`)
  }

  return (
    <>
      <section className="panel">
        <div className="panel-title">
          <h2>Yeni Teklif</h2>
          <div className="actions">
            <button className="secondary" onClick={save}><Save size={17}/> Kaydet</button>
            <button className="primary" onClick={pdf}><Download size={17}/> PDF Al</button>
          </div>
        </div>

        <div className="form-grid">
          <Input label="Teklif No (Otomatik)" value={form.quote_no} onChange={()=>{}} readOnly />
          <Select label="Müşteri" value={form.customer_id} onChange={v => setForm({...form, customer_id:v})}
            options={customers.map(c => [c.id, c.company_name])} />
          <Input label="Geçerlilik Tarihi" type="date" value={form.valid_until} onChange={v => setForm({...form, valid_until:v})} />
          <Input label="İndirim %" type="number" value={form.discount_rate} onChange={v => setForm({...form, discount_rate:v})} />
          <Input label="KDV %" type="number" value={form.vat_rate} onChange={v => setForm({...form, vat_rate:v})} />
        </div>

        <div className="quote-items">
          {form.items.map((item, index) => (
            <div className="quote-row" key={index}>
              <Input label="Açıklama" value={item.description} onChange={v => updateItem(index,'description',v)} />
              <Input label="Miktar" type="number" value={item.quantity} onChange={v => updateItem(index,'quantity',v)} />
              <Input label="Birim" value={item.unit} onChange={v => updateItem(index,'unit',v)} />
              <Input label="Birim Fiyat" type="number" value={item.unit_price} onChange={v => updateItem(index,'unit_price',v)} />
              <button className="icon danger-btn item-delete" onClick={() => removeItem(index)}><Trash2 size={16}/></button>
            </div>
          ))}
          <button className="secondary" onClick={addItem}><Plus size={17}/> Satır Ekle</button>
        </div>

        <label className="field full">
          <span>Notlar</span>
          <textarea value={form.notes} onChange={e => setForm({...form, notes:e.target.value})} />
        </label>

        <div className="totals">
          <span>Ara Toplam <strong>{currency(totals.subtotal)}</strong></span>
          <span>İndirim <strong>{currency(totals.discount)}</strong></span>
          <span>KDV <strong>{currency(totals.vat)}</strong></span>
          <span className="grand">Genel Toplam <strong>{currency(totals.grand)}</strong></span>
        </div>
      </section>

      <section className="panel">
        <h2>Teklif Geçmişi</h2>
        <Table headers={['Teklif No','Tarih','Geçerlilik','Toplam','Kaydeden','']}>
          {quotes.map(q => <tr key={q.id}>
            <td><strong>{q.quote_no}</strong></td><td>{dateText(q.created_at)}</td><td>{dateText(q.valid_until)}</td><td>{currency(q.grand_total)}</td><td>{creatorFor(logs, 'quotes', q.id)}</td>
            <td><button className="icon danger-btn" onClick={async()=>{if(!confirm('Bu teklif silinsin mi?'))return;const {error}=await supabase.from('quotes').delete().eq('id',q.id);if(error)return flash(error.message);flash('Teklif silindi.');reload()}}><Trash2 size={16}/></button></td>
          </tr>)}
        </Table>
      </section>
    </>
  )
}

function Finance({ transactions, customers, logs, reload, flash }) {
  const blank = { type:'Gider', account:'Kasa', category:'', amount:'', transaction_date:new Date().toISOString().slice(0,10), customer_id:'', description:'' }
  const [form,setForm]=useState(blank)
  const income=transactions.filter(t=>t.type==='Gelir').reduce((s,t)=>s+Number(t.amount||0),0)
  const expense=transactions.filter(t=>t.type==='Gider').reduce((s,t)=>s+Number(t.amount||0),0)
  const save=async e=>{e.preventDefault();const payload={...form,amount:Number(form.amount||0),customer_id:form.customer_id||null};const {error}=await supabase.from('finance_transactions').insert(payload);if(error)return flash(error.message);setForm(blank);flash('Muhasebe kaydı eklendi.');reload()}
  const remove=async id=>{if(!confirm('Bu muhasebe kaydı silinsin mi?'))return;const {error}=await supabase.from('finance_transactions').delete().eq('id',id);if(error)return flash(error.message);reload()}
  return <>
    <div className="stats"><Stat title="Toplam Gelir" value={currency(income)}/><Stat title="Toplam Gider" value={currency(expense)} danger/><Stat title="Net Bakiye" value={currency(income-expense)} danger={income-expense<0}/></div>
    <FormPanel title="Gelir / Gider Kaydı">
      <form className="form-grid" onSubmit={save}>
        <Select label="İşlem Türü" value={form.type} onChange={v=>setForm({...form,type:v})} options={['Gelir','Gider'].map(x=>[x,x])}/>
        <Select label="Hesap" value={form.account} onChange={v=>setForm({...form,account:v})} options={['Kasa','Banka','Kredi Kartı'].map(x=>[x,x])}/>
        <Input label="Kategori" value={form.category} onChange={v=>setForm({...form,category:v})} required/>
        <Input label="Tutar" type="number" value={form.amount} onChange={v=>setForm({...form,amount:v})} required/>
        <Input label="Tarih" type="date" value={form.transaction_date} onChange={v=>setForm({...form,transaction_date:v})}/>
        <Select label="Müşteri / Cari" value={form.customer_id} onChange={v=>setForm({...form,customer_id:v})} options={customers.map(c=>[c.id,c.company_name])}/>
        <Input label="Açıklama" value={form.description} onChange={v=>setForm({...form,description:v})}/>
        <button className="primary"><Save size={17}/> Kaydet</button>
      </form>
    </FormPanel>
    <section className="panel"><h2>Hareketler</h2><Table headers={['Tarih','Tür','Hesap','Kategori','Açıklama','Tutar','Kaydeden','']}>
      {transactions.map(t=><tr key={t.id}><td>{dateText(t.transaction_date)}</td><td><Badge danger={t.type==='Gider'}>{t.type}</Badge></td><td>{t.account}</td><td>{t.category}</td><td>{t.description}</td><td><strong>{currency(t.amount)}</strong></td><td>{creatorFor(logs,'finance_transactions',t.id)}</td><td><button className="icon danger-btn" onClick={()=>remove(t.id)}><Trash2 size={16}/></button></td></tr>)}
    </Table></section>
  </>
}

function Operators({ operators, reload, flash }) {
  const [form, setForm] = useState(emptyOperator)

  const save = async e => {
    e.preventDefault()
    const { error } = await supabase.from('operators').insert(form)
    if (error) return flash(error.message)
    setForm(emptyOperator); flash('Operatör eklendi.'); reload()
  }

  const toggle = async op => {
    const { error } = await supabase.from('operators').update({ active: !op.active }).eq('id', op.id)
    if (error) return flash(error.message)
    reload()
  }

  return (
    <>
      <FormPanel title="Operatör Ekle">
        <form className="form-grid" onSubmit={save}>
          <Input label="Ad Soyad" value={form.full_name} onChange={v => setForm({...form, full_name:v})} required />
          <Select label="Rol" value={form.role} onChange={v => setForm({...form, role:v})}
            options={['Yönetici','Operatör','Kaynakçı','Muhasebe'].map(x => [x,x])} />
          <button className="primary"><Plus size={17}/> Ekle</button>
        </form>
      </FormPanel>
      <section className="panel">
        <Table headers={['Ad Soyad','Rol','Durum','']}>
          {operators.map(o => <tr key={o.id}>
            <td>{o.full_name}</td><td>{o.role}</td><td>{o.active ? <Badge>Aktif</Badge> : <Badge danger>Pasif</Badge>}</td>
            <td><button className="secondary small" onClick={() => toggle(o)}>{o.active ? 'Pasif Yap' : 'Aktif Yap'}</button></td>
          </tr>)}
        </Table>
      </section>
    </>
  )
}


function AuditHistory({ logs }) {
  const [search, setSearch] = useState('')
  const actionText = { INSERT: 'Oluşturdu', UPDATE: 'Güncelledi', DELETE: 'Sildi' }
  const tableText = {
    customers: 'Müşteri', jobs: 'İş Emri', inventory: 'Stok', quotes: 'Teklif',
    quote_items: 'Teklif Satırı', operators: 'Personel', company_settings: 'Firma Ayarı', finance_transactions: 'Muhasebe Kaydı'
  }
  const filtered = logs.filter(log =>
    `${log.user_name} ${log.user_email} ${log.record_label} ${log.table_name} ${log.action}`
      .toLowerCase().includes(search.toLowerCase())
  )
  return (
    <>
      <ListHeader title="İşlem Geçmişi" search={search} setSearch={setSearch} />
      <section className="panel">
        <p className="muted">Kayıtlar otomatik oluşur; uygulama içinden değiştirilemez veya silinemez.</p>
        <Table headers={['Tarih / Saat','Kullanıcı','İşlem','Kayıt','Detay']}>
          {filtered.map(log => <tr key={log.id}>
            <td>{new Intl.DateTimeFormat('tr-TR', { dateStyle:'short', timeStyle:'short' }).format(new Date(log.created_at))}</td>
            <td><strong>{log.user_name || log.user_email || 'Sistem'}</strong></td>
            <td><Badge danger={log.action === 'DELETE'}>{actionText[log.action] || log.action}</Badge></td>
            <td>{tableText[log.table_name] || log.table_name}</td>
            <td>{log.record_label || log.record_id || '-'}</td>
          </tr>)}
        </Table>
      </section>
    </>
  )
}

function SettingsPage({ settings, setSettings, flash }) {
  const save = async e => {
    e.preventDefault()
    const payload = { ...settings, id: 1 }
    const { error } = await supabase.from('company_settings').upsert(payload)
    if (error) return flash(error.message)
    flash('Ayarlar kaydedildi.')
  }

  const logo = file => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setSettings({ ...settings, logo_data_url: reader.result })
    reader.readAsDataURL(file)
  }

  return (
    <section className="panel">
      <h2>Firma ve PDF Ayarları</h2>
      <form className="form-grid" onSubmit={save}>
        <Input label="Firma Adı" value={settings.company_name} onChange={v => setSettings({...settings, company_name:v})} />
        <Input label="Slogan" value={settings.slogan} onChange={v => setSettings({...settings, slogan:v})} />
        <Input label="Telefon" value={settings.phone} onChange={v => setSettings({...settings, phone:v})} />
        <Input label="E-posta" value={settings.email} onChange={v => setSettings({...settings, email:v})} />
        <Input label="Adres" value={settings.address} onChange={v => setSettings({...settings, address:v})} />
        <Input label="Vergi Dairesi" value={settings.tax_office} onChange={v => setSettings({...settings, tax_office:v})} />
        <Input label="Vergi No" value={settings.tax_no} onChange={v => setSettings({...settings, tax_no:v})} />
        <Input label="IBAN" value={settings.iban} onChange={v => setSettings({...settings, iban:v})} />
        <label className="field">
          <span>Logo</span>
          <input type="file" accept="image/*" onChange={e => logo(e.target.files?.[0])} />
        </label>
        {settings.logo_data_url && <img className="logo-preview" src={settings.logo_data_url} alt="Logo önizleme" />}
        <button className="primary"><Save size={17}/> Kaydet</button>
      </form>
    </section>
  )
}

function FormPanel({ title, children }) {
  return <section className="panel"><h2>{title}</h2>{children}</section>
}

function ListHeader({ title, search, setSearch }) {
  return <div className="list-header"><h2>{title}</h2><label className="search"><Search size={17}/><input placeholder="Ara…" value={search} onChange={e => setSearch(e.target.value)} /></label></div>
}

function Input({ label, value, onChange, type='text', required=false, readOnly=false }) {
  return <label className="field"><span>{label}</span><input type={type} value={value ?? ''} onChange={e => onChange(e.target.value)} required={required} readOnly={readOnly} /></label>
}

function Select({ label, value, onChange, options }) {
  return <label className="field"><span>{label}</span><select value={value ?? ''} onChange={e => onChange(e.target.value)}>
    <option value="">Seçiniz</option>
    {options.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
  </select></label>
}

function Badge({ children, danger=false }) {
  return <span className={`badge ${danger ? 'badge-danger' : ''}`}>{children}</span>
}

function Table({ headers, children }) {
  return <div className="table-wrap"><table><thead><tr>{headers.map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{children}</tbody></table></div>
}

createRoot(document.getElementById('root')).render(<App />)
