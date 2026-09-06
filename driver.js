const SUPABASE_URL = "https://cziefuaclocpwicwjprb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_j_MkiOlGUZOBsR8TSxIM1w_pnQ_B1xx";
let db;
let pendingOrders = [];

window.onload = function() {
    db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    loadDeliveries();
};

async function loadDeliveries() {
    const container = document.getElementById("orders-container");
    container.innerHTML = `<div class="empty-state"><div class="emoji">⏳</div>Loading deliveries...</div>`;

    try {
        const { data: orders, error } = await db
            .from('orders')
            .select('*')
            .not('fulfillment_status', 'in', '("Delivered","Cancelled")')
            .order('created_at', { ascending: true });
        if (error) throw error;

        pendingOrders = orders || [];
        document.getElementById("pending-count").innerText = pendingOrders.length;
        renderOrders();
        hydrateCustomerNames();
    } catch (err) {
        console.error("Error loading deliveries:", err);
        container.innerHTML = `<div class="empty-state">⚠️ Could not load deliveries.<br><small>${err.message}</small></div>`;
    }
}

function renderOrders() {
    const container = document.getElementById("orders-container");

    if (pendingOrders.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="emoji">🎉</div>All caught up — no deliveries pending.</div>`;
        return;
    }

    container.innerHTML = pendingOrders.map(o => {
        const items = o.order_items_json || [];
        const itemsHtml = items.map(item =>
            `<div><span>${item.qty}x ${item.product ? item.product.name : 'Item'}</span></div>`
        ).join('');

        return `
            <div class="order-card" id="order-card-${o.id}">
                <div class="order-card-top">
                    <span class="order-ref">${o.order_number || '#ORD-' + o.id}</span>
                    <span class="order-status">${o.fulfillment_status}</span>
                </div>

                <div class="customer-name" id="customer-name-${o.id}">${customerNameCache[o.customer_phone] || o.customer_phone}</div>
                <a class="customer-phone" href="tel:${o.customer_phone}">📞 ${o.customer_phone}</a>
                <div class="location-row">📍 ${o.delivery_location || '-'}</div>

                <div class="items-list">${itemsHtml}</div>

                <div class="due-row">
                    <div>
                        <div class="due-label">Amount Due</div>
                        <span class="payment-badge">${o.payment_method || 'Cash on Delivery'}</span>
                    </div>
                    <div class="due-amount">K ${parseFloat(o.total_amount || 0).toFixed(2)}</div>
                </div>

                <button class="btn-delivered" onclick="markDeliveredAndCollected(${o.id})">✅ Delivered & Collected</button>
                <button class="btn-issue" onclick="toggleIssuePanel(${o.id})">⚠️ Report Issue</button>

                <div class="issue-panel" id="issue-panel-${o.id}">
                    <p>What happened with this delivery?</p>
                    <button class="issue-choice-btn" onclick="openPartialForm(${o.id})">💰 Partial payment collected</button>
                    <button class="issue-choice-btn" onclick="reportCouldNotDeliver(${o.id})">❌ Could not deliver</button>

                    <div class="partial-form" id="partial-form-${o.id}">
                        <input type="number" step="0.01" min="0.01" id="partial-amount-${o.id}" placeholder="Amount actually collected (K)">
                        <button onclick="submitPartialPayment(${o.id})">Confirm Partial Payment</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Fetch and cache customer names by phone so cards can show a name instead of
// just a bare phone number. Updates each card's name element directly rather
// than re-rendering the whole list, so any already-open "Report Issue" panels
// don't get reset.
let customerNameCache = {};
async function hydrateCustomerNames() {
    const phones = [...new Set(pendingOrders.map(o => o.customer_phone).filter(Boolean))];
    const missing = phones.filter(p => !customerNameCache[p]);
    if (missing.length === 0) return;

    try {
        const { data } = await db.from('customers').select('phone_number, title, first_name, last_name').in('phone_number', missing);
        (data || []).forEach(c => {
            customerNameCache[c.phone_number] = `${c.title || ''} ${c.first_name || ''} ${c.last_name || ''}`.trim();
        });
        pendingOrders.forEach(o => {
            const el = document.getElementById(`customer-name-${o.id}`);
            if (el && customerNameCache[o.customer_phone]) el.innerText = customerNameCache[o.customer_phone];
        });
    } catch (err) {
        console.warn("Could not load customer names:", err);
    }
}

function toggleIssuePanel(orderId) {
    const panel = document.getElementById(`issue-panel-${orderId}`);
    if (panel) panel.classList.toggle('open');
}

function openPartialForm(orderId) {
    const form = document.getElementById(`partial-form-${orderId}`);
    if (form) form.classList.add('open');
}

// The happy path: one tap marks the order Delivered AND records a matching
// payment, so ops never has to separately remember to log the payment.
async function markDeliveredAndCollected(orderId) {
    const order = pendingOrders.find(o => o.id === orderId);
    if (!order) return;

    if (!confirm(`Confirm: delivered to ${order.customer_phone} and collected K ${parseFloat(order.total_amount || 0).toFixed(2)} in full?`)) return;

    try {
        const { error: statusErr } = await db.from('orders').update({ fulfillment_status: 'Delivered' }).eq('id', orderId);
        if (statusErr) throw statusErr;

        const { error: payErr } = await db.from('customer_payments').insert([{
            customer_phone: order.customer_phone,
            amount: parseFloat(order.total_amount || 0),
            payment_date: new Date().toISOString().split('T')[0],
            payment_method: order.payment_method || 'Cash on Delivery',
            note: `Auto-recorded at delivery for ${order.order_number || '#ORD-' + order.id}`
        }]);
        if (payErr) {
            console.error("Payment record failed (order was still marked Delivered):", payErr);
            alert("Delivered, but the payment record could not be saved automatically. Please tell your office admin so they can log it in the Customer Ledger.");
        }

        pendingOrders = pendingOrders.filter(o => o.id !== orderId);
        document.getElementById("pending-count").innerText = pendingOrders.length;
        renderOrders();
    } catch (err) {
        console.error("Error marking delivered:", err);
        alert("Could not update this order: " + err.message);
    }
}

// Partial payment: still delivered, but only part of the amount was
// collected. Marks Delivered and records exactly what was actually received
// — the shortfall shows up honestly in the Customer Ledger for follow-up.
async function submitPartialPayment(orderId) {
    const order = pendingOrders.find(o => o.id === orderId);
    if (!order) return;

    const input = document.getElementById(`partial-amount-${orderId}`);
    const amount = parseFloat(input.value);
    if (!amount || amount <= 0) {
        alert("Please enter the amount actually collected.");
        return;
    }
    if (amount > parseFloat(order.total_amount || 0)) {
        alert("That's more than the order total — please double-check the amount.");
        return;
    }

    try {
        const { error: statusErr } = await db.from('orders').update({ fulfillment_status: 'Delivered' }).eq('id', orderId);
        if (statusErr) throw statusErr;

        const { error: payErr } = await db.from('customer_payments').insert([{
            customer_phone: order.customer_phone,
            amount: amount,
            payment_date: new Date().toISOString().split('T')[0],
            payment_method: order.payment_method || 'Cash on Delivery',
            note: `Partial payment collected at delivery for ${order.order_number || '#ORD-' + order.id} (order total K ${parseFloat(order.total_amount || 0).toFixed(2)})`
        }]);
        if (payErr) throw payErr;

        alert(`Delivered. K ${amount.toFixed(2)} collected — remaining balance will show in this customer's ledger.`);
        pendingOrders = pendingOrders.filter(o => o.id !== orderId);
        document.getElementById("pending-count").innerText = pendingOrders.length;
        renderOrders();
    } catch (err) {
        console.error("Error recording partial payment:", err);
        alert("Could not save this: " + err.message);
    }
}

// Could-not-deliver: deliberately does NOT change the order's status or
// touch stock/payments. This is a safeguard, not a dead end — it just tells
// the driver to hand the exception to the office rather than letting the
// app guess what "failed" should mean (redeliver? cancel? reschedule?).
function reportCouldNotDeliver(orderId) {
    const order = pendingOrders.find(o => o.id === orderId);
    if (!order) return;
    alert(`Got it — this order (${order.order_number || '#ORD-' + order.id}) has NOT been changed. Please contact your office admin to decide next steps (reschedule, cancel, etc.) from the Order Fulfillment dashboard.`);
    toggleIssuePanel(orderId);
}
