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
const OWNER_TELEGRAM_USERNAME=(process.env.OWNER_TELEGRAM_USERNAME||"wswkkk").replace(/^@/,"").toLowerCase();

app.use(express.json({limit:"2mb"}));
app.use(express.static(path.join(__dirname,"public")));

async function tg(method,body){
 const r=await fetch("https://api.telegram.org/bot"+BOT_TOKEN+"/"+method,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
 const j=await r.json();
 if(!j.ok) throw new Error(j.description||"Telegram API error");
 return j.result;
}

app.get("/api/health",async(req,res)=>res.json({ok:true,service:"telegram-digital-market",database:!!db.pool,payments:!!BOT_TOKEN}));
app.get("/auth/login",async(req,res)=>{
 if(!BOT_TOKEN)return res.status(503).send("TELEGRAM_MARKET_BOT_TOKEN не настроен.");
 try{
  const bot=(await tg("getMe",{})).username;
  if(!bot)return res.status(503).send("У бота нет username.");
  const site=SITE_URL||("https://"+req.get("host"));
  res.send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Вход через Telegram</title></head><body style="font-family:Arial;text-align:center;padding:50px"><h2>Вход через Telegram</h2><p>Авторизуйтесь для входа в магазин.</p><script async src="https://telegram.org/js/telegram-widget.js?22" data-telegram-login="${bot}" data-size="large" data-auth-url="${site}/auth/telegram" data-request-access="write"></script><p><a href="/">Вернуться в магазин</a></p></body></html>`);
 }catch(e){res.status(500).send("Ошибка Telegram Login: "+e.message)}
});
app.get("/auth/telegram",(req,res)=>{if(!BOT_TOKEN)return res.status(503).send("TELEGRAM_MARKET_BOT_TOKEN не настроен.");const q={...req.query};const hash=String(q.hash||"");delete q.hash;const check=Object.keys(q).sort().map(k=>k+"="+q[k]).join("\\n");const secret=crypto.createHash("sha256").update(BOT_TOKEN).digest();const expected=crypto.createHmac("sha256",secret).update(check).digest("hex");if(!hash||hash!==expected)return res.status(403).send("Не удалось проверить авторизацию Telegram.");if(Math.floor(Date.now()/1000)-Number(q.auth_date||0)>86400)return res.status(403).send("Авторизация устарела.");const payload=Buffer.from(JSON.stringify({id:String(q.id),username:String(q.username||"").toLowerCase(),name:String(q.first_name||""),exp:Date.now()+604800000})).toString("base64url");const sig=crypto.createHmac("sha256",BOT_TOKEN).update(payload).digest("base64url");res.setHeader("Set-Cookie","market_session="+payload+"."+sig+"; Path=/; Max-Age=604800; HttpOnly; Secure; SameSite=Lax");res.redirect("/?login=ok");});
app.get("/api/auth/me",(req,res)=>{const u=getSession(req);res.json({authenticated:!!u,user:u?{id:u.id,username:u.username,name:u.name}:null,isOwner:!!(u&&u.username===OWNER_TELEGRAM_USERNAME)});});
app.post("/api/auth/logout",(req,res)=>{res.setHeader("Set-Cookie","market_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax");res.json({ok:true});});

function getCookie(req,name){const parts=(req.headers.cookie||"").split(";");for(const p of parts){const x=p.trim();if(x.startsWith(name+"="))return decodeURIComponent(x.slice(name.length+1));}return "";
}
function getSession(req){try{const raw=getCookie(req,"market_session");if(!raw||!BOT_TOKEN)return null;const a=raw.split(".");if(a.length!==2)return null;const expected=crypto.createHmac("sha256",BOT_TOKEN).update(a[0]).digest("base64url");if(a[1]!==expected)return null;const u=JSON.parse(Buffer.from(a[0],"base64url").toString());if(!u.exp||u.exp<Date.now())return null;return u;}catch(e){return null;}}
function ownerAuth(req,res){const u=getSession(req);if(u&&u.username===OWNER_TELEGRAM_USERNAME)return null;return res.status(401).json({error:"Нет доступа к панели владельца"});}
app.get("/api/owner/stats",async(req,res)=>{if(ownerAuth(req,res))return;try{res.json({stats:await owner.stats()})}catch(e){res.status(500).json({error:e.message})}});
app.get("/api/owner/orders",async(req,res)=>{if(ownerAuth(req,res))return;try{res.json({items:await owner.orders()})}catch(e){res.status(500).json({error:e.message})}});


app.post("/api/account-verification/start",async(req,res)=>{
 const u=getSession(req); if(!u)return res.status(401).json({error:"Сначала войдите через Telegram"});
 if(!BOT_TOKEN)return res.status(503).json({error:"TELEGRAM_MARKET_BOT_TOKEN не настроен"});
 try{const v=await db.createVerification();const bot=(await tg("getMe",{})).username;res.json({nonce:v.nonce,bot,link:"https://t.me/"+bot+"?start=verify_"+encodeURIComponent(v.nonce),expires_in:900})}catch(e){res.status(500).json({error:e.message})}
});
app.get("/api/account-verification/:nonce",async(req,res)=>{
 try{const v=await db.getVerification(req.params.nonce);if(!v)return res.status(404).json({error:"Проверка не найдена"});if(new Date(v.created_at).getTime()<Date.now()-900000)return res.json({status:"expired"});res.json({status:v.status,telegram_user_id:v.telegram_user_id||null,verified_at:v.verified_at||null})}catch(e){res.status(500).json({error:e.message})}
});

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
   if(!u)return res.status(401).json({error:"Для продажи Telegram-аккаунта войдите через Telegram"});
   const v=verification_nonce?await db.getVerification(verification_nonce):null;
   if(!v||v.status!=="verified")return res.status(400).json({error:"Сначала подтвердите, что аккаунт активен"});
   if(String(v.telegram_user_id)!==String(u.id))return res.status(403).json({error:"Подтверждён другой Telegram-аккаунт"});
   verified_telegram_id=String(v.telegram_user_id);verified_at=v.verified_at;
  }
  res.status(201).json({item:await db.addListing({title,category,price_stars:Number(price_stars),seller_handle,description,delivery_mode,verified_telegram_id,verified_at})})
 }catch(e){res.status(500).json({error:e.message})}
});

app.post("/api/orders",async(req,res)=>{
 const u=getSession(req);
 if(!u)return res.status(401).json({error:"Войдите через Telegram, чтобы создать и управлять сделкой"});
 const listing=await db.listing(req.body?.listing_id);
 if(!listing)return res.status(404).json({error:"Товар не найден"});
 if(!BOT_TOKEN)return res.status(503).json({error:"Платежи не настроены: добавьте TELEGRAM_MARKET_BOT_TOKEN в Render"});
 try{
  const order=await db.createOrder({listing_id:listing.id,buyer_telegram_id:String(u.id),seller_handle:listing.seller_handle,amount_stars:listing.price_stars});
  const invoice=await tg("createInvoiceLink",{title:listing.title.slice(0,32),description:(listing.description||"Цифровой товар").slice(0,255),payload:order.payload,currency:"XTR",prices:[{label:listing.title.slice(0,32),amount:listing.price_stars}],start_parameter:"order_"+order.id});
  if(db.pool) await db.pool.query("UPDATE orders SET invoice_url=$2 WHERE id=$1",[order.id,invoice]); else order.invoice_url=invoice;
  res.json({order_id:order.id,invoice_url:invoice,status:"pending"});
 }catch(e){res.status(500).json({error:e.message})}
});

app.post("/api/orders/:id/cancel",async(req,res)=>{
 const u=getSession(req);if(!u)return res.status(401).json({error:"Войдите через Telegram"});
 try{const o=await db.cancelOrder(req.params.id,u.id);if(!o)return res.status(400).json({error:"Заказ уже оплачен или его нельзя отменить"});res.json({ok:true,order:o})}catch(e){res.status(500).json({error:e.message})}
});
app.post("/api/orders/:id/refund",async(req,res)=>{
 const u=getSession(req);if(!u)return res.status(401).json({error:"Войдите через Telegram"});
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
 if(String(o.buyer_telegram_id)!==String(u.id)&&u.username!==OWNER_TELEGRAM_USERNAME)return res.status(403).json({error:"Нет доступа к этой сделке"});
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
