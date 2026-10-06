const {Pool}=require("pg");
const crypto=require("crypto");
const pool=process.env.DATABASE_URL?new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_URL.includes("render.com")?{rejectUnauthorized:false}:undefined}):null;
const memory={listings:[],orders:[],verifications:[],users:[]};
function id(prefix){return prefix+"_"+crypto.randomBytes(10).toString("hex")}
async function init(){
 if(!pool)return console.warn("DATABASE_URL is not configured: using temporary memory storage");
 const statements=[
  `CREATE TABLE IF NOT EXISTS users(
   id text primary key,name text unique not null,password_hash text not null,created_at timestamptz default now()
  )`,
  `CREATE TABLE IF NOT EXISTS chats(
   id text primary key,type text not null,name text not null,created_at timestamptz default now()
  )`,
  `CREATE TABLE IF NOT EXISTS chat_members(chat_id text not null references chats(id) on delete cascade,user_id text not null,primary key(chat_id,user_id))`,
  `CREATE TABLE IF NOT EXISTS chat_messages(
   id text primary key,chat_id text not null references chats(id) on delete cascade,user_id text not null,message text not null,created_at timestamptz default now()
  )`,
  `CREATE TABLE IF NOT EXISTS listings(
   id text primary key,title text not null,category text not null,price_stars integer not null,
   seller_handle text not null,description text default '',delivery_mode text default 'manual',
   status text default 'active',created_at timestamptz default now(),verified_telegram_id text,verified_at timestamptz
  )`,
  `ALTER TABLE listings ADD COLUMN IF NOT EXISTS verified_telegram_id text`,
  `ALTER TABLE listings ADD COLUMN IF NOT EXISTS verified_at timestamptz`,
  `CREATE TABLE IF NOT EXISTS account_verifications(
   nonce text primary key,telegram_user_id text,status text default 'pending',
   created_at timestamptz default now(),verified_at timestamptz
  )`,
  `CREATE TABLE IF NOT EXISTS orders(
   id text primary key,listing_id text not null references listings(id),buyer_user_id text,buyer_telegram_id text,
   seller_handle text not null,amount_stars integer not null,payload text unique not null,
   invoice_url text,status text default 'pending',telegram_charge_id text,
   created_at timestamptz default now(),paid_at timestamptz,
   cancelled_at timestamptz,refund_requested_at timestamptz,refund_reason text,
   complaint_reason text,complaint_status text default 'none',complaint_created_at timestamptz,
   resolved_at timestamptz,refunded_at timestamptz
  )`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS buyer_user_id text`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS buyer_telegram_id text`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_at timestamptz`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_requested_at timestamptz`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_reason text`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS complaint_reason text`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS complaint_status text DEFAULT 'none'`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS complaint_created_at timestamptz`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS resolved_at timestamptz`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS refunded_at timestamptz`
 ];
 for(const sql of statements) await pool.query(sql);
}

async function listings(){
 if(!pool)return memory.listings.filter(x=>x.status==="active");
 return (await pool.query("SELECT * FROM listings WHERE status='active' ORDER BY created_at DESC")).rows;
}
async function listing(idv){
 if(!pool)return memory.listings.find(x=>x.id===idv&&x.status==="active");
 return (await pool.query("SELECT * FROM listings WHERE id=$1 AND status='active'",[idv])).rows[0];
}
async function addListing(x){
 const row={id:id("lst"),...x,status:"active",created_at:new Date().toISOString()};
 if(!pool){memory.listings.push(row);return row}
 return (await pool.query("INSERT INTO listings(id,title,category,price_stars,seller_handle,description,delivery_mode,status,verified_telegram_id,verified_at) VALUES($1,$2,$3,$4,$5,$6,$7,'active',$8,$9) RETURNING *",[row.id,x.title,x.category,x.price_stars,x.seller_handle,x.description||"",x.delivery_mode||"manual",x.verified_telegram_id||null,x.verified_at||null])).rows[0];
}
async function createUser(x){const row={id:id("usr"),...x,created_at:new Date().toISOString()};if(!pool){memory.users.push(row);return row}return (await pool.query("INSERT INTO users(id,name,password_hash) VALUES($1,$2,$3) RETURNING id,name,created_at",[row.id,x.name,x.password_hash])).rows[0]}
async function findUserByName(name){if(!pool)return memory.users.find(x=>x.name.toLowerCase()===String(name).toLowerCase());return (await pool.query("SELECT * FROM users WHERE lower(name)=lower($1)",[name])).rows[0]}

