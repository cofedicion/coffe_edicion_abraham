(() => {
  const cards = Array.from(document.querySelectorAll("[data-product-id]"), (card) => {
    const add = card.querySelector(".btn-add-cart");
    return {
      card,
      id: card.dataset.productId,
      add,
      addLabel: add.lastElementChild.textContent.trim(),
      icon: add.firstElementChild,
    };
  });
  const notice = document.getElementById("stockNotice");

  let soldOut = new Set();
  let loaded = false;
  let canManage = false;
  let refreshing;
  let saving;

  function showNotice(message) {
    notice.textContent = message;
    notice.hidden = !message;
  }

  function addSwitch(entry) {
    const label = document.createElement("label");
    label.className = "stock-switch";
    const caption = document.createElement("span");
    caption.textContent = "Stock";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("role", "switch");
    input.setAttribute("aria-label", `Disponibilidad de ${entry.card.dataset.productName}`);
    input.addEventListener("change", () => changeAvailability(entry.id, !input.checked));
    label.append(input, caption);
    entry.add.after(label);
    entry.control = label;
    entry.input = input;
  }

  function renderCard(entry) {
    const unavailable = soldOut.has(entry.id);
    entry.add.disabled = !loaded || unavailable;
    entry.add.lastElementChild.textContent = unavailable ? "Agotado" : entry.added ? "Agregado" : entry.addLabel;
    entry.icon.textContent = entry.added ? "check" : "add_shopping_cart";
    entry.icon.hidden = unavailable;
    entry.card.querySelectorAll(".stepper-dec, .stepper-inc").forEach((control) => {
      control.disabled = unavailable;
    });

    if (canManage && !entry.control) addSwitch(entry);
    if (!canManage && entry.control) {
      entry.control.remove();
      entry.control = null;
      entry.input = null;
    }
    if (entry.input) {
      entry.input.checked = !unavailable;
      entry.input.disabled = !loaded || Boolean(saving);
      entry.control.title = unavailable ? "Activar producto" : "Marcar como agotado";
    }
  }

  function render() {
    cards.forEach(renderCard);
  }

  function accept(data) {
    soldOut = new Set(data.soldOut);
    canManage = data.canManage === true;
    loaded = true;
    showNotice("");
    render();
    document.dispatchEvent(new Event("stockchange"));
  }

  async function request(options) {
    const response = await fetch("/api/stock", { cache: "no-store", ...options });
    if (!response.ok) throw new Error("Stock request failed");
    const data = await response.json();
    if (!Array.isArray(data.soldOut)) throw new Error("Stock response is invalid");
    return data;
  }

  function refresh() {
    if (saving) return saving.then(refresh);
    if (!refreshing) {
      refreshing = request()
        .then((data) => {
          accept(data);
          return true;
        })
        .catch(() => {
          loaded = false;
          showNotice("No pudimos consultar el stock. Recarga la página para reintentar.");
          render();
          document.dispatchEvent(new Event("stockchange"));
          return false;
        })
        .finally(() => { refreshing = null; });
    }
    return refreshing;
  }

  function changeAvailability(productId, unavailable) {
    if (!canManage || !loaded || saving) return;
    const inProgress = refreshing;
    saving = (async () => {
      try {
        await inProgress;
        const data = await request({
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId, soldOut: unavailable }),
        });
        accept(data);
      } catch {
        showNotice("No pudimos confirmar el cambio de stock. Recarga la página y vuelve a intentarlo.");
      } finally {
        saving = null;
        render();
      }
    })();
    render();
  }

  function showAdded(id) {
    const entry = cards.find((card) => card.id === id);
    clearTimeout(entry.feedbackTimer);
    entry.added = true;
    renderCard(entry);
    entry.feedbackTimer = setTimeout(() => {
      entry.added = false;
      renderCard(entry);
    }, 1200);
  }

  window.stock = {
    isLoaded: () => loaded,
    isSoldOut: (id) => soldOut.has(id),
    refresh,
    showAdded,
  };
  render();
  refresh();
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refresh();
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) refresh();
  });
})();
