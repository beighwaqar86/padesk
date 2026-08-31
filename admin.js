const SUPABASE_URL = "https://cziefuaclocpwicwjprb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_j_MkiOlGUZOBsR8TSxIM1w_pnQ_B1xx";
let db;

window.onload = function() {
    db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    fetchAdminProducts();
};

// TAB SWITCHING ENGINE
function switchAdminTab(tabName) {
    document.querySelectorAll('.admin-tab-content').forEach(el => el.style.display = 'none');
    ['products', 'banners', 'fulfillment'].forEach(t => {
        const btn = document.getElementById(`tab-btn-${t}`);
        if (btn) {
            btn.style.background = t === tabName ? '#0baf65' : '#edf2f7';
            btn.style.color = t === tabName ? 'white' : '#4a5568';
        }
    });

    const activeTab = document.getElementById(`admin-tab-${tabName}`);
    if (activeTab) activeTab.style.display = 'block';

    if (tabName === 'fulfillment') {
        loadOrderFulfillmentHub();
    } else if (tabName === 'products') {
        fetchAdminProducts();
    }
}

// 📦 PRODUCTS MASTER MANAGEMENT
async function fetchAdminProducts() {
    const { data: products } = await db.from('products').select('*').order('id', { ascending: false });
    const tbody = document.getElementById("admin-product-rows");
    
    if (!tbody) return;

    tbody.innerHTML = (products || []).map(p => `
        <tr>
            <td><strong>${p.product_code || '-'}</strong></td>
            <td>${p.name}</td>
            <td>K ${parseFloat(p.price).toFixed(2)} ${p.deal_price ? `<br><small style="color:green">Deal: K${parseFloat(p.deal_price).toFixed(2)}</small>` : ''}</td>
            <td>${p.category || '-'} ➔ ${p.sub_category || '-'}</td>
            <td>${p.brand || '-'}</td>
            <td>${p.source || '-'}</td>
            <td>
                <button onclick='deleteProduct(${p.id})' style="color:red; background:none; border:none; cursor:pointer;">🗑️ Delete</button>
            </td>
        </tr>
    `).join('');
}

async function saveProduct(event) {
    event.preventDefault();
    const payload = {
        product_code: document.getElementById("prod-code").value,
        name: document.getElementById("prod-name").value,
        price: parseFloat(document.getElementById("prod-price").value),
        deal_price: document.getElementById("prod-deal-price").value ? parseFloat(document.getElementById("prod-deal-price").value) : null,
        category: document.getElementById("prod-category").value,
        sub_category: document.getElementById("prod-subcategory").value,
        brand: document.getElementById("prod-brand").value,
        source: document.getElementById("prod-source").value,
        image_url: document.getElementById("prod-image").value
    };

    const { error } = await db.from('products').insert([payload]);
    if (error) {
        alert("Error saving product: " + error.message);
    } else {
        alert("Product saved successfully!");
        document.getElementById("product-form").reset();
        fetchAdminProducts();
    }
}

async function deleteProduct(id) {
    if (confirm("Delete this product from master?")) {
        await db.from('products').delete().eq('id', id);
        fetchAdminProducts();
    }
}

