const { createClient } = supabase;
const db = createClient(window.DTS_SUPABASE_URL, window.DTS_SUPABASE_PUBLISHABLE_KEY);

let bookings = [], month = new Date();
month.setDate(1);
let currentUser = null;
const $ = x => document.getElementById(x);
const today = () => new Date().toISOString().slice(0,10);
const fmt = s => new Date(s + 'T00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const icons = {'Anniversary Surprise':'♥','Proposal Surprise':'💍','Romantic Setup':'♥','Welcome Surprise':'✦','Custom Event':'✿'};

function showLogin(){ $('login').classList.remove('hidden'); $('app').classList.add('hidden'); }
function showApp(){ $('login').classList.add('hidden'); $('app').classList.remove('hidden'); }
function setAuthMessage(msg, error=true){ $('loginError').textContent = msg || ''; $('loginError').style.color = error ? '' : '#5f7d61'; }

$('loginForm').onsubmit = async e => {
  e.preventDefault(); setAuthMessage('Signing in…', false);
  const email = $('user').value.trim();
  const password = $('pass').value;
  const { error } = await db.auth.signInWithPassword({ email, password });
  if(error){ setAuthMessage(error.message || 'Incorrect email or password.'); return; }
  await startApp();
};

$('logout').onclick = async () => { await db.auth.signOut(); showLogin(); };

$('forgot').onclick = async () => {
  const email = $('user').value.trim();
  if(!email){ setAuthMessage('Enter your email first, then click Forgot password.'); return; }
  const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname });
  setAuthMessage(error ? error.message : 'Password reset email sent. Check your inbox.', !error);
};

$('showSignup').onclick = () => { $('loginPanel').classList.add('hidden'); $('signupPanel').classList.remove('hidden'); setAuthMessage(''); };
$('showLogin').onclick = () => { $('signupPanel').classList.add('hidden'); $('loginPanel').classList.remove('hidden'); setAuthMessage(''); };
$('signupForm').onsubmit = async e => {
  e.preventDefault();
  const name = $('signupName').value.trim(), email = $('signupEmail').value.trim(), password = $('signupPass').value;
  if(password.length < 8){ $('signupError').textContent='Password must be at least 8 characters.'; return; }
  $('signupError').textContent='Creating account…';
  const { data, error } = await db.auth.signUp({ email, password, options:{ data:{ full_name:name } } });
  if(error){ $('signupError').textContent=error.message; return; }
  if(data.session){ $('signupError').textContent='Account created. Loading dashboard…'; await startApp(); }
  else { $('signupError').textContent='Account created. If email confirmation is enabled, confirm your email first. Then sign in. New staff accounts must be authorized by the owner in Supabase.'; }
};

async function startApp(){
  const { data:{ user } } = await db.auth.getUser();
  if(!user){ showLogin(); return; }
  const { data: staff, error } = await db.from('staff').select('user_id,full_name').eq('user_id',user.id).maybeSingle();
  if(error || !staff){
    await db.auth.signOut();
    setAuthMessage('This account is not authorized for Dream Town Surprises yet. Ask the owner to add it as staff.');
    showLogin(); return;
  }
  currentUser = { ...user, full_name: staff.full_name || user.user_metadata?.full_name || 'Team Member' };
  $('welcomeName').textContent = currentUser.full_name.split(' ')[0];
  $('profileName').textContent = currentUser.full_name;
  $('profileInitials').textContent = currentUser.full_name.split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase();
  showApp(); await loadBookings(); render();
}

async function loadBookings(){
  const { data, error } = await db.from('bookings').select('*').order('event_date',{ascending:true});
  if(error){ console.error(error); alert('Could not load bookings: ' + error.message); return; }
  bookings = (data||[]).map(b=>({ id:b.id, type:b.event_type, date:b.event_date, time:b.event_time || '', bookedBy:b.booked_by, customer:b.customer_name || '', phone:b.phone || '', status:b.status, notes:b.notes || '' }));
}

