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
  render(products.filter(p=>
    (p.name+" "+p.type+" "+p.desc).toLowerCase().includes(q)
  ));
});

function view(v){
  document.querySelector("#catalog").classList.toggle("hidden",v!=="home");
  document.querySelector(".toolbar").classList.toggle("hidden",v!=="home");
  document.querySelector(".hero").classList.toggle("hidden",v!=="home");
  document.querySelector("#sell").classList.toggle("hidden",v!=="sell");
  document.querySelector("#orders").classList.toggle("hidden",v!=="orders");
  document.querySelectorAll(".nav").forEach(x=>x.classList.toggle("active",x.dataset.view===v));
}

document.querySelectorAll("[data-view]").forEach(x=>
  x.addEventListener("click",()=>view(x.dataset.view))
);

document.querySelector("#loginBtn").addEventListener("click",()=>{
  alert("Telegram Login подключим после настройки отдельного бота и домена.");
});
