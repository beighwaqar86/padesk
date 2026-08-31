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

        tbody.innerHTML = data.map(p => `
            <tr style="border-bottom:1px solid #edf2f7;">
                <td style="padding:8px;">${p.product_code || '-'}</td>
                <td style="padding:8px;"><strong>${p.name}</strong></td>
                <td style="padding:8px;"><span style="background:#e6f7f0; color:#0baf65; padding:2px 6px; border-radius:4px; font-size:0.7rem; font-weight:bold;">${p.business \vert{}\vert{} ''}</span> /${p.category}</td>
                <td style="padding:8px;">K ${parseFloat(p.deal_price || p.price).toFixed(2)}</td>
                <td style="padding:8px; text-align:center;">
                    <button type="button" onclick='editProduct(${JSON.stringify(p)})' style="background:#3182ce; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">Edit</button>
                    <button type="button" onclick="deleteProduct(${p.id})" style="background:#e53e3e; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">Del</button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        console.error("Error loading products:", err);
        tbody.innerHTML = '<tr><td colspan="5" style="padding: 20px; text-align: center; color: red;">Failed to load products.</td></tr>';
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
        price: parseFloat(document.getElementById("p-price").value),
        deal_price: document.getElementById("p-deal-price").value ? parseFloat(document.getElementById("p-deal-price").value) : null,
        brand: document.getElementById("p-brand").value.trim() || null,
        image_url: document.getElementById("p-image").value.trim() || null,
        sell_oos: document.getElementById("p-sell-oos").value,
        is_active: document.getElementById("p-active").checked
    };
    
    const query = id ? db.from('products').update(payload).eq('id', id) : db.from('products').insert([payload]);
    const { error } = await query;
    if (error) {
        alert("Error: " + error.message);
    } else {
        alert("Product saved successfully!");
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
}

// --- PURCHASES MODULE ---
async function loadPurchaseProductDropdown() {
    const selectEl = document.getElementById("purchase-product-select");
    if (!selectEl) return;

    try {
        const { data: products, error } = await db.from('products').select('id, name, product_code, cost_price').order('name');
        if (error) throw error;

        selectEl.innerHTML = '<option value="">-- Choose Product --</option>' + (products || []).map(p => `
            <option value="${p.id}">${p.name} (Code: ${p.product_code \vert{}\vert{} '-'} \vert{} Current Cost: K${parseFloat(p.cost_price || 0).toFixed(2)})</option>
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
            const confirmOverride = confirm(`⚠️ FINANCIAL ALERT: Purchase unit cost (K ${unitCost.toFixed(2)}) is HIGHER than current selling price (K${currentSellingPrice.toFixed(2)})! Proceed?`);
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
        const { error: updateErr } = await db.from('products').update({
            stock_qty: newStock,
            cost_price: unitCost
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
            tbody.innerHTML = '<tr><td colspan="7" style="padding: 15px; text-align: center; color: #718096;">No purchase orders recorded yet.</td></tr>';
            return;
        }

        tbody.innerHTML = purchases.map(p => {
            let poCode = p.po_code;
            const invDate = p.invoice_date || p.purchase_date;

            if (!poCode) {
                const pDate = invDate ? new Date(invDate) : new Date(p.created_at || Date.now());
                const day = String(pDate.getDate()).padStart(2, '0');
                const month = String(pDate.getMonth() + 1).padStart(2, '0');
                const year = pDate.getFullYear();
                poCode = `PO${day}${month}${year}${String(p.id).padStart(2, '0')}`;
            }

            const prodName = p.products ? p.products.name : 'Unknown Product';
            const totalCost = p.qty_received * parseFloat(p.purchase_unit_cost);
            const formattedDate = invDate || (p.created_at ? p.created_at.split('T')[0] : '-');

            return `
                <tr style="border-bottom: 1px solid #edf2f7;">
                    <td style="padding: 9px; font-weight: bold; color: #2b6cb0;">${poCode}</td>
                    <td style="padding: 9px; color: #4a5568; white-space: nowrap;">${formattedDate}</td>
                    <td style="padding: 9px;">${p.supplier_name}</td>
                    <td style="padding: 9px; font-weight: 600;">${prodName}</td>
                    <td style="padding: 9px; text-align: center;">${p.qty_received}</td>
                    <td style="padding: 9px; text-align: right;">K ${parseFloat(p.purchase_unit_cost).toFixed(2)}</td>
                    <td style="padding: 9px; text-align: right; font-weight: bold; color: #0baf65;">K ${totalCost.toFixed(2)}</td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error("Error loading purchases history:", err);
        tbody.innerHTML = `<tr><td colspan="7" style="padding: 15px; text-align: center; color: red;">Failed to load purchase history.</td></tr>`;
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
                <td