// 🚚 ORDER FULFILLMENT HUB LOADER
async function loadOrderFulfillmentHub() {
    const { data: orders, error } = await db
        .from('orders')
        .select('*')
        .order('id', { ascending: false });

    const container = document.getElementById("fulfillment-orders-list");
    if (!container) return;

    if (error || !orders || orders.length === 0) {
        container.innerHTML = `<tr><td colspan="6" style="padding: 20px; text-align: center; color: #718096;">No orders found.</td></tr>`;
        return;
    }

    container.innerHTML = orders.map(o => {
        const orderDate = o.created_at ? new Date(o.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
        const orderNum = o.order_number || (`#ORD-${o.id}`);
        const customerTitle = o.customer_title || '';
        const customerName = `${customerTitle} ${o.customer_first_name || ''} ${o.customer_last_name || ''}`.trim() || o.customer_phone || 'Valued Shopper';
        const items = o.order_items_json || [];

        return `
            <tr style="border-bottom: 1px solid #edf2f7; background: #fff;">
                <td style="padding: 12px; font-weight: bold; color: #2d3748;">#${o.id}</td>
                <td style="padding: 12px; color: #4a5568; white-space: nowrap;">${orderDate}</td>
                <td style="padding: 12px;">
                    <button type="button" onclick="toggleOrderDetails(${o.id})" style="background: #ebf8ff; color: #2b6cb0; border: 1px solid #bee3f8; padding: 4px 8px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 0.8rem;">
                        📋 ${orderNum} ▾
                    </button>
                </td>
                <td style="padding: 12px;">
                    <strong>${customerName}</strong><br>
                    <small style="color: #718096;">📱 ${o.customer_phone || '-'}</small><br>
                    <small style="color: #e53e3e;">📍 ${o.delivery_location || '-'}</small>
                </td>
                <td style="padding: 12px;">
                    <strong style="color: #0baf65;">K ${parseFloat(o.total_amount).toFixed(2)}</strong><br>
                    <small style="color: #4a5568;">${o.payment_method || 'CoD'} (${o.payment_status || 'Pending'})</small>
                </td>
                <td style="padding: 12px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <select id="status-${o.id}" class="form-input" style="padding: 6px; font-size: 0.8rem; border-radius: 6px; border: 1px solid #cbd5e0;">
                            <option value="Order Placed" ${o.fulfillment_status === 'Order Placed' ? 'selected' : ''}>Order Placed</option>
                            <option value="Processing" ${o.fulfillment_status === 'Processing' ? 'selected' : ''}>Processing</option>
                            <option value="Out for Delivery" ${o.fulfillment_status === 'Out for Delivery' ? 'selected' : ''}>Out for Delivery</option>
                            <option value="Delivered" ${o.fulfillment_status === 'Delivered' ? 'selected' : ''}>Delivered</option>
                            <option value="Cancelled" ${o.fulfillment_status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                        </select>
                        <button type="button" onclick="updateOrderStatus(${o.id})" style="background: #0baf65; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 0.8rem;">
                            Save
                        </button>
                    </div>
                </td>
            </tr>
            <!-- Collapsible Details Row -->
            <tr id="details-row-${o.id}" style="display: none; background: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                <td colspan="6" style="padding: 16px;">
                    <div style="background: white; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; max-width: 700px;">
                        <h4 style="margin: 0 0 8px 0; font-size: 0.85rem; color: #2d3748;">📦 Order Breakdown (${items.length} items)</h4>
                        <table style="width: 100%; font-size: 0.8rem; border-collapse: collapse;">
                            <thead>
                                <tr style="border-bottom: 1px solid #edf2f7; text-align: left; color: #718096;">
                                    <th style="padding: 4px;">Product Name</th>
                                    <th style="padding: 4px;">Code</th>
                                    <th style="padding: 4px; text-align: center;">Qty</th>
                                    <th style="padding: 4px; text-align: right;">Unit Price</th>
                                    <th style="padding: 4px; text-align: right;">Total Value</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${items.map(item => {
                                    const p = item.product || {};
                                    const price = parseFloat(p.deal_price || p.price || 0);
                                    const totalVal = price * (item.qty || 1);
                                    return `
                                        <tr style="border-bottom: 1px solid #f7fafc;">
                                            <td style="padding: 6px 4px; font-weight: 600;">${p.name || 'Item'}</td>
                                            <td style="padding: 6px 4px; color: #718096;">${p.product_code || '-'}</td>
                                            <td style="padding: 6px 4px; text-align: center;">${item.qty || 1}</td>
                                            <td style="padding: 6px 4px; text-align: right;">K ${price.toFixed(2)}</td>
                                            <td style="padding: 6px 4px; text-align: right; font-weight: bold; color: #0baf65;">K ${totalVal.toFixed(2)}</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Toggle expansion of order item details
function toggleOrderDetails(orderId) {
    const row = document.getElementById(`details-row-${orderId}`);
    if (row) {
        row.style.display = row.style.display === 'none' ? 'table-row' : 'none';
    }
}

// Save fulfillment status back to Supabase
async function updateOrderStatus(orderId) {
    const selectEl = document.getElementById(`status-${orderId}`);
    if (!selectEl) return;

    const newStatus = selectEl.value;

    const { error } = await db
        .from('orders')
        .update({ fulfillment_status: newStatus })
        .eq('id', orderId);

    if (error) {
        alert("Failed to update status: " + error.message);
    } else {
        alert(`Order #${orderId} fulfillment status updated to "${newStatus}" successfully!`);
        loadOrderFulfillmentHub();
    }
}
