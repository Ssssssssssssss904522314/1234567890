let products=[];
let currentOrderId=localStorage.getItem("marketOrderId")||"";
const catalog=document.querySelector("#catalog");
function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function render(list=products){
 if(!list.length){catalog.innerHTML=`<div class="empty-state"><div class="empty-icon">◇</div><h3>Товаров пока нет</h3><p>Опубликуйте первое реальное объявление — после этого оно появится здесь.</p><button class="primary" onclick="view('sell')">Выставить товар</button></div>`;return}
 catalog.innerHTML=list.map(p=>`<article class="card"><div class="thumb">◇</div><span class="tag">${esc(p.category)}</span><h3>${esc(p.title)}</h3><div class="muted">${esc(p.description||"")}</div><div class="price">${p.price_stars} ⭐</div><div class="seller"><span class="muted">${esc(p.seller_handle)}</span><button class="buy-btn" data-buy="${p.id}">Купить</button></div></article>`).join("");
 document.querySelectorAll("[data-buy]").forEach(b=>b.addEventListener("click",()=>buy(b.dataset.buy)));
}
async function loadListings(){try{const r=await fetch("/api/listings");const j=await r.json();products=j.items||[];render()}catch(e){catalog.innerHTML='<div class="empty">Не удалось загрузить каталог.</div>'}}
loadListings();
document.querySelector("#search").addEventListener("input",e=>{const q=e.target.value.toLowerCase().trim();render(products.filter(p=>(p.title+" "+p.category+" "+(p.description||"")).toLowerCase().includes(q)))});
function view(v){
 const sections={
  home:["#catalog",".toolbar",".hero"],
  sell:["#sell"],
  orders:["#orders"],
  chats:["#chats"],
  purchase:["#purchase"],
  owner:["#owner"]
 };
 const visible=new Set(sections[v]||sections.home);
 ["#catalog",".toolbar",".hero","#sell","#orders","#chats","#purchase","#owner"].forEach(sel=>{
  const el=document.querySelector(sel);if(el)el.classList.toggle("hidden",!visible.has(sel));
 });
 document.querySelectorAll(".nav").forEach(x=>x.classList.toggle("active",x.dataset.view===v));
 if(v==="home")loadListings();
 if(v==="orders")loadOrders();
 if(v==="chats")loadChats();
 if(v==="owner")loadOwnerPanel();
}
document.querySelectorAll("[data-view]").forEach(x=>{if(x.dataset.view==="owner")return;x.addEventListener("click",()=>view(x.dataset.view))});
let currentUser=null;
let authMode="login";
const authModal=document.querySelector("#authModal"),authTitle=document.querySelector("#authTitle"),authSubtitle=document.querySelector("#authSubtitle"),authName=document.querySelector("#authName"),authPassword=document.querySelector("#authPassword"),authSubmit=document.querySelector("#authSubmit"),authSwitch=document.querySelector("#authSwitch"),authMessage=document.querySelector("#authMessage");
function openAuth(mode="login"){authMode=mode;authTitle.textContent=mode==="login"?"Вход в Market":"Регистрация";authSubtitle.textContent=mode==="login"?"Введите имя и пароль.":"Создайте аккаунт: имя + пароль.";authSubmit.textContent=mode==="login"?"Войти":"Создать аккаунт";authSwitch.textContent=mode==="login"?"Нет аккаунта? Зарегистрироваться":"Уже есть аккаунт? Войти";authMessage.classList.add("hidden");authName.value="";authPassword.value="";authModal.classList.remove("hidden");authModal.setAttribute("aria-hidden","false");authName.focus()}
function closeAuth(){authModal.classList.add("hidden");authModal.setAttribute("aria-hidden","true")}
document.querySelector("#closeAuth")?.addEventListener("click",closeAuth);
authModal?.addEventListener("click",e=>{if(e.target===authModal)closeAuth()});
authSwitch?.addEventListener("click",()=>openAuth(authMode==="login"?"register":"login"));
authSubmit?.addEventListener("click",async()=>{
 const name=authName.value.trim(),password=authPassword.value;
 authMessage.classList.remove("hidden");authMessage.textContent=authMode==="login"?"Выполняется вход…":"Создаём аккаунт…";
 try{const r=await fetch("/api/auth/"+authMode,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name,password})});const j=await r.json();if(!r.ok)throw new Error(j.error||"Ошибка авторизации");closeAuth();await initAuth()}catch(e){authMessage.textContent=e.message}
});
authPassword?.addEventListener("keydown",e=>{if(e.key==="Enter")authSubmit.click()});
const adminModal=document.querySelector("#adminModal"),adminPassword=document.querySelector("#adminPassword"),adminSubmit=document.querySelector("#adminSubmit"),adminMessage=document.querySelector("#adminMessage");
function openAdminLogin(){adminMessage?.classList.add("hidden");if(adminPassword)adminPassword.value="";adminModal?.classList.remove("hidden");adminModal?.setAttribute("aria-hidden","false");adminPassword?.focus()}
function closeAdminLogin(){adminModal?.classList.add("hidden");adminModal?.setAttribute("aria-hidden","true")}
document.querySelector("#closeAdmin")?.addEventListener("click",closeAdminLogin);
adminModal?.addEventListener("click",e=>{if(e.target===adminModal)closeAdminLogin()});
async function adminIsAuthenticated(){try{const r=await fetch("/api/admin/me");const j=await r.json();return !!j.authenticated}catch(e){return false}}
async function openOwnerPanel(){
 if(!(await adminIsAuthenticated())){openAdminLogin();return}
 view("owner");await loadOwnerPanel();
}
document.querySelector('.nav[data-view="owner"]')?.addEventListener("click",e=>{e.preventDefault();openOwnerPanel()});
adminSubmit?.addEventListener("click",async()=>{
 const password=adminPassword?.value||"";
 adminMessage.classList.remove("hidden");adminMessage.textContent="Проверяем пароль…";
 try{const r=await fetch("/api/admin/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({password})});const j=await r.json();if(!r.ok)throw new Error(j.error||"Ошибка входа");closeAdminLogin();view("owner");await loadOwnerPanel()}catch(e){adminMessage.textContent=e.message}
});
adminPassword?.addEventListener("keydown",e=>{if(e.key==="Enter")adminSubmit.click()});
async function initAuth(){
 try{
  const r=await fetch("/api/auth/me");const j=await r.json();
  currentUser=j.user||null;
  if(currentUser)loadOrders();
  const seller=document.querySelector("#sellSeller");if(seller)seller.value=currentUser?.name||"";
  const ownerNav=document.querySelector('.nav[data-view="owner"]');if(ownerNav)ownerNav.classList.remove("hidden");
  const btn=document.querySelector("#loginBtn");
  if(btn){
   if(j.authenticated){btn.textContent="Выйти";btn.onclick=async()=>{await fetch("/api/auth/logout",{method:"POST"});location.reload()}}
   else{btn.textContent="Войти";btn.onclick=()=>openAuth("login")}
  }
 }catch(e){}
}
initAuth();
async function loadOrders(){
 const box=document.querySelector("#orders");if(!box)return;
 if(!currentUser){box.innerHTML='<div class="empty">🔐 Войдите в Market, чтобы видеть сделки.</div>';return}
 try{
  const r=await fetch("/api/orders");const j=await r.json();if(!r.ok)throw new Error(j.error||"Не удалось загрузить сделки");
  const labels={pending:"Ожидает оплаты",paid:"Оплачено",delivery:"Выдача",completed:"Завершено",cancelled:"Отменено",refund_requested:"Возврат запрошен",disputed:"Жалоба",refunded:"Возвращено"};
  box.innerHTML=j.items?.length?'<div class="orders-list">'+j.items.map(o=>`<article class="market-order"><div><b>#${esc(o.id.slice(-8))}</b><h3>${esc(o.title||"Товар")}</h3><span>${esc(o.category||"")} · ${Number(o.amount_stars||0)} ⭐</span></div><em>${labels[o.status]||esc(o.status)}</em><button class="secondary order-open" data-order="${esc(o.id)}">Открыть</button></article>`).join("")+'</div>':'<div class="empty">У вас пока нет сделок.</div>';
  box.querySelectorAll(".order-open").forEach(b=>b.addEventListener("click",async()=>{const o=j.items.find(x=>x.id===b.dataset.order);if(o){currentOrderId=o.id;view("purchase");await pollOrder(o.id,null)}}));
 }catch(e){box.innerHTML='<div class="empty">'+esc(e.message)+'</div>'}
}
let activeChatId=null,chatTimer=null;
async function loadChats(){
 const list=document.querySelector("#chatList"),messages=document.querySelector("#chatMessages");if(!list||!messages)return;
 if(!currentUser){list.innerHTML='<div class="empty">🔐 Войдите в Market, чтобы открыть чаты.</div>';messages.innerHTML='<div class="empty">Войдите в Market.</div>';return}
 try{
  const r=await fetch("/api/chats");const j=await r.json();if(!r.ok)throw new Error(j.error||"Не удалось загрузить чаты");
  const items=j.items||[];list.innerHTML=items.map((x,i)=>`<button class="chat-item ${i===0?"active":""}" data-chat="${esc(x.id)}"><span class="chat-avatar small">✦</span><span><b>${esc(x.name)}</b><small>${esc(x.last_message||"Напишите нам, если нужна помощь")}</small></span></button>`).join("")||'<div class="empty">Чатов пока нет.</div>';
  if(items.length&&!activeChatId)activeChatId=items[0].id;
  list.querySelectorAll(".chat-item").forEach(b=>b.addEventListener("click",()=>{activeChatId=b.dataset.chat;list.querySelectorAll(".chat-item").forEach(x=>x.classList.remove("active"));b.classList.add("active");loadChatMessages()}));
  await loadChatMessages();
 }catch(e){list.innerHTML='<div class="empty">'+esc(e.message)+'</div>'}
}
async function loadChatMessages(){
 if(!activeChatId)return;const box=document.querySelector("#chatMessages");if(!box)return;
 try{const r=await fetch("/api/chats/"+encodeURIComponent(activeChatId)+"/messages");const j=await r.json();if(!r.ok)throw new Error(j.error||"Не удалось загрузить сообщения");
  box.innerHTML=(j.items||[]).map(m=>`<div class="chat-message ${String(m.user_id)===String(currentUser?.id)?"mine":"support"}"><div>${esc(m.message)}</div><time>${new Date(m.created_at).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})}</time></div>`).join("")||'<div class="empty">Напишите в поддержку — мы ответим здесь.</div>';
  box.scrollTop=box.scrollHeight;
 }catch(e){box.innerHTML='<div class="empty">'+esc(e.message)+'</div>'}
}
document.querySelector("#chatForm")?.addEventListener("submit",async e=>{e.preventDefault();if(!activeChatId)return;const input=document.querySelector("#chatInput"),message=input.value.trim();if(!message)return;input.disabled=true;try{const r=await fetch("/api/chats/"+encodeURIComponent(activeChatId)+"/messages",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({message})});const j=await r.json();if(!r.ok)throw new Error(j.error||"Не удалось отправить");input.value="";await loadChatMessages();await loadChats()}catch(e){alert(e.message)}finally{input.disabled=false;input.focus()}});
document.querySelector('.nav[data-view="chats"]')?.addEventListener("click",()=>{loadChats();if(chatTimer)clearInterval(chatTimer);chatTimer=setInterval(loadChatMessages,3000)});
document.querySelector('.nav[data-view="orders"]')?.addEventListener("click",()=>loadOrders());
async function buy(id){
 const p=products.find(x=>x.id===id);if(!p)return;
 try{
  const r=await fetch("/api/orders",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({listing_id:id})});
  const j=await r.json();if(!r.ok)throw new Error(j.error||"Не удалось создать заказ");
  localStorage.setItem("marketOrderId",j.order_id);currentOrderId=j.order_id;
  window.open(j.invoice_url,"_blank","noopener");
  showPurchase(j.order_id,p);
 }catch(e){alert(e.message)}
}
function showPurchase(orderId,p){
 currentOrderId=orderId;localStorage.setItem("marketOrderId",orderId);
 const box=document.querySelector("#purchase");
 box.querySelector(".eyebrow").textContent="PURCHASE #"+orderId.slice(-8);
 box.querySelector("h2").textContent="Ожидается оплата";
 box.querySelector("p").textContent="Оплатите счёт в Telegram Stars. После подтверждения Telegram статус изменится автоматически.";
 box.querySelector(".account-main h3").textContent=p.title;
 box.querySelector(".account-data").innerHTML=`<div><span>Категория</span><b>${esc(p.category)}</b></div><div><span>Цена</span><b>${p.price_stars} ⭐</b></div><div><span>Продавец</span><b>${esc(p.seller_handle)}</b></div><div><span>Выдача</span><b>${esc(p.delivery_mode||"manual")}</b></div>`;
 const btn=document.querySelector("#receiveBtn");btn.disabled=false;btn.textContent="Проверить оплату";
 btn.onclick=()=>pollOrder(orderId,p);
 document.querySelector("#deliveryMessage").classList.add("hidden");
 view("purchase");pollOrder(orderId,p);
}
function setDeliveryMessage(text){
 const msg=document.querySelector("#deliveryMessage");msg.classList.remove("hidden");msg.textContent=text;
}
async function loadCurrentOrder(){
 if(!currentOrderId)return null;
 try{const r=await fetch("/api/orders/"+encodeURIComponent(currentOrderId));const j=await r.json();if(!r.ok)throw new Error(j.error||"Не удалось загрузить сделку");return j.order}catch(e){setDeliveryMessage(e.message);return null}
}
async function pollOrder(orderId,p){
 currentOrderId=orderId;
 const msg=document.querySelector("#deliveryMessage");msg.classList.remove("hidden");msg.textContent="Проверяем статус сделки…";
 try{
  const r=await fetch("/api/orders/"+encodeURIComponent(orderId));const j=await r.json();if(!r.ok)throw new Error(j.error||"Не удалось проверить заказ");
  const o=j.order||{};const status=o.status;
  const labels={pending:"● Ожидается оплата",paid:"● Оплачено",delivery:"● Выдача",completed:"● Завершено",cancelled:"● Отменено",refund_requested:"● Запрошен возврат",disputed:"● Спор открыт",refunded:"● Возвращено"};
  document.querySelector("#purchase .status-pill").textContent=labels[status]||("● "+status);
  if(status==="pending"){msg.textContent="Счёт создан. Оплатите его в Telegram Stars или отмените заказ.";return}
  if(status==="paid"||status==="delivery"){msg.textContent="Платёж подтверждён. После получения товара нажмите «Подтвердить получение». Если возникла проблема — используйте возврат или жалобу.";document.querySelector("#receiveBtn").textContent="Обновить статус";return}
  if(status==="completed"){msg.textContent="Сделка завершена. Спасибо за покупку.";return}
  if(status==="cancelled"){msg.textContent="Заказ отменён до оплаты.";return}
  if(status==="refund_requested"){msg.textContent="Запрос на возврат отправлен владельцу маркета. Ожидайте решения.";return}
  if(status==="disputed"){msg.textContent="Жалоба открыта. Выдача/завершение сделки приостановлены до рассмотрения.";return}
  if(status==="refunded"){msg.textContent="Возврат выполнен. Stars возвращены через Telegram.";return}
  msg.textContent="Текущий статус: "+status;
 }catch(e){msg.textContent=e.message||"Не удалось проверить заказ."}
}
async function orderAction(path,body,message){
 try{
  const r=await fetch("/api/orders/"+encodeURIComponent(currentOrderId)+path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body||{})});
  const j=await r.json();if(!r.ok)throw new Error(j.error||"Операция не выполнена");
  setDeliveryMessage(j.message||message);await pollOrder(currentOrderId,null);
 }catch(e){setDeliveryMessage(e.message)}
}
document.querySelector("#completeOrderBtn")?.addEventListener("click",()=>orderAction("/complete",{},"Получение подтверждено."));
document.querySelector("#cancelOrderBtn")?.addEventListener("click",()=>{
 if(!currentOrderId)return setDeliveryMessage("Сначала откройте сделку.");
 if(confirm("Отменить заказ? Отмена доступна до подтверждения оплаты."))orderAction("/cancel",{},"Заказ отменён.");
});
document.querySelector("#refundOrderBtn")?.addEventListener("click",()=>{
 if(!currentOrderId)return setDeliveryMessage("Сначала откройте сделку.");
 const reason=prompt("Причина запроса на возврат:","Товар не получен / проблема с товаром");
 if(reason!==null)orderAction("/refund",{reason},"Запрос на возврат отправлен.");
});
document.querySelector("#sellerChatBtn")?.addEventListener("click",()=>setDeliveryMessage("Чат сделки будет привязан к Telegram Login продавца после подключения авторизации."));
document.querySelector("#disputeBtn")?.addEventListener("click",()=>{
 if(!currentOrderId)return setDeliveryMessage("Сначала откройте сделку.");
 const reason=prompt("Опишите проблему для жалобы:");
 if(reason&&reason.trim())orderAction("/complaint",{reason:reason.trim()},"Жалоба передана на рассмотрение.");
});
const rulesModal=document.querySelector("#accountRulesModal");
const rulesAccepted=document.querySelector("#rulesAccepted");
const acceptRules=document.querySelector("#acceptRules");
const closeRules=document.querySelector("#closeRules");
let pendingAccountPublish=false;
function openRules(){if(rulesModal){rulesModal.classList.remove("hidden");rulesModal.setAttribute("aria-hidden","false")}}
function closeRulesModal(){if(rulesModal){rulesModal.classList.add("hidden");rulesModal.setAttribute("aria-hidden","true")}}
rulesAccepted?.addEventListener("change",()=>{acceptRules.disabled=!rulesAccepted.checked});
closeRules?.addEventListener("click",closeRulesModal);
rulesModal?.addEventListener("click",e=>{if(e.target===rulesModal)closeRulesModal()});
acceptRules?.addEventListener("click",()=>{if(!rulesAccepted.checked)return;localStorage.setItem("telegramAccountRulesAccepted","1");closeRulesModal();if(pendingAccountPublish){pendingAccountPublish=false;publishListing()}});

