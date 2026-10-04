const express=require("express");
const path=require("path");
const app=express();
const PORT=process.env.PORT||10000;

app.use(express.json({limit:"2mb"}));
app.use(express.static(path.join(__dirname,"public")));

app.get("/api/health",(req,res)=>res.json({ok:true,service:"telegram-digital-market"}));

app.use((req,res)=>{
  if(req.method==="GET") return res.sendFile(path.join(__dirname,"public","index.html"));
  res.status(404).json({error:"Not found"});
});

app.listen(PORT,"0.0.0.0",()=>console.log("Marketplace listening on "+PORT));
