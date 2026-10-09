-- =========================================================
-- Secret Pull: Supabase Database Schema
-- ระบบฐานข้อมูลร้านสุ่มและจำหน่ายการ์ดสะสมออนไลน์
-- =========================================================

-- 1. ตาราง Profiles (เชื่อมกับ auth.users ของ Supabase)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'staff')),
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Trigger สร้าง profile อัตโนมัติเมื่อผู้ใช้สมัครสมาชิกผ่าน Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Customer'),
    'customer'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 2. ตาราง Categories (หมวดหมู่สินค้า)
CREATE TABLE IF NOT EXISTS public.categories (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. ตาราง Products (สินค้า/กล่องสุ่ม/ซองการ์ด)
CREATE TABLE IF NOT EXISTS public.products (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  stock INT NOT NULL DEFAULT 0,
  category_id BIGINT REFERENCES public.categories(id) ON DELETE SET NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. ตาราง Orders (คำสั่งซื้อ)
CREATE TABLE IF NOT EXISTS public.orders (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  total_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  payment_method TEXT DEFAULT 'promptpay_qr',
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 5. ตาราง Order Items (รายการสินค้าในคำสั่งซื้อ)
CREATE TABLE IF NOT EXISTS public.order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  product_id BIGINT REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price NUMERIC(10, 2) NOT NULL
);

-- 6. ปิดหรือตั้งค่า Row Level Security (RLS) เพื่อให้แอพพลิเคชันเข้าถึงได้
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- นโยบาย RLS แบบเปิดสำหรับ Client App (ใช้งานร่วมกับ Anon Key)
CREATE POLICY "Allow public read-write for profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write for categories" ON public.categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write for products" ON public.products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write for orders" ON public.orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write for order_items" ON public.order_items FOR ALL USING (true) WITH CHECK (true);

-- 7. ข้อมูลเริ่มต้นสำหรับทดสอบ (Seed Data)
INSERT INTO public.categories (name) VALUES 
('Pokémon TCG'),
('One Piece Card Game'),
('Yu-Gi-Oh! Official Card Game'),
('Mystery Card Box (กล่องสุ่ม)')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.products (name, description, price, stock, category_id, image_url) VALUES 
('Secret Pull Mystery Box Vol.1', 'กล่องสุ่มการ์ดพิเศษ การันตีการ์ดหายากระดับ Secret Rare ทุกกล่อง!', 1290, 15, 4, 'https://images.unsplash.com/photo-1613771404784-3a5686aa2be3?w=600'),
('Pokémon 151 Booster Pack (TH)', 'ซองการ์ดชุดโปเกมอน 151 ภาษาไทย ลุ้นการ์ดภาพเต็ม Art Rare', 150, 48, 1, 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600'),
('One Piece OP-05 Protagonists', 'ซองการ์ดวันพีซชุดการตื่นของยุคใหม่ ลุ้นการ์ดลูฟี่เกียร์ 5 มันงะแรร์', 180, 30, 2, 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=600'),
('Yu-Gi-Oh! 25th Quarter Century Pack', 'ซองการ์ดยูกิโอฉลองครบรอบ 25 ปี การันตีฟอยล์พิเศษ', 220, 25, 3, 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=600');
