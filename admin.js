const SUPABASE_URL = "https://cziefuaclocpwicwjprb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_j_MkiOlGUZOBsR8TSxIM1w_pnQ_B1xx";
let db;

window.onload = function() {
    try {
        db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        loadAdminProducts();
        loadAdminBanners();
        loadAdminOrders();
        loadPurchaseProductDropdown();
        loadStockHoldings();
        loadPurchasesHistory();
        
        // Default invoice date to today
        const invDateInput = document.getElementById("purchase-invoice-date");
        if (invDateInput) {
            invDateInput.value = new Date().toISOString().split('T')[0];
        }
    } catch (err) {
        console.error("Initialization error:", err);
    }
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
        loadPurchasesHistory();
    }
    if (tabName === 'stock') {
        loadStockHoldings();
    }
}

// --- PRODUCTS CRUD ---
async function loadAdminProducts() {
    const tbody = document.getElementById("admin-product-table");
    if (!tbody) return;

    try {
        const { data, error } = await db.from('products').select('*').order('id', { ascending: false });
        if (error) throw error;

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="padding: 20px; text-align: center;">No products found.</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(p => {
            const encodedProduct = encodeURIComponent(JSON.stringify(p));
            return `
                <tr style="border-bottom:1px solid #edf2f7;">
                    <td style="padding:8px;">${p.product_code || '-'}</td>
                    <td style="padding:8px;"><strong>${p.name}</strong></td>
                    <td style="padding:8px;"><span style="background:#e6f7f0; color:#0baf65; padding:2px 6px; border-radius:4px; font-size:0.7rem; font-weight:bold;">${p.business || ''}</span> / ${p.category}</td>
                    <td style="padding:8px;">K ${parseFloat(p.deal_price || p.price).toFixed(2)}</td>
                    <td style="padding:8px; text-align:center;">
                        <button type="button" onclick='editProductFromEncoded("${encodedProduct}")' style="background:#3182ce; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">Edit</button>
                        <button type="button" onclick="deleteProduct(${p.id})" style="background:#e53e3e; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">Del</button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error("Error loading products:", err);
        tbody.innerHTML = '<tr><td colspan="5" style="padding: 20px; text-align: center; color: red;">Failed to load products.</td></tr>';
    }
}

// Helper function to safely decode and edit product without syntax crashes
function editProductFromEncoded(encodedStr) {
    try {
        const p = JSON.parse(decodeURIComponent(encodedStr));
        editProduct(p);
    } catch (e) {
        console.error("Error decoding product:", e);
    }
}

// Two-Way Smart Pricing Calculator
function calculatePricing(source) {
    const costInput = document.getElementById("p-cost-price");
    const markupInput = document.getElementById("p-markup");
    const priceInput = document.getElementById("p-price");

    if (!costInput || !markupInput || !priceInput) return;

    let cost = parseFloat(costInput.value) || 0;
    let markup = parseFloat(markupInput.value) || 0;
    let price = parseFloat(priceInput.value) || 0;

    if (cost <= 0) return; // Need a cost base to calculate margins

    if (source === 'markup' || source === 'cost') {
        // Forward Calc: User changes Markup or Cost -> Calculate Selling Price
        price = cost + (cost * (markup / 100));
        priceInput.value = price.toFixed(2);
    } else if (source === 'price') {
        // Reverse Calc: User manually types Selling Price -> Calculate Markup
        markup = ((price - cost) / cost) * 100;
        markupInput.value = markup.toFixed(2);
    }
}

async function saveProduct(e) {
    e.preventDefault();
    const id = document.getElementById("product-id").value;
    const payload = {
        name: document.getElementById("p-name").value.trim(),
        product_code: document.getElementById("p-code").value.trim() || null,
        business: document.getElementById("p-business").value,
        category: document.getElementById("p-category").value.trim(),
        sub_category: document.getElementById("p-subcategory").value.trim() || null,
        cost_price: parseFloat(document.getElementById("p-cost-price").value) || 0,
        target_margin_pct: parseFloat(document.getElementById("p-markup").value) || 0,
        price: parseFloat(document.getElementById("p-price").value),
        deal_price: document.getElementById("p-deal-price").value ? parseFloat(document.getElementById("p-deal-price").value) : null,
        brand: document.getElementById("p-brand").value.trim() || null,
        image_url: document.getElementById("p-image").value.trim() || null,
        sell_oos: document.getElementById("p-sell-oos").value,
        is_active: document.getElementById("p-active").checked
    };
    
    // Safety check: Don't sell below cost
    if (payload.price < payload.cost_price) {
        if (!confirm("⚠️ WARNING: Selling price is below Cost Price. Are you sure you want to save?")) return;
    }

    const query = id ? db.from('products').update(payload).eq('id', id) : db.from('products').insert([payload]);
    const { error } = await query;
    if (error) {
        alert("Error: " + error.message);
    } else {
        alert(id ? "Product updated successfully!" : "Product created! Navigate to 'Stock Purchase' to receive initial inventory.");
        resetProductForm();
        loadAdminProducts();
        loadStockHoldings();
        loadPurchaseProductDropdown();
    }
}

function editProduct(p) {
    document.getElementById("product-id").value = p.id;
    document.getElementById("p-name").value = p.name;
    document.getElementById("p-code").value = p.product_code || '';
    document.getElementById("p-business").value = p.business || '';
    document.getElementById("p-category").value = p.category || '';
    document.getElementById("p-subcategory").value = p.sub_category || '';
    
    // Pricing Module Mapping and Locking
    const costInput = document.getElementById("p-cost-price");
    if (costInput) {
        costInput.value = p.cost_price || 0;
        costInput.readOnly = true; // Lock cost price on edit
        costInput.style.background = "#edf2f7"; // Visually indicate it's locked
    }
    
    const markupInput = document.getElementById("p-markup");
    if (markupInput) markupInput.value = p.target_margin_pct || 0;

    document.getElementById("p-price").value = p.price;
    document.getElementById("p-deal-price").value = p.deal_price || '';
    
    document.getElementById("p-brand").value = p.brand || '';
    document.getElementById("p-image").value = p.image_url || '';
    document.getElementById("p-sell-oos").value = p.sell_oos || 'N';
    document.getElementById("p-active").checked = p.is_active;
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteProduct(id) {
    if (!confirm("Delete product?")) return;
    await db.from('products').delete().eq('id', id);
    loadAdminProducts();
    loadStockHoldings();
    loadPurchaseProductDropdown();
}

function resetProductForm() {
    document.getElementById("admin-product-form").reset();
    document.getElementById("product-id").value = "";
    
    // Unlock cost price for new product entry
    const costInput = document.getElementById("p-cost-price");
    if (costInput) {
        costInput.readOnly = false;
        costInput.style.background = "#ffffff";
    }
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
    const invoiceDate = document.getElementById("purchase-invoice-date").value;

    if (!productId || !qty || !unitCost || !supplier || !invoiceDate) {
        return alert("Please fill in all required purchase details including invoice date.");
    }

    try {
        const { data: prod, error: fetchErr } = await db.from('products').select('*').eq('id', productId).single();
        if (fetchErr) throw fetchErr;

        const currentSellingPrice = parseFloat(prod.deal_price || prod.price);
        
        if (unitCost > currentSellingPrice) {
            const confirmOverride = confirm(`⚠️ FINANCIAL ALERT: Purchase unit cost (K ${unitCost.toFixed(2)}) is HIGHER than current selling price (K ${currentSellingPrice.toFixed(2)})! Proceed?`);
            if (!confirmOverride) return;
        }

        const dParts = invoiceDate.split('-');
        const dateStr = `${dParts[2]}${dParts[1]}${dParts[0]}`;
        
        const { count } = await db.from('purchases').select('*', { count: 'exact', head: true }).eq('invoice_date', invoiceDate);
        const seqNum = String((count || 0) + 1).padStart(2, '0');
        const poCode = `PO${dateStr}${seqNum}`;

        const { error: purchaseErr } = await db.from('purchases').insert([{
            po_code: poCode,
            supplier_name: supplier,
            invoice_ref: invoiceRef,
            invoice_date: invoiceDate,
            purchase_date: invoiceDate,
            product_id: parseInt(productId),
            qty_received: qty,
            purchase_unit_cost: unitCost,
            recorded_by: 'Admin'
        }]);
        if (purchaseErr) throw purchaseErr;

        const newStock = (prod.stock_qty || 0) + qty;
        
        // Auto-recalculate target margin based on new unit cost and existing price
        const currentPrice = parseFloat(prod.price || 0);
        let newMarginPct = prod.target_margin_pct || 0;
        
        if (unitCost > 0) {
            newMarginPct = ((currentPrice - unitCost) / unitCost) * 100;
        }

        const { error: updateErr } = await db.from('products').update({
            stock_qty: newStock,
            cost_price: unitCost,
            target_margin_pct: newMarginPct
        }).eq('id', productId);

        if (updateErr) throw updateErr;

        alert(`✅ Stock purchase recorded successfully! PO Code: ${poCode}`);
        document.getElementById("purchase-form").reset();
        document.getElementById("purchase-invoice-date").value = new Date().toISOString().split('T')[0];
        
        loadAdminProducts();
        loadStockHoldings();
        loadPurchasesHistory();
        loadPurchaseProductDropdown();

    } catch (err) {
        console.error("Purchase error:", err);
        alert("Failed to record purchase: " + err.message);
    }
}

async function loadPurchasesHistory() {
    const tbody = document.getElementById("admin-purchases-history-table");
    if (!tbody) return;

    try {
        const { data: purchases, error } = await db.from('purchases').select('*, products(name, product_code)').order('id', { ascending: false });
        if (error) throw error;

        if (!purchases || purchases.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="padding: 15px; text-align: center; color: #718096;">No purchase orders recorded yet.</td></tr>';
            return;
        }

        tbody.innerHTML = purchases.map(p => {
            const poCode = p.po_code || '-';
            
            // STRICTLY fetch invoice_date from DB only. Do NOT fallback to purchase_date or current date.
            const invDate = p.invoice_date || '-';
            const invRef = p.invoice_ref || '-';

            const prodName = p.products ? p.products.name : 'Unknown Product';
            const totalCost = (p.qty_received || 0) * parseFloat(p.purchase_unit_cost || 0);

            return `
                <tr style="border-bottom: 1px solid #edf2f7;">
                    <td style="padding: 9px; font-weight: bold; color: #2b6cb0;">${poCode}</td>
                    <td style="padding: 9px; color: #4a5568; white-space: nowrap;">${invDate}</td>
                    <td style="padding: 9px; color: #4a5568; font-weight: 500;">${invRef}</td>
                    <td style="padding: 9px;">${p.supplier_name || '-'}</td>
                    <td style="padding: 9px; font-weight: 600;">${prodName}</td>
                    <td style="padding: 9px; text-align: center;">${p.qty_received || 0}</td>
                    <td style="padding: 9px; text-align: right;">K ${parseFloat(p.purchase_unit_cost || 0).toFixed(2)}</td>
                    <td style="padding: 9px; text-align: right; font-weight: bold; color: #0baf65;">K ${totalCost.toFixed(2)}</td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error("Error loading purchases history:", err);
        tbody.innerHTML = `<tr><td colspan="8" style="padding: 15px; text-align: center; color: red;">Failed to load purchase history.</td></tr>`;
    }
}

// --- STOCK ON HAND ---
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
        tbody.innerHTML = `<tr><td colspan="5" style="padding: 15px; text-align: center; color: red;">Failed to load stock data.</td></tr>`;
    }
}

// --- BANNERS ---
async function loadAdminBanners() {
    const { data } = await db.from('banners').select('*').order('id', { ascending: false });
    const container = document.getElementById("admin-banners-list");
    if (!data || !container) return;
    container.innerHTML = data.map(b => `
        <div style="border:1px solid #e2e8f0; padding:10px; border-radius:8px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
            <div>
                <strong>${b.title}</strong><br><small>${b.subtitle || ''}</small>
            </div>
            <button type="button" onclick="deleteBanner(${b.id})" style="background:#e53e3e; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">Delete</button>
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
        const customerName = `${cust.title || ''} ${cust.first_name || ''} ${cust.last_name || ''}`.trim() || 'Valued Shopper';
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
