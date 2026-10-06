const express=require("express");
const path=require("path");
const crypto=require("crypto");
const db=require("./db");
const owner=require("./owner-panel");
const app=express();
const PORT=process.env.PORT||10000;
const BOT_TOKEN=process.env.TELEGRAM_MARKET_BOT_TOKEN||"";
const WEBHOOK_SECRET=process.env.TELEGRAM_MARKET_WEBHOOK_SECRET||"";
const SITE_URL=process.env.MARKET_SITE_URL||"";
const SESSION_SECRET=process.env.MARKET_SESSION_SECRET||crypto.randomBytes(32).toString("hex");
const OWNER_TELEGRAM_USERNAME=(process.env.OWNER_TELEGRAM_USERNAME||"wswkkk").replace(/^@/,"").toLowerCase();
const ADMIN_PASSWORD_HASH=process.env.ADMIN_PANEL_PASSWORD_HASH||"0827354a35fa25df0c90fbfa1e5fc4991c73d75de12b3c175a0db6af88c404da720233e42e8019e30e2725e6be26341deb2c7bd90ba8dd6dd4914680e36f66a8";
const ADMIN_PASSWORD_SALT=process.env.ADMIN_PANEL_PASSWORD_SALT||"market-admin-2026";

app.use(express.json({limit:"2mb"}));
app.use(express.static(path.join(__dirname,"public")));

