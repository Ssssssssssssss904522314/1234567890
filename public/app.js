let products=[];
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
 ["#catalog",".toolbar",".hero","#sell","#orders","#purchase"].forEach(sel=>{const el=document.querySelector(sel);if(!el)return;const home=["#catalog",".toolbar",".hero"].includes(sel);el.classList.toggle("hidden",home?v!=="home":sel==="#sell"?v!=="sell":sel==="#orders"?v!=="orders":v!=="purchase")});
 document.querySelectorAll(".nav").forEach(x=>x.classList.toggle("active",x.dataset.view===v));
}
document.querySelectorAll("[data-view]").forEach(x=>x.addEventListener("click",()=>view(x.dataset.view)));
document.querySelector("#loginBtn").addEventListener("click",()=>alert("Telegram Login подключим следующим этапом."));
async function buy(id){
 const p=products.find(x=>x.id===id);if(!p)return;
 try{
  const r=await fetch("/api/orders",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({listing_id:id})});
  const j=await r.json();if(!r.ok)throw new Error(j.error||"Не удалось создать заказ");
  localStorage.setItem("marketOrderId",j.order_id);
  window.open(j.invoice_url,"_blank","noopener");
  showPurchase(j.order_id,p);
 }catch(e){alert(e.message)}
}
function showPurchase(orderId,p){
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
async function pollOrder(orderId,p){
 const msg=document.querySelector("#deliveryMessage");msg.classList.remove("hidden");msg.textContent="Проверяем статус платежа…";
 try{const r=await fetch("/api/orders/"+encodeURIComponent(orderId));const j=await r.json();if(j.order?.status==="paid"){document.querySelector("#purchase .status-pill").textContent="● Оплачено";msg.textContent="Платёж подтверждён Telegram. Заказ передан в этап выдачи. Откройте чат сделки для передачи разрешённых данных товара.";document.querySelector("#receiveBtn").textContent="Оплата подтверждена";return}msg.textContent="Платёж ещё не подтверждён. Если вы только что оплатили, подождите несколько секунд и нажмите кнопку снова."}catch(e){msg.textContent="Не удалось проверить заказ."}
}
document.querySelector("#sellerChatBtn")?.addEventListener("click",()=>{const msg=document.querySelector("#deliveryMessage");msg.classList.remove("hidden");msg.textContent="Чат сделки будет привязан к Telegram Login продавца после подключения авторизации."});
document.querySelector("#disputeBtn")?.addEventListener("click",()=>{const msg=document.querySelector("#deliveryMessage");msg.classList.remove("hidden");msg.textContent="Спор создан. Выдача приостанавливается до решения модерации."});
document.querySelector("#publishBtn")?.addEventListener("click",async()=>{
 const body={title:document.querySelector("#sellTitle").value.trim(),category:document.querySelector("#sellCategory").value,price_stars:Number(document.querySelector("#sellPrice").value),delivery_mode:document.querySelector("#sellDelivery").value,description:document.querySelector("#sellDescription").value.trim(),seller_handle:document.querySelector("#sellSeller").value.trim()};
 const msg=document.querySelector("#publishMessage");msg.classList.remove("hidden");
 try{const r=await fetch("/api/listings",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});const j=await r.json();if(!r.ok)throw new Error(j.error);msg.textContent="Объявление опубликовано и уже доступно в каталоге.";document.querySelectorAll("#sell input,#sell textarea").forEach(x=>x.value="");await loadListings()}catch(e){msg.textContent=e.message}
});
