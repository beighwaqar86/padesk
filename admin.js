const SUPABASE_URL = "https://cziefuaclocpwicwjprb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_j_MkiOlGUZOBsR8TSxIM1w_pnQ_B1xx";
let db;

window.onload = function() {
    db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    loadAdminProducts();
    loadAdminBanners();
    loadAdminOrders();
    loadPurchaseProductDropdown();
    loadStockHoldings(); // Added initial call
};

function switchAdminTab(tabName) {
    document.querySelectorAll('.admin-tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('[id^="tab-btn-"]').forEach(btn => {
        btn.style.background = '#edf2f7';
        btn.style.color = '#4a5568';
    });

    const targetTab = document.getElementById(`admin-tab-${tabName}`);
    const targetBtn = document.getElementById(`tab-btn-${tabName}`);

    if (targetTab) targetTab.style.display = 'block';
    if (targetBtn) {
        targetBtn.style.background = '#0baf65';
        targetBtn.style.color = 'white';
    }

    if (tabName === 'purchases') {
        loadPurchaseProductDropdown();
    }
    if (tabName === 'stock') {
        loadStockHoldings(); // Refresh stock holdings when clicking the tab
    }
}

async function loadStockHoldings() {
    const tbody = document.getElementById("admin-stock-holdings-table");
    if (!tbody) return;

    try {
        const { data: products, error } = await db.from('products').select('*').order('name');
        if (error) throw error;

        if (!products || products.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="padding: 15px; text-align: center;">No products found in inventory.</td></tr>';
            return;
        }

        let totalInventoryCapital = 0;

        tbody.innerHTML = products.map(p => {
            const qty = p.stock_qty || 0;
            const unitCost = parseFloat(p.cost_price || 0);
            const totalVal = qty * unitCost;
            totalInventoryCapital += totalVal;

            const stockBadgeStyle = qty <= 0 
                ? 'background: #fed7d7; color: #c53030; padding: 2px 8px; border-radius: 4px; font-weight: bold;'
                : 'background: #e6f7f0; color: #0baf65; padding: 2px 8px; border-radius: 4px; font-weight: bold;';

            return `
                <tr style="border-bottom: 1px solid #edf2f7;">
                    <td style="padding: 10px; color: #4a5568;">${p.product_code || '-'}</td>
                    <td style="padding: 10px; font-weight: 600;">${p.name}</td>
                    <td style="padding: 10px; text-align: center;"><span style="${stockBadgeStyle}">${qty} units</span></td>
                    <td style="padding: 10px; text-align: right;">K ${unitCost.toFixed(2)}</td>
                    <td style="padding: 10px; text-align: right; font-weight: bold;">K ${totalVal.toFixed(2)}</td>
                </tr>
            `;
        }).join('') + `
            <tr style="background: #f8fafc; font-weight: bold; border-top: 2px solid #cbd5e0;">
                <td colspan="4" style="padding: 12px; text-align: right;">Total Inventory Asset Value:</td>
                <td style="padding: 12px; text-align: right; color: #0baf65;">K ${totalInventoryCapital.toFixed(2)}</td>
            </tr>
        `;
    } catch (err) {
        console.error("Error loading stock holdings:", err);
        tbody.innerHTML = `<tr><td colspan="5" style="padding: 15px; text-align: center; color: red;">Failed to load stock data: ${err.message}</td></tr>`;
    }
}

    const targetTab = document.getElementById(`admin-tab-${tabName}`);
    const targetBtn = document.getElementById(`tab-btn-${tabName}`);

    if (targetTab) targetTab.style.display = 'block';
    if (targetBtn) {
        targetBtn.style.background = '#0baf65';
        targetBtn.style.color = 'white';
    }

    // Refresh product list for purchases when switching to the tab
    if (tabName === 'purchases') {
        loadPurchaseProductDropdown();
    }
}

// --- PRODUCTS CRUD ---
async function loadAdminProducts() {
    const { data } = await db.from('products').select('*').order('id', { ascending: false });
    const tbody = document.getElementById("admin-product-table");
    if (!data || !tbody) return;
    tbody.innerHTML = data.map(p => `
        <tr style="border-bottom:1px solid #edf2f7;">
            <td style="padding:8px;">${p.product_code || '-'}</td>
            <td style="padding:8px;"><strong>${p.name}</strong></td>
            <td style="padding:8px;"><span style="background:#e6f7f0; color:#0baf65; padding:2px 6px; border-radius:4px; font-size:0.7rem; font-weight:bold;">${p.business || ''}</span> / ${p.category}</td>
            <td style="padding:8px;">K ${parseFloat(p.deal_price || p.price).toFixed(2)}</td>
            <td style="padding:8px; text-align:center;">
                <button onclick='editProduct(${JSON.stringify(p)})' style="background:#3182ce; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">Edit</button>
                <button onclick="deleteProduct(${p.id})" style="background:#e53e3e; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">Del</button>
            </td>
        </tr>
    `).join('');
}

