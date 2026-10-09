import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Image,
  Alert,
  Modal,
  SafeAreaView,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Ionicons } from '@expo/vector-icons';

// =========================================================================
// 1. ตั้งค่าการเชื่อมต่อ SUPABASE (กรอก URL และ KEY ที่ได้จาก Supabase)
// =========================================================================
const SUPABASE_URL = 'https://xvonktoqvhbseldonumx.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2b25rdG9xdmhic2VsZG9udW14Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1NDU3NDcsImV4cCI6MjEwNzEyMTc0N30.MB_UEyTaujbcezgbFjBgGQ99GrloFhTXRankNBmmpnA'; 

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export default function App() {
  // Session & Profile
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Authentication State
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

  // Navigation Tabs: 'shop', 'cart', 'staff_products', 'staff_categories', 'staff_orders', 'staff_reports'
  const [currentTab, setCurrentTab] = useState('shop');

  // Customer Data State
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState([]);
  const [isPaymentModalVisible, setIsPaymentModalVisible] = useState(false);

  // Staff Data State
  const [orders, setOrders] = useState([]);
  const [reportData, setReportData] = useState({
    totalSales: 0,
    todaySales: 0,
    monthSales: 0,
    totalCustomers: 0,
    paidOrdersCount: 0,
  });

  // Modal Form States
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [productForm, setProductForm] = useState({
    id: null,
    name: '',
    description: '',
    price: '',
    stock: '',
    category_id: null,
    image_url: '',
  });
  const [categoryForm, setCategoryForm] = useState({ id: null, name: '' });

  // -----------------------------------------------------------------------
  // ระบบยืนยันตัวตนและการดึงโปรไฟล์ (Auth & Profile)
  // -----------------------------------------------------------------------
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchUserProfile(session.user.id);
      else setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchUserProfile(session.user.id);
      } else {
        setProfile(null);
        setCart([]);
        setCurrentTab('shop');
        setLoading(false);
      }
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId) => {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (error) throw error;
      setProfile(data);
    } catch (err) {
      console.log('Error fetching user profile:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async () => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      Alert.alert('แจ้งเตือน', 'กรุณาระบุ SUPABASE_URL และ SUPABASE_ANON_KEY ในโค้ดก่อนเริ่มใช้งาน');
      return;
    }
    if (!email.trim() || !password.trim()) {
      Alert.alert('ข้อผิดพลาด', 'กรุณากรอกอีเมลและรหัสผ่านให้ครบถ้วน');
      return;
    }

    setLoading(true);
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
        options: { data: { full_name: fullName.trim() || 'Customer' } },
      });
      setLoading(false);
      if (error) {
        Alert.alert('สมัครสมาชิกไม่สำเร็จ', error.message);
      } else {
        Alert.alert('สมัครสมาชิกสำเร็จ', 'ระบบสร้างบัญชีเรียบร้อยแล้ว กรุณาเข้าสู่ระบบ');
        setIsSignUp(false);
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });
      setLoading(false);
      if (error) {
        Alert.alert('เข้าสู่ระบบไม่สำเร็จ', error.message);
      }
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  // -----------------------------------------------------------------------
  // การโหลดข้อมูลสินค้า หมวดหมู่ ออเดอร์ และรายงาน (Data Loading)
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (session) {
      fetchProducts();
      fetchCategories();
      if (profile?.role === 'staff') {
        fetchOrders();
        fetchReports();
      }
    }
  }, [session, profile]);

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*, categories(name)')
      .order('id', { ascending: false });
    if (!error && data) setProducts(data);
  };

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('id', { ascending: true });
    if (!error && data) setCategories(data);
  };

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('*, profiles(full_name, email), order_items(*)')
      .order('id', { ascending: false });
    if (!error && data) setOrders(data);
  };

  const fetchReports = async () => {
    try {
      const { data: allOrders } = await supabase
        .from('orders')
        .select('total_price, created_at, status')
        .eq('status', 'paid');

      const { count: customerCount } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'customer');

      let total = 0;
      let today = 0;
      let month = 0;
      const now = new Date();
      const todayPrefix = now.toISOString().split('T')[0];
      const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      if (allOrders) {
        allOrders.forEach((o) => {
          const price = Number(o.total_price);
          total += price;
          if (o.created_at) {
            if (o.created_at.startsWith(todayPrefix)) today += price;
            if (o.created_at.startsWith(monthPrefix)) month += price;
          }
        });
      }

      setReportData({
        totalSales: total,
        todaySales: today,
        monthSales: month,
        totalCustomers: customerCount || 0,
        paidOrdersCount: allOrders ? allOrders.length : 0,
      });
    } catch (err) {
      console.log('Error reports:', err.message);
    }
  };

  // -----------------------------------------------------------------------
  // ระบบสำหรับลูกค้า: ตะกร้าสินค้าและการสั่งซื้อ/ชำระเงิน (Customer Actions)
  // -----------------------------------------------------------------------
  const addToCart = (product) => {
    if (product.stock <= 0) {
      Alert.alert('สินค้าหมด', 'ขออภัย สินค้านี้จำหน่ายหมดแล้ว');
      return;
    }
    const itemInCart = cart.find((i) => i.id === product.id);
    if (itemInCart) {
      if (itemInCart.quantity >= product.stock) {
        Alert.alert('จำนวนจำกัด', `คุณเลือกซื้อครบตามจำนวนสต็อกที่มีแล้ว (${product.stock} ชิ้น)`);
        return;
      }
      setCart(cart.map((i) => (i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
    Alert.alert('เพิ่มสำเร็จ', `ใส่ "${product.name}" ลงในตะกร้าแล้ว`);
  };

  const updateCartQuantity = (productId, change) => {
    setCart(
      cart
        .map((item) => {
          if (item.id === productId) {
            const nextQty = item.quantity + change;
            if (nextQty > item.stock) {
              Alert.alert('สต็อกไม่พอ', `มีสินค้าเพียง ${item.stock} ชิ้น`);
              return item;
            }
            return nextQty > 0 ? { ...item, quantity: nextQty } : null;
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter((item) => item.id !== productId));
  };

  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  const handleCheckoutAndPay = async () => {
    if (cart.length === 0) return;
    setLoading(true);

    try {
      const total = calculateTotal();

      // 1. บันทึกคำสั่งซื้อใหม่
      const { data: newOrder, error: orderErr } = await supabase
        .from('orders')
        .insert({
          user_id: session.user.id,
          total_price: total,
          status: 'paid', // ชำระเงินผ่านระบบสำเร็จ
          payment_method: 'promptpay_qr',
        })
        .select()
        .single();

      if (orderErr) throw orderErr;

      // 2. บันทึกรายการสินค้าในคำสั่งซื้อ
      const itemsPayload = cart.map((item) => ({
        order_id: newOrder.id,
        product_id: item.id,
        product_name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
      }));

      const { error: itemsErr } = await supabase.from('order_items').insert(itemsPayload);
      if (itemsErr) throw itemsErr;

      // 3. ปรับลดสต็อกสินค้าในคลัง
      for (const item of cart) {
        await supabase
          .from('products')
          .update({ stock: Math.max(0, item.stock - item.quantity) })
          .eq('id', item.id);
      }

      setCart([]);
      setIsPaymentModalVisible(false);
      fetchProducts();
      Alert.alert('ชำระเงินสำเร็จ 🎉', `คำสั่งซื้อ #${newOrder.id} ได้รับการชำระเงินเรียบร้อยแล้ว ขอให้โชคดีในการสุ่มการ์ด!`);
      setCurrentTab('shop');
    } catch (err) {
      Alert.alert('เกิดข้อผิดพลาดในการสั่งซื้อ', err.message);
    } finally {
      setLoading(false);
    }
  };

  // -----------------------------------------------------------------------
  // ระบบสำหรับพนักงาน: จัดการสินค้าและหมวดหมู่ (Staff CRUD)
  // -----------------------------------------------------------------------
  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim()) {
      Alert.alert('แจ้งเตือน', 'กรุณากรอกชื่อหมวดหมู่');
      return;
    }
    if (categoryForm.id) {
      await supabase.from('categories').update({ name: categoryForm.name.trim() }).eq('id', categoryForm.id);
    } else {
      await supabase.from('categories').insert({ name: categoryForm.name.trim() });
    }
    setIsCategoryModalOpen(false);
    setCategoryForm({ id: null, name: '' });
    fetchCategories();
  };

  const handleDeleteCategory = async (id) => {
    Alert.alert('ยืนยันการลบ', 'ต้องการลบหมวดหมู่นี้หรือไม่?', [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ลบ',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('categories').delete().eq('id', id);
          fetchCategories();
        },
      },
    ]);
  };

  const handleSaveProduct = async () => {
    const { id, name, description, price, stock, category_id, image_url } = productForm;
    if (!name.trim() || !price || stock === '') {
      Alert.alert('แจ้งเตือน', 'กรุณากรอกชื่อ, ราคา และจำนวนสต็อก');
      return;
    }

    const payload = {
      name: name.trim(),
      description: description.trim(),
      price: parseFloat(price),
      stock: parseInt(stock, 10),
      category_id: category_id ? parseInt(category_id, 10) : null,
      image_url: image_url.trim() || 'https://images.unsplash.com/photo-1613771404784-3a5686aa2be3?w=500',
    };

    if (id) {
      await supabase.from('products').update(payload).eq('id', id);
    } else {
      await supabase.from('products').insert(payload);
    }

    setIsProductModalOpen(false);
    setProductForm({ id: null, name: '', description: '', price: '', stock: '', category_id: null, image_url: '' });
    fetchProducts();
  };

  const handleDeleteProduct = async (id) => {
    Alert.alert('ยืนยันการลบ', 'ต้องการลบสินค้านี้ออกจากระบบหรือไม่?', [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ลบ',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('products').delete().eq('id', id);
          fetchProducts();
        },
      },
    ]);
  };

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
    fetchOrders();
    fetchReports();
  };

  // กรองรายการสินค้า
  const filteredProducts = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCategory = selectedCategory ? p.category_id === selectedCategory : true;
    return matchSearch && matchCategory;
  });

  // -----------------------------------------------------------------------
  // Render: Loading Screen
  // -----------------------------------------------------------------------
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={{ marginTop: 12, color: '#4f46e5', fontWeight: 'bold' }}>Secret Pull กำลังเตรียมระบบ...</Text>
      </View>
    );
  }

  // -----------------------------------------------------------------------
  // Render: หน้าจอเข้าสู่ระบบ / สมัครสมาชิก (Auth Screen)
  // -----------------------------------------------------------------------
  if (!session) {
    return (
      <SafeAreaView style={styles.authContainer}>
        <StatusBar barStyle="light-content" />
        <View style={styles.authCard}>
          <Text style={styles.authBrand}>🃏 Secret Pull</Text>
          <Text style={styles.authSubBrand}>ร้านสุ่มการ์ด & การ์ดเกมสะสมของแท้</Text>

          {isSignUp && (
            <TextInput
              style={styles.input}
              placeholder="ชื่อ-นามสกุล ของท่าน"
              placeholderTextColor="#9ca3af"
              value={fullName}
              onChangeText={setFullName}
            />
          )}

          <TextInput
            style={styles.input}
            placeholder="อีเมล (Email)"
            placeholderTextColor="#9ca3af"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <TextInput
            style={styles.input}
            placeholder="รหัสผ่าน (Password)"
            placeholderTextColor="#9ca3af"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity style={styles.primaryBtn} onPress={handleAuth}>
            <Text style={styles.primaryBtnText}>{isSignUp ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)} style={{ marginTop: 16 }}>
            <Text style={{ textAlign: 'center', color: '#6366f1', fontSize: 13, fontWeight: '500' }}>
              {isSignUp ? 'มีบัญชีผู้ใช้แล้ว? เข้าสู่ระบบที่นี่' : 'ยังไม่มีบัญชีผู้ใช้? สมัครสมาชิกใหม่'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // -----------------------------------------------------------------------
  // Render: หน้าจอหลักของแอพพลิเคชัน (Main App Screen)
  // -----------------------------------------------------------------------
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* แถบด้านบน (Header Bar) */}
      <View style={styles.headerBar}>
        <View>
          <Text style={styles.headerLogo}>✨ Secret Pull</Text>
          <Text style={styles.headerRole}>
            {profile?.full_name} | {profile?.role === 'staff' ? 'เจ้าหน้าที่ร้าน (Staff) 🛡️' : 'ลูกค้าสมาชิก 🛍️'}
          </Text>
        </View>
        <TouchableOpacity onPress={handleSignOut} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
        </TouchableOpacity>
      </View>

      {/* เมนูแท็บนำทาง (Navigation Bar) */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabButton, currentTab === 'shop' && styles.activeTabButton]}
          onPress={() => setCurrentTab('shop')}>
          <Ionicons name="storefront-outline" size={18} color={currentTab === 'shop' ? '#6366f1' : '#6b7280'} />
          <Text style={[styles.tabText, currentTab === 'shop' && styles.activeTabText]}>สุ่ม/ซื้อ</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, currentTab === 'cart' && styles.activeTabButton]}
          onPress={() => setCurrentTab('cart')}>
          <Ionicons name="cart-outline" size={18} color={currentTab === 'cart' ? '#6366f1' : '#6b7280'} />
          <Text style={[styles.tabText, currentTab === 'cart' && styles.activeTabText]}>
            ตะกร้า ({cart.reduce((a, b) => a + b.quantity, 0)})
          </Text>
        </TouchableOpacity>

        {profile?.role === 'staff' && (
          <>
            <TouchableOpacity
              style={[styles.tabButton, currentTab === 'staff_products' && styles.activeTabButton]}
              onPress={() => setCurrentTab('staff_products')}>
              <Ionicons name="cube-outline" size={18} color={currentTab === 'staff_products' ? '#6366f1' : '#6b7280'} />
              <Text style={[styles.tabText, currentTab === 'staff_products' && styles.activeTabText]}>สินค้า</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, currentTab === 'staff_categories' && styles.activeTabButton]}
              onPress={() => setCurrentTab('staff_categories')}>
              <Ionicons name="folder-outline" size={18} color={currentTab === 'staff_categories' ? '#6366f1' : '#6b7280'} />
              <Text style={[styles.tabText, currentTab === 'staff_categories' && styles.activeTabText]}>หมวดหมู่</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, currentTab === 'staff_orders' && styles.activeTabButton]}
              onPress={() => {
                fetchOrders();
                setCurrentTab('staff_orders');
              }}>
              <Ionicons name="receipt-outline" size={18} color={currentTab === 'staff_orders' ? '#6366f1' : '#6b7280'} />
              <Text style={[styles.tabText, currentTab === 'staff_orders' && styles.activeTabText]}>ออเดอร์</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, currentTab === 'staff_reports' && styles.activeTabButton]}
              onPress={() => {
                fetchReports();
                setCurrentTab('staff_reports');
              }}>
              <Ionicons name="bar-chart-outline" size={18} color={currentTab === 'staff_reports' ? '#6366f1' : '#6b7280'} />
              <Text style={[styles.tabText, currentTab === 'staff_reports' && styles.activeTabText]}>สรุปยอด</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* ------------------------------------------------------------------- */}
      {/* 1. แท็บดูสินค้าและค้นหา (Customer Shop Screen) */}
      {/* ------------------------------------------------------------------- */}
      {currentTab === 'shop' && (
        <View style={{ flex: 1 }}>
          {/* แถบค้นหาสินค้า */}
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color="#9ca3af" style={{ marginRight: 8 }} />
            <TextInput
              style={{ flex: 1, fontSize: 14 }}
              placeholder="ค้นหาชื่อการ์ด กล่องสุ่ม ซอง Booster..."
              placeholderTextColor="#9ca3af"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color="#9ca3af" />
              </TouchableOpacity>
            )}
          </View>

          {/* ฟิลเตอร์หมวดหมู่สินค้า */}
          <View style={{ height: 42, marginBottom: 4 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12 }}>
              <TouchableOpacity
                style={[styles.categoryTag, selectedCategory === null && styles.activeCategoryTag]}
                onPress={() => setSelectedCategory(null)}>
                <Text style={[styles.categoryTagText, selectedCategory === null && styles.activeCategoryTagText]}>
                  ทั้งหมด
                </Text>
              </TouchableOpacity>
              {categories.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.categoryTag, selectedCategory === c.id && styles.activeCategoryTag]}
                  onPress={() => setSelectedCategory(c.id)}>
                  <Text style={[styles.categoryTagText, selectedCategory === c.id && styles.activeCategoryTagText]}>
                    {c.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* รายการการ์ด / สินค้า */}
          <FlatList
            data={filteredProducts}
            keyExtractor={(item) => item.id.toString()}
            numColumns={2}
            contentContainerStyle={{ padding: 8, paddingBottom: 20 }}
            renderItem={({ item }) => (
              <View style={styles.productCard}>
                <Image source={{ uri: item.image_url || 'https://via.placeholder.com/200' }} style={styles.productThumb} />
                <View style={{ padding: 10 }}>
                  <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.productCatName}>{item.categories?.name || 'การ์ดสะสมทั่วไป'}</Text>
                  <Text style={styles.productPrice}>฿{Number(item.price).toLocaleString()}</Text>
                  <Text style={{ fontSize: 11, marginTop: 2, color: item.stock > 0 ? '#10b981' : '#ef4444', fontWeight: '500' }}>
                    {item.stock > 0 ? `คงเหลือ ${item.stock} ชิ้น` : 'สินค้าหมด'}
                  </Text>
                  <TouchableOpacity
                    style={[styles.addCartBtn, item.stock <= 0 && { backgroundColor: '#d1d5db' }]}
                    onPress={() => addToCart(item)}
                    disabled={item.stock <= 0}>
                    <Text style={styles.addCartBtnText}>
                      {item.stock > 0 ? '+ สุ่ม / เพิ่มลงตะกร้า' : 'สินค้าหมด'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        </View>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* 2. แท็บตะกร้าสินค้าและการชำระเงิน (Cart Screen) */}
      {/* ------------------------------------------------------------------- */}
      {currentTab === 'cart' && (
        <View style={{ flex: 1, padding: 14 }}>
          <Text style={styles.pageTitle}>ตะกร้าสินค้าของคุณ 🛒</Text>
          {cart.length === 0 ? (
            <View style={styles.centerContainer}>
              <Ionicons name="cart-outline" size={72} color="#cbd5e1" />
              <Text style={{ color: '#94a3b8', marginTop: 12, fontSize: 15 }}>ไม่มีสินค้าในตะกร้า</Text>
            </View>
          ) : (
            <>
              <FlatList
                data={cart}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                  <View style={styles.cartRow}>
                    <Image source={{ uri: item.image_url }} style={styles.cartImg} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={{ fontWeight: 'bold', fontSize: 14, color: '#1e293b' }}>{item.name}</Text>
                      <Text style={{ color: '#4f46e5', fontWeight: '600', marginTop: 2 }}>
                        ฿{Number(item.price).toLocaleString()}
                      </Text>
                      <View style={styles.qtyBox}>
                        <TouchableOpacity style={styles.qtyBtn} onPress={() => updateCartQuantity(item.id, -1)}>
                          <Text style={{ fontSize: 14, fontWeight: 'bold' }}>-</Text>
                        </TouchableOpacity>
                        <Text style={{ marginHorizontal: 12, fontWeight: 'bold', fontSize: 14 }}>{item.quantity}</Text>
                        <TouchableOpacity style={styles.qtyBtn} onPress={() => updateCartQuantity(item.id, 1)}>
                          <Text style={{ fontSize: 14, fontWeight: 'bold' }}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => removeFromCart(item.id)} style={{ padding: 6 }}>
                      <Ionicons name="trash-outline" size={22} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                )}
              />

              <View style={styles.cartSummary}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 }}>
                  <Text style={{ fontSize: 16, color: '#475569' }}>ยอดชำระสุทธิ:</Text>
                  <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#4f46e5' }}>
                    ฿{calculateTotal().toLocaleString()}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.payBtn}
                  onPress={() => setIsPaymentModalVisible(true)}>
                  <Text style={styles.payBtnText}>ดำเนินการชำระเงิน (PromptPay)</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* 3. พนักงาน: จัดการสินค้า (Staff Product Management) */}
      {/* ------------------------------------------------------------------- */}
      {currentTab === 'staff_products' && (
        <View style={{ flex: 1, padding: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={styles.pageTitle}>จัดการรายการสินค้า 📦</Text>
            <TouchableOpacity
              style={styles.actionAddBtn}
              onPress={() => {
                setProductForm({ id: null, name: '', description: '', price: '', stock: '', category_id: null, image_url: '' });
                setIsProductModalOpen(true);
              }}>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>+ เพิ่มสินค้า</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={products}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <View style={styles.staffCard}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: 'bold', fontSize: 14, color: '#1e293b' }}>{item.name}</Text>
                  <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    หมวด: {item.categories?.name || 'ไม่มี'} | ฿{Number(item.price).toLocaleString()} | สต็อก: {item.stock} ชิ้น
                  </Text>
                </View>
                <TouchableOpacity
                  style={{ padding: 6, marginRight: 8 }}
                  onPress={() => {
                    setProductForm({
                      id: item.id,
                      name: item.name,
                      description: item.description || '',
                      price: item.price.toString(),
                      stock: item.stock.toString(),
                      category_id: item.category_id,
                      image_url: item.image_url || '',
                    });
                    setIsProductModalOpen(true);
                  }}>
                  <Ionicons name="pencil" size={18} color="#3b82f6" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeleteProduct(item.id)} style={{ padding: 6 }}>
                  <Ionicons name="trash" size={18} color="#ef4444" />
                </TouchableOpacity>
              </View>
            )}
          />
        </View>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* 4. พนักงาน: จัดการหมวดหมู่ (Staff Categories) */}
      {/* ------------------------------------------------------------------- */}
      {currentTab === 'staff_categories' && (
        <View style={{ flex: 1, padding: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={styles.pageTitle}>จัดการหมวดหมู่สินค้า 📁</Text>
            <TouchableOpacity
              style={styles.actionAddBtn}
              onPress={() => {
                setCategoryForm({ id: null, name: '' });
                setIsCategoryModalOpen(true);
              }}>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>+ เพิ่มหมวดหมู่</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={categories}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <View style={styles.staffCard}>
                <Text style={{ flex: 1, fontWeight: 'bold', fontSize: 14, color: '#1e293b' }}>{item.name}</Text>
                <TouchableOpacity
                  style={{ padding: 6, marginRight: 8 }}
                  onPress={() => {
                    setCategoryForm({ id: item.id, name: item.name });
                    setIsCategoryModalOpen(true);
                  }}>
                  <Ionicons name="pencil" size={18} color="#3b82f6" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeleteCategory(item.id)} style={{ padding: 6 }}>
                  <Ionicons name="trash" size={18} color="#ef4444" />
                </TouchableOpacity>
              </View>
            )}
          />
        </View>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* 5. พนักงาน: ปรับสถานะคำสั่งซื้อ (Staff Orders) */}
      {/* ------------------------------------------------------------------- */}
      {currentTab === 'staff_orders' && (
        <View style={{ flex: 1, padding: 14 }}>
          <Text style={styles.pageTitle}>คำสั่งซื้อและสถานะชำระเงิน 📜</Text>
          <FlatList
            data={orders}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <View style={styles.orderListItem}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontWeight: 'bold', fontSize: 15, color: '#1e293b' }}>ออเดอร์ #{item.id}</Text>
                  <View
                    style={[
                      styles.orderBadge,
                      {
                        backgroundColor:
                          item.status === 'paid' ? '#dcfce7' : item.status === 'pending' ? '#fef3c7' : '#fee2e2',
                      },
                    ]}>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: 'bold',
                        color: item.status === 'paid' ? '#166534' : item.status === 'pending' ? '#92400e' : '#991b1b',
                      }}>
                      {item.status === 'paid' ? 'ชำระแล้ว' : item.status === 'pending' ? 'รอดำเนินการ' : 'ยกเลิก'}
                    </Text>
                  </View>
                </View>

                <Text style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                  ลูกค้า: {item.profiles?.full_name || 'ลูกค้าทั่วไป'} ({item.profiles?.email})
                </Text>
                <Text style={{ fontSize: 11, color: '#94a3b8' }}>
                  เวลาสั่ง: {new Date(item.created_at).toLocaleString('th-TH')}
                </Text>

                <View style={styles.orderDivider}>
                  {item.order_items?.map((it, idx) => (
                    <Text key={idx} style={{ fontSize: 12, color: '#334155' }}>
                      • {it.product_name} x {it.quantity} = ฿{(it.quantity * it.unit_price).toLocaleString()}
                    </Text>
                  ))}
                  <Text style={{ fontWeight: 'bold', fontSize: 14, color: '#1e293b', marginTop: 6 }}>
                    ยอดรวมสุทธิ: ฿{Number(item.total_price).toLocaleString()}
                  </Text>
                </View>

                {/* ปุ่มปรับสถานะ */}
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
                  <TouchableOpacity
                    style={[styles.statusToggleBtn, { backgroundColor: '#10b981' }]}
                    onPress={() => handleUpdateOrderStatus(item.id, 'paid')}>
                    <Text style={styles.statusToggleBtnText}>ชำระแล้ว</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.statusToggleBtn, { backgroundColor: '#f59e0b' }]}
                    onPress={() => handleUpdateOrderStatus(item.id, 'pending')}>
                    <Text style={styles.statusToggleBtnText}>รอดำเนินการ</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.statusToggleBtn, { backgroundColor: '#ef4444' }]}
                    onPress={() => handleUpdateOrderStatus(item.id, 'cancelled')}>
                    <Text style={styles.statusToggleBtnText}>ยกเลิก</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        </View>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* 6. พนักงาน: รายงานยอดขายและลูกค้า (Staff Reports) */}
      {/* ------------------------------------------------------------------- */}
      {currentTab === 'staff_reports' && (
        <ScrollView style={{ flex: 1, padding: 14 }}>
          <Text style={styles.pageTitle}>รายงานยอดขายและสรุปสถิติ 📊</Text>

          <View style={styles.metricCard}>
            <View style={[styles.metricIconWrap, { backgroundColor: '#e0e7ff' }]}>
              <Ionicons name="cash-outline" size={24} color="#4338ca" />
            </View>
            <View style={{ marginLeft: 14 }}>
              <Text style={styles.metricLabel}>ยอดขายรวมทั้งหมด</Text>
              <Text style={styles.metricValue}>฿{reportData.totalSales.toLocaleString()}</Text>
              <Text style={{ fontSize: 11, color: '#64748b' }}>จากออเดอร์ที่ชำระแล้ว {reportData.paidOrdersCount} รายการ</Text>
            </View>
          </View>

          <View style={styles.metricCard}>
            <View style={[styles.metricIconWrap, { backgroundColor: '#dcfce7' }]}>
              <Ionicons name="today-outline" size={24} color="#15803d" />
            </View>
            <View style={{ marginLeft: 14 }}>
              <Text style={styles.metricLabel}>ยอดขายวันนี้ (Daily Sales)</Text>
              <Text style={styles.metricValue}>฿{reportData.todaySales.toLocaleString()}</Text>
            </View>
          </View>

          <View style={styles.metricCard}>
            <View style={[styles.metricIconWrap, { backgroundColor: '#fef3c7' }]}>
              <Ionicons name="calendar-outline" size={24} color="#b45309" />
            </View>
            <View style={{ marginLeft: 14 }}>
              <Text style={styles.metricLabel}>ยอดขายเดือนนี้ (Monthly Sales)</Text>
              <Text style={styles.metricValue}>฿{reportData.monthSales.toLocaleString()}</Text>
            </View>
          </View>

          <View style={styles.metricCard}>
            <View style={[styles.metricIconWrap, { backgroundColor: '#fee2e2' }]}>
              <Ionicons name="people-outline" size={24} color="#b91c1c" />
            </View>
            <View style={{ marginLeft: 14 }}>
              <Text style={styles.metricLabel}>จำนวนลูกค้าทั้งหมด (Customers)</Text>
              <Text style={styles.metricValue}>{reportData.totalCustomers} บัญชี</Text>
              <Text style={{ fontSize: 11, color: '#64748b' }}>ผู้ใช้ที่ลงทะเบียนในระบบ</Text>
            </View>
          </View>
        </ScrollView>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* Modal: สแกนชำระเงิน PromptPay QR (Payment Modal) */}
      {/* ------------------------------------------------------------------- */}
      <Modal visible={isPaymentModalVisible} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={[styles.modalBox, { alignItems: 'center' }]}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1e293b' }}>สแกนเพื่อชำระเงิน</Text>
            <Text style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>PromptPay QR Code (ระบบจำลอง)</Text>

            <Image
              source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=SECRETPULL_PAY_${calculateTotal()}` }}
              style={{ width: 170, height: 170, marginVertical: 16 }}
            />

            <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#4f46e5', marginBottom: 16 }}>
              ยอดชำระ: ฿{calculateTotal().toLocaleString()}
            </Text>

            <View style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between' }}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#94a3b8' }]}
                onPress={() => setIsPaymentModalVisible(false)}>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>ยกเลิก</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#10b981' }]}
                onPress={handleCheckoutAndPay}>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>ยืนยันชำระเงิน</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ------------------------------------------------------------------- */}
      {/* Modal: เพิ่ม/แก้ไขสินค้า (Product Modal) */}
      {/* ------------------------------------------------------------------- */}
      <Modal visible={isProductModalOpen} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{productForm.id ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="ชื่อสินค้า / การ์ด"
              placeholderTextColor="#9ca3af"
              value={productForm.name}
              onChangeText={(t) => setProductForm({ ...productForm, name: t })}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="รายละเอียด"
              placeholderTextColor="#9ca3af"
              value={productForm.description}
              onChangeText={(t) => setProductForm({ ...productForm, description: t })}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="ราคา (บาท)"
              placeholderTextColor="#9ca3af"
              keyboardType="numeric"
              value={productForm.price}
              onChangeText={(t) => setProductForm({ ...productForm, price: t })}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="จำนวนสต็อก"
              placeholderTextColor="#9ca3af"
              keyboardType="numeric"
              value={productForm.stock}
              onChangeText={(t) => setProductForm({ ...productForm, stock: t })}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="ลิงก์รูปภาพ (Image URL)"
              placeholderTextColor="#9ca3af"
              value={productForm.image_url}
              onChangeText={(t) => setProductForm({ ...productForm, image_url: t })}
            />

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#94a3b8', marginRight: 8 }]}
                onPress={() => setIsProductModalOpen(false)}>
                <Text style={{ color: '#fff' }}>ยกเลิก</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#6366f1' }]}
                onPress={handleSaveProduct}>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>บันทึก</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ------------------------------------------------------------------- */}
      {/* Modal: เพิ่ม/แก้ไขหมวดหมู่ (Category Modal) */}
      {/* ------------------------------------------------------------------- */}
      <Modal visible={isCategoryModalOpen} animationType="fade" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{categoryForm.id ? 'แก้ไขหมวดหมู่' : 'เพิ่มหมวดหมู่'}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="ชื่อหมวดหมู่สินค้า"
              placeholderTextColor="#9ca3af"
              value={categoryForm.name}
              onChangeText={(t) => setCategoryForm({ ...categoryForm, name: t })}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#94a3b8', marginRight: 8 }]}
                onPress={() => setIsCategoryModalOpen(false)}>
                <Text style={{ color: '#fff' }}>ยกเลิก</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#6366f1' }]}
                onPress={handleSaveCategory}>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>บันทึก</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// -------------------------------------------------------------------------
// สไตล์ตกแต่ง (StyleSheet)
// -------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  authContainer: { flex: 1, backgroundColor: '#1e1b4b', justifyContent: 'center', alignItems: 'center' },
  authCard: { width: '88%', backgroundColor: '#ffffff', borderRadius: 20, padding: 24, elevation: 5 },
  authBrand: { fontSize: 26, fontWeight: 'bold', textAlign: 'center', color: '#312e81' },
  authSubBrand: { fontSize: 13, textAlign: 'center', color: '#64748b', marginTop: 4, marginBottom: 20 },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#f8fafc',
    fontSize: 14,
    color: '#1e293b',
  },
  primaryBtn: { backgroundColor: '#6366f1', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 4 },
  primaryBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 15 },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerLogo: { fontSize: 18, fontWeight: 'bold', color: '#3730a3' },
  headerRole: { fontSize: 11, color: '#64748b', marginTop: 2 },
  logoutBtn: { padding: 6 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tabButton: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  activeTabButton: { borderBottomWidth: 2, borderBottomColor: '#6366f1' },
  tabText: { fontSize: 11, color: '#64748b', marginTop: 2 },
  activeTabText: { color: '#6366f1', fontWeight: 'bold' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    margin: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    height: 42,
  },
  categoryTag: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#e2e8f0',
    marginRight: 8,
    alignSelf: 'center',
  },
  activeCategoryTag: { backgroundColor: '#6366f1' },
  categoryTagText: { fontSize: 12, color: '#334155', fontWeight: '500' },
  activeCategoryTagText: { color: '#ffffff', fontWeight: 'bold' },
  productCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    margin: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    elevation: 2,
  },
  productThumb: { width: '100%', height: 130, resizeMode: 'cover' },
  productName: { fontWeight: 'bold', fontSize: 13, color: '#0f172a' },
  productCatName: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  productPrice: { fontSize: 15, fontWeight: 'bold', color: '#4f46e5', marginTop: 4 },
  addCartBtn: {
    backgroundColor: '#6366f1',
    borderRadius: 8,
    paddingVertical: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  addCartBtnText: { color: '#ffffff', fontSize: 11, fontWeight: 'bold' },
  pageTitle: { fontSize: 17, fontWeight: 'bold', color: '#0f172a' },
  cartRow: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  cartImg: { width: 54, height: 54, borderRadius: 8 },
  qtyBox: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  qtyBtn: {
    backgroundColor: '#f1f5f9',
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartSummary: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  payBtn: { backgroundColor: '#10b981', padding: 14, borderRadius: 10, alignItems: 'center' },
  payBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 15 },
  actionAddBtn: { backgroundColor: '#6366f1', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  staffCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  orderListItem: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  orderBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  orderDivider: {
    marginVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 8,
  },
  statusToggleBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, marginLeft: 8 },
  statusToggleBtnText: { color: '#ffffff', fontSize: 11, fontWeight: 'bold' },
  metricCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  metricIconWrap: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  metricLabel: { color: '#64748b', fontSize: 13 },
  metricValue: { fontSize: 20, fontWeight: 'bold', color: '#0f172a', marginTop: 2 },
  modalBg: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { width: '86%', backgroundColor: '#ffffff', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', marginBottom: 12 },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    fontSize: 14,
    color: '#0f172a',
  },
  modalBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, minWidth: 80, alignItems: 'center' },
});
