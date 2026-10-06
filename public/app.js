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
 ["#catalog",".toolbar",".hero","#sell","#orders","#purchase","#owner"].forEach(sel=>{const el=document.querySelector(sel);if(!el)return;const home=["#catalog",".toolbar",".hero"].includes(sel);el.classList.toggle("hidden",home?v!=="home":sel==="#sell"?v!=="sell":sel==="#orders"?v!=="orders":v!=="purchase"&&v!=="owner")});
 document.querySelectorAll(".nav").forEach(x=>x.classList.toggle("active",x.dataset.view===v));
}
document.querySelectorAll("[data-view]").forEach(x=>x.addEventListener("click",()=>view(x.dataset.view)));
async function initAuth(){
 try{
  const r=await fetch("/api/auth/me");const j=await r.json();
  const ownerNav=document.querySelector('.nav[data-view="owner"]');
  if(ownerNav)ownerNav.classList.toggle("hidden",!j.isOwner);
  const btn=document.querySelector("#loginBtn");
  if(btn){
   if(j.authenticated){
    btn.textContent=j.isOwner?"Администратор":"Выйти";
    btn.onclick=async()=>{await fetch("/api/auth/logout",{method:"POST"});location.reload()};
   }else{
    btn.textContent="Войти через Telegram";
    btn.onclick=()=>location.href="/auth/login";
   }
  }
  if(j.isOwner)loadOwnerPanel();
 }catch(e){}
}
initAuth();
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

async function loadOwnerPanel(){
 const key=localStorage.getItem("ownerPanelKey");
 const headers=key?{"x-owner-key":key}:{};
 try{
  const [sr,or]=await Promise.all([fetch("/api/owner/stats",{headers}),fetch("/api/owner/orders",{headers})]);
  const sj=await sr.json(),oj=await or.json();
  if(!sr.ok)throw new Error(sj.error||"Нет доступа");
  const s=sj.stats||{};
  document.querySelector("#ownerSales").textContent=Number(s.sales||0);
  document.querySelector("#ownerEarned").textContent=Number(s.earned_stars||0)+" ⭐";
  document.querySelector("#ownerPaid").textContent=Number(s.paid_orders||0);
  document.querySelector("#ownerRefunds").textContent=Number(s.refunds||0);
  document.querySelector("#ownerRefundStars").textContent=Number(s.refunded_stars||0)+" ⭐";
  document.querySelector("#ownerNet").textContent=Number(s.net_stars||0)+" ⭐";
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
 }catch(e){localStorage.removeItem("ownerPanelKey");document.querySelector("#ownerOrderList").innerHTML='<div class="empty">'+esc(e.message)+'</div>';}
}
document.querySelector("#ownerRefresh")?.addEventListener("click",loadOwnerPanel);
document.querySelector('.nav[data-view="owner"]')?.addEventListener("click",loadOwnerPanel);
