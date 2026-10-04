const products=[];

const catalog=document.querySelector("#catalog");

function render(list=products){
  if(!list.length){
    catalog.innerHTML=`
      <div class="empty-state">
        <div class="empty-icon">◇</div>
        <h3>Товаров пока нет</h3>
        <p>Здесь будут отображаться реальные объявления продавцов после публикации.</p>
        <button class="primary" onclick="view(&quot;sell&quot;)">Выставить товар</button>
      </div>`;
    return;
  }
  catalog.innerHTML=list.map(p=>`
    <article class="card">
      <div class="thumb">${p.icon||"◇"}</div>
      <span class="tag">${p.type}</span>
      <h3>${p.name}</h3>
      <div class="muted">${p.desc}</div>
      <div class="price">${p.price}</div>
      <div class="seller"><span class="muted">${p.seller}</span><span>★ ${p.rating}</span></div>
    </article>`).join("");
}
render();

document.querySelector("#search").addEventListener("input",e=>{
  const q=e.target.value.toLowerCase().trim();
  render(products.filter(p=>(p.name+" "+p.type+" "+p.desc).toLowerCase().includes(q)));
});

function view(v){
  ["catalog",".toolbar",".hero","#sell","#orders","#purchase"].forEach(sel=>{
    const el=document.querySelector(sel);
    if(el) el.classList.toggle("hidden", (sel==="#catalog"||sel===".toolbar"||sel===".hero") ? v!=="home" : sel==="#sell" ? v!=="sell" : sel==="#orders" ? v!=="orders" : v!=="purchase");
  });
  document.querySelectorAll(".nav").forEach(x=>x.classList.toggle("active",x.dataset.view===v));
}
document.querySelectorAll("[data-view]").forEach(x=>x.addEventListener("click",()=>view(x.dataset.view)));

document.querySelector("#loginBtn").addEventListener("click",()=>alert("Telegram Login подключим после настройки отдельного бота и домена."));

const receiveBtn=document.querySelector("#receiveBtn");
const deliveryMessage=document.querySelector("#deliveryMessage");
if(receiveBtn){
  receiveBtn.addEventListener("click",()=>{
    deliveryMessage.classList.remove("hidden");
    deliveryMessage.textContent="Запрос на выдачу создан. Продавец уведомлён. Сайт не запрашивает и не пересылает Telegram OTP, пароль 2FA или session-файл.";
    receiveBtn.textContent="Запрос на выдачу отправлен";
    receiveBtn.disabled=true;
  });
}
document.querySelector("#sellerChatBtn")?.addEventListener("click",()=>{
  deliveryMessage.classList.remove("hidden");
  deliveryMessage.textContent="Чат сделки откроется после подключения Telegram Login и серверной системы сообщений.";
});
document.querySelector("#disputeBtn")?.addEventListener("click",()=>{
  deliveryMessage.classList.remove("hidden");
  deliveryMessage.textContent="Спор создан. Средства сделки остаются в резерве до решения спора.";
});