async function deleteProduct(id) {
    if (!confirm("Delete product?")) return;
    await db.from('products').delete().eq('id', id);
    loadAdminProducts();
    loadPurchaseProductDropdown();
}

// --- PURCHASES MODULE ---
async function loadPurchaseProductDropdown() {
    const selectEl = document.getElementById("purchase-product-select");
    if (!selectEl) return;

    try {
        const { data: products, error } = await db.from('products').select('id, name, product_code, cost_price').order('name');
        if (error) throw error;

        selectEl.innerHTML = '<option value="">-- Choose Product --</option>' + (products || []).map(p => `
            <option value="${p.id}">${p.name} (Code: ${p.product_code || '-'} | Current Cost: K ${parseFloat(p.cost_price || 0).toFixed(2)})</option>
        `).join('');
    } catch (err) {
        console.error("Error loading product dropdown:", err);
    }
}

async function recordPurchase(event) {
    event.preventDefault();
    
    const productId = document.getElementById("purchase-product-select").value;
    const qty = parseInt(document.getElementById("purchase-qty").value);
    const unitCost = parseFloat(document.getElementById("purchase-unit-cost").value);
    const supplier = document.getElementById("purchase-supplier").value.trim();
    const invoiceRef = document.getElementById("purchase-invoice").value.trim();

    if (!productId || !qty || !unitCost || !supplier) {
        return alert("Please fill in all required purchase details.");
    }

    try {
        const { data: prod, error: fetchErr } = await db.from('products').select('*').eq('id', productId).single();
        if (fetchErr) throw fetchErr;

        const currentSellingPrice = parseFloat(prod.deal_price || prod.price);
        
        if (unitCost > currentSellingPrice) {
            const confirmOverride = confirm(`⚠️ FINANCIAL ALERT: Purchase unit cost (K ${unitCost.toFixed(2)}) is HIGHER than the current selling price (K ${currentSellingPrice.toFixed(2)})! This will result in an immediate loss. Do you still want to proceed?`);
            if (!confirmOverride) return;
        }

        const { error: purchaseErr } = await db.from('purchases').insert([{
            supplier_name: supplier,
            invoice_ref: invoiceRef,
            product_id: parseInt(productId),
            qty_received: qty,
            purchase_unit_cost: unitCost,
            recorded_by: 'Admin'
        }]);
        if (purchaseErr) throw purchaseErr;

        const newStock = (prod.stock_qty || 0) + qty;
        const { error: updateErr } = await db.from('products').update({
            stock_qty: newStock,
            cost_price: unitCost
        }).eq('id', productId);

        if (updateErr) throw updateErr;

        alert("✅ Purchase recorded successfully! Stock and acquisition cost updated.");
        document.getElementById("purchase-form").reset();
        loadAdminProducts();
        loadPurchaseProductDropdown();

    } catch (err) {
        console.error("Purchase error:", err);
        alert("Failed to record purchase: " + err.message);
    }
}

// --- BANNERS CRUD ---
async function loadAdminBanners() {
    const { data } = await db.from('banners').select('*').order('id', { ascending: false });
    const container = document.getElementById("admin-banners-list");
    if (!data || !container) return;
    container.innerHTML = data.map(b => `
        <div style="border:1px solid #e2e8f0; padding:10px; border-radius:8px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
            <div>
                <strong>${b.title}</strong><br><small>${b.subtitle || ''}</small>
            </div>
            <button onclick="deleteBanner(${b.id})" style="background:#e53e3e; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">Delete</button>
        </div>
    `).join('');
}

async function deleteBanner(id) {
    await db.from('banners').delete().eq('id', id);
    loadAdminBanners();
}