async function saveBooking(){
  const id = $('editId').value;
  const b = { type:$('type').value,date:$('date').value,time:$('time').value,bookedBy:$('bookedBy').value.trim(),customer:$('customer').value.trim(),phone:$('phone').value.trim(),status:$('status').value,notes:$('notes').value.trim() };
  const duplicate = bookings.find(x=>x.date===b.date && x.status!=='Cancelled' && x.id!==id);
  if(duplicate){ $('formError').textContent=`This date is already booked by ${duplicate.bookedBy}. Choose another date.`; return; }
  $('formError').textContent='Saving…';
  const row = { event_date:b.date,event_time:b.time || null,event_type:b.type,booked_by:b.bookedBy,customer_name:b.customer || null,phone:b.phone || null,status:b.status,notes:b.notes || null };
  let result;
  if(id) result = await db.from('bookings').update(row).eq('id',id).select().single();
  else result = await db.from('bookings').insert({ ...row, created_by:currentUser.id }).select().single();
  if(result.error){
    $('formError').textContent = result.error.code === '23505' ? 'That date was just booked by another device. Please choose another date.' : result.error.message;
    return;
  }
  closeModal(); await loadBookings(); render(); if(!$('bookings').classList.contains('hidden')) renderBookings();
}

$('bookingForm').onsubmit = e => { e.preventDefault(); saveBooking(); };

