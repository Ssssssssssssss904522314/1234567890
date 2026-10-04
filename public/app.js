const products=[
{icon:"@",type:"Юзернейм",name:"@nova",desc:"Короткий юзернейм",price:"120 USDT",seller:"@seller_one",rating:"4.9"},
{icon:"◉",type:"Канал",name:"Tech Daily",desc:"Тематика: технологии",price:"85 USDT",seller:"@market_pro",rating:"5.0"},
{icon:"◌",type:"Группа",name:"Design Hub",desc:"Активное сообщество",price:"60 USDT",seller:"@digital_store",rating:"4.8"},
{icon:"⌁",type:"Бот",name:"@helperbot",desc:"Готовый бот-проект",price:"150 USDT",seller:"@devshop",rating:"4.9"},
{icon:"#",type:"Юзернейм",name:"@orbit",desc:"Свободный формат",price:"95 USDT",seller:"@seller_two",rating:"4.7"},
{icon:"✦",type:"Канал",name:"News Point",desc:"Новостной канал",price:"210 USDT",seller:"@mediahub",rating:"4.9"},
{icon:"◇",type:"Группа",name:"Game Club",desc:"Игровое сообщество",price:"70 USDT",seller:"@seller_three",rating:"4.8"},
{icon:"⚡",type:"Бот",name:"@autoshop",desc:"Автоматизация",price:"180 USDT",seller:"@automation",rating:"5.0"}
];
const catalog=document.querySelector("#catalog");
function render(list=products){catalog.innerHTML=list.map(p=>`<article class="card"><div class="thumb">${p.icon}</div><span class="tag">${p.type}</span><h3>${p.name}</h3><div class="muted">${p.desc}</div><div class="price">${p.price}</div><div class="seller"><span class="muted">${p.seller}</span><span>★ ${p.rating}</span></div></article>`).join("")}
render();
document.querySelector("#search").addEventListener("input",e=>{const q=e.target.value.toLowerCase();render(products.filter(p=>(p.name+" "+p.type+" "+p.desc).toLowerCase().includes(q)))});
function view(v){document.querySelector("#catalog").classList.toggle("hidden",v!=="home");document.querySelector(".toolbar").classList.toggle("hidden",v!=="home");document.querySelector(".hero").classList.toggle("hidden",v!=="home");document.querySelector("#sell").classList.toggle("hidden",v!=="sell");document.querySelector("#orders").classList.toggle("hidden",v!=="orders");document.querySelectorAll(".nav").forEach(x=>x.classList.toggle("active",x.dataset.view===v))}
document.querySelectorAll("[data-view]").forEach(x=>x.addEventListener("click",()=>view(x.dataset.view)));
document.querySelector("#loginBtn").addEventListener("click",()=>alert("Telegram Login подключим после создания бота в @BotFather и указания домена."));
