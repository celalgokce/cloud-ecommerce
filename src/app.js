const express = require('express');
const session = require('express-session');
const { Pool } = require('pg');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;
const pool = new Pool({ host: process.env.DB_HOST||'localhost', port: process.env.DB_PORT||5432, database: process.env.DB_NAME||'ecommerce', user: process.env.DB_USER||'admin', password: process.env.DB_PASS||'admin123' });

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(compression());
app.use(morgan('short'));

let sessionConfig = { secret: process.env.SESSION_SECRET||'cloud-secret-2024', resave: false, saveUninitialized: true, cookie: { maxAge: 86400000 } };
if (process.env.REDIS_HOST) {
  const RedisStore = require('connect-redis').default;
  const { createClient } = require('redis');
  const rc = createClient({ url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT||6379}` });
  rc.connect().then(()=>console.log('Redis connected')).catch(()=>console.log('Redis unavailable'));
  sessionConfig.store = new RedisStore({ client: rc });
}
app.use(session(sessionConfig));

app.set('view engine','ejs');
app.set('views', path.join(__dirname,'views'));
app.use(express.static(path.join(__dirname,'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use((req,res,next)=>{ if(!req.session.cart)req.session.cart=[]; res.locals.cartCount=req.session.cart.reduce((s,i)=>s+i.quantity,0); res.locals.user=req.session.user||null; next(); });

function requireAdmin(req,res,next){ if(!req.session.user||req.session.user.role!=='admin') return res.redirect('/login'); next(); }

// PUBLIC
app.get('/', async(req,res)=>{ try{ const f=await pool.query('SELECT * FROM products WHERE featured=true LIMIT 6'); const s=await pool.query(`SELECT (SELECT COUNT(*) FROM products) AS product_count,(SELECT COUNT(*) FROM orders) AS order_count,(SELECT COUNT(DISTINCT customer_name) FROM orders) AS customer_count`); res.render('home',{title:'Ana Sayfa',featured:f.rows,stats:s.rows[0]}); }catch(e){ res.render('home',{title:'Ana Sayfa',featured:[],stats:{}}); }});
app.get('/products', async(req,res)=>{ try{ const cat=req.query.category||''; const search=req.query.search||''; const sort=req.query.sort||'product_id'; let q='SELECT * FROM products WHERE 1=1'; const p=[]; if(cat){p.push(cat);q+=` AND category=$${p.length}`;} if(search){p.push(`%${search}%`);q+=` AND (product_name ILIKE $${p.length} OR description ILIKE $${p.length})`;} const sm={'price_asc':'price ASC','price_desc':'price DESC','name':'product_name ASC','newest':'product_id DESC'}; q+=` ORDER BY ${sm[sort]||'product_id'}`; const prods=await pool.query(q,p); const cats=await pool.query('SELECT DISTINCT category FROM products ORDER BY category'); res.render('products',{title:'Ürünler',products:prods.rows,categories:cats.rows.map(r=>r.category),currentCategory:cat,currentSearch:search,currentSort:sort}); }catch(e){ res.render('products',{title:'Ürünler',products:[],categories:[],currentCategory:'',currentSearch:'',currentSort:''}); }});
app.get('/products/:id', async(req,res)=>{ try{ const p=await pool.query('SELECT * FROM products WHERE product_id=$1',[req.params.id]); if(!p.rows.length) return res.status(404).render('error',{title:'404',message:'Ürün bulunamadı'}); res.render('product-detail',{title:p.rows[0].product_name,product:p.rows[0]}); }catch(e){ res.status(500).render('error',{title:'Hata',message:'Sunucu hatası'}); }});
app.post('/cart/add',(req,res)=>{ const{product_id,product_name,price,quantity}=req.body; const ex=req.session.cart.find(i=>i.product_id==product_id); if(ex)ex.quantity+=parseInt(quantity)||1; else req.session.cart.push({product_id:parseInt(product_id),product_name,price:parseFloat(price),quantity:parseInt(quantity)||1}); res.redirect('/cart'); });
app.get('/cart',(req,res)=>{ const cart=req.session.cart||[]; res.render('cart',{title:'Sepet',cart,total:cart.reduce((s,i)=>s+i.price*i.quantity,0)}); });
app.post('/cart/remove',(req,res)=>{ req.session.cart=req.session.cart.filter(i=>i.product_id!=req.body.product_id); res.redirect('/cart'); });
app.post('/checkout', async(req,res)=>{ try{ const{customer_name,customer_email,address}=req.body; const cart=req.session.cart||[]; if(!cart.length)return res.redirect('/cart'); const total=cart.reduce((s,i)=>s+i.price*i.quantity,0); const uid=req.session.user?req.session.user.user_id:null; const o=await pool.query(`INSERT INTO orders(user_id,customer_name,customer_email,shipping_address,total_amount,status)VALUES($1,$2,$3,$4,$5,'pending')RETURNING order_id`,[uid,customer_name,customer_email,address,total]); const oid=o.rows[0].order_id; for(const i of cart){await pool.query('INSERT INTO order_items(order_id,product_id,quantity,unit_price)VALUES($1,$2,$3,$4)',[oid,i.product_id,i.quantity,i.price]);await pool.query('UPDATE products SET stock=stock-$1 WHERE product_id=$2',[i.quantity,i.product_id]);} req.session.cart=[]; res.render('order-success',{title:'Başarılı',orderId:oid,total}); }catch(e){console.error(e);res.status(500).render('error',{title:'Hata',message:'Sipariş oluşturulamadı'});}});
app.get('/orders', async(req,res)=>{ try{ const o=await pool.query('SELECT o.*,COUNT(oi.item_id)AS item_count FROM orders o LEFT JOIN order_items oi ON o.order_id=oi.order_id GROUP BY o.order_id ORDER BY o.created_at DESC'); res.render('orders',{title:'Siparişler',orders:o.rows}); }catch(e){res.render('orders',{title:'Siparişler',orders:[]});}});

// AUTH
app.get('/login',(req,res)=>{ if(req.session.user)return res.redirect('/'); res.render('login',{title:'Giriş',error:null}); });
app.post('/login', async(req,res)=>{ try{ const r=await pool.query('SELECT * FROM users WHERE email=$1 AND password=$2',[req.body.email,req.body.password]); if(r.rows.length){req.session.user=r.rows[0];res.redirect(r.rows[0].role==='admin'?'/admin':'/');} else res.render('login',{title:'Giriş',error:'E-posta veya şifre hatalı'}); }catch(e){res.render('login',{title:'Giriş',error:'Hata'});}});
app.get('/register',(req,res)=>{ if(req.session.user)return res.redirect('/'); res.render('register',{title:'Kayıt',error:null}); });
app.post('/register', async(req,res)=>{ try{ await pool.query('INSERT INTO users(full_name,email,password)VALUES($1,$2,$3)',[req.body.full_name,req.body.email,req.body.password]); const u=await pool.query('SELECT * FROM users WHERE email=$1',[req.body.email]); req.session.user=u.rows[0]; res.redirect('/'); }catch(e){res.render('register',{title:'Kayıt',error:'Bu e-posta zaten kayıtlı'});}});
app.get('/logout',(req,res)=>{ req.session.destroy(); res.redirect('/login'); });

// ADMIN
app.get('/admin', requireAdmin, async(req,res)=>{ try{ const s=await pool.query(`SELECT(SELECT COUNT(*)FROM products)AS products,(SELECT COUNT(*)FROM orders)AS orders,(SELECT COUNT(*)FROM users)AS users,(SELECT COALESCE(SUM(total_amount),0)FROM orders)AS revenue,(SELECT COUNT(*)FROM orders WHERE status='pending')AS pending,(SELECT COUNT(*)FROM orders WHERE created_at>NOW()-INTERVAL '24 hours')AS today_orders`); const ro=await pool.query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 10'); const tp=await pool.query(`SELECT p.product_name,p.emoji,SUM(oi.quantity)AS sold,SUM(oi.quantity*oi.unit_price)AS revenue FROM order_items oi JOIN products p ON oi.product_id=p.product_id GROUP BY p.product_id,p.product_name,p.emoji ORDER BY sold DESC LIMIT 5`); const cs=await pool.query(`SELECT p.category,COUNT(oi.item_id)AS sales,SUM(oi.quantity*oi.unit_price)AS revenue FROM order_items oi JOIN products p ON oi.product_id=p.product_id GROUP BY p.category ORDER BY revenue DESC`); res.render('admin/dashboard',{title:'Admin',stats:s.rows[0],recentOrders:ro.rows,topProducts:tp.rows,categorySales:cs.rows}); }catch(e){console.error(e);res.render('admin/dashboard',{title:'Admin',stats:{},recentOrders:[],topProducts:[],categorySales:[]});}});
app.get('/admin/products', requireAdmin, async(req,res)=>{ const p=await pool.query('SELECT * FROM products ORDER BY product_id'); res.render('admin/products',{title:'Ürünler',products:p.rows}); });
app.post('/admin/products/add', requireAdmin, async(req,res)=>{ const{product_name,description,category,price,stock,emoji,color_class,featured}=req.body; await pool.query('INSERT INTO products(product_name,description,category,price,stock,emoji,color_class,featured)VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[product_name,description,category,price,stock,emoji||'📦',color_class||'bg-gray',featured==='on']); res.redirect('/admin/products'); });
app.post('/admin/products/delete/:id', requireAdmin, async(req,res)=>{ await pool.query('DELETE FROM order_items WHERE product_id=$1',[req.params.id]); await pool.query('DELETE FROM products WHERE product_id=$1',[req.params.id]); res.redirect('/admin/products'); });
app.get('/admin/orders', requireAdmin, async(req,res)=>{ const o=await pool.query('SELECT o.*,COUNT(oi.item_id)AS item_count FROM orders o LEFT JOIN order_items oi ON o.order_id=oi.order_id GROUP BY o.order_id ORDER BY o.created_at DESC'); res.render('admin/orders',{title:'Siparişler',orders:o.rows}); });
app.post('/admin/orders/:id/status', requireAdmin, async(req,res)=>{ await pool.query('UPDATE orders SET status=$1 WHERE order_id=$2',[req.body.status,req.params.id]); res.redirect('/admin/orders'); });
app.get('/admin/users', requireAdmin, async(req,res)=>{ const u=await pool.query('SELECT user_id,full_name,email,role,created_at FROM users ORDER BY user_id'); res.render('admin/users',{title:'Kullanıcılar',users:u.rows}); });

// HEALTH & API
app.get('/health',(req,res)=>res.json({status:'healthy',timestamp:new Date().toISOString(),uptime:process.uptime(),version:'2.0.0',region:process.env.K_REVISION||'local'}));
app.get('/api/stats', async(req,res)=>{ try{const s=await pool.query(`SELECT(SELECT COUNT(*)FROM products)AS products,(SELECT COUNT(*)FROM orders)AS orders,(SELECT COALESCE(SUM(total_amount),0)FROM orders)AS revenue`);res.json(s.rows[0]);}catch(e){res.status(500).json({error:e.message});}});

app.listen(PORT,()=>{ console.log(`\n🛒 CloudShop v2.0 on port ${PORT}`); console.log(`   http://localhost:${PORT}`); console.log(`   Admin: /admin (admin@cloudshop.com / admin123)\n`); });