function render(){ stats(); calendar(); upcoming(); }
function stats(){ let y=new Date().getFullYear(),m=String(new Date().getMonth()+1).padStart(2,'0'); $('total').textContent=bookings.length; $('month').textContent=bookings.filter(b=>b.date?.startsWith(y+'-'+m)).length; $('upcoming').textContent=bookings.filter(b=>b.date>=today() && b.status!=='Cancelled').length; $('customers').textContent=new Set(bookings.map(b=>b.customer||b.bookedBy)).size; }
function calendar(){ let y=month.getFullYear(),m=month.getMonth(),first=new Date(y,m,1).getDay(),days=new Date(y,m+1,0).getDate(); $('calTitle').textContent=month.toLocaleString('en-IN',{month:'long',year:'numeric'}); let h='<span></span>'.repeat(first); for(let d=1;d<=days;d++){ let s=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`,b=bookings.some(x=>x.date===s&&x.status!=='Cancelled'); h+=`<button class="${b?'booked ':''}${s===today()?'today':''}" onclick="openModal('${s}')">${d}</button>` } $('days').innerHTML=h; }
function upcoming(){ let a=bookings.filter(b=>b.date>=today()&&b.status!=='Cancelled').sort((a,b)=>a.date.localeCompare(b.date)).slice(0,5); $('upcomingList').innerHTML=a.length?a.map(b=>`<div class="booking"><div class="thumb">${icons[b.type]||'✦'}</div><div><b>${esc(b.type)}</b><div class="sub">${esc(b.notes||'Special surprise experience')}</div></div><div class="meta"><b>▣ ${fmt(b.date)}</b><br>◷ ${esc(b.time||'TBD')}</div><div class="meta">Booked by<br><b>${esc(b.bookedBy)}</b></div><span class="badge">${esc(b.status||'Confirmed')}</span></div>`).join(''):'<p>No upcoming bookings. Create your first surprise.</p>'; }

function page(n){ document.querySelectorAll('.page').forEach(x=>x.classList.add('hidden')); $(n).classList.remove('hidden'); document.querySelectorAll('nav button').forEach(x=>x.classList.toggle('active',x.dataset.page===n)); if(n==='bookings')renderBookings(); if(n==='availability')availability(); if(n==='customers')customers(); if(n==='reports')reports(); }
function renderBookings(){ let q=($('filter').value||'').toLowerCase(); $('allBookings').innerHTML=bookings.filter(b=>[b.type,b.bookedBy,b.customer,b.date].join(' ').toLowerCase().includes(q)).sort((a,b)=>a.date.localeCompare(b.date)).map(b=>`<div class="fullrow"><b>${fmt(b.date)}</b><span><b>${esc(b.type)}</b><br>${esc(b.customer||'No customer')}</span><span>${esc(b.bookedBy)}<br>${esc(b.phone||'')}</span><span>${esc(b.time||'TBD')}</span><span class="badge">${esc(b.status)}</span><span><button class="mini" onclick="editBooking('${b.id}')">Edit</button></span></div>`).join('')||'<p>No bookings found.</p>'; }
window.editBooking = id => { const b=bookings.find(x=>x.id===id); if(!b)return; openModal(); $('editId').value=b.id; $('type').value=b.type; $('date').value=b.date; $('time').value=b.time; $('bookedBy').value=b.bookedBy; $('customer').value=b.customer; $('phone').value=b.phone; $('status').value=b.status; $('notes').value=b.notes; $('modalTitle').textContent='Edit Booking'; };

function openModal(date=''){ $('bookingForm').reset(); $('editId').value=''; $('modal').classList.remove('hidden'); $('date').value=date||today(); $('modalTitle').textContent='Create New Booking'; $('formError').textContent=''; }
function closeModal(){ $('modal').classList.add('hidden'); }
$('close').onclick=closeModal;
$('filter').oninput=renderBookings; $('search').oninput=e=>{ $('filter').value=e.target.value; page('bookings'); };
$('prev').onclick=()=>{month.setMonth(month.getMonth()-1);calendar()}; $('next').onclick=()=>{month.setMonth(month.getMonth()+1);calendar()}; $('menu').onclick=()=>document.querySelector('aside').classList.toggle('open');

document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>page(b.dataset.page)); document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>openModal());
function availability(){ let a=[]; for(let i=0;i<21;i++){let d=new Date();d.setDate(d.getDate()+i);let s=d.toISOString().slice(0,10);a.push(`<button class="${bookings.some(b=>b.date===s&&b.status!=='Cancelled')?'booked':''}" onclick="showDate('${s}')">${fmt(s)}</button>`)} $('availDays').innerHTML=a.join(''); showDate(today()); }
window.showDate=s=>{ let b=bookings.filter(x=>x.date===s&&x.status!=='Cancelled'); $('availInfo').innerHTML=`<small>DATE STATUS</small><h2>${fmt(s)}</h2>${b.length?`<div class="card"><b>🔴 Booked</b>${b.map(x=>`<p><b>${esc(x.type)}</b><br>Booked by ${esc(x.bookedBy)} · ${esc(x.time||'TBD')}</p>`).join('')}</div>`:`<div class="card"><b>🟢 Available</b><p>No booking exists for this date.</p><button class="create" onclick="openModal('${s}')">Book this date →</button></div>`}`; };
function customers(){let m={}; bookings.forEach(b=>{let k=b.customer||b.bookedBy;m[k]??={name:k,phone:b.phone,count:0};m[k].count++}); $('customerGrid').innerHTML=Object.values(m).map(c=>`<div class="customer"><h3>${esc(c.name)}</h3><p>${esc(c.phone||'No phone added')}</p><b>${c.count} booking(s)</b></div>`).join('')||'<div class="card">No customers yet.</div>';}
function reports(){ $('reportsGrid').innerHTML=`<article><b>${bookings.length}</b><span>Total Bookings</span></article><article><b>${bookings.filter(x=>x.status==='Confirmed').length}</b><span>Confirmed</span></article><article><b>${bookings.filter(x=>x.status==='Pending').length}</b><span>Pending</span></article>`; }

(async()=>{ const {data:{session}}=await db.auth.getSession(); if(session) await startApp(); else showLogin(); db.auth.onAuthStateChange(async(event, session)=>{ if(session && (event==='SIGNED_IN'||event==='INITIAL_SESSION')) await startApp(); }); })();
