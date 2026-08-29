// YOUR LIVE SUPABASE KEYS
const SUPABASE_URL = "https://cziefuaclocpwicwjprb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_j_MkiOlGUZOBsR8TSxIM1w_pnQ_B1xx";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let cart = [];

window.onload = function() {
    loadProductMaster();
};

// 1. FETCH PRODUCTS FROM SUPABASE DATABASE
async function loadProductMaster() {
    const { data: products, error } = await db
        .from('products')
        .select('*')
        .eq('is_active', true);

    if (error) {
        console.error("Error fetching products:", error);
        document.getElementById("product-list").innerText = "Failed to load products.";
        return;
    }

    renderProducts(products);
}

// 2. RENDER PRODUCT CARDS WITH IMAGES & PRICES
function renderProducts(products) {
    const container = document.getElementById("product-list");
    container.innerHTML = products.map(p => `
        <div class="product-card">
            <img src="${p.image_url}" alt="${p.name}" style="width:100%; height:120px; object-fit:cover; border-radius:6px;">
            <h4>${p.name}</h4>
            <p><small>${p.description}</small></p>
            <p><strong>K ${parseFloat(p.price).toFixed(2)}</strong></p>
            <button onclick='addToCart(${JSON.stringify(p)})' class="btn-add">+ Add to Combo</button>
        </div>
    `).join('');
}

function addToCart(product) {
    cart.push(product);
    updateCartUI();
}

function removeFromCart(index) {
    cart.splice(index, 1);
    updateCartUI();
}

// 3. COMBO VALIDATION ENGINE (MIN 3 ITEMS & MIN K249)
function updateCartUI() {
    const list = document.getElementById("cart-items");
    list.innerHTML = cart.map((item, index) => `
        <li>
            ${item.name} - K ${parseFloat(item.price).toFixed(2)} 
            <button onclick="removeFromCart(${index})" style="color:red; background:none; border:none; cursor:pointer;">✕</button>
        </li>
    `).join('');
    
    const totalCount = cart.length;
    const totalPrice = cart.reduce((sum, item) => sum + parseFloat(item.price), 0);

    // Update Rule UI
    const countRuleEl = document.getElementById("item-count-rule");
    const priceRuleEl = document.getElementById("price-rule");
    const checkoutBtn = document.getElementById("checkout-btn");

    const hasMinItems = totalCount >= 3;
    const hasMinPrice = totalPrice >= 249.00;

    countRuleEl.innerHTML = hasMinItems 
        ? `✅ Items selected: ${totalCount} (Minimum met)` 
        : `❌ Items selected: ${totalCount} / 3 minimum`;
    countRuleEl.style.color = hasMinItems ? "green" : "red";

    priceRuleEl.innerHTML = hasMinPrice 
        ? `✅ Combo total: K ${totalPrice.toFixed(2)} (Minimum met)` 
        : `❌ Combo total: K ${totalPrice.toFixed(2)} / K 249.00 minimum`;
    priceRuleEl.style.color = hasMinPrice ? "green" : "red";

    // Enable button only when both combo conditions are met
    if (hasMinItems && hasMinPrice) {
        checkoutBtn.disabled = false;
        checkoutBtn.innerText = `Place Combo Order (K ${totalPrice.toFixed(2)})`;
    } else {
        checkoutBtn.disabled = true;
        checkoutBtn.innerText = "Build Min 3 Items & K249 Combo to Order";
    }
}

async function handleCheckout(event) {
    event.preventDefault();
    
    const totalCount = cart.length;
    const totalPrice = cart.reduce((sum, item) => sum + parseFloat(item.price), 0);

    if (totalCount < 3 || totalPrice < 249.00) {
        alert("Combo requirements not met! Select at least 3 items with a total of K249 or more.");
        return;
    }

    const selectedOffice = document.getElementById("workplace-select").value;
    const contactPhone = document.getElementById("customer-phone").value;

    const { data, error } = await db.from('orders').insert([{
        customer_phone: contactPhone,
        delivery_location: selectedOffice,
        total_amount: totalPrice,
        order_items_json: cart,
        status: 'Pending Aggregation'
    }]);

    if (error) {
        alert("Error placing order: " + error.message);
    } else {
        alert("Zikomo! Combo order submitted successfully.");
        cart = [];
        updateCartUI();
    }
}

// Initialize Supabase Client
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const products = [
    { id: "p1", name: "Month-End Family Pack", price: 450.00, desc: "10kg Mealie Meal + 2L Oil + 2kg Sugar" },
    { id: "p2", name: "Office Tea Break Pack", price: 180.00, desc: "Lipton Tea 100s + White Sugar 1kg" }
];

let cart = [];

window.onload = function() {
    renderProducts();
};

function renderProducts() {
    const container = document.getElementById("product-list");
    container.innerHTML = products.map(p => `
        <div class="product-card">
            <h4>${p.name}</h4>
            <p><small>${p.desc}</small></p>
            <p><strong>K ${p.price.toFixed(2)}</strong></p>
            <button onclick="addToCart('${p.id}')" style="background:#0baf65;color:white;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;">+ Add</button>
        </div>
    `).join('');
}

function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    cart.push(product);
    updateCartUI();
}

function updateCartUI() {
    const list = document.getElementById("cart-items");
    list.innerHTML = cart.map(item => `<li>${item.name} - K ${item.price}</li>`).join('');
    
    const total = cart.reduce((sum, item) => sum + item.price, 0);
    document.getElementById("cart-total").innerText = total.toFixed(2);
}

async function handleCheckout(event) {
    event.preventDefault();
    if (cart.length === 0) return alert("Your basket is empty!");

    const selectedOffice = document.getElementById("workplace-select").value;
    const contactPhone = document.getElementById("customer-phone").value;
    const totalAmount = cart.reduce((sum, item) => sum + item.price, 0);

    // INSERT ORDER DIRECTLY INTO SUPABASE
    const { data, error } = await db
        .from('orders')
        .insert([
            {
                customer_phone: contactPhone,
                delivery_location: selectedOffice,
                total_amount: totalAmount,
                order_items_json: cart,
                status: 'Pending Aggregation'
            }
        ]);

    if (error) {
        console.error("Supabase Error:", error);
        alert("Error placing order: " + error.message);
    } else {
        alert("Zikomo! Order placed successfully. Our runner will call you on delivery day outside your building.");
        cart = [];
        updateCartUI();
    }
}