let checkNonce="";
const checkBox=document.querySelector("#accountVerifyBox");
const checkBtn=document.querySelector("#verifyAccountBtn");
const checkStatus=document.querySelector("#accountVerifyStatus");
const categoryBox=document.querySelector("#sellCategory");
function syncCheckBox(){if(checkBox)checkBox.classList.toggle("hidden",categoryBox?.value!=="Telegram-аккаунт")}
categoryBox?.addEventListener("change",syncCheckBox);syncCheckBox();
checkBtn?.addEventListener("click",async()=>{
 try{
  checkBtn.disabled=true;checkStatus.textContent="Подготовка проверки…";
  const r=await fetch("/api/account-verification/start",{method:"POST"});const j=await r.json();if(!r.ok)throw new Error(j.error||"Не удалось начать проверку");
  checkNonce=j.nonce;checkStatus.textContent="Откройте Telegram-бота и нажмите Start с проверяемого аккаунта.";window.open(j.link,"_blank","noopener");
  const timer=setInterval(async()=>{try{const q=await fetch("/api/account-verification/"+encodeURIComponent(checkNonce));const v=await q.json();if(v.status==="verified"){clearInterval(timer);checkBox.classList.add("verified");checkStatus.textContent="✓ Аккаунт активен и подтверждён";checkBtn.textContent="Подтверждено"}else if(v.status==="expired"){clearInterval(timer);checkStatus.textContent="Проверка истекла — нажмите кнопку ещё раз";checkBtn.disabled=false}}catch(e){}},2000);
 }catch(e){checkStatus.textContent=e.message;checkBtn.disabled=false}
});
async function publishListing(){
 const body={title:document.querySelector("#sellTitle").value.trim(),category:document.querySelector("#sellCategory").value,price_stars:Number(document.querySelector("#sellPrice").value),delivery_mode:document.querySelector("#sellDelivery").value,verification_nonce:checkNonce||null,description:document.querySelector("#sellDescription").value.trim(),seller_handle:document.querySelector("#sellSeller").value.trim()};
 const msg=document.querySelector("#publishMessage");msg.classList.remove("hidden");
 try{const r=await fetch("/api/listings",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});const j=await r.json();if(!r.ok)throw new Error(j.error);msg.textContent=body.category==="Telegram-аккаунт"?"Объявление аккаунта опубликовано. Секретные данные доступа не загружаются в маркет.":"Объявление опубликовано и уже доступно в каталоге.";document.querySelectorAll("#sell input,#sell textarea").forEach(x=>x.value="");await loadListings()}catch(e){msg.textContent=e.message}
}
document.querySelector("#publishBtn")?.addEventListener("click",()=>{
 const category=document.querySelector("#sellCategory").value;
 if(category==="Telegram-аккаунт" && localStorage.getItem("telegramAccountRulesAccepted")!=="1"){pendingAccountPublish=true;openRules();return}
 publishListing();
});

