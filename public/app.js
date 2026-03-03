const state = {
  items: [],
  filteredCategory: 'All',
  search: '',
  cart: new Map(),
};

const ui = {
  tabs: document.querySelectorAll('.tab-btn'),
  contents: document.querySelectorAll('.tab-content'),
  itemGrid: document.getElementById('itemGrid'),
  categoryFilters: document.getElementById('categoryFilters'),
  searchInput: document.getElementById('searchInput'),
  clearCartBtn: document.getElementById('clearCartBtn'),
  cartList: document.getElementById('cartList'),
  cartTotal: document.getElementById('cartTotal'),
  checkoutBtn: document.getElementById('checkoutBtn'),
  checkoutMessage: document.getElementById('checkoutMessage'),
  adminMessage: document.getElementById('adminMessage'),
  manualForm: document.getElementById('manualForm'),
  csvForm: document.getElementById('csvForm'),
  sheetForm: document.getElementById('sheetForm'),
};

const currency = (amount) => `$${amount.toFixed(2)}`;

const showMessage = (el, text, timeout = 3000) => {
  el.textContent = text;
  if (timeout) {
    window.setTimeout(() => {
      if (el.textContent === text) {
        el.textContent = '';
      }
    }, timeout);
  }
};

const loadItems = async () => {
  const response = await fetch('/api/items');
  state.items = await response.json();
  renderCategories();
  renderItems();
};

const getVisibleItems = () => {
  return state.items.filter((item) => {
    const inCategory = state.filteredCategory === 'All' || item.category === state.filteredCategory;
    const query = state.search.toLowerCase();
    const matchesSearch = !query || item.name.toLowerCase().includes(query) || item.barcode.toLowerCase().includes(query);
    return inCategory && matchesSearch;
  });
};

const renderCategories = () => {
  const categories = ['All', ...new Set(state.items.map((item) => item.category || 'General'))];
  ui.categoryFilters.innerHTML = '';

  categories.forEach((category) => {
    const btn = document.createElement('button');
    btn.className = `chip ${state.filteredCategory === category ? 'active' : ''}`;
    btn.textContent = category;
    btn.addEventListener('click', () => {
      state.filteredCategory = category;
      renderCategories();
      renderItems();
    });
    ui.categoryFilters.appendChild(btn);
  });
};

const addToCart = (item) => {
  const existing = state.cart.get(item.id);
  state.cart.set(item.id, {
    ...item,
    qty: existing ? existing.qty + 1 : 1,
  });
  renderCart();
};

const renderItems = () => {
  const items = getVisibleItems();
  ui.itemGrid.innerHTML = '';

  if (!items.length) {
    ui.itemGrid.innerHTML = '<p>No items match this filter.</p>';
    return;
  }

  items.forEach((item) => {
    const btn = document.createElement('button');
    btn.className = 'item-btn';
    btn.innerHTML = `${item.name}<span class="price">${currency(item.price)}</span><small>${item.category}</small>`;
    btn.addEventListener('click', () => addToCart(item));
    ui.itemGrid.appendChild(btn);
  });
};

const changeQty = (id, delta) => {
  const item = state.cart.get(id);
  if (!item) {
    return;
  }
  const nextQty = item.qty + delta;
  if (nextQty <= 0) {
    state.cart.delete(id);
  } else {
    state.cart.set(id, { ...item, qty: nextQty });
  }
  renderCart();
};

const renderCart = () => {
  ui.cartList.innerHTML = '';
  let total = 0;

  state.cart.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'cart-item';
    total += item.qty * item.price;

    row.innerHTML = `
      <div>
        <strong>${item.name}</strong>
        <div>${currency(item.price)} each</div>
      </div>
      <div class="qty-controls">
        <button type="button" data-action="minus">-</button>
        <span>${item.qty}</span>
        <button type="button" data-action="plus">+</button>
      </div>
    `;

    row.querySelector('[data-action="minus"]').addEventListener('click', () => changeQty(item.id, -1));
    row.querySelector('[data-action="plus"]').addEventListener('click', () => changeQty(item.id, 1));

    ui.cartList.appendChild(row);
  });

  ui.cartTotal.textContent = currency(total);
};

const setupTabs = () => {
  ui.tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      ui.tabs.forEach((btn) => btn.classList.remove('active'));
      ui.contents.forEach((content) => content.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
    });
  });
};

const setupForms = () => {
  ui.manualForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(ui.manualForm);
    const payload = Object.fromEntries(formData.entries());

    const response = await fetch('/api/items/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      showMessage(ui.adminMessage, data.error || 'Manual upload failed');
      return;
    }

    ui.manualForm.reset();
    showMessage(ui.adminMessage, `Added ${data.name}`);
    await loadItems();
  });

  ui.csvForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const file = ui.csvForm.elements.csvFile.files[0];
    if (!file) {
      showMessage(ui.adminMessage, 'Please select a CSV file first.');
      return;
    }

    const csv = await file.text();
    const response = await fetch('/api/items/csv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv }),
    });
    const data = await response.json();

    if (!response.ok) {
      showMessage(ui.adminMessage, data.error || 'CSV upload failed');
      return;
    }

    ui.csvForm.reset();
    showMessage(ui.adminMessage, `CSV uploaded. Added ${data.added} item(s).`);
    await loadItems();
  });

  ui.sheetForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const sheetUrl = new FormData(ui.sheetForm).get('sheetUrl');

    const response = await fetch('/api/items/sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: sheetUrl }),
    });

    const data = await response.json();
    if (!response.ok) {
      showMessage(ui.adminMessage, data.error || 'Sheet sync failed');
      return;
    }

    showMessage(ui.adminMessage, `Google Sheet synced. Added ${data.added} item(s).`);
    ui.sheetForm.reset();
    await loadItems();
  });
};

const setupActions = () => {
  ui.searchInput.addEventListener('input', (event) => {
    state.search = event.target.value;
    renderItems();
  });

  ui.clearCartBtn.addEventListener('click', () => {
    state.cart.clear();
    renderCart();
  });

  ui.checkoutBtn.addEventListener('click', () => {
    if (!state.cart.size) {
      showMessage(ui.checkoutMessage, 'Cart is empty.');
      return;
    }

    state.cart.clear();
    renderCart();
    showMessage(ui.checkoutMessage, 'Checkout complete. Ready for next customer!');
  });
};

const init = async () => {
  setupTabs();
  setupForms();
  setupActions();
  await loadItems();
};

init();
