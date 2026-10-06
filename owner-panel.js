const db=require("./db");
async function stats(){
 if(!db.pool) return {sales:0,earned_stars:0,paid_orders:0,refunds:0,refunded_stars:0,net_stars:0};
 const q=await db.pool.query(`SELECT
 COUNT(*) FILTER (WHERE status='paid' OR status='refunded')::int AS sales,
 COALESCE(SUM(amount_stars) FILTER (WHERE status='paid' OR status='refunded'),0)::int AS earned_stars,
 COUNT(*) FILTER (WHERE status='paid')::int AS paid_orders,
 COUNT(*) FILTER (WHERE status='refunded')::int AS refunds,
 COALESCE(SUM(amount_stars) FILTER (WHERE status='refunded'),0)::int AS refunded_stars
 FROM orders`);
 const x=q.rows[0];
 return {...x,net_stars:Number(x.earned_stars)-Number(x.refunded_stars)};
}
async function orders(){
 if(!db.pool) return [];
 return (await db.pool.query("SELECT id,listing_id,seller_handle,amount_stars,status,telegram_charge_id,buyer_telegram_id,refund_reason,complaint_reason,complaint_status,created_at,paid_at,refunded_at FROM orders ORDER BY COALESCE(paid_at,created_at) DESC LIMIT 100")).rows;
}
module.exports={stats,orders};