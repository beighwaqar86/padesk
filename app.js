// YOUR LIVE SUPABASE KEYS
const SUPABASE_URL = "https://cziefuaclocpwicwjprb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_j_MkiOlGUZOBsR8TSxIM1w_pnQ_B1xx";

let db;
let cart = [];

window.onload = function() {
    // Initialize Supabase after the library loads fully
    db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    loadProductMaster();
};

async function loadProductMaster() {
    const { data: products, error } = await db
        .from('products')
        .select('*');

    if (error) {
        console.error("Error fetching products:", error);
        document.getElementById("product-list").innerText = "Error: " + error.message;
        return;
    }

    if (!products || products.length === 0) {
        document.getElementById("product-list").innerText = "No active products found in database.";
        return;
    }

    renderProducts(products);
}

function renderProducts(products) {
    const container = document.getElementById("product-list");
    container.innerHTML = products.map(p => `
        <div class="product-card">
            <img src="${p.image_url || 'https://via.placeholder.com/150'}" alt="${p.name}" style="width:100%; height:120px; object-fit:cover; border-radius:6px;">
            <h4>${p.name}</h4>
            <p><small>${p.description || ''}</small></p>
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
        alert("Combo requirements not met!");
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
