// YOUR LIVE SUPABASE KEYS
const SUPABASE_URL = "https://cziefuaclocpwicwjprb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_j_MkIO..."; // Paste your full publishable key from your screenshot

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