async function createOrder(x){
 const row={id:id("ord"),payload:id("pay"),...x,status:"pending",created_at:new Date().toISOString()};
 if(!pool){memory.orders.push(row);return row}
 return (await pool.query("INSERT INTO orders(id,listing_id,buyer_user_id,buyer_telegram_id,seller_handle,amount_stars,payload,status) VALUES($1,$2,$3,$4,$5,$6,$7,'pending') RETURNING *",[row.id,x.listing_id,String(x.buyer_user_id||""),String(x.buyer_telegram_id||""),x.seller_handle,x.amount_stars,row.payload])).rows[0];
}
async function order(idv){
 if(!pool)return memory.orders.find(x=>x.id===idv);
 return (await pool.query("SELECT * FROM orders WHERE id=$1",[idv])).rows[0];
}
async function byPayload(payload){
 if(!pool)return memory.orders.find(x=>x.payload===payload);
 return (await pool.query("SELECT * FROM orders WHERE payload=$1",[payload])).rows[0];
}
async function userOrders(userId){if(!pool)return memory.orders.filter(x=>String(x.buyer_user_id)===String(userId)).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));return (await pool.query("SELECT o.*,l.title,l.category FROM orders o LEFT JOIN listings l ON l.id=o.listing_id WHERE o.buyer_user_id=$1 ORDER BY o.created_at DESC",[String(userId)])).rows}
async function ensureSupportChat(userId){if(!pool){let c=memory.chats?.find(x=>x.type==="support");if(!c){memory.chats=memory.chats||[];c={id:"support",type:"support",name:"Поддержка",created_at:new Date().toISOString()};memory.chats.push(c)}memory.chat_members=memory.chat_members||[];if(!memory.chat_members.some(x=>x.chat_id===c.id&&x.user_id===String(userId)))memory.chat_members.push({chat_id:c.id,user_id:String(userId)});return c}let c=(await pool.query("SELECT * FROM chats WHERE type='support' LIMIT 1")).rows[0];if(!c)c=(await pool.query("INSERT INTO chats(id,type,name) VALUES($1,'support','Поддержка') RETURNING *",["chat_support"])).rows[0];await pool.query("INSERT INTO chat_members(chat_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING",[c.id,String(userId)]);return c}
async function chats(userId){const support=await ensureSupportChat(userId);if(!pool)return [support];return (await pool.query("SELECT c.*, (SELECT message FROM chat_messages m WHERE m.chat_id=c.id ORDER BY m.created_at DESC LIMIT 1) last_message FROM chats c JOIN chat_members cm ON cm.chat_id=c.id WHERE cm.user_id=$1 ORDER BY CASE WHEN c.type='support' THEN 0 ELSE 1 END,c.created_at",[String(userId)])).rows}
async function chatMessages(chatId,userId){if(!pool)return (memory.chat_messages||[]).filter(x=>x.chat_id===chatId).sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at)));const member=await pool.query("SELECT 1 FROM chat_members WHERE chat_id=$1 AND user_id=$2",[chatId,String(userId)]);if(!member.rowCount)return null;return (await pool.query("SELECT * FROM chat_messages WHERE chat_id=$1 ORDER BY created_at ASC",[chatId])).rows}
async function sendChatMessage(chatId,userId,message){const msg=String(message||"").trim().slice(0,4000);if(!msg)return null;if(!pool){memory.chat_messages=memory.chat_messages||[];const m={id:id("msg"),chat_id:chatId,user_id:String(userId),message:msg,created_at:new Date().toISOString()};memory.chat_messages.push(m);return m}const member=await pool.query("SELECT 1 FROM chat_members WHERE chat_id=$1 AND user_id=$2",[chatId,String(userId)]);if(!member.rowCount)return null;return (await pool.query("INSERT INTO chat_messages(id,chat_id,user_id,message) VALUES($1,$2,$3,$4) RETURNING *",[id("msg"),chatId,String(userId),msg])).rows[0]}
async function cancelOrder(idv,buyerId){
 if(!pool){const o=memory.orders.find(x=>x.id===idv&&String(x.buyer_user_id)===String(buyerId));if(o&&o.status==="pending"){o.status="cancelled";o.cancelled_at=new Date().toISOString();}return o}
 return (await pool.query("UPDATE orders SET status='cancelled',cancelled_at=now() WHERE id=$1 AND buyer_user_id=$2 AND status='pending' RETURNING *",[idv,String(buyerId)])).rows[0];
}
async function requestRefund(idv,buyerId,reason){
 if(!pool){const o=memory.orders.find(x=>x.id===idv&&String(x.buyer_telegram_id)===String(buyerId));if(o&&["paid","delivery","completed","disputed"].includes(o.status)){o.status="refund_requested";o.refund_requested_at=new Date().toISOString();o.refund_reason=reason||"";}return o}
 return (await pool.query("UPDATE orders SET status='refund_requested',refund_requested_at=now(),refund_reason=$3 WHERE id=$1 AND buyer_user_id=$2 AND status IN ('paid','delivery','completed','disputed') RETURNING *",[idv,String(buyerId),reason||""])).rows[0];
}
async function openComplaint(idv,userId,reason){
 if(!pool){const o=memory.orders.find(x=>x.id===idv&&(String(x.buyer_telegram_id)===String(userId)));if(o&&!["cancelled","refunded"].includes(o.status)){o.status="disputed";o.complaint_status="open";o.complaint_created_at=new Date().toISOString();o.complaint_reason=reason||"";}return o}
 return (await pool.query("UPDATE orders SET status='disputed',complaint_status='open',complaint_created_at=now(),complaint_reason=$2 WHERE id=$1 AND buyer_user_id=$3 AND status NOT IN ('cancelled','refunded') RETURNING *",[idv,reason||"",String(userId)])).rows[0];
}
async function completeOrder(idv,buyerId){
 if(!pool){const o=memory.orders.find(x=>x.id===idv&&String(x.buyer_telegram_id)===String(buyerId));if(o&&["paid","delivery"].includes(o.status)){o.status="completed";o.resolved_at=new Date().toISOString();}return o}
 return (await pool.query("UPDATE orders SET status='completed',resolved_at=now() WHERE id=$1 AND buyer_user_id=$2 AND status IN ('paid','delivery') RETURNING *",[idv,String(buyerId)])).rows[0];
}
async function markRefunded(idv){
 if(!pool){const o=memory.orders.find(x=>x.id===idv);if(o){o.status="refunded";o.refunded_at=new Date().toISOString();o.complaint_status="resolved";}return o}
 return (await pool.query("UPDATE orders SET status='refunded',refunded_at=now(),resolved_at=now(),complaint_status='resolved' WHERE id=$1 AND status IN ('refund_requested','disputed','paid','delivery','completed') RETURNING *",[idv])).rows[0];
}
async function markPaid(payload,chargeId,buyerId){
 if(!pool){
  const o=memory.orders.find(x=>x.payload===payload); if(o){o.status="paid";o.telegram_charge_id=chargeId;o.buyer_telegram_id=String(buyerId||"");o.paid_at=new Date().toISOString()} return o;
 }
 return (await pool.query("UPDATE orders SET status='paid',telegram_charge_id=$2,buyer_telegram_id=$3,paid_at=now() WHERE payload=$1 RETURNING *",[payload,chargeId,String(buyerId||"")])).rows[0];
}