async function loadAdminSupport(){
 try{const r=await fetch("/api/admin/chats/support/messages");const j=await r.json();if(!r.ok)throw new Error(j.error||"Не удалось загрузить поддержку");const box=document.querySelector("#adminSupportMessages");box.innerHTML=(j.items||[]).map(m=>`<div class="chat-message ${m.user_id==="admin"?"mine":"support"}"><div>${esc(m.message)}</div><time>${esc(m.user_id)} · ${new Date(m.created_at).toLocaleString("ru-RU")}</time></div>`).join("")||'<div class="empty">Сообщений пока нет.</div>';box.scrollTop=box.scrollHeight}catch(e){const b=document.querySelector("#adminSupportMessages");if(b)b.innerHTML='<div class="empty">'+esc(e.message)+'</div>'}
}
document.querySelector("#adminSupportForm")?.addEventListener("submit",async e=>{e.preventDefault();const input=document.querySelector("#adminSupportInput"),message=input.value.trim();if(!message)return;input.disabled=true;try{const r=await fetch("/api/admin/chats/support/messages",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({message})});const j=await r.json();if(!r.ok)throw new Error(j.error||"Не удалось отправить");input.value="";await loadAdminSupport()}catch(e){alert(e.message)}finally{input.disabled=false;input.focus()}});
async function loadOwnerPanel(){
 try{
  const [sr,or]=await Promise.all([fetch("/api/owner/stats"),fetch("/api/owner/orders")]);
  const sj=await sr.json(),oj=await or.json();
  if(!sr.ok)throw new Error(sj.error||"Нет доступа");
  const s=sj.stats||{};
  document.querySelector("#ownerSales").textContent=Number(s.sales||0);
  document.querySelector("#ownerEarned").textContent=Number(s.earned_stars||0)+" ⭐";
  document.querySelector("#ownerPaid").textContent=Number(s.paid_orders||0);
  document.querySelector("#ownerRefunds").textContent=Number(s.refunds||0);
  document.querySelector("#ownerRefundStars").textContent=Number(s.refunded_stars||0)+" ⭐";
  document.querySelector("#ownerNet").textContent=Number(s.net_stars||0)+" ⭐";
  await loadAdminSupport();
  const list=document.querySelector("#ownerOrderList");
  const items=oj.items||[];
  list.innerHTML=items.length?items.map(o=>{
 const labels={pending:"Ожидает оплаты",paid:"Оплачено",delivery:"Выдача",completed:"Завершено",cancelled:"Отменено",refund_requested:"Запрос возврата",disputed:"Жалоба",refunded:"Возвращено"};
 const cls=(o.status==="refunded"||o.status==="cancelled")?"refund":(o.status==="refund_requested"||o.status==="disputed")?"warn":"paid";
 const action=(o.status==="refund_requested"||o.status==="disputed")?'<button class="danger owner-refund" data-refund="'+esc(o.id)+'">Вернуть Stars</button>':"";
 return `<div class="owner-order"><div><b>#${esc(o.id.slice(-8))}</b><span>${esc(o.seller_handle||"—")} · ${new Date(o.created_at).toLocaleString("ru-RU")}</span>${o.refund_reason?'<span>Возврат: '+esc(o.refund_reason)+'</span>':""}${o.complaint_reason?'<span>Жалоба: '+esc(o.complaint_reason)+'</span>':""}</div><strong>${Number(o.amount_stars||0)} ⭐</strong><em class="${cls}">${labels[o.status]||esc(o.status)}</em>${action}</div>`;
}).join(""):'<div class="empty">Сделок пока нет.</div>';
 document.querySelectorAll(".owner-refund").forEach(b=>b.addEventListener("click",async()=>{
  if(!confirm("Вернуть покупателю Stars по этой сделке?"))return;
  try{const rr=await fetch("/api/owner/orders/"+encodeURIComponent(b.dataset.refund)+"/refund",{method:"POST"});const jj=await rr.json();if(!rr.ok)throw new Error(jj.error||"Возврат не выполнен");await loadOwnerPanel()}catch(e){alert(e.message)}
 }));
 }catch(e){document.querySelector("#ownerOrderList").innerHTML='<div class="empty">'+esc(e.message)+'</div>';}
}
document.querySelector("#ownerRefresh")?.addEventListener("click",loadOwnerPanel);