// --- FULFILLMENT ORDERS ---
async function loadAdminOrders() {
    const { data: orders } = await db.from('orders').select('*').order('id', { ascending: false });
    const { data: customers } = await db.from('customers').select('*');
    
    const customerMap = {};
    if (customers) {
        customers.forEach(c => { customerMap[c.phone_number] = c; });
    }

    const tbody = document.getElementById("admin-orders-table");
    if (!orders || !tbody) return;

    tbody.innerHTML = orders.map(o => {
        const orderDate = o.created_at ? new Date(o.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
        const orderNum = o.order_number || (`#ORD-${o.id}`);
        
        const cust = customerMap[o.customer_phone] || {};
        const title = cust.title || '';
        const firstName = cust.first_name || '';
        const lastName = cust.last_name || '';
        const customerName = `${title} ${firstName} ${lastName}`.trim() || 'Valued Shopper';
        
        const items = o.order_items_json || [];

        return `
            <tr style="border-bottom:1px solid #edf2f7; background: #fff;">
                <td style="padding:10px; font-weight: bold; color: #2d3748;">#${o.id}</td>
                <td style="padding:10px; color: #4a5568; white-space: nowrap;">${orderDate}</td>
                <td style="padding:10px;">
                    <button type="button" onclick="toggleOrderDetails(${o.id})" style="background: #ebf8ff; color: #2b6cb0; border: 1px solid #bee3f8; padding: 4px 8px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 0.8rem;">
                        📋 ${orderNum} ▾
                    </button>
                </td>
                <td style="padding:10px;">
                    <strong>${customerName}</strong><br>
                    <small style="color: #718096;">📱 ${o.customer_phone || '-'}</small><br>
                    <small style="color: #e53e3e;">📍 ${o.delivery_location || '-'}</small>
                </td>
                <td style="padding:10px;">
                    <strong style="color: #0baf65;">K ${parseFloat(o.total_amount).toFixed(2)}</strong><br>
                    <small style="color: #4a5568;">${o.payment_method || 'Mobile Money'} (${o.payment_status || 'Pending'})</small>
                </td>
                <td style="padding:10px;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <select id="status-${o.id}" style="padding: 4px; font-size: 0.75rem;">
                            <option value="Order Placed" ${o.fulfillment_status === 'Order Placed' ? 'selected' : ''}>Order Placed</option>
                            <option value="Aggregating" ${o.fulfillment_status === 'Aggregating' ? 'selected' : ''}>Aggregating</option>
                            <option value="Dispatched" ${o.fulfillment_status === 'Dispatched' ? 'selected' : ''}>Dispatched</option>
                            <option value="Delivered" ${o.fulfillment_status === 'Delivered' ? 'selected' : ''}>Delivered</option>
                            <option value="Cancelled" ${o.fulfillment_status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                        </select>
                        <button type="button" onclick="updateFulfillmentStatus(${o.id})" style="background: #0baf65; color: white; border: none; padding: 5px 10px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 0.75rem;">
                            Save
                        </button>
                    </div>
                </td>
            </tr>
            <tr id="details-row-${o.id}" style="display: none; background: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                <td colspan="6" style="padding: 14px; text-align: center;">
                    <div style="background: white; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; max-width: 650px; margin: 0 auto; text-align: left;">
                        <h4 style="margin: 0 0 8px 0; font-size: 0.82rem; color: #2d3748;">📦 Order Breakdown (${items.length} items)</h4>
                        <table style="width: 100%; font-size: 0.78rem; border-collapse: collapse;">
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
                                            <td style="padding: 5px 4px; font-weight: 600;">${p.name || 'Item'}</td>
                                            <td style="padding: 5px 4px; color: #718096;">${p.product_code || '-'}</td>
                                            <td style="padding: 5px 4px; text-align: center;">${item.qty || 1}</td>
                                            <td style="padding: 5px 4px; text-align: right;">K ${price.toFixed(2)}</td>
                                            <td style="padding: 5px 4px; text-align: right; font-weight: bold; color: #0baf65;">K ${totalVal.toFixed(2)}</td>
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

function toggleOrderDetails(orderId) {
    const row = document.getElementById(`details-row-${orderId}`);
    if (row) {
        row.style.display = row.style.display === 'none' ? 'table-row' : 'none';
    }
}

async function updateFulfillmentStatus(orderId) {
    const selectEl = document.getElementById(`status-${orderId}`);
    if (!selectEl) return;

    const newStatus = selectEl.value;
    
    const { data, error } = await db
        .from('orders')
        .update({ fulfillment_status: newStatus })
        .eq('id', orderId)
        .select();
    
    if (error) {
        alert("Database Error: " + error.message);
    } else if (!data || data.length === 0) {
        alert("Update blocked! Check your Supabase RLS policies for the 'orders' table.");
    } else {
        alert(`Order #${orderId} fulfillment status updated to "${newStatus}" successfully!`);
        loadAdminOrders();
    }
}
