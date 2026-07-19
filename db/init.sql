CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
    product_id SERIAL PRIMARY KEY,
    product_name VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(50),
    price DECIMAL(10,2) NOT NULL,
    stock INTEGER DEFAULT 0,
    emoji VARCHAR(10) DEFAULT '📦',
    color_class VARCHAR(20) DEFAULT 'bg-gray',
    featured BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
    order_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id),
    customer_name VARCHAR(100) NOT NULL,
    customer_email VARCHAR(100),
    shipping_address TEXT,
    total_amount DECIMAL(10,2),
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
    item_id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(order_id),
    product_id INTEGER REFERENCES products(product_id),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL
);

INSERT INTO products (product_name, description, category, price, stock, emoji, color_class, featured) VALUES
('MacBook Pro 16"', 'Apple M3 Pro çip, 18GB RAM, 512GB SSD. Profesyoneller için tasarlanmış güçlü dizüstü bilgisayar.', 'Bilgisayar', 84999.99, 25, '💻', 'bg-blue', true),
('iPhone 15 Pro', 'A17 Pro çip, 256GB depolama, Titanium kasa. En gelişmiş iPhone deneyimi.', 'Telefon', 64999.99, 50, '📱', 'bg-purple', true),
('Samsung Galaxy S24 Ultra', 'Snapdragon 8 Gen 3, 256GB, Galaxy AI destekli akıllı telefon.', 'Telefon', 54999.99, 40, '📱', 'bg-green', true),
('Sony WH-1000XM5', 'Kablosuz Noise Cancelling kulaklık. 30 saat pil, çoklu cihaz bağlantısı.', 'Ses', 8999.99, 100, '🎧', 'bg-pink', true),
('iPad Air M2', '11 inç Liquid Retina ekran, M2 çip, 128GB Wi-Fi. Taşınabilir güç.', 'Tablet', 24999.99, 35, '📟', 'bg-cyan', true),
('Dell UltraSharp 27" 4K', 'IPS 4K monitor, USB-C bağlantı, sRGB %100. Tasarımcılar için ideal.', 'Monitör', 12999.99, 20, '🖥️', 'bg-orange', true),
('Logitech MX Master 3S', 'Ergonomik kablosuz mouse, 8K DPI sensör, USB-C şarj.', 'Aksesuar', 2499.99, 150, '🖱️', 'bg-blue', false),
('Keychron K2 Pro', 'Mekanik kablosuz klavye, RGB aydınlatma, Hot-Swap destekli.', 'Aksesuar', 3299.99, 80, '⌨️', 'bg-purple', false),
('Samsung T7 Shield 1TB', 'Taşınabilir SSD, USB 3.2, IP65 su ve toz dayanıklı.', 'Depolama', 3199.99, 60, '💾', 'bg-green', false),
('Canon EOS R50', 'Aynasız fotoğraf makinesi, 24.2MP, 4K video, Wi-Fi.', 'Kamera', 29999.99, 15, '📷', 'bg-pink', false),
('AirPods Pro 2', 'USB-C, aktif gürültü engelleme, adaptif ses, kişiselleştirilmiş uzamsal ses.', 'Ses', 7499.99, 120, '🎵', 'bg-cyan', false),
('ASUS ROG Strix G16', 'Gaming laptop, RTX 4070, 16GB RAM, 165Hz ekran.', 'Bilgisayar', 54999.99, 10, '🎮', 'bg-orange', false),
('PS5 DualSense Controller', 'Kablosuz gamepad, haptik geri bildirim, adaptif tetikler.', 'Oyun', 2299.99, 200, '🕹️', 'bg-yellow', false),
('Anker PowerBank 20K', '20000mAh, 65W USB-C PD hızlı şarj, 3 cihaz aynı anda.', 'Aksesuar', 1299.99, 180, '🔋', 'bg-gray', false),
('Apple Watch Ultra 2', 'Titanyum kasa, 36 saat pil, çift frekans GPS, dalış bilgisayarı.', 'Giyilebilir', 27999.99, 30, '⌚', 'bg-blue', false);

INSERT INTO users (full_name, email, password) VALUES
('Demo Kullanıcı', 'demo@cloudshop.com', 'demo123');

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- Admin role
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';
INSERT INTO users (full_name, email, password, role) VALUES ('Admin', 'admin@cloudshop.com', 'admin123', 'admin') ON CONFLICT (email) DO NOTHING;
UPDATE users SET role = 'admin' WHERE email = 'demo@cloudshop.com';
