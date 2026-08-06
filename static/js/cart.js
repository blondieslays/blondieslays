/* ===========================================================
   Blondie Slays — Design Cart
   Client-side cart (localStorage) for the ready-made design
   showcase cards. No live payment processing — "checkout"
   routes the selected designs into the existing Bulk/Custom
   quote form (Formspree), matching the site's manual-invoice
   workflow.
   =========================================================== */
(function () {
  var CART_KEY = "bsaCart";
  var CHECKOUT_FLAG = "bsaCartCheckoutPending";

  function getCart() {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY)) || [];
    } catch (e) {
      return [];
    }
  }
  function saveCart(cart) {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch (e) {}
    renderBadge();
    renderDrawerItems();
  }
  function cartCount(cart) {
    return (cart || getCart()).reduce(function (n, item) { return n + item.qty; }, 0);
  }

  function addToCart(item) {
    var cart = getCart();
    var existing = cart.find(function (c) { return c.slug === item.slug && c.size === item.size; });
    if (existing) {
      existing.qty += 1;
    } else {
      cart.push({ slug: item.slug, title: item.title, image: item.image, size: item.size, qty: 1 });
    }
    saveCart(cart);
  }
  function removeItem(index) {
    var cart = getCart();
    cart.splice(index, 1);
    saveCart(cart);
  }
  function changeQty(index, delta) {
    var cart = getCart();
    if (!cart[index]) return;
    cart[index].qty += delta;
    if (cart[index].qty <= 0) {
      cart.splice(index, 1);
    }
    saveCart(cart);
  }

  var badgeEl, overlayEl, drawerEl, itemsEl, countEl;

  function renderBadge() {
    if (!badgeEl) return;
    var n = cartCount();
    badgeEl.textContent = n;
    badgeEl.style.display = n > 0 ? "flex" : "none";
  }

  function renderDrawerItems() {
    if (!itemsEl) return;
    var cart = getCart();
    itemsEl.innerHTML = "";
    if (cart.length === 0) {
      itemsEl.innerHTML = '<p class="cart-drawer-empty">Your cart is empty — add a design from the shop sections to get started.</p>';
    } else {
      cart.forEach(function (item, i) {
        var row = document.createElement("div");
        row.className = "cart-item";
        row.innerHTML =
          '<img src="' + item.image + '" alt="' + item.title + '">' +
          '<div class="cart-item-info">' +
            '<p class="cart-item-title">' + item.title + '</p>' +
            '<p class="cart-item-meta">Size ' + item.size + '</p>' +
            '<div class="cart-item-row">' +
              '<button type="button" class="cart-qty-btn" data-i="' + i + '" data-d="-1">&minus;</button>' +
              '<span class="cart-qty-val">' + item.qty + '</span>' +
              '<button type="button" class="cart-qty-btn" data-i="' + i + '" data-d="1">+</button>' +
              '<button type="button" class="cart-item-remove" data-i="' + i + '">Remove</button>' +
            '</div>' +
          '</div>';
        itemsEl.appendChild(row);
      });
    }
    if (countEl) {
      var n = cartCount(cart);
      countEl.textContent = n === 0 ? "" : n + " item" + (n === 1 ? "" : "s") + " in cart";
    }
  }

  function openDrawer() {
    overlayEl.classList.add("open");
    drawerEl.classList.add("open");
  }
  function closeDrawer() {
    overlayEl.classList.remove("open");
    drawerEl.classList.remove("open");
  }
  function toggleDrawer() {
    if (drawerEl.classList.contains("open")) { closeDrawer(); } else { openDrawer(); }
  }

  function buildDrawer() {
    overlayEl = document.createElement("div");
    overlayEl.id = "cart-overlay";
    overlayEl.addEventListener("click", closeDrawer);

    drawerEl = document.createElement("div");
    drawerEl.id = "cart-drawer";
    drawerEl.innerHTML =
      '<div class="cart-drawer-header">' +
        '<h3>Your Cart</h3>' +
        '<button type="button" class="cart-drawer-close" aria-label="Close cart">&times;</button>' +
      '</div>' +
      '<div class="cart-drawer-items" id="cart-drawer-items"></div>' +
      '<div class="cart-drawer-footer">' +
        '<p class="cart-drawer-count" id="cart-drawer-count"></p>' +
        '<button type="button" class="cart-checkout-btn" id="cart-checkout-btn">Send Order Request</button>' +
        '<p class="cart-checkout-note">No live checkout yet — this sends your picks straight into a quote request. Elise will follow up with a secure PayPal invoice.</p>' +
      '</div>';

    document.body.appendChild(overlayEl);
    document.body.appendChild(drawerEl);

    itemsEl = document.getElementById("cart-drawer-items");
    countEl = document.getElementById("cart-drawer-count");

    drawerEl.querySelector(".cart-drawer-close").addEventListener("click", closeDrawer);
    document.getElementById("cart-checkout-btn").addEventListener("click", checkout);

    itemsEl.addEventListener("click", function (e) {
      var qtyBtn = e.target.closest(".cart-qty-btn");
      if (qtyBtn) {
        changeQty(parseInt(qtyBtn.dataset.i, 10), parseInt(qtyBtn.dataset.d, 10));
        return;
      }
      var rmBtn = e.target.closest(".cart-item-remove");
      if (rmBtn) {
        removeItem(parseInt(rmBtn.dataset.i, 10));
      }
    });

    renderDrawerItems();
  }

  function injectNavIcon() {
    var nav = document.querySelector("ul.navbar-nav.ms-auto, nav .navbar-nav, nav ul.navbar-nav");
    if (!nav) nav = document.querySelector("nav");
    if (!nav) return;

    var btn = document.createElement("a");
    btn.id = "cart-nav-btn";
    btn.href = "#";
    btn.setAttribute("aria-label", "View cart");
    btn.innerHTML = '<span class="cart-icon">&#128717;</span><span class="cart-badge" id="cart-badge" style="display:none;">0</span>';
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      toggleDrawer();
    });
    nav.appendChild(btn);
    badgeEl = document.getElementById("cart-badge");
    renderBadge();
  }

  function cartSummaryText() {
    var cart = getCart();
    if (cart.length === 0) return "";
    var lines = cart.map(function (item) {
      return "- " + item.title + " (Size " + item.size + ") x" + item.qty;
    });
    return "From the design shop cart:\n" + lines.join("\n") + "\n\n";
  }

  function fillQuoteFormIfPresent() {
    var textarea = document.getElementById("to-design") || document.getElementById("bk-design");
    if (!textarea) return false;
    var summary = cartSummaryText();
    if (!summary) return false;
    if (textarea.value.indexOf("From the design shop cart:") === -1) {
      textarea.value = summary + textarea.value;
    }
    var anchor = document.getElementById("team-order") || document.getElementById("custom-order");
    if (anchor) anchor.scrollIntoView({ behavior: "smooth", block: "start" });
    textarea.focus();
    return true;
  }

  function checkout() {
    if (getCart().length === 0) return;
    var filled = fillQuoteFormIfPresent();
    if (filled) {
      closeDrawer();
      return;
    }
    try { sessionStorage.setItem(CHECKOUT_FLAG, "1"); } catch (e) {}
    window.location.href = "/team-orders/#team-order";
  }

  function checkPendingCheckout() {
    var pending = false;
    try { pending = sessionStorage.getItem(CHECKOUT_FLAG) === "1"; } catch (e) {}
    if (!pending) return;
    if (fillQuoteFormIfPresent()) {
      try { sessionStorage.removeItem(CHECKOUT_FLAG); } catch (e) {}
    }
  }

  function wireDesignCards() {
    document.addEventListener("click", function (e) {
      var toggleBtn = e.target.closest(".design-toggle-btn");
      if (toggleBtn) {
        var wrap = toggleBtn.closest(".design-card-image-wrap");
        var img = wrap.querySelector(".design-card-img");
        var showingBack = img.dataset.showingBack === "1";
        if (showingBack) {
          img.src = img.dataset.front;
          img.dataset.showingBack = "0";
          toggleBtn.innerHTML = "&#8635; View Back";
        } else {
          img.src = img.dataset.back;
          img.dataset.showingBack = "1";
          toggleBtn.innerHTML = "&#8635; View Front";
        }
        return;
      }

      var addBtn = e.target.closest(".design-add-btn");
      if (addBtn) {
        var card = addBtn.closest(".design-card");
        var sizeSelect = card.querySelector(".design-size-select");
        addToCart({
          slug: addBtn.dataset.slug,
          title: addBtn.dataset.title,
          image: addBtn.dataset.image,
          size: sizeSelect ? sizeSelect.value : "M"
        });
        var original = addBtn.textContent;
        addBtn.textContent = "Added! ✓";
        addBtn.classList.add("added");
        setTimeout(function () {
          addBtn.textContent = original;
          addBtn.classList.remove("added");
        }, 1100);
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    buildDrawer();
    injectNavIcon();
    wireDesignCards();
    checkPendingCheckout();
  });

  window.BSACart = { addToCart: addToCart, openDrawer: openDrawer, toggleDrawer: toggleDrawer, getCart: getCart };
})();