async function tg(method,body){
 const r=await fetch("https://api.telegram.org/bot"+BOT_TOKEN+"/"+method,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
 const j=await r.json();
 if(!j.ok) throw new Error(j.description||"Telegram API error");
 return j.result;
}

app.get("/api/health",async(req,res)=>res.json({ok:true,service:"telegram-digital-market",database:!!db.pool,payments:!!BOT_TOKEN}));
function setSession(res,u){const payload=Buffer.from(JSON.stringify({id:u.id,name:u.name,exp:Date.now()+604800000})).toString("base64url");const sig=crypto.createHmac("sha256",SESSION_SECRET).update(payload).digest("base64url");res.setHeader("Set-Cookie","market_session="+payload+"."+sig+"; Path=/; Max-Age=604800; HttpOnly; Secure; SameSite=Lax");}
app.post("/api/auth/register",async(req,res)=>{
 const name=String(req.body?.name||"").trim();const password=String(req.body?.password||"");
 if(!/^[A-Za-zА-Яа-яЁё0-9_.-]{3,32}$/.test(name))return res.status(400).json({error:"Имя: 3–32 символа, только буквы, цифры, _ . -"});
 if(password.length<6)return res.status(400).json({error:"Пароль должен содержать минимум 6 символов"});
 try{
  if(await db.findUserByName(name))return res.status(409).json({error:"Пользователь с таким именем уже существует"});
  const password_hash=crypto.scryptSync(password,crypto.randomBytes(16),64).toString("hex")+":"+crypto.randomBytes(16).toString("hex");
  const salt=password_hash.split(":")[1];const hash=crypto.scryptSync(password,salt,64).toString("hex");
  const user=await db.createUser({name,password_hash:hash+":"+salt});setSession(res,user);res.json({ok:true,user:{id:user.id,name:user.name}});
 }catch(e){res.status(500).json({error:e.message})}
});
app.post("/api/auth/login",async(req,res)=>{
 const name=String(req.body?.name||"").trim();const password=String(req.body?.password||"");
 try{
  const user=await db.findUserByName(name);if(!user)return res.status(401).json({error:"Неверное имя или пароль"});
  const parts=String(user.password_hash||"").split(":");if(parts.length!==2)return res.status(401).json({error:"Неверное имя или пароль"});
  const hash=crypto.scryptSync(password,parts[1],64).toString("hex");if(hash.length!==parts[0].length||!crypto.timingSafeEqual(Buffer.from(hash),Buffer.from(parts[0])))return res.status(401).json({error:"Неверное имя или пароль"});
  setSession(res,user);res.json({ok:true,user:{id:user.id,name:user.name}});
 }catch(e){res.status(500).json({error:e.message})}
});
app.get("/auth/login",(req,res)=>res.redirect("/"));
function setAdminSession(res){const payload=Buffer.from(JSON.stringify({admin:true,exp:Date.now()+86400000})).toString("base64url");const sig=crypto.createHmac("sha256",SESSION_SECRET).update(payload).digest("base64url");res.setHeader("Set-Cookie","admin_session="+payload+"."+sig+"; Path=/; Max-Age=86400; HttpOnly; Secure; SameSite=Lax");}
function getAdminSession(req){try{const raw=getCookie(req,"admin_session");if(!raw)return null;const a=raw.split(".");if(a.length!==2)return null;const expected=crypto.createHmac("sha256",SESSION_SECRET).update(a[0]).digest("base64url");if(a[1]!==expected)return null;const x=JSON.parse(Buffer.from(a[0],"base64url").toString());return x.admin&&x.exp>Date.now()?x:null}catch(e){return null}}
function adminAuth(req,res){if(getAdminSession(req))return null;return res.status(401).json({error:"Введите пароль панели владельца"});}
app.post("/api/admin/login",(req,res)=>{
 const password=String(req.body?.password||"");
 const hash=crypto.scryptSync(password,ADMIN_PASSWORD_SALT,64).toString("hex");
 if(hash!==ADMIN_PASSWORD_HASH)return res.status(401).json({error:"Неверный пароль"});
 setAdminSession(res);res.json({ok:true});
});
app.post("/api/admin/logout",(req,res)=>{res.setHeader("Set-Cookie","admin_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax");res.json({ok:true})});
app.get("/api/admin/me",(req,res)=>res.json({authenticated:!!getAdminSession(req)}));
app.get("/api/auth/me",(req,res)=>{const u=getSession(req);res.json({authenticated:!!u,user:u?{id:u.id,username:u.username,name:u.name}:null,isOwner:false,isAdmin:!!getAdminSession(req)});});
app.post("/api/auth/logout",(req,res)=>{res.setHeader("Set-Cookie","market_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax");res.json({ok:true});});

function getCookie(req,name){const parts=(req.headers.cookie||"").split(";");for(const p of parts){const x=p.trim();if(x.startsWith(name+"="))return decodeURIComponent(x.slice(name.length+1));}return "";
}
function getSession(req){try{const raw=getCookie(req,"market_session");if(!raw)return null;const a=raw.split(".");if(a.length!==2)return null;const expected=crypto.createHmac("sha256",SESSION_SECRET).update(a[0]).digest("base64url");if(a[1]!==expected)return null;const u=JSON.parse(Buffer.from(a[0],"base64url").toString());if(!u.exp||u.exp<Date.now())return null;return u;}catch(e){return null;}}
function ownerAuth(req,res){return adminAuth(req,res)}
app.get("/api/owner/stats",async(req,res)=>{if(ownerAuth(req,res))return;try{res.json({stats:await owner.stats()})}catch(e){res.status(500).json({error:e.message})}});
app.get("/api/owner/orders",async(req,res)=>{if(ownerAuth(req,res))return;try{res.json({items:await owner.orders()})}catch(e){res.status(500).json({error:e.message})}});


app.post("/api/account-verification/start",async(req,res)=>{
 const u=getSession(req); if(!u)return res.status(401).json({error:"Сначала войдите в Market"});
 if(!BOT_TOKEN)return res.status(503).json({error:"TELEGRAM_MARKET_BOT_TOKEN не настроен"});
 try{const v=await db.createVerification();const bot=(await tg("getMe",{})).username;res.json({nonce:v.nonce,bot,link:"https://t.me/"+bot+"?start=verify_"+encodeURIComponent(v.nonce),expires_in:900})}catch(e){res.status(500).json({error:e.message})}
});
app.get("/api/account-verification/:nonce",async(req,res)=>{
 try{const v=await db.getVerification(req.params.nonce);if(!v)return res.status(404).json({error:"Проверка не найдена"});if(new Date(v.created_at).getTime()<Date.now()-900000)return res.json({status:"expired"});res.json({status:v.status,telegram_user_id:v.telegram_user_id||null,verified_at:v.verified_at||null})}catch(e){res.status(500).json({error:e.message})}
});

app.get("/api/orders",async(req,res)=>{const u=getSession(req);if(!u)return res.status(401).json({error:"Войдите в Market"});try{res.json({items:await db.userOrders(u.id)})}catch(e){res.status(500).json({error:e.message})}});
app.get("/api/chats",async(req,res)=>{const u=getSession(req);if(!u)return res.status(401).json({error:"Войдите в Market"});try{res.json({items:await db.chats(u.id)})}catch(e){res.status(500).json({error:e.message})}});
app.get("/api/chats/:id/messages",async(req,res)=>{const u=getSession(req);if(!u)return res.status(401).json({error:"Войдите в Market"});try{const items=await db.chatMessages(req.params.id,u.id);if(!items)return res.status(403).json({error:"Нет доступа"});res.json({items})}catch(e){res.status(500).json({error:e.message})}});
app.post("/api/chats/:id/messages",async(req,res)=>{const u=getSession(req);if(!u)return res.status(401).json({error:"Войдите в Market"});try{const m=await db.sendChatMessage(req.params.id,u.id,req.body?.message);if(!m)return res.status(400).json({error:"Сообщение не отправлено"});res.json({message:m})}catch(e){res.status(500).json({error:e.message})}});
app.get("/api/listings",async(req,res)=>{
 try{res.json({items:await db.listings()})}catch(e){res.status(500).json({error:e.message})}
});

app.post("/api/listings",async(req,res)=>{
 const {title,category,price_stars,seller_handle,description,delivery_mode,verification_nonce}=req.body||{};
 if(!title||!category||!seller_handle||!Number.isInteger(Number(price_stars))||Number(price_stars)<1)return res.status(400).json({error:"Заполните название, категорию, цену в Stars и продавца"});
 try{
  const u=getSession(req);
  let verified_telegram_id=null,verified_at=null;
  if(category==="Telegram-аккаунт"){
   if(!u)return res.status(401).json({error:"Для продажи Telegram-аккаунта войдите в Market"});
   const v=verification_nonce?await db.getVerification(verification_nonce):null;
   if(!v||v.status!=="verified")return res.status(400).json({error:"Сначала подтвердите, что аккаунт активен"});
   
   verified_telegram_id=String(v.telegram_user_id);verified_at=v.verified_at;
  }
  res.status(201).json({item:await db.addListing({title,category,price_stars:Number(price_stars),seller_handle,description,delivery_mode,verified_telegram_id,verified_at})})
 }catch(e){res.status(500).json({error:e.message})}
});

app.post("/api/orders",async(req,res)=>{
 const u=getSession(req);
 if(!u)return res.status(401).json({error:"Войдите в Market, чтобы создать и управлять сделкой"});
 const listing=await db.listing(req.body?.listing_id);
 if(!listing)return res.status(404).json({error:"Товар не найден"});
 if(!BOT_TOKEN)return res.status(503).json({error:"Платежи не настроены: добавьте TELEGRAM_MARKET_BOT_TOKEN в Render"});
 try{
  const order=await db.createOrder({listing_id:listing.id,buyer_user_id:String(u.id),seller_handle:listing.seller_handle,amount_stars:listing.price_stars});
  const invoice=await tg("createInvoiceLink",{title:listing.title.slice(0,32),description:(listing.description||"Цифровой товар").slice(0,255),payload:order.payload,currency:"XTR",prices:[{label:listing.title.slice(0,32),amount:listing.price_stars}],start_parameter:"order_"+order.id});
  if(db.pool) await db.pool.query("UPDATE orders SET invoice_url=$2 WHERE id=$1",[order.id,invoice]); else order.invoice_url=invoice;
  res.json({order_id:order.id,invoice_url:invoice,status:"pending"});
 }catch(e){res.status(500).json({error:e.message})}
});

app.post("/api/orders/:id/cancel",async(req,res)=>{
 const u=getSession(req);if(!u)return res.status(401).json({error:"Войдите в Market"});
 try{const o=await db.cancelOrder(req.params.id,u.id);if(!o)return res.status(400).json({error:"Заказ уже оплачен или его нельзя отменить"});res.json({ok:true,order:o})}catch(e){res.status(500).json({error:e.message})}
});
app.post("/api/orders/:id/refund",async(req,res)=>{
 const u=getSession(req);if(!u)return res.status(401).json({error:"Войдите в Market"});
 const reason=String(req.body?.reason||"").slice(0,1000);
 try{const o=await db.requestRefund(req.params.id,u.id,reason);if(!o)return res.status(400).json({error:"Для этой сделки сейчас нельзя запросить возврат"});res.json({ok:true,order:o,message:"Запрос на возврат отправлен владельцу маркета"})}catch(e){res.status(500).json({error:e.message})}
});
app.post("/api/orders/:id/complaint",async(req,res)=>{
 const u=getSession(req);if(!u)return res.status(401).json({error:"Войдите через Telegram"});
 const reason=String(req.body?.reason||"").slice(0,2000);
 if(!reason)return res.status(400).json({error:"Укажите причину жалобы"});
 try{const o=await db.openComplaint(req.params.id,u.id,reason);if(!o)return res.status(400).json({error:"Жалобу по этой сделке открыть нельзя"});res.json({ok:true,order:o,message:"Жалоба передана на рассмотрение"})}catch(e){res.status(500).json({error:e.message})}
});
app.post("/api/orders/:id/complete",async(req,res)=>{
 const u=getSession(req);if(!u)return res.status(401).json({error:"Войдите через Telegram"});
 try{const o=await db.completeOrder(req.params.id,u.id);if(!o)return res.status(400).json({error:"Заказ нельзя завершить на текущем этапе"});res.json({ok:true,order:o})}catch(e){res.status(500).json({error:e.message})}
});
app.post("/api/owner/orders/:id/refund",async(req,res)=>{
 if(ownerAuth(req,res))return;
 try{
  const o=await db.order(req.params.id);
  if(!o)return res.status(404).json({error:"Заказ не найден"});
  if(!o.buyer_telegram_id||!o.telegram_charge_id)return res.status(400).json({error:"У заказа нет данных для возврата Stars"});
  if(o.status==="refunded")return res.status(400).json({error:"Заказ уже возвращён"});
  await tg("refundStarPayment",{user_id:Number(o.buyer_telegram_id),telegram_payment_charge_id:o.telegram_charge_id});
  const updated=await db.markRefunded(o.id);
  res.json({ok:true,order:updated});
 }catch(e){res.status(500).json({error:e.message})}
});
app.get("/api/orders/:id",async(req,res)=>{
 const u=getSession(req);if(!u)return res.status(401).json({error:"Войдите через Telegram"});
 const o=await db.order(req.params.id);
 if(!o)return res.status(404).json({error:"Заказ не найден"});
 if(String(o.buyer_user_id)!==String(u.id)&&u.name.toLowerCase()!==OWNER_TELEGRAM_USERNAME)return res.status(403).json({error:"Нет доступа к этой сделке"});
 res.json({order:o});
});

app.post("/api/telegram/payment-webhook",async(req,res)=>{
 if(WEBHOOK_SECRET&&req.get("x-telegram-bot-api-secret-token")!==WEBHOOK_SECRET)return res.sendStatus(403);
 const u=req.body||{};
 const msg=u.message;
 const start=String(msg?.text||"").match(/^\/start(?:@\\w+)?\\s+verify_([A-Za-z0-9_]+)$/);
 if(start&&msg?.from?.id){
  try{const v=await db.completeVerification(start[1],msg.from.id);if(v)await tg("sendMessage",{chat_id:msg.chat.id,text:"✅ Telegram-аккаунт подтверждён. Вернитесь в Telegram Market — статус проверки обновится автоматически."});}catch(e){console.error("Verification error:",e.message)}
 }
 const pq=u.pre_checkout_query;
 if(pq){
  try{
   const o=await db.byPayload(pq.invoice_payload);
   const valid=o&&o.status==="pending"&&Number(o.amount_stars)===Number(pq.total_amount)&&pq.currency==="XTR";
   await tg("answerPreCheckoutQuery",{pre_checkout_query_id:pq.id,ok:!!valid,...(!valid?{error_message:"Заказ недоступен или сумма счёта не совпадает."}:{})});
  }catch(e){try{await tg("answerPreCheckoutQuery",{pre_checkout_query_id:pq.id,ok:false,error_message:"Не удалось проверить заказ."})}catch(_){} }
 }
 const sp=u.message?.successful_payment;
 if(sp){
  const o=await db.markPaid(sp.invoice_payload,sp.telegram_payment_charge_id,u.message.from?.id);
  if(o) console.log("Order paid:",o.id);
 }
 res.json({ok:true});
});

app.post("/api/telegram/setup-webhook",async(req,res)=>{
 if(!BOT_TOKEN)return res.status(503).json({error:"TELEGRAM_MARKET_BOT_TOKEN missing"});
 try{
  const base=SITE_URL.replace(/\/$/,"");
  const url=base+"/api/telegram/payment-webhook";
  const result=await tg("setWebhook",{url,secret_token:WEBHOOK_SECRET||undefined,allowed_updates:["message","pre_checkout_query"]});
  res.json({ok:true,result,url});
 }catch(e){res.status(500).json({error:e.message})}
});

app.use((req,res)=>{
 if(req.method==="GET")return res.sendFile(path.join(__dirname,"public","index.html"));
 res.status(404).json({error:"Not found"});
});

db.init().then(()=>app.listen(PORT,"0.0.0.0",()=>{setInterval(()=>db.purgeVerifications().catch(()=>{}),300000);console.log("Marketplace listening on "+PORT+" | db="+!!db.pool+" | payments="+!!BOT_TOKEN)})).catch(e=>{console.error(e);process.exit(1)});