async function createVerification(){const nonce=id("verify");if(!pool){const row={nonce,status:"pending",created_at:new Date().toISOString()};memory.verifications.push(row);return row}return (await pool.query("INSERT INTO account_verifications(nonce,status) VALUES($1,'pending') RETURNING *",[nonce])).rows[0]}
async function getVerification(nonce){if(!pool)return memory.verifications.find(x=>x.nonce===nonce);return (await pool.query("SELECT * FROM account_verifications WHERE nonce=$1",[nonce])).rows[0]}
async function completeVerification(nonce,userId){if(!pool){const row=memory.verifications.find(x=>x.nonce===nonce);if(row){row.telegram_user_id=String(userId);row.status="verified";row.verified_at=new Date().toISOString()}return row}return (await pool.query("UPDATE account_verifications SET telegram_user_id=$2,status='verified',verified_at=now() WHERE nonce=$1 AND status='pending' RETURNING *",[nonce,String(userId)])).rows[0]}
async function purgeVerifications(){if(pool)await pool.query("DELETE FROM account_verifications WHERE created_at < now()-interval '15 minutes'")}
module.exports={pool,init,createUser,findUserByName,userOrders,ensureSupportChat,chats,chatMessages,sendChatMessage,listings,listing,addListing,createOrder,order,byPayload,markPaid,cancelOrder,requestRefund,openComplaint,completeOrder,markRefunded,createVerification,getVerification,completeVerification,purgeVerifications};