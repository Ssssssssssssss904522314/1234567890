const express=require("express");
const path=require("path");
const db=require("./db");
const owner=require("./owner-panel");
const app=express();
const PORT=process.env.PORT||10000;
const BOT_TOKEN=process.env.TELEGRAM_MARKET_BOT_TOKEN||"";
const WEBHOOK_SECRET=process.env.TELEGRAM_MARKET_WEBHOOK_SECRET||"";
const SITE_URL=process.env.MARKET_SITE_URL||"";

app.use(express.json({limit:"2mb"}));
app.use(express.static(path.join(__dirname,"public")));

async function tg(method,body){
 const r=await fetch("https://api.telegram.org/bot"+BOT_TOKEN+"/"+method,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
 const j=await r.json();
 if(!j.ok) throw new Error(j.description||"Telegram API error");
 return j.result;
}

app.get("/api/health",async(req,res)=>res.json({ok:true,service:"telegram-digital-market",database:!!db.pool,payments:!!BOT_TOKEN}));

app.get("/api/owner/stats",async(req,res)=>{try{res.json({stats:await owner.stats()})}catch(e){res.status(500).json({error:e.message})}});
app.get("/api/owner/orders",async(req,res)=>{try{res.json({items:await owner.orders()})}catch(e){res.status(500).json({error:e.message})}});

app.get("/api/listings",async(req,res)=>{
 try{res.json({items:await db.listings()})}catch(e){res.status(500).json({error:e.message})}
});

app.post("/api/listings",async(req,res)=>{
 const {title,category,price_stars,seller_handle,description,delivery_mode}=req.body||{};
 if(!title||!category||!seller_handle||!Number.isInteger(Number(price_stars))||Number(price_stars)<1)return res.status(400).json({error:"Заполните название, категорию, цену в Stars и продавца"});
 try{res.status(201).json({item:await db.addListing({title,category,price_stars:Number(price_stars),seller_handle,description,delivery_mode})})}catch(e){res.status(500).json({error:e.message})}
});

app.post("/api/orders",async(req,res)=>{
 const listing=await db.listing(req.body?.listing_id);
 if(!listing)return res.status(404).json({error:"Товар не найден"});
 if(!BOT_TOKEN)return res.status(503).json({error:"Платежи не настроены: добавьте TELEGRAM_MARKET_BOT_TOKEN в Render"});
 try{
  const order=await db.createOrder({listing_id:listing.id,seller_handle:listing.seller_handle,amount_stars:listing.price_stars});
  const invoice=await tg("createInvoiceLink",{title:listing.title.slice(0,32),description:(listing.description||"Цифровой товар").slice(0,255),payload:order.payload,currency:"XTR",prices:[{label:listing.title.slice(0,32),amount:listing.price_stars}],start_parameter:"order_"+order.id});
  if(db.pool) await db.pool.query("UPDATE orders SET invoice_url=$2 WHERE id=$1",[order.id,invoice]); else order.invoice_url=invoice;
  res.json({order_id:order.id,invoice_url:invoice,status:"pending"});
 }catch(e){res.status(500).json({error:e.message})}
});

app.get("/api/orders/:id",async(req,res)=>{
 const o=await db.order(req.params.id);
 if(!o)return res.status(404).json({error:"Заказ не найден"});
 res.json({order:o});
});

app.post("/api/telegram/payment-webhook",async(req,res)=>{
 if(WEBHOOK_SECRET&&req.get("x-telegram-bot-api-secret-token")!==WEBHOOK_SECRET)return res.sendStatus(403);
 const u=req.body||{};
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

db.init().then(()=>app.listen(PORT,"0.0.0.0",()=>console.log("Marketplace listening on "+PORT+" | db="+!!db.pool+" | payments="+!!BOT_TOKEN))).catch(e=>{console.error(e);process.exit(1)});
